import io, os, tempfile, base64, asyncio, time
from typing import Optional, List
import numpy as np
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import tempfile, os
from batch_face import RetinaFace
import tensorflow as tf
from tensorflow.keras.preprocessing.image import img_to_array
from scipy import stats
from face_analyze.functions.utils import preprocess_input as vggface_preprocess
from face_analyze.functions.get_models import EE_D7, load_weights_EE, load_weights_EE_D7, load_full_EE, load_weights_LSTM, load_weights_LSTM_D7
from face_analyze.functions.sequences import sequences as emonet_sequences
from face_analyze.functions.get_face_areas import VideoCamera
from fastapi import FastAPI, File, UploadFile, HTTPException, Request, WebSocket, WebSocketDisconnect, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, Field
import cv2
import asyncio

from .face_analyze import CombinedFaceAnalyzer, visualize_plt

#start (after build docker)
import requests
TF_EMOTION_URL = os.getenv("TF_EMOTION_URL", "http://api_tf:8000/predict-emotion")
EMO_LABELS = ["Anger", "Disgust", "Fear", "Happiness", "Neutral", "Sadness", "Surprise"]

# Emo-Net config
_HERE = os.path.dirname(os.path.abspath(__file__))
EMONET_FE_PATH        = os.getenv("EMONET_FE_PATH",        os.path.join(_HERE, "phase2_best.h5"))
EMONET_DENSE7_PATH    = os.getenv("EMONET_DENSE7_PATH",    os.path.join(_HERE, "weights_0_66_49_wo_gl.h5"))
EMONET_LSTM_PATH      = os.getenv("EMONET_LSTM_PATH",      os.path.join(_HERE, "lstm_p3_best.h5"))
EMONET_DENSE7_LSTM_PATH = os.getenv("EMONET_DENSE7_LSTM_PATH", os.path.join(_HERE, "SAVEE_with_config.h5"))
EMONET_LABELS    = ['Happiness', 'Sadness', 'Surprise', 'Fear', 'Disgust', 'Anger']
EMONET_LABELS_D7 = ['Happiness', 'Sadness', 'Surprise', 'Fear', 'Disgust', 'Anger', 'Neutral']

_emonet_image_model    = None  # EE_D7 full model (Dense 7) for single image
_emonet_image_d6_model = None  # EE full model (Dense 6) for basic mode video/webcam
_emonet_ee_model       = None  # EE (Dense 6) backbone for fine tune LSTM
_emonet_ee_d7_model    = None  # EE_D7 backbone for Dense 7 LSTM
_emonet_lstm_model     = None  # fine tune LSTM (lstm_p3_best.h5)
_emonet_lstm_d7_model  = None  # Dense 7 LSTM (SAVEE_with_config.h5)
_emonet_detector       = None  # RetinaFace

# Per-session webcam LSTM buffer: {session_id: {features, new_count, seq_idx, last_access}}
webcam_lstm_sessions: dict = {}
WEBCAM_SESSION_TTL = 600  # seconds

def _load_dense7_emonet(path: str):
    model = EE_D7()
    model.load_weights(path)
    return model

def _estimate_pose_from_landmarks(landmarks):
    """Estimate head pose label and pan angle from 5-point RetinaFace landmarks.
    Landmark order: [eye0, eye1, nose, mouth0, mouth1]
    """
    try:
        pts = np.array(landmarks)
        eye0_x, eye1_x = float(pts[0][0]), float(pts[1][0])
        nose_x = float(pts[2][0])
        eye_span = abs(eye1_x - eye0_x)
        if eye_span < 1:
            return "N/A", 0.0
        # Positive ratio → nose shifts toward eye1 side (face turns that way)
        pan_ratio = (nose_x - (eye0_x + eye1_x) / 2.0) / eye_span
        pan_deg = float(np.round(pan_ratio * 90.0, 1))
        if abs(pan_deg) < 15:
            pose = "Front"
        elif pan_deg > 0:
            pose = "Right"
        else:
            pose = "Left"
        return pose, pan_deg
    except Exception:
        return "N/A", 0.0

def infer_emotion_from_tf(face_bgr: np.ndarray):
    ok, jpg = cv2.imencode(".jpg", face_bgr)
    if not ok:
        return None

    try:
        r = requests.post(
            TF_EMOTION_URL,
            files={"file": ("face.jpg", jpg.tobytes(), "image/jpeg")},
            timeout=10
        )
        r.raise_for_status()
        return r.json()  # {"emotion": <int>, "scores": [...]}
    except Exception:
        return None

def _infer_emotion_emonet(face_bgr: np.ndarray):
    """Fallback emotion inference using the local Emo-Net Dense7 model."""
    if _emonet_image_model is None or face_bgr is None or face_bgr.size == 0:
        return None
    try:
        face_rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
        face_resized = cv2.resize(face_rgb, (224, 224), interpolation=cv2.INTER_AREA)
        face_arr = vggface_preprocess(img_to_array(face_resized), version=2)
        pred = _emonet_image_model.predict(face_arr[np.newaxis], verbose=0)[0]
        emotion_idx = int(np.argmax(pred))
        return {"emotion": EMONET_LABELS_D7[emotion_idx], "confidence": float(pred[emotion_idx])}
    except Exception:
        return None
#end

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Face Pose & Emotion API", version="2.0.0")

# API Key auth — set API_KEY env var to enable; leave empty to disable (local dev)
_API_KEY = os.getenv("API_KEY", "")

@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    if _API_KEY:
        skip_paths = {"/health", "/docs", "/openapi.json"}
        if request.url.path not in skip_paths:
            if request.headers.get("x-api-key") != _API_KEY:
                return JSONResponse(status_code=401, content={"detail": "Invalid or missing API key"})
    return await call_next(request)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS แบบยืดหยุน (กำหนดใน environment)
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "GET", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


MAX_FILE_SIZE = 10 * 1024 * 1024        # 10MB for images 
MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024  # 50MB for videos
ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
IMAGE_MAX_SIZE = 3000   # px — max for both width and height
IMAGE_MIN_SIZE = 60    # px — min for both width and height
MAX_VIDEO_RESOLUTION = (1280, 720)   # max width × height
MIN_VIDEO_RESOLUTION = (320, 240)    # min width × height

def _check_video_resolution(video_path: str) -> None:
    """Reject videos outside the allowed resolution range."""
    cap = cv2.VideoCapture(video_path)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    min_w, min_h = MIN_VIDEO_RESOLUTION
    max_w, max_h = MAX_VIDEO_RESOLUTION
    if w < min_w or h < min_h:
        raise HTTPException(
            status_code=400,
            detail=f"Video resolution too small. Minimum is {min_w}×{min_h} (got {w}×{h})."
        )
    if w > max_w or h > max_h:
        raise HTTPException(
            status_code=413,
            detail=f"Video resolution too large. Maximum is {max_w}×{max_h} (got {w}×{h})."
        )

