import cv2

def analyze_video(video_path: str):
    cap = cv2.VideoCapture(video_path)

    frame_count = 0
    faces_total = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        # TODO: เรียก CombinedFaceAnalyzer ที่คุณมี
        # result = analyzer.analyze_face(frame, draw=False)
        # faces_total += len(result[-1])

    cap.release()

    return {
        "frames": frame_count,
        "faces_detected": faces_total,
        "status": "ok"
    }