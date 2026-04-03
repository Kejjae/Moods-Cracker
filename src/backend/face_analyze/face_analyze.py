import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import time
import numpy as np
import math
from matplotlib import pyplot as plt
import pickle
import pandas as pd
import argparse

# Import drawing styles for face mesh
from mediapipe.python.solutions.drawing_styles import get_default_face_mesh_tesselation_style
from mediapipe.python.solutions.drawing_styles import get_default_face_mesh_contours_style
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
WEIGHTS_PATH = (BASE_DIR / "model.h5") if (BASE_DIR / "model.h5").exists() else (BASE_DIR.parent / "model.h5")

# Command line arguments – parse เฉพาะตอนรันเป็นสคริปต์
def _default_args():
    return argparse.Namespace(path=None, mode='display', train_emotions=False)

if __name__ == "__main__":
    parser = argparse.ArgumentParser("Combined Face Pose and Emotion Detection")
    parser.add_argument("-p", "--path", help="To use image path.", type=str)
    parser.add_argument("-m", "--mode", help="train/display/image",
                        choices=['train', 'display', 'image'], default='display')
    parser.add_argument("--train-emotions", help="Train emotion model", action='store_true')
    args = parser.parse_args()
else:
    args = _default_args()

# Constants
left_offset = 20
fontScale = 2
fontThickness = 3
text_color = (0,0,255)
lineColor = (255, 255, 0)
LINE_COLOR = (255, 255, 0)

# Emotion dictionary
emotion_dict = {0: "Anger", 1: "Disgust", 2: "Fear", 3: "Happiness", 4: "Neutral", 5: "Sadness", 6: "Surprise"}

def create_emotion_model():
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import Dense, Dropout, Flatten, Conv2D, MaxPooling2D
    """Create the emotion detection CNN model"""
    model = Sequential()
    
    model.add(Conv2D(32, kernel_size=(3, 3), activation='relu', input_shape=(48,48,1)))
    model.add(Conv2D(64, kernel_size=(3, 3), activation='relu'))
    model.add(MaxPooling2D(pool_size=(2, 2)))
    model.add(Dropout(0.25))

    model.add(Conv2D(128, kernel_size=(3, 3), activation='relu'))
    model.add(MaxPooling2D(pool_size=(2, 2)))
    model.add(Conv2D(128, kernel_size=(3, 3), activation='relu'))
    model.add(MaxPooling2D(pool_size=(2, 2)))
    model.add(Dropout(0.25))

    model.add(Flatten())
    model.add(Dense(1024, activation='relu'))
    model.add(Dropout(0.5))
    model.add(Dense(7, activation='softmax'))
    
    return model

def plot_model_history(model_history):
    """Plot Accuracy and Loss curves given the model_history"""
    fig, axs = plt.subplots(1,2,figsize=(15,5))
    # summarize history for accuracy
    axs[0].plot(range(1,len(model_history.history['accuracy'])+1),model_history.history['accuracy'])
    axs[0].plot(range(1,len(model_history.history['val_accuracy'])+1),model_history.history['val_accuracy'])
    axs[0].set_title('Model Accuracy')
    axs[0].set_ylabel('Accuracy')
    axs[0].set_xlabel('Epoch')
    axs[0].set_xticks(np.arange(1,len(model_history.history['accuracy'])+1))
    axs[0].legend(['train', 'val'], loc='best')
    # summarize history for loss
    axs[1].plot(range(1,len(model_history.history['loss'])+1),model_history.history['loss'])
    axs[1].plot(range(1,len(model_history.history['val_loss'])+1),model_history.history['val_loss'])
    axs[1].set_title('Model Loss')
    axs[1].set_ylabel('Loss')
    axs[1].set_xlabel('Epoch')
    axs[1].set_xticks(np.arange(1,len(model_history.history['loss'])+1))
    axs[1].legend(['train', 'val'], loc='best')
    fig.savefig('plot.png')
    plt.show()

def npAngle(a, b, c):
    """Calculate angle between three points"""
    ba = a - b
    bc = c - b 
    cosine_angle = np.dot(ba, bc)/(np.linalg.norm(ba)*np.linalg.norm(bc))
    angle = np.arccos(cosine_angle)
    return np.degrees(angle)

