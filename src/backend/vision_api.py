from fastapi import FastAPI
from face_analyze.face_analyze import CombinedFaceAnalyzer
import requests

app = FastAPI()
TF_URL = "http://api_tf:8000/predict-emotion"

analyzer = CombinedFaceAnalyzer(
    staticMode=True,
    maxFaces=5,
    use_emotions=False,
)
r = requests.post(TF_URL, files={"file": ("face.jpg", face_bytes, "image/jpeg")})
emotion = r.json()

@app.get("/health")
def health():
    return {"service": "vision"}