def _check_image_size(img: Image.Image) -> None:
    """Reject images outside the allowed dimension range."""
    w, h = img.size
    if w < IMAGE_MIN_SIZE or h < IMAGE_MIN_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Image too small. Minimum size is {IMAGE_MIN_SIZE}×{IMAGE_MIN_SIZE} px (got {w}×{h})."
        )
    if w > IMAGE_MAX_SIZE or h > IMAGE_MAX_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large. Maximum size is {IMAGE_MAX_SIZE}×{IMAGE_MAX_SIZE} px (got {w}×{h})."
        )

_analyzer = None
_startup_error = None

@app.on_event("startup")
async def startup_event():
    global _analyzer, _startup_error
    global _emonet_image_model, _emonet_image_d6_model, _emonet_ee_model, _emonet_ee_d7_model, _emonet_lstm_model, _emonet_lstm_d7_model, _emonet_detector
    try:
        _analyzer = CombinedFaceAnalyzer(staticMode=True, maxFaces=5, use_emotions=True)
    except Exception as e:
        _startup_error = str(e)
        print(f"Analyzer initialization failed: {e}")
    import traceback
    print(f"[Emo-Net] FE path: {EMONET_FE_PATH} — exists: {os.path.exists(EMONET_FE_PATH)}")
    print(f"[Emo-Net] Dense7 path: {EMONET_DENSE7_PATH} — exists: {os.path.exists(EMONET_DENSE7_PATH)}")
    print(f"[Emo-Net] Fine tune LSTM path: {EMONET_LSTM_PATH} — exists: {os.path.exists(EMONET_LSTM_PATH)}")
    print(f"[Emo-Net] Dense7 LSTM path: {EMONET_DENSE7_LSTM_PATH} — exists: {os.path.exists(EMONET_DENSE7_LSTM_PATH)}")
    try:
        _emonet_image_model   = _load_dense7_emonet(EMONET_DENSE7_PATH)
        _emonet_image_d6_model = load_full_EE(EMONET_FE_PATH)
        _emonet_ee_model      = load_weights_EE(EMONET_FE_PATH)
        _emonet_ee_d7_model   = load_weights_EE_D7(EMONET_DENSE7_PATH)
        _emonet_lstm_model    = load_weights_LSTM(EMONET_LSTM_PATH)
        _emonet_lstm_d7_model = load_weights_LSTM_D7(EMONET_DENSE7_LSTM_PATH)
        _emonet_detector      = RetinaFace(gpu_id=-1)
        print("[Emo-Net] All models loaded successfully")
    except Exception as e:
        print(f"[Emo-Net] Loading failed: {e}")
        traceback.print_exc()

@app.get("/health")
async def health():
    return {
        "status": "healthy" if _analyzer and not _startup_error else "error",
        "model_loaded": bool(_analyzer and _analyzer.use_emotions),
        "error": _startup_error,
        "rate_limit": "20/minute"
    }

class AnalysisResponse(BaseModel):
    prediction: str
    confidence: float
    filename: str
    faces: list
    face_count: int
    image_width: int
    image_height: int
    preview_base64: Optional[str] = None
    preview_mime: Optional[str] = None
    sequences: Optional[list] = None

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print(" WebSocket connected")
    analyzer = CombinedFaceAnalyzer(maxFaces=5, use_emotions=True)

    try:
        while True:
            data = await websocket.receive_text()
            if not data:
                continue

            # แปลง Base64 -> OpenCV image
            header, encoded = data.split(",", 1)
            img_bytes = base64.b64decode(encoded)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            # วิเคราะห์
            (result_img, landmarks_list, angle_R_list, angle_L_list,
            pose_list, pan_list, emotions_list, conf_list, faces_info) = analyzer.analyze_face(frame, draw=False)

            # ส่งผลลัพธ์กลับ
            result = {
                "faces": faces_info,
                "face_count": len(faces_info),
            }

            await websocket.send_json(result)
            await asyncio.sleep(0.05)  # ปรับความถี่เล็กน้อย

    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        print(f"Error in WebSocket: {e}")
        await websocket.close()

