from fastapi import FastAPI, File, UploadFile
import numpy as np
import cv2

from face_analyze.emotion_model import load_emotion_model

app = FastAPI(title="TF Emotion API")
model = load_emotion_model()

@app.post("/predict-emotion")
async def predict_emotion(file: UploadFile = File(...)):
    data = await file.read()
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_GRAYSCALE)
    if img is None:
        return {"detail": "Cannot decode image"}

    img = cv2.resize(img, (48, 48))
    x = img.astype("float32") / 255.0
    x = x[None, ..., None]

    pred = model.predict(x)[0]
    return {"emotion": int(np.argmax(pred)), "scores": pred.tolist()}