def pan_angle(landmarks):
    """Calculate pan angle from landmarks"""
    if len(landmarks) >= 3:
        if len(landmarks) == 5:
            eyeL = np.array(landmarks[0])
            eyeR = np.array(landmarks[1]) 
            nose = np.array(landmarks[2])
        else:
            eyeL = np.array([landmarks[0][0], landmarks[0][1]])
            eyeR = np.array([landmarks[1][0], landmarks[1][1]])
            nose = np.array([landmarks[2][0], landmarks[2][1]])
        
        eye_mid = (eyeL + eyeR) / 2
        face_vector = nose - eye_mid
        eyeLtoR = eyeR - eyeL
        
        pan_rad = np.arctan2(face_vector[0], eyeLtoR[0])
        return np.degrees(pan_rad)
    return 0

def pan_angle_mediapipe(faceLms):
    """Calculate pan angle from MediaPipe face landmarks"""
    Leye = 33
    Reye = 263
    nose_tip = 1

    eyeL = np.array([faceLms.landmark[Leye].x, faceLms.landmark[Leye].y])
    eyeR = np.array([faceLms.landmark[Reye].x, faceLms.landmark[Reye].y])
    nose = np.array([faceLms.landmark[nose_tip].x, faceLms.landmark[nose_tip].y])

    eye_mid = (eyeL + eyeR) / 2
    face_vector = nose - eye_mid
    eyeLtoR = eyeR - eyeL
    pan_rad = np.arctan2(face_vector[0], eyeLtoR[0])
    
    return np.degrees(pan_rad)

def get_face_bounding_box(faceLms, img_w, img_h):
    """Calculate bounding box for a face"""
    x_coords = [lm.x * img_w for lm in faceLms.landmark]
    y_coords = [lm.y * img_h for lm in faceLms.landmark]
    
    x_min, x_max = min(x_coords), max(x_coords)
    y_min, y_max = min(y_coords), max(y_coords)
    
    return int(x_min), int(y_min), int(x_max - x_min), int(y_max - y_min)