@app.post("/predict-image/", response_model=AnalysisResponse)
@limiter.limit("300/minute")  # จำกัด 20 requests/นาที/IP (15*request per minuten)
async def predict_image(
    request: Request,
    file: UploadFile = File(...), 
    preview: bool = True
):
    # Validation
    if not file.content_type or file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_TYPES)}"
        )
    
    if _analyzer is None:
        raise HTTPException(
            status_code=503, 
            detail=f"Service unavailable: {_startup_error or 'Model not loaded'}"
        )

    try:
        # อ่านไฟล์ + ตรวจขนาด
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_FILE_SIZE//1024//1024}MB")

        # ประมวลผลรูป
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        _check_image_size(image)
        image_np = np.array(image)
        image_bgr = image_np[:, :, ::-1].copy()

        # วิเคราะห์ใบหน้า (ใช้ asyncio เพื่อไม่บล็อก event loop)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, 
            _analyzer.analyze_face, 
            image_bgr, 
            False
        )
        
        (result_img, landmarks_list, angle_R_list, angle_L_list,
        pose_list, pan_list, emotions_list, conf_list, faces_info) = result

        # สร้างข้อมูล faces
        faces = []

        for f in faces_info:
            box = f.get("box")
            if not box:
                continue

            x0 = max(int(box["x"]), 0)
            y0 = max(int(box["y"]), 0)
            x1 = min(int(box["x"] + box["w"]), image_bgr.shape[1])
            y1 = min(int(box["y"] + box["h"]), image_bgr.shape[0])

            face_crop = image_bgr[y0:y1, x0:x1]

            emo = "N/A"
            conf = 0.0
            if face_crop.size > 0:
                tf_res = infer_emotion_from_tf(face_crop)
                if tf_res:
                    emo_id = tf_res.get("emotion")
                    scores = tf_res.get("scores") or []
                    if scores and isinstance(scores, list) and len(scores) == 1 and isinstance(scores[0], list):
                        scores = scores[0]
                    if isinstance(emo_id, int) and 0 <= emo_id < len(EMO_LABELS):
                        emo = EMO_LABELS[emo_id]
                    if scores:
                        conf = float(max(scores))
                else:
                    emo_res = _infer_emotion_emonet(face_crop)
                    if emo_res:
                        emo = emo_res["emotion"]
                        conf = emo_res["confidence"]

            f["emotion"] = emo
            f["confidence"] = conf

            faces.append({
                "pose": f.get("pose"),
                "pan": float(np.round(f.get("pan", 0.0), 1)),
                "emotion": emo,
                "confidence": conf,
                "box": box
            })


        first_emotion = faces[0]["emotion"] if faces else "No Face Detected"
        first_conf = faces[0]["confidence"] if faces else 0.0

        resp = {
            "prediction": first_emotion,
            "confidence": first_conf,
            "filename": file.filename or "unknown",
            "faces": faces,
            "face_count": len(faces),
            "image_width": image_np.shape[1],
            "image_height": image_np.shape[0]
        }
                
        # ทำให้ emotions_list ตรงกับผลสุดท้ายจาก TF
        if len(emotions_list) == len(faces):
            emotions_list = [f["emotion"] for f in faces]

        # สร้าง preview
        if preview and faces:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                out_path = visualize_plt(
                    image_bgr, landmarks_list, angle_R_list, angle_L_list,
                    pose_list, emotions_list, pan_list, save_path=tmp.name, show=False
                )
            with open(out_path, "rb") as f:
                resp["preview_base64"] = base64.b64encode(f.read()).decode("utf-8")
                resp["preview_mime"] = "image/jpeg"
            os.unlink(out_path)

        return resp

    except Image.UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="Cannot identify image file")
    except Exception as e:
        print(f"Processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    finally:
        await file.close()


from fastapi import File, UploadFile, HTTPException
import tempfile, os
import cv2
import asyncio

@app.post("/predict-video/", response_model=AnalysisResponse)
async def predict_video(
    request: Request,
    file: UploadFile = File(...),
    preview: bool = True,
    every_n: int = 5,
):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Invalid video type")

    contents = await file.read()
    if len(contents) > MAX_VIDEO_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_VIDEO_FILE_SIZE // 1024 // 1024}MB")

    suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(contents)
        video_path = tmp.name

    _check_video_resolution(video_path)

    try:
        if _analyzer is None:
            raise HTTPException(status_code=503, detail="Analyzer not ready")

        cap = cv2.VideoCapture(video_path)
        picked_frame = None
        picked_meta = None
        idx = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            idx += 1
            if idx % every_n != 0:
                continue

            result = _analyzer.analyze_face(frame, draw=False)
            (
                _, landmarks_list, angle_R_list, angle_L_list,
                pose_list, pan_list, emotions_list, conf_list, faces_info
            ) = result

            if faces_info:
                picked_frame = frame
                picked_meta = result
                break

        cap.release()

        if picked_frame is None:
            return {
                "prediction": "No Face Detected",
                "confidence": 0.0,
                "filename": file.filename,
                "faces": [],
                "face_count": 0,
                "image_width": 0,
                "image_height": 0,
            }

        (
            _, landmarks_list, angle_R_list, angle_L_list,
            pose_list, pan_list, emotions_list, conf_list, faces_info
        ) = picked_meta

        h, w, _ = picked_frame.shape
        faces = []

        for f in faces_info:
            box = f["box"]
            x0, y0 = box["x"], box["y"]
            x1, y1 = x0 + box["w"], y0 + box["h"]
            face_crop = picked_frame[y0:y1, x0:x1]

            emo, conf = "N/A", 0.0
            tf_res = infer_emotion_from_tf(face_crop)
            if tf_res:
                emo_id = tf_res.get("emotion")
                scores = tf_res.get("scores") or []
                if 0 <= emo_id < len(EMO_LABELS):
                    emo = EMO_LABELS[emo_id]
                conf = float(max(scores)) if scores else 0.0
            else:
                emo_res = _infer_emotion_emonet(face_crop)
                if emo_res:
                    emo = emo_res["emotion"]
                    conf = emo_res["confidence"]

            faces.append({
                "pose": f["pose"],
                "pan": float(np.round(f["pan"], 1)),
                "emotion": emo,
                "confidence": conf,
                "box": box
            })

        resp = {
            "prediction": faces[0]["emotion"],
            "confidence": faces[0]["confidence"],
            "filename": file.filename,
            "faces": faces,
            "face_count": len(faces),
            "image_width": w,
            "image_height": h,
        }

        if preview:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmpimg:
                out = visualize_plt(
                    picked_frame,
                    landmarks_list,
                    angle_R_list,
                    angle_L_list,
                    pose_list,
                    [f["emotion"] for f in faces],
                    pan_list,
                    save_path=tmpimg.name,
                    show=False,
                )
            with open(out, "rb") as f:
                resp["preview_base64"] = base64.b64encode(f.read()).decode()
                resp["preview_mime"] = "image/jpeg"
            os.unlink(out)

        return resp

    finally:
        os.unlink(video_path)




@app.post("/predict-image-emonet/", response_model=AnalysisResponse)
async def predict_image_emonet(
    request: Request,
    file: UploadFile = File(...),
    preview: bool = True,
    model: str = Query('dense7'),
):
    if not file.content_type or file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_TYPES)}")
    image_model  = _emonet_image_d6_model if model == 'dense6' else _emonet_image_model
    image_labels = EMONET_LABELS          if model == 'dense6' else EMONET_LABELS_D7
    if image_model is None or _emonet_detector is None:
        raise HTTPException(status_code=503, detail="Emo-Net model not loaded")

    try:
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_FILE_SIZE//1024//1024}MB")

        image = Image.open(io.BytesIO(contents)).convert("RGB")
        _check_image_size(image)
        image_np = np.array(image)
        image_bgr = image_np[:, :, ::-1].copy()

        raw_faces = _emonet_detector(image_bgr, cv=False)

        # Collect valid faces first, then batch predict in one call
        valid_faces = []
        for box, landmarks, prob in raw_faces:
            if prob < 0.7:
                continue
            x0, y0 = max(0, int(box[0])), max(0, int(box[1]))
            x1, y1 = min(image_bgr.shape[1] - 1, int(box[2])), min(image_bgr.shape[0] - 1, int(box[3]))
            face_crop = image_bgr[y0:y1, x0:x1]
            if face_crop.size == 0:
                continue
            face_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
            face_resized = cv2.resize(face_rgb, (224, 224), interpolation=cv2.INTER_AREA)
            face_arr = vggface_preprocess(img_to_array(face_resized), version=2)
            pose_val, pan_val = _estimate_pose_from_landmarks(landmarks)
            valid_faces.append((face_arr, pose_val, pan_val, x0, y0, x1, y1))

        faces = []
        if valid_faces:
            # Single batch predict for all faces at once
            batch = np.stack([f[0] for f in valid_faces], axis=0)
            preds = image_model.predict(batch, verbose=0)
            for pred, (_, pose_val, pan_val, x0, y0, x1, y1) in zip(preds, valid_faces):
                emotion_idx = int(np.argmax(pred))
                face_entry: dict = {
                    "emotion": image_labels[emotion_idx],
                    "confidence": float(pred[emotion_idx]),
                    "pose": pose_val,
                    "pan": pan_val,
                    "box": {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0},
                }
                face_crop = image_bgr[y0:y1, x0:x1]
                if face_crop.size > 0:
                    _tc_h, _tc_w = face_crop.shape[:2]; _tc_scale = max(1.0, 128 / min(_tc_h, _tc_w)); _tc_thumb = cv2.resize(face_crop, (max(1, int(_tc_w * _tc_scale)), max(1, int(_tc_h * _tc_scale))), interpolation=cv2.INTER_CUBIC); ok_t, jpg_t = cv2.imencode('.jpg', _tc_thumb, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    if ok_t:
                        face_entry["face_thumb_base64"] = base64.b64encode(jpg_t.tobytes()).decode()
                faces.append(face_entry)

        first_emotion = faces[0]["emotion"] if faces else "No Face Detected"
        first_conf = faces[0]["confidence"] if faces else 0.0

        resp = {
            "prediction": first_emotion,
            "confidence": first_conf,
            "filename": file.filename or "unknown",
            "faces": faces,
            "face_count": len(faces),
            "image_width": image_np.shape[1],
            "image_height": image_np.shape[0],
        }

        if preview and faces:
            emotions_list = [f["emotion"] for f in faces]
            landmarks_dummy = [[[f["box"]["x"], f["box"]["y"]]] for f in faces]
            angle_dummy = [0.0 for _ in faces]
            pan_list = [f.get("pan", 0.0) for f in faces]
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                out_path = visualize_plt(
                    image_bgr, landmarks_dummy, angle_dummy, angle_dummy,
                    ["N/A"] * len(faces), emotions_list, pan_list,
                    save_path=tmp.name, show=False
                )
            with open(out_path, "rb") as f:
                resp["preview_base64"] = base64.b64encode(f.read()).decode("utf-8")
                resp["preview_mime"] = "image/jpeg"
            os.unlink(out_path)

        return resp

    except Image.UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="Cannot identify image file")
    except Exception as e:
        print(f"Emo-Net image processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    finally:
        await file.close()


@app.post("/predict-webcam-emonet/", response_model=AnalysisResponse)
async def predict_webcam_emonet(
    request: Request,
    files: List[UploadFile] = File(...),
    preview: bool = True,
):
    if _emonet_ee_model is None or _emonet_lstm_model is None:
        raise HTTPException(status_code=503, detail="Emo-Net model not loaded")

    face_areas = []
    rep_frame = None
    rep_box = None
    rep_landmarks = None

    for f in files:
        data = await f.read()
        nparr = np.frombuffer(data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            continue
        if _emonet_detector is not None:
            try:
                faces_det = _emonet_detector(frame, cv=True)
                if faces_det:
                    box, landmarks, prob = faces_det[0]
                    if prob > 0.5:
                        fh, fw = frame.shape[:2]
                        x0, y0 = max(0, int(box[0])), max(0, int(box[1]))
                        x1, y1 = min(fw, int(box[2])), min(fh, int(box[3]))
                        face_crop = frame[y0:y1, x0:x1]
                        face_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
                        face_resized = cv2.resize(face_rgb, (224, 224), interpolation=cv2.INTER_AREA)
                        face_arr = img_to_array(face_resized)
                        face_arr = vggface_preprocess(face_arr, version=2)
                        face_areas.append(face_arr)
                        if rep_frame is None:
                            rep_frame = frame
                            rep_box = {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}
                            rep_landmarks = landmarks
            except Exception:
                pass

    if not face_areas:
        return {
            "prediction": "No Face Detected",
            "confidence": 0.0,
            "filename": "webcam",
            "faces": [],
            "face_count": 0,
            "image_width": 0,
            "image_height": 0,
        }

    # Pad or trim to exactly 10 frames
    while len(face_areas) < 10:
        face_areas.append(face_areas[-1])
    face_areas = face_areas[:10]

    features = tf.concat([_emonet_ee_model(np.array([fa])) for fa in face_areas], axis=0)
    seq_features = [features.numpy().tolist()]
    pred = _emonet_lstm_model(np.array(seq_features)).numpy()
    emo_idx = int(np.argmax(pred[0]))
    emotion = EMONET_LABELS[emo_idx]
    confidence = float(pred[0][emo_idx])

    pose_info, pan_info = _estimate_pose_from_landmarks(rep_landmarks) if rep_landmarks is not None else ("N/A", 0.0)
    img_w, img_h = (rep_frame.shape[1], rep_frame.shape[0]) if rep_frame is not None else (0, 0)
    landmarks_list, angle_R_list, angle_L_list, pose_list, pan_list = [], [], [], [], []

    faces = [{"emotion": emotion, "confidence": confidence, "pose": pose_info, "pan": pan_info, "box": rep_box}]
    resp = {
        "prediction": emotion,
        "confidence": confidence,
        "filename": "webcam",
        "faces": faces,
        "face_count": 1,
        "image_width": img_w,
        "image_height": img_h,
    }

    if preview and rep_frame is not None:
        try:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                out = visualize_plt(
                    rep_frame, landmarks_list, angle_R_list, angle_L_list,
                    pose_list, [emotion], pan_list, save_path=tmp.name, show=False,
                )
            with open(out, "rb") as f:
                resp["preview_base64"] = base64.b64encode(f.read()).decode()
                resp["preview_mime"] = "image/jpeg"
            os.unlink(out)
        except Exception:
            pass

    return resp


@app.post("/predict-webcam-emonet/lstm/")
async def predict_webcam_emonet_lstm(
    request: Request,
    file: UploadFile = File(...),
    session_id: str = Form(...),
    model: str = Form('finetune'),
):
    ee_model   = _emonet_ee_d7_model  if model == 'dense7' else _emonet_ee_model
    lstm_model = _emonet_lstm_d7_model if model == 'dense7' else _emonet_lstm_model
    labels     = EMONET_LABELS_D7     if model == 'dense7' else EMONET_LABELS
    if ee_model is None or lstm_model is None or _emonet_detector is None:
        raise HTTPException(status_code=503, detail="Emo-Net model not loaded")

    WIN = 10
    STEP = 3

    # Init or retrieve session
    now = time.time()
    if session_id not in webcam_lstm_sessions:
        webcam_lstm_sessions[session_id] = {'last_access': now, 'face_sessions': {}}
    session = webcam_lstm_sessions[session_id]
    session['last_access'] = now

    # Expire old sessions
    expired = [sid for sid, s in list(webcam_lstm_sessions.items()) if now - s['last_access'] > WEBCAM_SESSION_TTL]
    for sid in expired:
        webcam_lstm_sessions.pop(sid, None)

    # Decode frame
    data = await file.read()
    nparr = np.frombuffer(data, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        return {'ready': False}

    fh, fw = frame.shape[:2]

    try:
        faces_det = _emonet_detector(frame, cv=False)
        valid_faces = [(b, l, p) for b, l, p in faces_det if p > 0.5]
        if not valid_faces:
            return {'ready': False}

        # Sort left-to-right for consistent face index assignment
        valid_faces.sort(key=lambda x: x[0][0])

        face_sessions = session['face_sessions']
        # Remove buffers for faces that are no longer detected
        for k in list(face_sessions.keys()):
            if k >= len(valid_faces):
                del face_sessions[k]

        faces_result = []
        any_ready = False

        for face_idx, (det_box, det_landmarks, _) in enumerate(valid_faces):
            x0 = max(0, int(det_box[0]))
            y0 = max(0, int(det_box[1]))
            x1 = min(fw, int(det_box[2]))
            y1 = min(fh, int(det_box[3]))
            face_crop = frame[y0:y1, x0:x1]
            if face_crop.size == 0:
                continue

            face_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
            face_resized = cv2.resize(face_rgb, (224, 224), interpolation=cv2.INTER_AREA)
            face_arr = img_to_array(face_resized)
            feature = ee_model(np.expand_dims(vggface_preprocess(face_arr, version=2), 0)).numpy()[0]

            if face_idx not in face_sessions:
                face_sessions[face_idx] = {
                    'features': [], 'new_count': 0, 'seq_idx': 0,
                    'last_emotion': '', 'last_conf': 0.0,
                }
            fses = face_sessions[face_idx]
            fses['features'].append(feature)
            fses['new_count'] += 1

            box_info = {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0}
            pose_val, pan_val = _estimate_pose_from_landmarks(det_landmarks)

            if len(fses['features']) >= WIN and fses['new_count'] >= STEP:
                window = np.array(fses['features'][-WIN:])
                pred = lstm_model(window[np.newaxis, ...]).numpy()[0]
                emo_idx = int(np.argmax(pred))

                face_result: dict = {
                    'ready': True,
                    'emotion': labels[emo_idx],
                    'confidence': float(pred[emo_idx]),
                    'pose': pose_val,
                    'pan': float(np.round(pan_val, 1)),
                    'sequence_index': fses['seq_idx'],
                    'box': box_info,
                }

                fses['new_count'] = 0
                fses['seq_idx'] += 1
                fses['last_emotion'] = labels[emo_idx]
                fses['last_conf'] = float(pred[emo_idx])
                any_ready = True
            else:
                face_result = {
                    'ready': False,
                    'emotion': fses['last_emotion'],
                    'confidence': fses['last_conf'],
                    'pose': pose_val,
                    'pan': float(np.round(pan_val, 1)),
                    'box': box_info,
                }

            faces_result.append(face_result)

        if not faces_result:
            return {'ready': False}

        first = faces_result[0]
        return {
            'ready': any_ready,
            'prediction': first.get('emotion', ''),
            'emotion': first.get('emotion', ''),
            'confidence': first.get('confidence', 0.0),
            'pose': first.get('pose', ''),
            'pan': first.get('pan', 0.0),
            'face_count': len(faces_result),
            'image_width': fw,
            'image_height': fh,
            'faces': faces_result,
        }

    except Exception:
        return {'ready': False}


@app.delete("/webcam-session/{session_id}")
async def clear_webcam_session(session_id: str):
    webcam_lstm_sessions.pop(session_id, None)
    return {'ok': True}

@app.delete("/sessions")
async def clear_all_sessions():
    count = len(webcam_lstm_sessions)
    webcam_lstm_sessions.clear()
    return {'ok': True, 'cleared': count}


@app.websocket("/ws/webcam-emonet/")
async def ws_webcam_emonet(websocket: WebSocket):
    await websocket.accept()
    WIN = 10
    STEP = 5
    features = []
    new_count = 0
    seq_idx = 0
    try:
        while True:
            data = await websocket.receive_bytes()
            nparr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                await websocket.send_json({'ready': False})
                continue
            fh, fw = frame.shape[:2]
            if _emonet_detector is None or _emonet_ee_model is None or _emonet_lstm_model is None:
                await websocket.send_json({'ready': False})
                continue
            try:
                faces_det = _emonet_detector(frame, cv=False)
                valid_faces = [(b, l, p) for b, l, p in faces_det if p > 0.5]
                if not valid_faces:
                    await websocket.send_json({'ready': False})
                    continue
                det_box, det_landmarks, _ = valid_faces[0]
                x0 = max(0, int(det_box[0]))
                y0 = max(0, int(det_box[1]))
                x1 = min(fw, int(det_box[2]))
                y1 = min(fh, int(det_box[3]))
                face_crop = frame[y0:y1, x0:x1]
                if face_crop.size == 0:
                    await websocket.send_json({'ready': False})
                    continue
                face_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
                face_resized = cv2.resize(face_rgb, (224, 224), interpolation=cv2.INTER_AREA)
                face_arr = img_to_array(face_resized)
                feature = _emonet_ee_model(
                    np.expand_dims(vggface_preprocess(face_arr, version=2), 0)
                ).numpy()[0]
                features.append(feature)
                new_count += 1
                box_info = {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0}
                pose_val, pan_val = _estimate_pose_from_landmarks(det_landmarks)
                if len(features) >= WIN and new_count >= STEP:
                    window = np.array(features[-WIN:])
                    pred = _emonet_lstm_model(window[np.newaxis, ...]).numpy()[0]
                    emo_idx = int(np.argmax(pred))
                    _tc_h, _tc_w = face_crop.shape[:2]; _tc_scale = max(1.0, 128 / min(_tc_h, _tc_w)); _tc_thumb = cv2.resize(face_crop, (max(1, int(_tc_w * _tc_scale)), max(1, int(_tc_h * _tc_scale))), interpolation=cv2.INTER_CUBIC); ok, jpg = cv2.imencode('.jpg', _tc_thumb, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    result = {
                        'ready': True,
                        'prediction': EMONET_LABELS[emo_idx],
                        'emotion': EMONET_LABELS[emo_idx],
                        'confidence': float(pred[emo_idx]),
                        'pose': pose_val,
                        'pan': float(np.round(pan_val, 1)),
                        'sequence_index': seq_idx,
                        'box': box_info,
                        'image_width': fw,
                        'image_height': fh,
                        'face_count': 1,
                        'faces': [{'emotion': EMONET_LABELS[emo_idx], 'confidence': float(pred[emo_idx]),
                                   'pose': pose_val, 'pan': float(np.round(pan_val, 1)), 'box': box_info}],
                    }
                    if ok:
                        result['face_thumb_base64'] = base64.b64encode(jpg.tobytes()).decode()
                    new_count = 0
                    seq_idx += 1
                    await websocket.send_json(result)
                else:
                    await websocket.send_json({'ready': False})
            except Exception:
                await websocket.send_json({'ready': False})
    except WebSocketDisconnect:
        pass


@app.post("/predict-video-emonet/", response_model=AnalysisResponse)
async def predict_video_emonet(
    request: Request,
    file: UploadFile = File(...),
    preview: bool = True,
):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Invalid video type")
    if _emonet_ee_model is None or _emonet_lstm_model is None:
        raise HTTPException(status_code=503, detail="Emo-Net model not loaded")

    contents = await file.read()
    if len(contents) > MAX_VIDEO_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_VIDEO_FILE_SIZE // 1024 // 1024}MB")

    suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(contents)
        video_path = tmp.name

    _check_video_resolution(video_path)

    try:
        detect = VideoCamera(path_video=video_path, conf=0.7)
        dict_face_areas, total_frame = detect.get_frame()

        if not dict_face_areas:
            return {
                "prediction": "No Face Detected",
                "confidence": 0.0,
                "filename": file.filename or "unknown",
                "faces": [],
                "face_count": 0,
                "image_width": 0,
                "image_height": 0,
            }

        # Extract primary face (face_0) with clean frame names for LSTM
        primary_keys = sorted([k for k in dict_face_areas if k.endswith('_0')])
        if not primary_keys:
            primary_keys = sorted(dict_face_areas.keys())

        MAX_FACE_FRAMES = 120
        if len(primary_keys) > MAX_FACE_FRAMES:
            step = max(1, len(primary_keys) // MAX_FACE_FRAMES)
            primary_keys = primary_keys[::step][:MAX_FACE_FRAMES]

        name_frames = [k.rsplit('_', 1)[0] for k in primary_keys]
        face_areas = [dict_face_areas[k] for k in primary_keys]

        face_array = np.stack(face_areas)
        feature_chunks = [
            _emonet_ee_model(face_array[i:i + 16])
            for i in range(0, len(face_array), 16)
        ]
        features = tf.concat(feature_chunks, axis=0)
        seq_paths, seq_features = emonet_sequences(name_frames, features)

        # Batch LSTM inference
        LSTM_BATCH = 32
        pred_chunks = [
            _emonet_lstm_model(np.array(seq_features[i:i + LSTM_BATCH])).numpy()
            for i in range(0, len(seq_features), LSTM_BATCH)
        ]
        pred = np.concatenate(pred_chunks, axis=0)

        mode_result = stats.mode(np.argmax(pred, axis=1))
        mode_idx = int(mode_result[0][0]) if hasattr(mode_result[0], '__len__') else int(mode_result[0])
        emotion = EMONET_LABELS[mode_idx]
        best_seq_idx = np.argmax(np.max(pred, axis=1))
        confidence = float(np.max(pred[best_seq_idx]))

        # Evenly subsample sequences for display (max 20)
        MAX_DISPLAY_SEQS = 20
        if len(seq_paths) > MAX_DISPLAY_SEQS:
            display_idx = np.linspace(0, len(seq_paths) - 1, MAX_DISPLAY_SEQS, dtype=int)
            seq_paths_display = [seq_paths[i] for i in display_idx]
            pred_display = pred[display_idx]
        else:
            seq_paths_display = seq_paths
            pred_display = pred

        # Build per-sequence results: face thumbnail + pose + pan via _emonet_detector
        sequence_results = []
        cap_seq = cv2.VideoCapture(video_path)
        for i, (sp, seq_pred) in enumerate(zip(seq_paths_display, pred_display)):
            emo_idx = int(np.argmax(seq_pred))
            seq_entry = {
                "sequence_index": i,
                "emotion": EMONET_LABELS[emo_idx],
                "confidence": float(seq_pred[emo_idx]),
                "pose": "N/A",
                "pan": 0.0,
            }
            first_frame_num = int(sp[0])
            cap_seq.set(cv2.CAP_PROP_POS_FRAMES, first_frame_num - 1)
            ret, seq_frame = cap_seq.read()
            if ret and seq_frame is not None and _emonet_detector is not None:
                try:
                    faces_det = _emonet_detector(seq_frame, cv=False)
                    if faces_det:
                        det_box, det_landmarks, det_prob = faces_det[0]
                        if det_prob > 0.5:
                            pose_val, pan_val = _estimate_pose_from_landmarks(det_landmarks)
                            seq_entry["pose"] = pose_val
                            seq_entry["pan"] = float(np.round(pan_val, 1))
                            fh, fw = seq_frame.shape[:2]
                            x0 = max(0, int(det_box[0]))
                            y0 = max(0, int(det_box[1]))
                            x1 = min(fw, int(det_box[2]))
                            y1 = min(fh, int(det_box[3]))
                            face_crop = seq_frame[y0:y1, x0:x1]
                            if face_crop.size > 0:
                                _tc_h, _tc_w = face_crop.shape[:2]; _tc_scale = max(1.0, 128 / min(_tc_h, _tc_w)); _tc_thumb = cv2.resize(face_crop, (max(1, int(_tc_w * _tc_scale)), max(1, int(_tc_h * _tc_scale))), interpolation=cv2.INTER_CUBIC); ok, jpg = cv2.imencode(".jpg", _tc_thumb, [cv2.IMWRITE_JPEG_QUALITY, 85])
                                if ok:
                                    seq_entry["face_thumb_base64"] = base64.b64encode(jpg.tobytes()).decode()
                except Exception:
                    pass
            sequence_results.append(seq_entry)
        cap_seq.release()

        # Get bounding box / pose / pan from a representative frame using _emonet_detector
        box_info = None
        pose_info = "N/A"
        pan_info = 0.0
        img_w, img_h = 0, 0
        picked_frame = None

        if _emonet_detector is not None and name_frames:
            cap = cv2.VideoCapture(video_path)
            for fname in name_frames:
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(fname) - 1)
                ret, frame = cap.read()
                if not ret or frame is None:
                    continue
                try:
                    faces_det = _emonet_detector(frame, cv=False)
                    if faces_det:
                        det_box, det_landmarks, det_prob = faces_det[0]
                        if det_prob > 0.5:
                            fh, fw = frame.shape[:2]
                            x0 = max(0, int(det_box[0]))
                            y0 = max(0, int(det_box[1]))
                            x1 = min(fw, int(det_box[2]))
                            y1 = min(fh, int(det_box[3]))
                            picked_frame = frame
                            img_h, img_w = fh, fw
                            box_info = {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}
                            pose_info, pan_info = _estimate_pose_from_landmarks(det_landmarks)
                            pan_info = float(np.round(pan_info, 1))
                            break
                except Exception:
                    pass
            cap.release()

        faces = [{
            "emotion": emotion,
            "confidence": confidence,
            "pose": pose_info,
            "pan": pan_info,
            "box": box_info,
        }]

        resp = {
            "prediction": emotion,
            "confidence": confidence,
            "filename": file.filename or "unknown",
            "faces": faces,
            "face_count": 1,
            "image_width": img_w,
            "image_height": img_h,
            "sequences": sequence_results,
        }

        if preview and picked_frame is not None:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmpimg:
                out = visualize_plt(
                    picked_frame,
                    [], [], [], [],
                    [emotion],
                    [],
                    save_path=tmpimg.name,
                    show=False,
                )
            with open(out, "rb") as f:
                resp["preview_base64"] = base64.b64encode(f.read()).decode()
                resp["preview_mime"] = "image/jpeg"
            os.unlink(out)

        return resp

    except Exception as e:
        print(f"Emo-Net video processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    finally:
        os.unlink(video_path)


@app.post("/predict-video-emonet/stream/")
async def predict_video_emonet_stream(
    request: Request,
    file: UploadFile = File(...),
    model: str = Form('finetune'),
):
    ee_model   = _emonet_ee_d7_model  if model == 'dense7' else _emonet_ee_model
    lstm_model = _emonet_lstm_d7_model if model == 'dense7' else _emonet_lstm_model
    labels     = EMONET_LABELS_D7     if model == 'dense7' else EMONET_LABELS
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Invalid video type")
    if ee_model is None or lstm_model is None:
        raise HTTPException(status_code=503, detail="Emo-Net model not loaded")

    contents = await file.read()
    if len(contents) > MAX_VIDEO_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_VIDEO_FILE_SIZE // 1024 // 1024}MB")

    suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(contents)
        video_path = tmp.name

    _check_video_resolution(video_path)

    async def generate():
        import json
        from collections import defaultdict
        try:
            # Real-time sliding window: detect face → extract feature → run LSTM every STEP frames
            WIN = 10
            STEP = 5

            cap_fd = cv2.VideoCapture(video_path)
            total_frame_fd = int(cap_fd.get(cv2.CAP_PROP_FRAME_COUNT))
            vid_fps = cap_fd.get(cv2.CAP_PROP_FPS) or 25.0
            w_fd = int(cap_fd.get(cv2.CAP_PROP_FRAME_WIDTH))
            h_fd = int(cap_fd.get(cv2.CAP_PROP_FRAME_HEIGHT))
            need_frames_set = set(range(1, total_frame_fd + 1, max(1, round(5 * vid_fps / 25))))
            total_sampled = len(need_frames_set)

            yield f"data: {json.dumps({'type': 'progress', 'frame': 0, 'total': total_frame_fd, 'sampled': 0, 'total_sampled': total_sampled, 'phase': 'detecting'})}\n\n"
            await asyncio.sleep(0)

            local_detector = RetinaFace(gpu_id=-1)
            # per-face rolling buffer: features + box info for LSTM window
            face_buffers = defaultdict(lambda: {'features': [], 'box_infos': [], 'new_count': 0})
            all_preds = []
            global_seq_idx = 0
            any_face = False
            cur_frame_fd = 0
            sampled_idx = 0
            no_face_streak = 0

            while True:
                ret, fr = cap_fd.read()
                if not ret or fr is None:
                    break
                cur_frame_fd += 1
                if cur_frame_fd not in need_frames_set:
                    continue
                sampled_idx += 1

                faces = local_detector(fr, cv=False)
                faces_this_frame = []

                for f_id, face_data in enumerate(faces):
                    box, landmarks, prob = face_data
                    if prob <= 0.7:
                        continue
                    startX = max(0, int(box[0]))
                    startY = max(0, int(box[1]))
                    endX = min(w_fd - 1, int(box[2]))
                    endY = min(h_fd - 1, int(box[3]))
                    face_crop = fr[startY:endY, startX:endX]
                    if face_crop.size == 0:
                        continue
                    any_face = True

                    fr_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
                    fr_resized = cv2.resize(fr_rgb, (224, 224), interpolation=cv2.INTER_AREA)
                    fr_arr = img_to_array(fr_resized)
                    feature = ee_model(
                        np.expand_dims(vggface_preprocess(fr_arr, version=2), 0)
                    ).numpy()[0]

                    pose_val, pan_val = _estimate_pose_from_landmarks(landmarks)
                    faces_this_frame.append((f_id, feature, face_crop, {
                        'x': startX, 'y': startY, 'w': endX - startX, 'h': endY - startY,
                        'pose': pose_val, 'pan': pan_val,
                    }))

                # Track no-face streak
                if not faces_this_frame:
                    no_face_streak += 1
                    if no_face_streak >= WIN:
                        yield f"data: {json.dumps({'type': 'no_face', 'sequence_index': global_seq_idx})}\n\n"
                        await asyncio.sleep(0)
                        global_seq_idx += 1
                        no_face_streak = 0
                else:
                    no_face_streak = 0

                # Update buffers and trigger LSTM when window is ready
                frame_yielded = False
                for f_id, feature, face_crop, box_info in faces_this_frame:
                    buf = face_buffers[f_id]
                    buf['features'].append(feature)
                    buf['box_infos'].append(box_info)
                    buf['new_count'] += 1

                    if len(buf['features']) >= WIN and buf['new_count'] >= STEP:
                        window = np.array(buf['features'][-WIN:])
                        pred = lstm_model(window[np.newaxis, ...]).numpy()[0]
                        all_preds.append(pred)
                        emo_idx = int(np.argmax(pred))
                        bi = box_info

                        _tc_h, _tc_w = face_crop.shape[:2]; _tc_scale = max(1.0, 128 / min(_tc_h, _tc_w)); _tc_thumb = cv2.resize(face_crop, (max(1, int(_tc_w * _tc_scale)), max(1, int(_tc_h * _tc_scale))), interpolation=cv2.INTER_CUBIC); ok, jpg = cv2.imencode('.jpg', _tc_thumb, [cv2.IMWRITE_JPEG_QUALITY, 85])

                        seq_entry = {
                            'sequence_index': global_seq_idx,
                            'face_index': f_id,
                            'emotion': labels[emo_idx],
                            'confidence': float(pred[emo_idx]),
                            'pose': bi['pose'],
                            'pan': float(np.round(bi['pan'], 1)),
                            'frame_number': cur_frame_fd,
                            'fps': float(vid_fps),
                            'box': {'x': bi['x'], 'y': bi['y'], 'w': bi['w'], 'h': bi['h']},
                            'image_width': w_fd,
                            'image_height': h_fd,
                        }
                        if ok:
                            seq_entry['face_thumb_base64'] = base64.b64encode(jpg.tobytes()).decode()

                        yield f"data: {json.dumps({'type': 'sequence', 'data': seq_entry})}\n\n"
                        await asyncio.sleep(0)
                        buf['new_count'] = 0
                        frame_yielded = True

                if frame_yielded:
                    global_seq_idx += 1

                yield f"data: {json.dumps({'type': 'progress', 'frame': cur_frame_fd, 'total': total_frame_fd, 'sampled': sampled_idx, 'total_sampled': total_sampled, 'phase': 'detecting'})}\n\n"
                await asyncio.sleep(0)

            cap_fd.release()
            del local_detector

            if not any_face:
                yield f"data: {json.dumps({'type': 'error', 'message': 'No Face Detected'})}\n\n"
                return

            # Final dominant emotion
            if all_preds:
                combined = np.array(all_preds)
                mode_result = stats.mode(np.argmax(combined, axis=1))
                mode_idx = int(mode_result[0][0]) if hasattr(mode_result[0], '__len__') else int(mode_result[0])
                emotion = labels[mode_idx]
                confidence = float(np.max(combined))
            else:
                emotion, confidence = 'No Face Detected', 0.0

            final = {
                'prediction': emotion,
                'confidence': confidence,
                'face_count': len(face_buffers),
                'image_width': w_fd,
                'image_height': h_fd,
                'faces': [{'emotion': emotion, 'confidence': confidence, 'pose': 'N/A', 'pan': 0.0, 'box': None}],
            }
            yield f"data: {json.dumps({'type': 'final', 'data': final})}\n\n"

        except Exception as e:
            import json
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            os.unlink(video_path)

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/predict-video-emonet-d7/stream/")
async def predict_video_emonet_d7_stream(
    file: UploadFile = File(...),
):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Invalid video type")
    if _emonet_image_d6_model is None:
        raise HTTPException(status_code=503, detail="Emo-Net model not loaded")

    contents = await file.read()
    if len(contents) > MAX_VIDEO_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_VIDEO_FILE_SIZE // 1024 // 1024}MB")

    suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(contents)
        video_path = tmp.name

    _check_video_resolution(video_path)

    async def generate():
        import json
        try:
            cap = cv2.VideoCapture(video_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            vid_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            need_frames_set = set(range(1, total_frames + 1, max(1, round(5 * vid_fps / 25))))

            yield f"data: {json.dumps({'type': 'progress', 'frame': 0, 'total': total_frames, 'phase': 'detecting'})}\n\n"
            await asyncio.sleep(0)

            local_detector = RetinaFace(gpu_id=-1)
            all_preds = []
            global_seq_idx = 0
            any_face = False
            cur_frame = 0

            while True:
                ret, fr = cap.read()
                if not ret or fr is None:
                    break
                cur_frame += 1
                if cur_frame not in need_frames_set:
                    continue

                faces = local_detector(fr, cv=False)
                for f_id, face_data in enumerate(faces):
                    box, landmarks, prob = face_data
                    if prob <= 0.7:
                        continue
                    startX = max(0, int(box[0]))
                    startY = max(0, int(box[1]))
                    endX = min(w - 1, int(box[2]))
                    endY = min(h - 1, int(box[3]))
                    face_crop = fr[startY:endY, startX:endX]
                    if face_crop.size == 0:
                        continue
                    any_face = True

                    fr_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
                    fr_resized = cv2.resize(fr_rgb, (224, 224), interpolation=cv2.INTER_AREA)
                    fr_arr = vggface_preprocess(img_to_array(fr_resized), version=2)
                    pred = _emonet_image_d6_model.predict(np.expand_dims(fr_arr, 0), verbose=0)[0]
                    all_preds.append(pred)
                    emo_idx = int(np.argmax(pred))

                    pose_val, pan_val = _estimate_pose_from_landmarks(landmarks)
                    _tc_h, _tc_w = face_crop.shape[:2]; _tc_scale = max(1.0, 128 / min(_tc_h, _tc_w)); _tc_thumb = cv2.resize(face_crop, (max(1, int(_tc_w * _tc_scale)), max(1, int(_tc_h * _tc_scale))), interpolation=cv2.INTER_CUBIC); ok, jpg = cv2.imencode('.jpg', _tc_thumb, [cv2.IMWRITE_JPEG_QUALITY, 85])

                    seq_entry = {
                        'sequence_index': global_seq_idx,
                        'face_index': f_id,
                        'emotion': EMONET_LABELS[emo_idx],
                        'confidence': float(pred[emo_idx]),
                        'pose': pose_val,
                        'pan': float(np.round(pan_val, 1)),
                        'frame_number': cur_frame,
                        'fps': float(vid_fps),
                        'box': {'x': startX, 'y': startY, 'w': endX - startX, 'h': endY - startY},
                        'image_width': w,
                        'image_height': h,
                    }
                    if ok:
                        seq_entry['face_thumb_base64'] = base64.b64encode(jpg.tobytes()).decode()

                    yield f"data: {json.dumps({'type': 'sequence', 'data': seq_entry})}\n\n"
                    await asyncio.sleep(0)
                    global_seq_idx += 1

                yield f"data: {json.dumps({'type': 'progress', 'frame': cur_frame, 'total': total_frames, 'phase': 'detecting'})}\n\n"
                await asyncio.sleep(0)

            cap.release()
            del local_detector

            if not any_face:
                yield f"data: {json.dumps({'type': 'error', 'message': 'No Face Detected'})}\n\n"
                return

            if all_preds:
                combined = np.array(all_preds)
                mode_result = stats.mode(np.argmax(combined, axis=1))
                mode_idx = int(mode_result[0][0]) if hasattr(mode_result[0], '__len__') else int(mode_result[0])
                emotion = EMONET_LABELS[mode_idx]
                confidence = float(np.max(combined))
            else:
                emotion, confidence = 'No Face Detected', 0.0

            final = {
                'prediction': emotion,
                'confidence': confidence,
                'face_count': 1,
                'image_width': w,
                'image_height': h,
                'faces': [{'emotion': emotion, 'confidence': confidence, 'pose': 'N/A', 'pan': 0.0, 'box': None}],
            }
            yield f"data: {json.dumps({'type': 'final', 'data': final})}\n\n"

        except Exception as e:
            import json
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            os.unlink(video_path)

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

# Serve React build as static files (must be last)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
_DIST = os.path.join(os.path.dirname(__file__), "..", "..", "dist")
if os.path.isdir(_DIST):
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "face_analyze.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )