import React, { useEffect, useRef, useState } from 'react';
import './core_general.css';
import { useNavigate } from 'react-router-dom';
import Webcam from "react-webcam";
import addimg from "/img/add-image.png" ;
import videoimg from "/img/video-production.png";
import webcamimg from "/img/webcam.png";

interface CoreGenProps {
  setTrigger?: (value: boolean) => void;
  hideHeader?: boolean;
}

interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FaceData {
  box?: FaceBox;
  emotion?: string;
  pose?: string;
  pan?: number;
}

interface PredictionResult {
  faces?: FaceData[];
  preview_base64?: string;
  preview_base64_list?: string[];
  preview_mime?: string;
  image_width: number;
  image_height: number;
}

function Core_gen(props: CoreGenProps) {
  const navigate = useNavigate();
  const [file, setFile] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const webcamRef = useRef<Webcam>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
  const webcamProcessingRef = useRef(false);
  const [webcamLiveEmotion, setWebcamLiveEmotion] = useState<{ emotion: string; confidence: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewList, setPreviewList] = useState<string[]>([]);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoProcessingRef = useRef(false);
  const videoFrameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [videoPrediction, setVideoPrediction] = useState<PredictionResult | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [hasPredictedOnce, setHasPredictedOnce] = useState(false);

  const IMAGE_MAX_MB = 5;
  const VIDEO_MAX_MB = 50;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (f.size > IMAGE_MAX_MB * 1024 * 1024) {
        alert(`Image file too large. Maximum size is ${IMAGE_MAX_MB}MB.`);
        e.target.value = '';
        return;
      }
      setFile(URL.createObjectURL(f));
      setFileType('image');
      setIsWebcamActive(false);
      setIsVideoActive(false);
      setVideoPrediction(null);
      uploadImage(f);
    }
  }

  function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const videoFile = e.target.files[0];
      if (videoFile.size > VIDEO_MAX_MB * 1024 * 1024) {
        alert(`Video file too large. Maximum size is ${VIDEO_MAX_MB}MB.`);
        e.target.value = '';
        return;
      }
      setFile(URL.createObjectURL(videoFile));
      setFileType('video');
      setIsWebcamActive(false);
      setIsVideoActive(false);
      setVideoPrediction(null);
      setHasPredictedOnce(false);
      setPrediction(null);
      setPreview(null);
      setPreviewList([]);
    }
  }

  const clearAll = () => {
    setFile(null);
    setPrediction(null);
    setPreview(null);
    setPreviewList([]);
    setVideoPrediction(null);
    setIsVideoActive(false);
    setVideoPlaying(false);
    setVideoCurrentTime(0);
    setVideoDuration(0);
    setHasPredictedOnce(false);
    setImgSize({ width: 0, height: 0 });
    setFileType(null);
    setIsWebcamActive(false);
    setWebcamLiveEmotion(null);
    if (videoFrameIntervalRef.current) clearInterval(videoFrameIntervalRef.current);
    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
  };

  const handleImportClick = () => { clearAll(); fileInputRef.current?.click(); };
  const handleVideoClick = () => { clearAll(); videoInputRef.current?.click(); };

  const handleHome = () => {
    navigate('/');
    if (props.setTrigger) props.setTrigger(false);
  };

  const handleAdvanced = () => {
    navigate('/advanced/Model_1');
    if (props.setTrigger) props.setTrigger(false);
  };

  const handleWebcamClick = () => {
    const wasActive = isWebcamActive;
    clearAll();
    setIsWebcamActive(!wasActive);
  };

  const captureWebcam = async () => {
    if (!webcamRef.current) return;
    if (webcamProcessingRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    const blob = await (await fetch(imageSrc)).blob();
    const f = new File([blob], "webcam-capture.jpg", { type: "image/jpeg" });
    webcamProcessingRef.current = true;

    const formData = new FormData();
    formData.append('file', f);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/predict-image-emonet/?preview=0&model=dense6`, {
        method: 'POST',
        headers: { 'x-api-key': import.meta.env.VITE_API_KEY ?? '' },
        body: formData,
      });
      if (response.ok) {
        const result: PredictionResult = await response.json();
        if (result.faces?.length) {
          setPrediction(result);
          const face = result.faces[0] as any;
          if (face.emotion) {
            setWebcamLiveEmotion({
              emotion: face.emotion,
              confidence: face.confidence ?? 0,
            });
          }
        }
      }
    } catch { /* ignore */ } finally {
      webcamProcessingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isWebcamActive) return;
    captureIntervalRef.current = setInterval(() => { captureWebcam(); }, 150);
    return () => {
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    };
  }, [isWebcamActive]);

  // Draw bounding boxes for webcam
  useEffect(() => {
    const canvas = webcamCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const v = webcamRef.current?.video;
    if (!v) return;
    const elW = v.clientWidth || canvas.width;
    const elH = v.clientHeight || canvas.height;
    canvas.width = elW;
    canvas.height = elH;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!isWebcamActive || !prediction?.faces || !prediction.image_width) return;

    // compute object-fit:contain content area
    const natRatio = v.videoWidth / v.videoHeight;
    const elRatio = elW / elH;
    let cW: number, cH: number, offX: number, offY: number;
    if (natRatio > elRatio) {
      cW = elW; cH = elW / natRatio;
      offX = 0; offY = (elH - cH) / 2;
    } else {
      cH = elH; cW = elH * natRatio;
      offX = (elW - cW) / 2; offY = 0;
    }

    const emoColors: Record<string, string> = {
      Happiness: '#b9e7ab', Sadness: '#2d49d7', Anger: '#9a2315',
      Surprise: '#dacbf1', Fear: '#070605', Disgust: '#e95d22', Neutral: '#b3b3b3',
    };
    const scaleX = cW / prediction.image_width;
    const scaleY = cH / prediction.image_height;
    prediction.faces.forEach((face, i) => {
      if (!face.box) return;
      const { x, y, w, h } = face.box;
      const color = emoColors[face.emotion ?? ''] || '#ffffff';
      const bx = offX + x * scaleX;
      const by = offY + y * scaleY;
      const bw = w * scaleX;
      const bh = h * scaleY;

      // bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(bx, by, bw, bh);

      // label text
      const label = `#${i + 1} ${face.emotion ?? '—'}`;
      ctx.font = 'bold 12px monospace';
      const textWidth = ctx.measureText(label).width;
      const labelX = bx;
      const labelY = by > 22 ? by - 4 : by + bh + 18;

      // label background
      ctx.fillStyle = color;
      ctx.fillRect(labelX - 2, labelY - 15, textWidth + 8, 18);

      // label text
      ctx.fillStyle = '#fff';
      ctx.fillText(label,labelX + 2, labelY - 1);
    });
  }, [prediction, isWebcamActive]);

  const uploadImage = async (selectedFile: File) => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const endpoint = isWebcamActive
        ? `${import.meta.env.VITE_API_BASE ?? ''}/predict-image-emonet/?preview=0&model=dense6`
        : `${import.meta.env.VITE_API_BASE ?? ''}/predict-image-emonet/?preview=1&model=dense6`;
      const response = await fetch(endpoint, { method: 'POST', headers: { 'x-api-key': import.meta.env.VITE_API_KEY ?? '' }, body: formData });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const result: PredictionResult = await response.json();
      setPrediction(result);

      if (!isWebcamActive) {
        if (Array.isArray(result.preview_base64_list) && result.preview_base64_list.length > 0) {
          const mime = result.preview_mime || 'image/jpeg';
          const previews = result.preview_base64_list.map((b64: string) => `data:${mime};base64,${b64}`);
          setPreviewList(previews);
          setPreview(previews[0]);
        } else if (result.preview_base64) {
          const mime = result.preview_mime || 'image/jpeg';
          const previewUrl = `data:${mime};base64,${result.preview_base64}`;
          setPreview(previewUrl);
          setPreviewList([previewUrl]);
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  const captureVideoFrame = () => {
    const video = videoElementRef.current;
    if (!video || video.paused || video.ended) return;
    if (videoProcessingRef.current) return;
    const offscreen = document.createElement('canvas');
    offscreen.width = video.videoWidth;
    offscreen.height = video.videoHeight;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    offscreen.toBlob((blob) => {
      if (!blob) return;
      const f = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
      videoProcessingRef.current = true;
      uploadFrame(f).finally(() => { videoProcessingRef.current = false; });
    }, 'image/jpeg', 0.85);
  };

  const uploadFrame = async (frameFile: File) => {
    const formData = new FormData();
    formData.append('file', frameFile);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/predict-image-emonet/?preview=0&model=dense6`, {
        method: 'POST', headers: { 'x-api-key': import.meta.env.VITE_API_KEY ?? '' }, body: formData,
      });
      if (!response.ok) return;
      const result: PredictionResult = await response.json();
      setVideoPrediction(result);
      setHasPredictedOnce(true);
    } catch (e) {
      console.error('Frame predict error:', e);
    }
  };

  const handleVideoPlay = () => {
    setIsVideoActive(true);
    setVideoPlaying(true);
    videoFrameIntervalRef.current = setInterval(() => { captureVideoFrame(); }, 800);
  };

  const handleVideoStop = () => {
    setIsVideoActive(false);
    setVideoPlaying(false);
    if (videoFrameIntervalRef.current) clearInterval(videoFrameIntervalRef.current);
  };

  const handleCustomVideoToggle = () => {
    const v = videoElementRef.current;
    if (!v) return;
    if (v.paused) { v.play(); } else { v.pause(); }
  };

  const handleVideoReplay = () => {
    const v = videoElementRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play();
  };

  const handleVideoSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoElementRef.current;
    if (!v) return;
    v.currentTime = Number(e.target.value);
    setVideoCurrentTime(Number(e.target.value));
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  // Draw bounding boxes
  useEffect(() => {
    const canvas = videoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const v = videoElementRef.current;
    if (v) {
      canvas.width = v.clientWidth || canvas.width;
      canvas.height = v.clientHeight || canvas.height;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!videoPrediction?.faces || !videoPrediction.image_width) return;
    const emoColors: Record<string, string> = {
      Happiness: '#b9e7ab', Sadness: '#2d49d7', Anger: '#9a2315',
      Surprise: '#dacbf1', Fear: '#070605', Disgust: '#e95d22', Neutral: '#b3b3b3',
    };
    const scaleX = canvas.width / videoPrediction.image_width;
    const scaleY = canvas.height / videoPrediction.image_height;
    videoPrediction.faces.forEach((face, i) => {
      if (!face.box) return;
      const { x, y, w, h } = face.box;
      const color = emoColors[face.emotion ?? ''] || '#ffffff';
      const bx = x * scaleX, by = y * scaleY, bw = w * scaleX, bh = h * scaleY;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(bx, by, bw, bh);
      const label = `#${i + 1} ${face.emotion ?? '—'}`;
      ctx.font = 'bold 12px monospace';
      const tw = ctx.measureText(label).width;
      const lx = bx, ly = by > 22 ? by - 4 : by + bh + 18;
      ctx.fillStyle = color;
      ctx.fillRect(lx - 2, ly - 15, tw + 8, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(label,lx + 2, ly - 1);
    });
  }, [videoPrediction, isVideoActive]);

  const faces = prediction?.faces ?? [];

  return (
    <>
    <svg className="box-grid-svg-filter-gen">
      <defs>
        <filter id="wavy-gen">
          <feTurbulence type="turbulence" baseFrequency="0.012" numOctaves="2" seed="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
    <div className='container-3'>
      <div className="box-grid-bg-gen" />
      <span className="switch-chip-nav" onClick={handleAdvanced}>Switch to<br/>ADVANCE</span>
      <div className="nav-item" onClick={handleHome}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 169.66 162.31" width="60" height="60">
                        <defs>
                            <style>{`
                            .cls-1 { fill: #d8903a; }
                            .cls-2 { fill: #f5cd9e; }
                            .cls-2, .cls-3, .cls-4, .cls-5, .cls-6 { stroke-miterlimit: 10; }
                            .cls-2, .cls-4, .cls-5, .cls-6 { stroke: #93551a; }
                            .cls-3 { fill: #c88635; stroke: #f5cd9e; }
                            .cls-4 { fill: none; }
                            .cls-7 { fill: #fff; }
                            .cls-7, .cls-5 { font-family: ForteMT, Forte; font-size: 125px; }
                            .cls-8 { opacity: .5; }
                            .cls-8, .cls-5 { fill: #93551a; }
                            .cls-6 { fill: #f4ceb3; }
                            `}</style>
                        </defs>
                        <g id="Layer_1" data-name="Layer 1">
                            <g>
                            <path className="cls-1" d="M62.85,15.14c-.12,1.3-2.69-1.98-4.45-2.21s-2,1.63-2.28,2.84-1.12,4.02.87,5.94,6.85,3.29,6.39,4.49-4.93-.98-7.76-.86-3.99,2.74-4.6,3.85-2.15,3.56-.73,5.95,5.71,4.99,4.96,6.03-4.5-2.25-7.26-2.88-4.57,1.6-5.44,2.51-2.99,2.88-2.24,5.56,4.23,6.29,3.23,7.1-3.78-3.33-6.28-4.64-4.82.39-5.9,1.05-3.61,2.04-3.55,4.82,2.52,7.15,1.34,7.69-2.82-4.17-4.92-6.07-4.77-.82-5.98-.44-3.99,1.08-4.63,3.79.67,7.55-.6,7.78-3.46-4.38-6.16-5.81-4.84-.24-6.12-.17c-.63,2.15-.14,3.99,2.54,5.5,2.53,1.42,7.67,1.38,7.67,3.5s-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.75-2.61,5.92c0,2.45-.76,4.53.96,4.79,1.34.21,4.13-2.81,5.77-1.84,2.96,1.76,1.9,6.36,3.13,8.16,1.38,2.02,4.19.9,8.05.9,3.66,0,6.86.22,8.69-2.28s2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.86.22,8.69-2.28,2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.86.22,8.69-2.28,2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.86.22,8.69-2.28,2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.87.22,8.69-2.28,2.28-7.72,5.94-7.72c3.35,0,5.09,5.79,7.8,8.41,3.21,3.11,6.15,3.41,9.06.71,2.71-2.5,2.35-5.3-.7-8.5-2.54-2.66-8.24-4.36-8.24-7.42,0-3.38,5.16-3.65,7.66-5.34s2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.16-3.65,7.66-5.34,2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.16-3.65,7.66-5.34,2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.16-3.65,7.66-5.34,2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.17-3.65,7.67-5.34,2.33-4.79,2.33-8.17c0-3.61,1.11-6.28-.87-7.47-1.72-1.04-6.1.39-7.91-2.19-1.21-1.72,1.58-4.85,1.24-6.25-.42-1.77-2.62-.9-5.26-.9-2.38,0-5.11.06-6.3,2.56s-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.3-2.56-5.11.06-6.3,2.56-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.29-2.56-5.11.06-6.29,2.56-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.3-2.56-5.11.06-6.3,2.56-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.3-2.56-4.93-.04-5.84,2.34c-.85,2.23.33,6.81-1.89,7.42s-3.6-2.96-4.82-3.27-1.83,2.37-4.14,2.98Z"/>
                            <path className="cls-4" d="M62.85,15.14c-.12,1.3-2.69-1.98-4.45-2.21s-2,1.63-2.28,2.84-1.12,4.02.87,5.94,6.85,3.29,6.39,4.49-4.93-.98-7.76-.86-3.99,2.74-4.6,3.85-2.15,3.56-.73,5.95,5.71,4.99,4.96,6.03-4.5-2.25-7.26-2.88-4.57,1.6-5.44,2.51-2.99,2.88-2.24,5.56,4.23,6.29,3.23,7.1-3.78-3.33-6.28-4.64-4.82.39-5.9,1.05-3.61,2.04-3.55,4.82,2.52,7.15,1.34,7.69-2.82-4.17-4.92-6.07-4.77-.82-5.98-.44-3.99,1.08-4.63,3.79.67,7.55-.6,7.78-3.46-4.38-6.16-5.81-4.84-.24-6.12-.17c-.63,2.15-.14,3.99,2.54,5.5,2.53,1.42,7.67,1.38,7.67,3.5s-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.75-2.61,5.92c0,2.45-.76,4.53.96,4.79,1.34.21,4.13-2.81,5.77-1.84,2.96,1.76,1.9,6.36,3.13,8.16,1.38,2.02,4.19.9,8.05.9,3.66,0,6.86.22,8.69-2.28s2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.86.22,8.69-2.28,2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.86.22,8.69-2.28,2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.86.22,8.69-2.28,2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.87.22,8.69-2.28,2.28-7.72,5.94-7.72c3.35,0,5.09,5.79,7.8,8.41,3.21,3.11,6.15,3.41,9.06.71,2.71-2.5,2.35-5.3-.7-8.5-2.54-2.66-8.24-4.36-8.24-7.42,0-3.38,5.16-3.65,7.66-5.34s2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.16-3.65,7.66-5.34,2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.16-3.65,7.66-5.34,2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.16-3.65,7.66-5.34,2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.17-3.65,7.67-5.34,2.33-4.79,2.33-8.17c0-3.61,1.11-6.28-.87-7.47-1.72-1.04-6.1.39-7.91-2.19-1.21-1.72,1.58-4.85,1.24-6.25-.42-1.77-2.62-.9-5.26-.9-2.38,0-5.11.06-6.3,2.56s-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.3-2.56-5.11.06-6.3,2.56-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.29-2.56-5.11.06-6.29,2.56-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.3-2.56-5.11.06-6.3,2.56-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.3-2.56-4.93-.04-5.84,2.34c-.85,2.23.33,6.81-1.89,7.42s-3.6-2.96-4.82-3.27-1.83,2.37-4.14,2.98Z"/>
                            </g>
                            <g>
                            <path className="cls-1" d="M41.68,28.28c-.43.53-.63.62-1.25.91s-.69.13-1.31.42-.93-.38-1.55-.09-.44.98-1.1.81-.84-.21-1.23-.77.05-.87-.34-1.43.14-.93-.25-1.49-.65-.17-.76-.85-.79-.7-.61-1.38.93-.48,1.11-1.16-.34-.82-.16-1.5-.13-.77.05-1.45.57-.57,1.01-1.12.38-.63.99-.92.46-.63,1.07-.92.76,0,1.38-.28.6-.12,1.26.05,1.04-.2,1.43.36.32.61.71,1.17.45.52.84,1.08.38.78.49,1.46-1.03.57-1.21,1.25-.02.72-.21,1.4.13.76-.05,1.44.29.69.29,1.4c0,.83-.17,1.05-.62,1.59Z"/>
                            <path className="cls-4" d="M41.68,28.28c-.43.53-.63.62-1.25.91s-.69.13-1.31.42-.93-.38-1.55-.09-.44.98-1.1.81-.84-.21-1.23-.77.05-.87-.34-1.43.14-.93-.25-1.49-.65-.17-.76-.85-.79-.7-.61-1.38.93-.48,1.11-1.16-.34-.82-.16-1.5-.13-.77.05-1.45.57-.57,1.01-1.12.38-.63.99-.92.46-.63,1.07-.92.76,0,1.38-.28.6-.12,1.26.05,1.04-.2,1.43.36.32.61.71,1.17.45.52.84,1.08.38.78.49,1.46-1.03.57-1.21,1.25-.02.72-.21,1.4.13.76-.05,1.44.29.69.29,1.4c0,.83-.17,1.05-.62,1.59Z"/>
                            </g>
                            <g>
                            <path className="cls-1" d="M17.68,43.78c-.46.46-.74.55-1.37.72s-.68-.02-1.32.14-.84-.63-1.47-.46-.56.44-1.19.61-.47.8-1.1.97-.79-.07-1.42-.24.04-.97-.42-1.43-.53-.39-.99-.85-1.25.32-1.71-.14.14-1.07-.32-1.53-.89-.04-1.36-.5-1.17-.31-1.34-.94.93-.74,1.1-1.37-.29-.75-.12-1.38-.23-.74-.06-1.37.53-.53.7-1.16.9-.44,1.07-1.07-1.07-1.45-.61-1.91.99-.28,1.62-.44.61-.24,1.24-.41.75.27,1.38.1.88.77,1.51.6.59-.34,1.22-.51.47-.85,1.1-.69.92-.09,1.38.37-.35,1.27.11,1.73.48.44.95.9.9.03,1.36.49.77.16,1.23.63,1.12.46,1.29,1.1-.92.82-1.09,1.45-.48.55-.65,1.18.81.89.64,1.52-1.23.35-1.4.98-.2.73-.18,1.38c.03.81.67,1.08.21,1.54Z"/>
                            <path className="cls-4" d="M17.68,43.78c-.46.46-.74.55-1.37.72s-.68-.02-1.32.14-.84-.63-1.47-.46-.56.44-1.19.61-.47.8-1.1.97-.79-.07-1.42-.24.04-.97-.42-1.43-.53-.39-.99-.85-1.25.32-1.71-.14.14-1.07-.32-1.53-.89-.04-1.36-.5-1.17-.31-1.34-.94.93-.74,1.1-1.37-.29-.75-.12-1.38-.23-.74-.06-1.37.53-.53.7-1.16.9-.44,1.07-1.07-1.07-1.45-.61-1.91.99-.28,1.62-.44.61-.24,1.24-.41.75.27,1.38.1.88.77,1.51.6.59-.34,1.22-.51.47-.85,1.1-.69.92-.09,1.38.37-.35,1.27.11,1.73.48.44.95.9.9.03,1.36.49.77.16,1.23.63,1.12.46,1.29,1.1-.92.82-1.09,1.45-.48.55-.65,1.18.81.89.64,1.52-1.23.35-1.4.98-.2.73-.18,1.38c.03.81.67,1.08.21,1.54Z"/>
                            </g>
                            <g>
                            <path className="cls-4" d="M22.07,8.54c-.42.5-.65.46-1.27.7s-.66.12-1.27.36-.65.18-1.29,0-.44-.34-.86-.85-.71-.27-1.13-.78-.45-.6-.56-1.24c-.13-.76.61-.63.8-1.38s.14-.76.34-1.5-.67-1.18-.17-1.77c.42-.5.91.15,1.53-.08s.49-.57,1.11-.8.74-.85,1.37-.68.24.92.65,1.43.63.34,1.05.85,1,.41,1.11,1.06c.13.76-.42.86-.62,1.6s-.8.66-.84,1.43c-.04.85.53,1.06.04,1.65Z"/>
                            <path className="cls-1" d="M22.07,8.54c-.42.5-.65.46-1.27.7s-.66.12-1.27.36-.65.18-1.29,0-.44-.34-.86-.85-.71-.27-1.13-.78-.45-.6-.56-1.24c-.13-.76.61-.63.8-1.38s.14-.76.34-1.5-.67-1.18-.17-1.77c.42-.5.91.15,1.53-.08s.49-.57,1.11-.8.74-.85,1.37-.68.24.92.65,1.43.63.34,1.05.85,1,.41,1.11,1.06c.13.76-.42.86-.62,1.6s-.8.66-.84,1.43c-.04.85.53,1.06.04,1.65Z"/>
                            </g>
                        </g>
                        <g id="Layer_2" data-name="Layer 2">
                            <text className="cls-5" transform="translate(24.47 113.85) scale(1.4 1)"><tspan x="0" y="0">m</tspan></text>
                            <text className="cls-7" transform="translate(11.08 113.85) scale(1.4 1)"><tspan x="0" y="0">m</tspan></text>
                        </g>
                        <g id="Layer_3" data-name="Layer 3">
                            <circle className="cls-3" cx="91.79" cy="41.94" r="4"/>
                            <circle className="cls-6" cx="137.29" cy="41.94" r="4"/>
                            <circle className="cls-8" cx="46.29" cy="132.67" r="4"/>
                            <circle className="cls-2" cx="42.29" cy="132.67" r="4"/>
                            <circle className="cls-8" cx="95.04" cy="132.67" r="4"/>
                            <circle className="cls-6" cx="91.79" cy="132.67" r="4"/>
                            <circle className="cls-8" cx="136.54" cy="132.67" r="4"/>
                            <circle className="cls-3" cx="133.29" cy="132.67" r="4"/>
                        </g>
                    </svg>
      </div>
      <div className='inner-container'>
        <div className='menu-container'>
          <span className="switch-chip" onClick={handleAdvanced}>Switch to<br/>ADVANCE</span>
          <div className='menu-item'>
            <div className='image-item' onClick={handleImportClick}>
              <img src={addimg} className='add_img' alt="Import" />
                  <input
                    type="file"
                    id="imageInput"
                    ref={fileInputRef}
                    accept='image/*'
                    onChange={handleChange}
                    className="hidden"
                  />
            </div>
            <span className="type">Import Image</span>
          </div>
          <div className='menu-item'>
            <div className='video-item' onClick={handleVideoClick}>
              <img src={videoimg} className='add_img' alt="Video" />
                  <input
                    type="file"
                    ref={videoInputRef}
                    accept="video/*"
                    onChange={handleVideoChange}
                    className="hidden"
                  />
            </div>
            <span className="type">Import Video</span>
          </div>

          <div className='menu-item'>
            <div className={`webcam-item${isWebcamActive ? ' active' : ''}`}
                  onClick={handleWebcamClick}
                >
                  <img src={webcamimg} className='add_img' alt="Webcam" />
            </div>
              <span className="type">Webcam</span>
          </div>
        </div>

        <div className='middle-panel'>
          <div className='middle-input-space'>
            <div className='middle-content'>
              {!file && !isWebcamActive && (
                <div className="mood-title">
                  MOOD!
                  <span>preview</span>
                </div>
              )}
            {file && fileType === 'video' && (
                  <div className="webcam-wrapper">
                    <div className="video-wrapper">
                      <video
                        ref={videoElementRef}
                        src={file}
                        muted
                        className="video-element"
                        onPlay={handleVideoPlay}
                        onPause={handleVideoStop}
                        onEnded={() => { handleVideoStop(); setVideoCurrentTime(videoDuration); }}
                        onTimeUpdate={() => setVideoCurrentTime(videoElementRef.current?.currentTime ?? 0)}
                        onLoadedMetadata={() => setVideoDuration(videoElementRef.current?.duration ?? 0)}
                      />
                      <canvas ref={videoCanvasRef} className="webcam-canvas" />
                    </div>
                    <div className="video-controls">
                      <button className="video-btn" onClick={handleCustomVideoToggle}>
                        {videoPlaying ? '⏸' : '▶'}
                      </button>
                      {hasPredictedOnce && (
                        <button className="video-btn" onClick={handleVideoReplay}>↩ Replay</button>
                      )}
                    </div>
                    <div className="video-timebar">
                      <span className="video-time">{formatTime(videoCurrentTime)}</span>
                      <input
                        type="range"
                        className="video-progress"
                        min={0}
                        max={videoDuration || 0}
                        step={0.1}
                        value={videoCurrentTime}
                        onChange={handleVideoSeek}
                      />
                      <span className="video-time">{formatTime(videoDuration)}</span>
                    </div>
                  </div>
                )}

                {file && fileType === 'image' && (
                  <img src={file} alt="Uploaded preview" className="hidden" />
                )}

                {(preview && prediction?.faces) && (
                  <div className='preview-container'>
                    <div className="preview-frame">
                      <div className="preview-image-wrapper">
                      <img
                        ref={imgRef}
                        src={preview}
                        className="preview-image"
                        alt="Preview"
                        onLoad={() => {
                          if (imgRef.current) {
                            setImgSize({
                              width: imgRef.current.clientWidth,
                              height: imgRef.current.clientHeight,
                            });
                          }
                        }}
                      />

                      {faces.map((face: FaceData, index: number) => {
                        if (!face?.box) return null;
                        const { x, y, w, h } = face.box;
                        const renderedWidth = imgSize?.width || imgRef.current?.clientWidth || prediction.image_width;
                        const renderedHeight = imgSize?.height || imgRef.current?.clientHeight || prediction.image_height;
                        const scaleX = renderedWidth / prediction.image_width;
                        const scaleY = renderedHeight / prediction.image_height;
                        const left = Math.max(0, x * scaleX);
                        const top = Math.max(0, y * scaleY);
                        const width = Math.min(renderedWidth - left, w * scaleX);
                        const height = Math.min(renderedHeight - top, h * scaleY);
                        const emotionColors: Record<string, string> = {
                          Happiness: '#97e77f', Sadness: '#2D49D7', Anger: '#9A2315',
                          Surprise: '#be9fec', Fear: '#070605', Disgust: '#e95d22',
                          Neutral: '#928e8e',
                        };
                        const borderColor = emotionColors[face.emotion ?? "N/A"] || '#ffffff';
                        return (
                          <div
                            key={index}
                            className="face-box"
                            style={{
                              left: `${left}px`,
                              top: `${top}px`,
                              width: `${width}px`,
                              height: `${height}px`,
                              border: `3px solid ${borderColor}`,
                            }}
                          >
                            <div className="face-box-label" style={{ background: borderColor }}>
                              #{index + 1} {face.emotion ?? '—'}
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  </div>
                )}

            {isWebcamActive && (
              <div className="webcam-wrapper">
                <div className="webcam-frame">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.7}
                    videoConstraints={{ width: 320, height: 240, facingMode: 'user' }}
                    className="webcam-feed"
                  />
                  <canvas
                    ref={webcamCanvasRef}
                    className="webcam-canvas"
                  />
                </div>
              </div>
            )}
          </div>
          </div>
        
        </div>
      </div>
    </div>
    </>
  );
}

export default Core_gen;