class CombinedFaceAnalyzer:
    def __init__(self, staticMode=False, maxFaces=5, minDetectionCon=0.5, minTrackCon=0.5, use_emotions=True):
        self.use_emotions = use_emotions
        self.emotion_model = None

        import cv2
        import mediapipe as mp

        self.cv2 = cv2
        self.mp = mp

        self.staticMode = staticMode
        self.maxFaces = maxFaces
        self.minDetectionCon = minDetectionCon
        self.minTrackCon = minTrackCon
        self.use_emotions = use_emotions

        # MediaPipe setup
        self.mpDraw = self.mp.solutions.drawing_utils
        self.mpFaceMesh = self.mp.solutions.face_mesh
        self.faceMesh = self.mpFaceMesh.FaceMesh(
            static_image_mode=self.staticMode,
            max_num_faces=self.maxFaces,
            min_detection_confidence=self.minDetectionCon,
            min_tracking_confidence=self.minTrackCon)
        self.drawSpec = self.mpDraw.DrawingSpec(thickness=1, circle_radius=1, color=(242, 180, 192))

        # Emotion detection setup
        if self.use_emotions:
            try:
                self.emotion_model = create_emotion_model()
                self.emotion_model.load_weights(str(WEIGHTS_PATH))
                print(f"Emotion model loaded: {WEIGHTS_PATH}")
            except Exception as e:
                print(f"Could not load emotion model: {e}")
                print("Continuing without emotion detection...")
                self.use_emotions = False
        
        # Haar cascade for face detection (backup for emotion detection)
        if self.use_emotions:
            print("Emotion detection requested, but this analyzer should not load emotion models in api_vision.")
            self.use_emotions = False
            #try:
                #self.face_cascade = self.cv2.CascadeClassifier('haarcascade_frontalface_default.xml')
                #if self.face_cascade.empty():
                #   self.face_cascade = self.cv2.CascadeClassifier(self.cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            #except:
            #   print("Could not load Haar cascade, using MediaPipe bounding box for emotions")
            #  self.face_cascade = None

    def extract_key_landmarks(self, faceLms, img_w, img_h):
        """Extract key landmarks in standard format"""
        left_eye_idx = 33
        right_eye_idx = 263
        nose_idx = 1
        left_mouth_idx = 61
        right_mouth_idx = 291
        
        landmarks = []
        for idx in [left_eye_idx, right_eye_idx, nose_idx, left_mouth_idx, right_mouth_idx]:
            x = faceLms.landmark[idx].x * img_w
            y = faceLms.landmark[idx].y * img_h
            landmarks.append([x, y])
        
        return np.array(landmarks)

    def detect_emotion(self, face_roi_gray):
        """Detect emotion from face ROI"""
        if not self.use_emotions:
            return "N/A", 0.0
        
        try:
            cropped_img = np.expand_dims(np.expand_dims(self.cv2.resize(face_roi_gray, (48, 48)), -1), 0)
            prediction = self.emotion_model.predict(cropped_img, verbose=0)
            maxindex = int(np.argmax(prediction))
            confidence = float(np.max(prediction))
            return emotion_dict[maxindex], confidence
        except Exception as e:
            print(f"Error in emotion detection: {e}")
            return "N/A", 0.0

    def analyze_face(self, img, draw=True):
        """Combined face pose and emotion analysis"""
        imgRGB = self.cv2.cvtColor(img, self.cv2.COLOR_BGR2RGB)
        results = self.faceMesh.process(imgRGB)
        gray = self.cv2.cvtColor(img, self.cv2.COLOR_BGR2GRAY)

        img_h, img_w, img_c = img.shape
        
        # Variables to store results
        landmarks_list = []
        angle_R_list = []
        angle_L_list = []
        pred_list = []
        pan_angles = []
        emotions_list = []
        emotion_confidence_list = []
        faces_info = [] #เรียกใช้ bounding box
        
        if results.multi_face_landmarks:
            for face_idx, faceLms in enumerate(results.multi_face_landmarks):
                # Draw face mesh if requested
                if draw:
                    self.mpDraw.draw_landmarks(
                        image=img,
                        landmark_list=faceLms,
                        connections=self.mp.solutions.face_mesh.FACEMESH_TESSELATION,
                        landmark_drawing_spec=self.drawSpec,
                        connection_drawing_spec=get_default_face_mesh_tesselation_style())
                    
                    self.mpDraw.draw_landmarks(
                        image=img,
                        landmark_list=faceLms,
                        connections=self.solutions.face_mesh.FACEMESH_CONTOURS,
                        landmark_drawing_spec=self.drawSpec,
                        connection_drawing_spec=get_default_face_mesh_tesselation_style())
                
                # Get face bounding box
                face_x, face_y, face_w, face_h = get_face_bounding_box(faceLms, img_w, img_h)
                
                # Extract key landmarks for pose estimation
                key_landmarks = self.extract_key_landmarks(faceLms, img_w, img_h)
                landmarks_list.append(key_landmarks)
                
                # Calculate pose angles
                angR = npAngle(key_landmarks[0], key_landmarks[1], key_landmarks[2])
                angL = npAngle(key_landmarks[1], key_landmarks[0], key_landmarks[2])
                angle_R_list.append(angR)
                angle_L_list.append(angL)
                
                # Calculate pan angle
                pan = pan_angle(key_landmarks)
                pan_angles.append(pan)
                
                # Determine face pose
                if (int(angR) in range(35, 57)) and (int(angL) in range(35, 58)):
                    predLabel = 'Frontal'
                else: 
                    predLabel = 'Left Profile' if angR < angL else 'Right Profile'
                pred_list.append(predLabel)

                # Emotion detection
                emotion = "N/A"
                emotion_conf = 0.0
                if self.use_emotions:
                    # Extract face region for emotion detection
                    face_roi = gray[max(0, face_y):min(img_h, face_y + face_h), 
                                    max(0, face_x):min(img_w, face_x + face_w)]
                    if face_roi.size > 0:
                        emotion, emotion_conf = self.detect_emotion(face_roi)
                
                emotions_list.append(emotion)
                emotion_confidence_list.append(emotion_conf)

                # เก็บค่าผลลัพธ์ต่อใบหน้า
                face_info = {
                    "box": {"x": int(face_x), "y": int(face_y), "w": int(face_w), "h": int(face_h)},
                    "pose": predLabel,
                    "pan": float(pan),
                    "emotion": emotion,
                    "emotion_conf": float(emotion_conf),
                    "index": int(face_idx)
                }
                
                faces_info.append(face_info)

                # 3D pose estimation
                face_3d = []
                face_2d = []
                nose_2d = None

                for id, lm in enumerate(faceLms.landmark):
                    if id in [33, 263, 1, 61, 291, 199]:
                        x, y = int(lm.x * img_w), int(lm.y * img_h)
                        
                        if id == 1:
                            nose_2d = (lm.x * img_w, lm.y * img_h)

                        face_2d.append([x, y])
                        face_3d.append([x, y, lm.z])

                if len(face_2d) >= 4 and nose_2d is not None:
                    face_2d = np.array(face_2d, dtype=np.float64)
                    face_3d = np.array(face_3d, dtype=np.float64)

                    focal_length = 1 * img_w
                    cam_matrix = np.array([[focal_length, 0, img_h / 2],
                                          [0, focal_length, img_w / 2],
                                          [0, 0, 1]])
                    
                    dist_matrix = np.zeros((4, 1), dtype=np.float64)
                    success, rot_vec, trans_vec = self.cv2.solvePnP(face_3d, face_2d, cam_matrix, dist_matrix)

                    if success and draw:
                        rmat, jac = self.cv2.Rodrigues(rot_vec)
                        angles, mtxR, mtxQ, Qx, Qy, Qz = self.cv2.RQDecomp3x3(rmat)

                        x = angles[0] * 360
                        y = angles[1] * 360
                        z = angles[2] * 360   

                        # Determine head direction
                        if y > 10:
                            text = "Looking Left"
                        elif y < -10:
                            text = "Looking Right"
                        elif x < -10:
                            text = "Looking Down"
                        elif x > 10:
                            text = "Looking Up"
                        else:
                            text = "Forward"

                        # Draw direction line
                        p1 = (int(nose_2d[0]), int(nose_2d[1]))
                        p2 = (int(nose_2d[0] + y * 10), int(nose_2d[1] - x * 10))
                        self.cv2.line(img, p1, p2, (242, 180, 192), 2)

                        # Calculate text position
                        text_x = face_x + face_w + 10
                        text_y = face_y + 30
                        
                        if text_x > img_w - 300:
                            text_x = max(10, face_x - 250)
                        if text_y < 30:
                            text_y = face_y + face_h + 30

                        # Display information
                        info_lines = [
                        f"Face {face_idx + 1}:",
                        f"X: {np.round(x, 1)}°",
                        f"Y: {np.round(y, 1)}°", 
                        f"Z: {np.round(z, 1)}°",
                        f"Pan: {np.round(pan, 1)}°",
                        f"Pose: {predLabel}",
                        f"Emotion: {emotion}",
                            #f"Confidence: {emotion_conf:.2f}"
                        ]

                        #for i, line in enumerate(info_lines):
                         #   cv2.putText(img, line,
                          #              (text_x, text_y + i * 25),
                           #             cv2.FONT_HERSHEY_SIMPLEX, 1,
                            #            (0, 255, 0) if i < 2 else (255, 255, 255), 2)
                            

        return (img, landmarks_list, angle_R_list, angle_L_list, pred_list, 
                pan_angles, emotions_list, emotion_confidence_list,faces_info)

