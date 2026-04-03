FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# เลือก requirements ผ่าน ARG
ARG REQ=requirements-tf.txt
COPY ${REQ} ./requirements.txt

RUN pip install --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

# ก๊อปโค้ด backend ทั้งหมด
COPY . .

CMD ["sh", "-c", "uvicorn face_analyze.main:app --host 0.0.0.0 --port ${API_PORT:-8000}"]