def train_emotion_model():
    """Train the emotion detection model"""
    print("Training emotion detection model...")
    
    # Define data generators
    train_dir = 'data/train_augmented'
    val_dir = 'data/test'

    num_train = 115284 #28709
    num_val = 7178
    batch_size = 64
    num_epoch = 50

    train_datagen = ImageDataGenerator(rescale=1./255)
    val_datagen = ImageDataGenerator(rescale=1./255)

    train_generator = train_datagen.flow_from_directory(
            train_dir,
            target_size=(48,48),
            batch_size=batch_size,
            color_mode="grayscale",
            class_mode='categorical')

    validation_generator = val_datagen.flow_from_directory(
            val_dir,
            target_size=(48,48),
            batch_size=batch_size,
            color_mode="grayscale",
            class_mode='categorical')

    model = create_emotion_model()
    model.load_weights("model.h5")
    model.compile(loss='categorical_crossentropy',optimizer=Adam(learning_rate=0.0001),metrics=['accuracy'])
    
    model_info = model.fit(
            train_generator,
            steps_per_epoch=num_train // batch_size,
            epochs=num_epoch,
            validation_data=validation_generator,
            validation_steps=num_val // batch_size)
    
    with open('train_history.pkl', 'wb') as f:
        pickle.dump(model_info.history, f)

    # === Save as CSV ===
    df = pd.DataFrame(model_info.history)
    df.to_csv('train_metrics.csv', index=False)

    # === Plot Accuracy/Loss ===
    plt.figure(figsize=(12, 5))

    # Accuracy
    plt.subplot(1, 2, 1)
    plt.plot(model_info.history['accuracy'], label='Train Acc')
    plt.plot(model_info.history['val_accuracy'], label='Val Acc')
    plt.title("Model Accuracy")
    plt.xlabel("Epoch")
    plt.ylabel("Accuracy")
    plt.legend()

    # Loss
    plt.subplot(1, 2, 2)
    plt.plot(model_info.history['loss'], label='Train Loss')
    plt.plot(model_info.history['val_loss'], label='Val Loss')
    plt.title("Model Loss")
    plt.xlabel("Epoch")
    plt.ylabel("Loss")
    plt.legend()
    plt.tight_layout()
    plt.show()
    

    #overfitiing check
    plt.figure(figsize=(10, 5))
    plt.plot(model_info.history['loss'], label='Train Loss')
    plt.plot(model_info.history['val_loss'], label='Val Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.title('Training vs Validation Loss')
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.savefig("overfit_check.png")
    plt.show()
    #plot_model_history(model_info)
    model.save_weights('model.h5')

def process_image(image_path):
    import cv2
    img = cv2.imread(image_path)
    if img is None:
        print(f"Error: Cannot load image from {image_path}")
        return
    
    analyzer = CombinedFaceAnalyzer(staticMode=True, maxFaces=5)
    
    (result_img, landmarks_list, angle_R_list, angle_L_list, 
     pred_list, pan_angles, emotions_list, emotion_conf_list) = analyzer.analyze_face(img)
    
    if landmarks_list:
        # Always generate matplotlib plot and save it
        output_path = f"result_{os.path.splitext(os.path.basename(image_path))[0]}.jpg"
        output_path = visualize_plt(
            img, landmarks_list, angle_R_list, angle_L_list,
            pred_list, emotions_list, pan_angles, 
            save_path=output_path, show=False
        )
        
        print(f"Result saved as: {output_path}")
        
        # Print analysis results
        print("\nAnalysis Results:")
        for i, (pose, emotion, conf, pan) in enumerate(zip(pred_list, emotions_list, emotion_conf_list, pan_angles)):
            print(f"Face {i+1}: Pose={pose}, Emotion={emotion} ({conf:.2f}), Pan={pan:.1f}°")
    else:
        print("No faces detected in the image")

def visualize_plt(image, landmarks_, angle_R_, angle_L_, pred_, emotions_, pans_, save_path=None, show=True):
    fig, ax = plt.subplots(1, 1, figsize=(8, 8))

    import cv2
    
    #leftCount = len([i for i in pred_ if i == 'Left Profile'])
    #rightCount = len([i for i in pred_ if i == 'Right Profile'])
    #frontalCount = len([i for i in pred_ if i == 'Frontal'])
    #facesCount = len(pred_)
    
    #ax.set_title(f"Detected faces = {facesCount}\nFrontal = {frontalCount}, Left = {leftCount}, Right = {rightCount}")

    for i, (landmarks, pred, emo, pan, aL, aR) in enumerate(zip(landmarks_, pred_, emotions_, pans_, angle_L_, angle_R_)):
        if not landmarks:
            continue
        x, y = landmarks[0][0], landmarks[0][1]
        x_offset = x + 30
        y_offset = y + 60
        text = (
            f"# {i+1}, {pred}\n"
            #f"Pose: {pred}\n"
            f"{emo}, {round(pan,1)}°"
            #f"Pan: {round(pan,1)}°\n"
            #f"L: {int(aL)}°, R: {int(aR)}°"
        )
        #ax.text(x_offset, y_offset, text, fontsize=10, color='white', bbox=dict(facecolor='black', alpha=0.2))

    ax.imshow(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

    ax.axis('off')
    ax.set_xticks([])
    ax.set_yticks([])
    
    output_path = save_path if save_path else 'face_pose_output.jpg'
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    if show:
        plt.show()
    else:
        plt.close(fig)
    return output_path

def visualize_cv2(frame, landmarks_, angle_R_, angle_L_, pred_):
    import cv2
    #OpenCV visualization
    pan_angles = [pan_angle(landmarks) for landmarks in landmarks_]
    
    for landmarks, angle_R, angle_L, pred, pan in zip(landmarks_, angle_R_, angle_L_, pred_, pan_angles):
        color = (0, 0, 0) if pred == 'Frontal' else ((255, 0, 0) if pred == 'Right Profile' else (0, 0, 255))
        
        # Draw landmarks
        #for land in landmarks:
            #cv2.circle(frame, (int(land[0]), int(land[1])), radius=5, color=(0, 255, 255), thickness=-1)
        
        # Draw connections
        pts = [(int(landmarks[0][0]), int(landmarks[0][1])),
               (int(landmarks[1][0]), int(landmarks[1][1])),
               (int(landmarks[2][0]), int(landmarks[2][1]))]
        
        cv2.line(frame, pts[0], pts[1], LINE_COLOR, 3)
        cv2.line(frame, pts[0], pts[2], LINE_COLOR, 3)
        cv2.line(frame, pts[1], pts[2], LINE_COLOR, 3)
        
        # Add text
        text_lines = [
            f"{pred}",
            f"L:{math.floor(angle_L)} R:{math.floor(angle_R)}",
            f"Pan: {round(pan)}°"
        ]
        
        y_offset = pts[0][1] - 40
        for j, line in enumerate(text_lines):
            cv2.putText(frame, line, (pts[0][0], y_offset + j * 25), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2, cv2.LINE_AA)

def run_webcam():
    import cv2
    """Run real-time webcam analysis"""
    cap = cv2.VideoCapture(0)
    pTime = 0
    
    analyzer = CombinedFaceAnalyzer(maxFaces=5, use_emotions=True)
    
    print("Starting webcam... Press 'q' to quit, 's' to save screenshot")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Analyze frame
        (result_frame, landmarks_list, angle_R_list, angle_L_list, 
         pred_list, pan_angles, emotions_list, emotion_conf_list) = analyzer.analyze_face(frame)
        
        img_h, img_w, _ = result_frame.shape
        for i, (landmarks, pred, emotion, emotion_conf, pan) in enumerate(zip(landmarks_list, pred_list, emotions_list, emotion_conf_list, pan_angles)):
            # Get face position for text placement
            face_x = int(landmarks[0][0])  # Use left eye x position
            face_y = int(landmarks[0][1])  # Use left eye y position
            
            # Calculate text position (avoid going off screen)
            text_x = face_x + 50
            text_y = face_y - 60
            
            if text_x > img_w - 300:
                text_x = max(10, face_x - 250)
            if text_y < 30:
                text_y = face_y + 100

            # Display information
            info_lines = [
                f"Face {i + 1}:",
                f"Pose: {pred}",
                f"Pan: {pan:.1f}°",
                f"Emotion: {emotion}",
                f"Conf: {emotion_conf:.2f}"
            ]

            for j, line in enumerate(info_lines):
                cv2.putText(result_frame, line,
                            (text_x, text_y + j * 25),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6,
                            (0, 255, 0) if j == 0 else (255, 255, 255), 2)
        # Calculate and display FPS
        cTime = time.time()
        fps = 1 / (cTime - pTime) if pTime != 0 else 0
        pTime = cTime

        cv2.putText(result_frame, f'FPS: {int(fps)}', (20, 50), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        
        # Display face count
        face_count = len(landmarks_list)
        cv2.putText(result_frame, f'Faces: {face_count}', (20, 90), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        
        cv2.imshow('Combined Face Analysis - Press q to quit, s to save', 
                   cv2.resize(result_frame, (1200, 800), interpolation=cv2.INTER_CUBIC))

        key = cv2.waitKey(1) & 0xff
        if key == ord('q'):
            break
        elif key == ord('s'):
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            screenshot_path = f"screenshot_{timestamp}.jpg"
            cv2.imwrite(screenshot_path, result_frame)
            print(f"Screenshot saved as: {screenshot_path}")

    cap.release()
    cv2.destroyAllWindows()

def main():
    if args.mode == "train" or args.train_emotions:
        train_emotion_model()
    elif args.mode == "image" and args.path:
        process_image(args.path)
    elif args.mode == "display":
        run_webcam()

if __name__ == "__main__":
    main()