import React, { useEffect, useRef, useState } from 'react';
import './core_advanced.css';
import { useNavigate } from 'react-router-dom';
import Webcam from "react-webcam";
import addimg from "/img/add-image.png" ;
import videoimg from "/img/video-production.png";
import webcamimg from "/img/webcam.png";

import type { FaceBox, SequenceResult, PredictionResult, FaceTracked, BoxQueueItem, DropdownOption, CardAdProps } from '../types/face';
import { EmotionFilter } from './components/EmotionFilter';
import { EmotionTimeline } from './components/EmotionTimeline';
import { FaceCardList } from './components/FaceCardList';
import { ImagePreview } from './components/ImagePreview';
import { VideoPlayer } from './components/VideoPlayer';
import { WebcamFeed } from './components/WebcamFeed';
import { useVideoBox } from './hooks/useVideoBox';

const EMOTION_COLORS: Record<string, string> = {
  Happiness: '#b9e7ab', Sadness: '#2d49d7', Anger: '#9a2315',
  Surprise: '#dacbf1', Fear: '#070605', Disgust: '#e95d22', Neutral: '#b3b3b3',
};

function Core_Ad(props: CardAdProps) {

    const navigate = useNavigate();
    const [file, setFile] = useState<string | null>(null);
    const [prediction, setPrediction] = useState<PredictionResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const webcamRef = useRef<Webcam>(null);
    const videoPlayerRef = useRef<HTMLVideoElement>(null);
    const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
    const faceTrackRef = useRef<Record<number, FaceTracked>>({});
    const lastCapturedFrameRef = useRef<string | null>(null);
    const webcamSessionIdRef = useRef<string | null>(null);
    const predDimsRef = useRef({ w: 1, h: 1 });
    const [videoEnded, setVideoEnded] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [_previewList, setPreviewList] = useState<string[]>([]);
    const [isWebcamActive, setIsWebcamActive] = useState(false);
    const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const webcamProcessingRef = useRef(false);
    const [webcamError, setWebcamError] = useState<string | null>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
    const [_showPopup, setShowPopup] = useState(false);
    const [videoLoading, setVideoLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [detectedFrame, setDetectedFrame] = useState(0);
    const [totalFrames, setTotalFrames] = useState(0);
    const [warnMsg, setWarnMsg] = useState<string | null>(null);
    const [_pendingFile, setPendingFile] = useState<File | null>(null);
    const [pendingFileUrl, setPendingFileUrl] = useState<string | null>(null);
    const [pendingFileType, setPendingFileType] = useState<'image' | 'video' | 'webcam' | null>(null);
    const [showCheckBox, setShowCheckBox] = useState(true);
    const [checkboxDropdownOpen, setCheckboxDropdownOpen] = useState(false);
    const [toRun, setToRun] = useState(true);
    const [useFaceDetect, setUseFaceDetect] = useState(true);
    const [focusNeutral, setFocusNeutral] = useState(true);
    const [focusHappiness, setFocusHappiness] = useState(true);
    const [focusSad, setFocusSad] = useState(true);
    const [focusAngry, setFocusAngry] = useState(true);
    const [focusFearful, setFocusFearful] = useState(true);
    const [focusDisgusted, setFocusDisgusted] = useState(true);
    const [focusSurprised, setFocusSurprised] = useState(true);
    const [sourceType, setSourceType] = useState<'image' | 'video' | 'webcam' | null>(null);
    const [leftPanelLocked, setLeftPanelLocked] = useState(false);
    const [menuLocked, setMenuLocked] = useState(true);
    const [_showModelPicker, setShowModelPicker] = useState(false);
    const [_showImageDropdown, setShowImageDropdown] = useState(false);
    const [inputLocked, setInputLocked] = useState(true);
    const [isVideoReplaying, setIsVideoReplaying] = useState(false);
    const [webcamResults, setWebcamResults] = useState<any[]>([]);
    const [webcamLiveEmotion, setWebcamLiveEmotion] = useState<Array<{ emotion: string; confidence: number; pose: string; pan: number; thumb?: string }> | null>(null);
    const [_webcamFrameIndex, setWebcamFrameIndex] = useState(0);
    const [streamingSequences, setStreamingSequences] = useState<SequenceResult[]>([]);
    const [videoBoxActive, setVideoBoxActive] = useState(false);
    const videoCanvasRef = useRef<HTMLCanvasElement>(null);
    const [boxQueueDone, setBoxQueueDone] = useState(false);
    const [analyzingFrame, setAnalyzingFrame] = useState<string>('');
    const [videoCurrentTime, setVideoCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const [activeSeqIndex, setActiveSeqIndex] = useState<number | null>(null);
    const [inputFileName, setInputFileName] = useState<string>('');

    const [showDropdown, setShowDropdown] = useState(false);
    const [showWebcamDropdown, setShowWebcamDropdown] = useState(false);
    const [selectedOption, setSelectedOption] = useState<DropdownOption | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const webcamDropdownRef = useRef<HTMLDivElement>(null);
    const focusedEmotionsRef = useRef<Set<string> | null>(null);
    const { seqBoxQueueRef, allBoxItemsRef, processBoxQueue, handleBoxReplay, reset: resetVideoBox } = useVideoBox(
      videoCanvasRef, videoPlayerRef, setActiveSeqIndex, setStreamingSequences, setBoxQueueDone
    );

    const formatTime = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const clearWebcamSession = () => {
      const sid = webcamSessionIdRef.current;
      if (sid) {
        fetch(`${import.meta.env.VITE_API_BASE ?? ''}/webcam-session/${sid}`, {
          method: 'DELETE',
          headers: { 'x-api-key': import.meta.env.VITE_API_KEY ?? '' },
        }).catch(() => {});
        webcamSessionIdRef.current = null;
      }
    };

    const clearAllData = () => {
      setIsWebcamActive(false);
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      clearWebcamSession();
      setPrediction(null);
      setStreamingSequences([]);
      setWebcamResults([]);
      setWebcamLiveEmotion(null);
      setWebcamFrameIndex(0);
      setPreview(null);
      setPreviewList([]);
      setVideoBoxActive(false);
      setBoxQueueDone(false);
      resetVideoBox();
      faceTrackRef.current = {};
      setInputFileName('');
      setSourceType(null);
      setLeftPanelLocked(false);
      setInputLocked(true);
      setShowCheckBox(true);
      setMenuLocked(true);
      setSelectedOption(null);
      setToRun(true);
      setVideoEnded(false);
      setIsVideoReplaying(false);
      setVideoLoading(false);
      setUploadProgress(0);
      setPendingFile(null);
      setPendingFileUrl(null);
      setPendingFileType(null);
      setShowDropdown(false);
      setShowWebcamDropdown(false);
    };

    const endSession = () => {
      clearAllData();
    };

    const IMAGE_MAX_MB = 20;
    const VIDEO_MAX_MB = 50;

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      if (e.target.files && e.target.files[0]) {
        const f = e.target.files[0];
        if (f.size > IMAGE_MAX_MB * 1024 * 1024) {
          setWarnMsg(`Image file too large. Maximum size is ${IMAGE_MAX_MB} MB.`);
          e.target.value = '';
          return;
        }
        const url = URL.createObjectURL(f);

        setIsWebcamActive(false);
        setPrediction(null);
        setPreview(null);
        setPreviewList([]);

        setInputFileName(f.name);
        setPendingFile(f);
        setPendingFileUrl(url);
        setPendingFileType('image');
        setFile(url);
        setInputLocked(false);
        uploadImage(f);
      }
    }

    function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
      if (e.target.files && e.target.files[0]) {
        const videoFile = e.target.files[0];
        if (videoFile.size > VIDEO_MAX_MB * 1024 * 1024) {
          setWarnMsg(`Video file too large. Maximum size is ${VIDEO_MAX_MB} MB.`);
          e.target.value = '';
          return;
        }
        const url = URL.createObjectURL(videoFile);

        setIsWebcamActive(false);
        setPrediction(null);
        setPreview(null);
        setPreviewList([]);
        setVideoEnded(false);
        setIsVideoReplaying(false);

        setInputFileName(videoFile.name);
        setPendingFile(videoFile);
        setPendingFileUrl(url);
        setPendingFileType('video');
        setFile(url);
        setInputLocked(false);
        uploadVideo(videoFile, selectedOption?.value);
      }
    }

    const handleRunPendingFile = async () => {
      if (!toRun || !sourceType) return;
      if (sourceType !== 'image' && !selectedOption) return;

      if (sourceType === 'image') {
        fileInputRef.current?.click();
        return;
      }

      if (sourceType === 'video') {
        videoInputRef.current?.click();
        return;
      }

      if (sourceType === 'webcam') {
        setPendingFile(null);
        setPendingFileUrl(null);
        setPendingFileType('webcam');
        setWebcamResults([]);
      setWebcamLiveEmotion(null);
        setWebcamFrameIndex(0);
        setStreamingSequences([]);
        setPrediction(null);
        setVideoBoxActive(false);
        setBoxQueueDone(false);
        resetVideoBox();
        setIsWebcamActive(true);
        setInputLocked(false);
        return;
      }
    };

    const handleStopWebcam = () => {
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      setIsWebcamActive(false);
      clearWebcamSession();
    };

const handleWebcamModelSelect = (value: string) => {
      const option: DropdownOption = {
        id: value === 'emo-net' ? 2 : 1,
        label: value === 'emo-net' ? 'Emo-Net (fine tune)' : 'Emo-Net',
        value,
      };

      clearWebcamSession();
      if (value === 'emo-net' || value === 'default') {
        webcamSessionIdRef.current = crypto.randomUUID();
      }

      setSelectedOption(option);
      setShowWebcamDropdown(false);
      setShowCheckBox(true);
      setToRun(true);
      setLeftPanelLocked(false);
      setInputFileName('webcam');
      setPendingFileType('webcam');
      setWebcamResults([]);
      setWebcamLiveEmotion(null);
      setWebcamFrameIndex(0);
      setStreamingSequences([]);
      setPrediction(null);
      setVideoBoxActive(false);
      resetVideoBox();
      setIsWebcamActive(true);
      setInputLocked(false);
    };

    const handleVideoModelSelect = (value: string) => {
      const option: DropdownOption = {
        id: value === 'emo-net' ? 2 : 1,
        label: value === 'emo-net' ? 'Emo-Net (fine tune)' : 'Emo-Net',
        value,
      };

      setSelectedOption(option);
      setShowDropdown(false);
      videoInputRef.current?.click();
    };

    const handleImageSourceClick = () => {
      const proceed = () => {
        if (prediction !== null || webcamResults.length > 0 || isWebcamActive) {
          clearAllData();
        }
        setSourceType('image');
        setSelectedOption(null);
        setShowDropdown(false);
        setShowWebcamDropdown(false);
        setShowImageDropdown(false);
        setShowModelPicker(false);
        setShowCheckBox(true);
        setToRun(true);
        setLeftPanelLocked(false);
        setMenuLocked(false);
        setPendingFile(null);
        setPendingFileUrl(null);
        setPendingFileType(null);
        setInputLocked(true);
        setPrediction(null);
        setPreview(null);
        setPreviewList([]);
        fileInputRef.current?.click();
      };
      proceed();
    };

    const handleVideoSourceClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (prediction !== null || webcamResults.length > 0 || isWebcamActive) {
        clearAllData();
      }
      setSourceType('video');
      setShowDropdown(true);
      setShowWebcamDropdown(false);
      setShowCheckBox(true);
      setToRun(true);
      setMenuLocked(false);
      setLeftPanelLocked(true);
      setIsVideoReplaying(false);
      setPendingFile(null);
      setPendingFileUrl(null);
      setPendingFileType(null);
      setSelectedOption(null);
      setPrediction(null);
      setPreview(null);
      setPreviewList([]);
    };

    const handleWebcamSourceClick = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (isWebcamActive) {
        handleStopWebcam();
        return;
      }
      if (prediction !== null || webcamResults.length > 0) {
        clearAllData();
      }
      setSourceType('webcam');
      setShowDropdown(false);
      setShowWebcamDropdown(true);
      setShowCheckBox(true);
      setToRun(true);
      setMenuLocked(false);
      setLeftPanelLocked(true);
      setPendingFile(null);
      setPendingFileUrl(null);
      setPendingFileType(null);
      setSelectedOption(null);
      setPrediction(null);
      setPreview(null);
      setPreviewList([]);
      setWebcamError(null);
    };

    const handleHome = () => {
      navigate('/');
      if (props.setTrigger) props.setTrigger(false);
    };

    const handleCoreGeneral = () => {
      navigate('/general/core_general');
      if (props.setTrigger) props.setTrigger(false);
    };

    const handleViewResult = () => {
      const p = prediction;
      const wr = webcamResults;
      const st = sourceType;
      const f = file;
      const fe = focusedEmotions ? Array.from(focusedEmotions) : null;
      endSession();
      navigate('/advanced/View_Result', { state: { prediction: p, webcamResults: wr, sourceType: st, videoUrl: f, inputFileName, focusedEmotions: fe, modelValue: selectedOption?.value } });
      if (props.setTrigger) props.setTrigger(false);
    };
  
    const captureWebcam = async () => {
      if (!webcamRef.current) return;
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;
      lastCapturedFrameRef.current = imageSrc;

      const blob = await new Promise<Blob>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const MAX_W = 640, MAX_H = 480;
          const scale = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(img.width  * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85);
        };
        img.src = imageSrc;
      });
      const file = new File([blob], "webcam-capture.jpg", { type: "image/jpeg" });

      if (webcamProcessingRef.current) return;
      webcamProcessingRef.current = true;

      if (selectedOption?.value === 'emo-net' || selectedOption?.value === 'default') {
        captureWebcamLSTM(file).finally(() => { webcamProcessingRef.current = false; });
      } else {
        uploadImage(file).finally(() => { webcamProcessingRef.current = false; });
      }
    };

    const captureWebcamLSTM = async (file: File) => {
      const sessionId = webcamSessionIdRef.current;
      if (!sessionId) return;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_id', sessionId);
      formData.append('model', selectedOption?.value === 'default' ? 'dense7' : 'finetune');

      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/predict-webcam-emonet/lstm/`, {
          method: 'POST',
          headers: { 'x-api-key': import.meta.env.VITE_API_KEY ?? '' },
          body: formData,
        });
        if (!response.ok) return;

        const result = await response.json();

        // Always update prediction if box data is present (shows box while LSTM warms up)
        if (result.faces?.length) {
          setPrediction(result);
        }

        if (result.faces?.length) {
          const capturedSrc = lastCapturedFrameRef.current;

          const processWithThumbs = (thumbs: (string | undefined)[]) => {
            setWebcamLiveEmotion(result.faces.map((f: any, i: number) => ({
              emotion: f.emotion ?? '',
              confidence: f.confidence ?? 0,
              pose: f.pose ?? '',
              pan: f.pan ?? 0,
              thumb: thumbs[i],
            })));
            if (result.ready) {
              const readyEntries = (result.faces as any[])
                .map((f: any, i: number) => ({ f, thumb: thumbs[i] }))
                .filter(({ f }) => f.ready);
              if (readyEntries.length) {
                setWebcamResults(prev => [
                  ...prev,
                  ...readyEntries.map(({ f, thumb }: any, i: number) => ({
                    frameIndex: prev.length + i + 1,
                    timestamp: new Date().toISOString(),
                    emotion: f.emotion ?? '',
                    confidence: f.confidence ?? '',
                    pose: f.pose ?? '',
                    pan: f.pan ?? '',
                    thumb,
                  })),
                ]);
              }
            }
          };

          if (capturedSrc && result.image_width) {
            const img = new Image();
            img.onload = () => {
              const rx = img.naturalWidth / result.image_width;
              const ry = img.naturalHeight / result.image_height;
              const thumbs = result.faces.map((f: any) => {
                if (!f.box) return undefined;
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return undefined;
                const x = Math.max(0, f.box.x * rx);
                const y = Math.max(0, f.box.y * ry);
                const w = Math.min(img.naturalWidth - x, f.box.w * rx);
                const h = Math.min(img.naturalHeight - y, f.box.h * ry);
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
                return canvas.toDataURL('image/jpeg');
              });
              processWithThumbs(thumbs);
            };
            img.src = capturedSrc;
          } else {
            processWithThumbs(result.faces.map(() => undefined));
          }
        }
      } catch { /* ignore network errors */ }
    };

    // Real-time continuous capture
    useEffect(() => {
      if (!isWebcamActive || !selectedOption) return;
      captureIntervalRef.current = setInterval(() => { captureWebcam(); }, 150);
      return () => {
        if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      };
    }, [isWebcamActive, selectedOption]);
  
    const uploadImage = async (selectedFile: File, modelValue?: string) => {
      if (!selectedFile) {
        alert("Please select an image");
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      const model = modelValue ?? selectedOption?.value;

      try {
        if (model === 'emo-net' || model === 'default') {
          const response = await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/predict-image-emonet/?preview=${isWebcamActive ? 0 : 1}&model=dense6`, {
            method: 'POST',
            headers: { 'x-api-key': import.meta.env.VITE_API_KEY ?? '' },
            body: formData
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result: PredictionResult = await response.json();
            if (isWebcamActive) {
              const face = result?.faces?.[0];

              setWebcamResults((prev) => [
                ...prev,
                {
                  frameIndex: prev.length + 1,
                  timestamp: new Date().toISOString(),
                  emotion: face?.emotion ?? '',
                  confidence: face?.confidence ?? '',
                  pose: face?.pose ?? '',
                  pan: face?.pan ?? ''
                }
              ]);
            }
          setPrediction(result);
          if (!isWebcamActive) { setShowPopup(true); }

          if (result.preview_base64) {
            const mime = result.preview_mime || 'image/jpeg';
            const previewUrl = `data:${mime};base64,${result.preview_base64}`;
            setPreview(previewUrl);
            setPreviewList([previewUrl]);
          }

        } else {
          const response = await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/predict-image-emonet/?preview=${isWebcamActive ? 0 : 1}&model=dense6`, {
            method: 'POST',
            headers: { 'x-api-key': import.meta.env.VITE_API_KEY ?? '' },
            body: formData
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result: PredictionResult = await response.json();
          if (isWebcamActive) {
            const face = result?.faces?.[0];

            setWebcamResults((prev) => [
              ...prev,
              {
                frameIndex: prev.length + 1,
                timestamp: new Date().toISOString(),
                emotion: face?.emotion ?? '',
                confidence: face?.confidence ?? '',
                pose: face?.pose ?? '',
                pan: face?.pan ?? ''
              }
            ]);
          }
          setPrediction(result);
          if (!isWebcamActive) { setShowPopup(true); }

          if (Array.isArray(result.preview_base64_list) && result.preview_base64_list.length > 0) {
            const mime = result.preview_mime || 'image/jpeg';
            const previews = result.preview_base64_list.map((b64: string) =>
              `data:${mime};base64,${b64}`
            );
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
  
    const uploadVideo = async (selectedVideo: File, modelValue?: string) => {
      if (!selectedVideo) {
        alert("Please select a video");
        return;
      }

      setVideoLoading(true);
      setUploadProgress(0);
      setDetectedFrame(0);
      setTotalFrames(0);
      setPrediction(null);
      setPreview(null);
      setPreviewList([]);
      setShowPopup(false);
      setStreamingSequences([]);
      resetVideoBox();
      setBoxQueueDone(false);
      setVideoBoxActive(false);
      setAnalyzingFrame('');

      const formData = new FormData();
      formData.append("file", selectedVideo);
      const model = modelValue ?? selectedOption?.value;

      try {
        if (model === 'emo-net' || model === 'default') {
          formData.append('model', model === 'default' ? 'dense7' : 'finetune');
          const response = await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/predict-video-emonet/stream/`, {
            method: "POST",
            headers: { 'x-api-key': import.meta.env.VITE_API_KEY ?? '' },
            body: formData,
          });

          if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`HTTP ${response.status} ${response.statusText} ${text}`);
          }

          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          const collectedSeqs: SequenceResult[] = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() ?? '';
            for (const part of parts) {
              const line = part.startsWith('data: ') ? part.slice(6) : part;
              if (!line.trim()) continue;
              try {
                const msg = JSON.parse(line);
                if (msg.type === 'progress') {
                  if (msg.phase === 'detecting') {
                    const sampled = msg.sampled ?? msg.frame;
                    const totalSampled = msg.total_sampled ?? msg.total;
                    setUploadProgress(Math.round((sampled / totalSampled) * 50));
                    setDetectedFrame(sampled);
                    setTotalFrames(totalSampled);
                    setAnalyzingFrame(`Detecting faces: frame ${sampled} / ${totalSampled}`);
                  } else if (msg.phase === 'analyzing') {
                    setUploadProgress(52);
                    setAnalyzingFrame('Running emotion analysis…');
                  }
                } else if (msg.type === 'sequence') {
                  setAnalyzingFrame('');
                  collectedSeqs.push(msg.data);
                  setUploadProgress(prev => Math.min(99, prev + 5));
                  if (msg.data.box) {
                    setVideoBoxActive(true);
                    const boxItem: BoxQueueItem = {
                      box: msg.data.box,
                      emotion: msg.data.emotion,
                      imgW: msg.data.image_width,
                      imgH: msg.data.image_height,
                      seqIndex: msg.data.sequence_index as number,
                      faceIndex: (msg.data.face_index as number) ?? 0,
                      frameNumber: msg.data.frame_number as number,
                      fps: msg.data.fps as number,
                      seqData: msg.data,
                    };
                    allBoxItemsRef.current.push(boxItem);
                    seqBoxQueueRef.current.push(boxItem);
                    processBoxQueue();
                  } else {
                    setStreamingSequences(prev => [...prev, msg.data]);
                  }
                } else if (msg.type === 'no_face') {
                  const noFaceEntry: SequenceResult = { sequence_index: msg.sequence_index, emotion: '', confidence: 0, no_face: true };
                  collectedSeqs.push(noFaceEntry);
                  setStreamingSequences(prev => [...prev, noFaceEntry]);
                } else if (msg.type === 'final') {
                  setPrediction({ ...msg.data, sequences: collectedSeqs });
                  if (!isWebcamActive) { setShowPopup(true); }
                } else if (msg.type === 'error') {
                  throw new Error(msg.message);
                }
              } catch (parseErr) { /* skip malformed lines */ }
            }
          }
        } else {
          const response = await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/predict-video-emonet/?preview=1`, {
            method: "POST",
            headers: { 'x-api-key': import.meta.env.VITE_API_KEY ?? '' },
            body: formData,
          });

          if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`HTTP ${response.status} ${response.statusText} ${text}`);
          }

          const result: PredictionResult = await response.json();
          setPrediction(result);

          if (result.preview_base64) {
            const mime = result.preview_mime || "image/jpeg";
            const previewUrl = `data:${mime};base64,${result.preview_base64}`;
            setPreview(previewUrl);
            setPreviewList([previewUrl]);
          }

          if (!isWebcamActive) { setShowPopup(true); }
        }
      } catch (err: any) {
        console.error("Error uploading video:", err);
        let msg: string = err?.message || 'Upload video failed';
        try {
          const match = msg.match(/\{.*\}/s);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.detail) msg = parsed.detail;
          }
        } catch {}
        setWarnMsg(msg);
        // Clear the imported file so it is not shown after rejection
        setPendingFile(null);
        setPendingFileUrl(null);
        setPendingFileType(null);
        setFile(null);
        setInputFileName('');
        setInputLocked(true);
        if (videoInputRef.current) videoInputRef.current.value = '';
      } finally {
        setUploadProgress(100);
        setVideoLoading(false);
        setLeftPanelLocked(false);
      }
    };

    useEffect(() => {
      function handler(_e: MouseEvent) {
        setShowDropdown(false);
        setShowWebcamDropdown(false);
      }

      document.addEventListener('click', handler);
      return () => {
        document.removeEventListener('click', handler);
      };
    }, []);

    useEffect(() => {
      if (!videoLoading) return;
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 99) { clearInterval(interval); return 99; }
          return prev + (99 - prev) * 0.06;
        });
      }, 200);
      return () => clearInterval(interval);
    }, [videoLoading]);

    // Update face tracking data when prediction arrives — no drawing here
    useEffect(() => {
      if (!isWebcamActive) {
        faceTrackRef.current = {};
        return;
      }
      if (!prediction?.faces || !prediction.image_width) return;

      predDimsRef.current = { w: prediction.image_width, h: prediction.image_height };

      const emoColors: Record<string, string> = {
        Happiness: '#b9e7ab', Sadness: '#2d49d7', Anger: '#9a2315',
        Surprise: '#dacbf1', Fear: '#070605', Disgust: '#e95d22', Neutral: '#b3b3b3',
      };

      const activeFaceIndices = new Set<number>();

      prediction.faces.forEach((face, i) => {
        if (!face.box) return;
        activeFaceIndices.add(i);
        const tracked = faceTrackRef.current[i];
        const targetBox: FaceBox = { ...face.box };
        // Snap currentBox on first detection, spring after
        const currentBox: FaceBox = tracked?.currentBox ?? { ...face.box };
        const velBox: FaceBox = tracked?.velBox ?? { x: 0, y: 0, w: 0, h: 0 };

        const emoHistory = tracked ? [...tracked.emoHistory] : [];
        // Only add to history on a fresh LSTM result (ready===true), or non-LSTM mode (ready===undefined).
        // Skip ready===false frames — those echo last_emotion repeatedly and would dilute real results.
        if (face.emotion && prediction.ready !== false) {
          emoHistory.push({ emotion: face.emotion, confidence: face.confidence ?? 0 });
          if (emoHistory.length > 3) emoHistory.shift();
        }

        const totals: Record<string, number> = {};
        emoHistory.forEach(e => { totals[e.emotion] = (totals[e.emotion] ?? 0) + e.confidence; });
        const dominantEmotion = emoHistory.length
          ? Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0]
          : (tracked?.dominantEmotion ?? '');
        const avgConf = emoHistory.length ? (totals[dominantEmotion] / emoHistory.length) : (tracked?.avgConf ?? 0);

        const color = emoColors[dominantEmotion] || '#ffffff';
        const label = dominantEmotion ? `#${i + 1} ${dominantEmotion} ${(avgConf * 100).toFixed(0)}%` : `#${i + 1}`;
        const line2Parts = [face.pose, face.pan !== undefined ? `${face.pan.toFixed(1)}°` : null].filter(Boolean) as string[];

        faceTrackRef.current[i] = {
          box: targetBox, currentBox, velBox, emoHistory,
          dominantEmotion, avgConf, color,
          line1: label, line2: line2Parts.join(' | '),
        };
      });

      // Remove stale face tracks
      Object.keys(faceTrackRef.current).forEach(k => {
        if (!activeFaceIndices.has(Number(k))) delete faceTrackRef.current[Number(k)];
      });
    }, [prediction, isWebcamActive]);

    // rAF drawing loop — lerps box position at 60fps for smooth tracking
    useEffect(() => {
      if (!isWebcamActive) {
        const canvas = webcamCanvasRef.current;
        if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const STIFFNESS = 0.1;  // spring pull strength
      const DAMPING   = 0.72; // velocity retention per frame
      let rafId: number;

      const draw = () => {
        const canvas = webcamCanvasRef.current;
        if (!canvas) { rafId = requestAnimationFrame(draw); return; }
        const ctx = canvas.getContext('2d');
        if (!ctx) { rafId = requestAnimationFrame(draw); return; }

        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && canvas.width !== Math.round(rect.width)) {
          canvas.width = Math.round(rect.width);
          canvas.height = Math.round(rect.height);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const { w: imgW, h: imgH } = predDimsRef.current;
        const scaleX = canvas.width / imgW;
        const scaleY = canvas.height / imgH;

        Object.values(faceTrackRef.current).forEach((face) => {
          // Spring physics toward target box
          (['x', 'y', 'w', 'h'] as const).forEach(k => {
            face.velBox[k] = face.velBox[k] * DAMPING + (face.box[k] - face.currentBox[k]) * STIFFNESS;
            face.currentBox[k] += face.velBox[k];
          });

          const fe = focusedEmotionsRef.current;
          if (fe && !fe.has(face.dominantEmotion)) return;

          const { currentBox: cb, color, line1, line2 } = face;
          const rx = cb.x * scaleX, ry = cb.y * scaleY;
          const rw = cb.w * scaleX, rh = cb.h * scaleY;

          ctx.font = 'bold 13px sans-serif';
          const lineH = 18;
          const labelH = line2 ? lineH * 2 + 6 : lineH + 4;
          const maxTextW = Math.max(ctx.measureText(line1).width, line2 ? ctx.measureText(line2).width : 0);
          const labelW = maxTextW + 10;
          const labelY = ry >= labelH ? ry - labelH : ry + rh;

          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.fillStyle = color;
          ctx.fillRect(rx, labelY, labelW, labelH);
          ctx.fillStyle = '#fff';
          ctx.fillText(line1, rx + 5, labelY + 14);
          if (line2) {
            ctx.font = '11px sans-serif';
            ctx.fillText(line2, rx + 5, labelY + 14 + lineH);
          }
        });

        rafId = requestAnimationFrame(draw);
      };

      rafId = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(rafId);
    }, [isWebcamActive]);

    const allEmotionsSelected = focusNeutral && focusHappiness && focusSad && focusAngry && focusFearful && focusDisgusted && focusSurprised;

    const focusedEmotions: Set<string> | null = allEmotionsSelected
      ? null
      : new Set([
          ...(focusNeutral    ? ['Neutral']    : []),
          ...(focusHappiness  ? ['Happiness']  : []),
          ...(focusSad        ? ['Sadness']    : []),
          ...(focusAngry      ? ['Anger']      : []),
          ...(focusFearful    ? ['Fear']       : []),
          ...(focusDisgusted  ? ['Disgust']    : []),
          ...(focusSurprised  ? ['Surprise']   : []),
        ]);

    focusedEmotionsRef.current = focusedEmotions;

    const isFocused = (emotion: string | undefined) =>
      !focusedEmotions || focusedEmotions.has(emotion ?? '');

return (
    <>
    <svg className="box-grid-svg-filter-ad">
      <defs>
        <filter id="wavy-ad">
          <feTurbulence type="turbulence" baseFrequency="0.012" numOctaves="2" seed="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
    <div className='container-ad'>
      <div className="box-grid-bg-ad" />
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" className="svg-defs">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -5" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
      {!props.hideHeader && (
      <>
      <div className="nav-item2" onClick={handleHome}>
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
      <div className="nav-ad">
        <div className='nav-ad-item'onClick={handleCoreGeneral}>
          <div className='nav-ad-item-text'> Switch to Basic</div>
        </div>
      </div>
      </>
      )}
      <div className='inner-container-ad'> 
        <div className='left-ad-panel'>
          <div className='left-head'>
            <div className="left-head-content">
              <span className="left-head-model">
                {selectedOption ? selectedOption.label : ''}
              </span>
            </div>
          </div>

          <div className={`left-middle${leftPanelLocked || isWebcamActive || videoLoading ? ' locked' : ''}`}>
            <EmotionFilter
              showCheckBox={showCheckBox}
              checkboxDropdownOpen={checkboxDropdownOpen}
              setCheckboxDropdownOpen={setCheckboxDropdownOpen}
              useFaceDetect={useFaceDetect}
              setUseFaceDetect={setUseFaceDetect}
              allEmotionsSelected={allEmotionsSelected}
              focusNeutral={focusNeutral}       setFocusNeutral={setFocusNeutral}
              focusHappiness={focusHappiness}   setFocusHappiness={setFocusHappiness}
              focusSad={focusSad}               setFocusSad={setFocusSad}
              focusAngry={focusAngry}           setFocusAngry={setFocusAngry}
              focusFearful={focusFearful}       setFocusFearful={setFocusFearful}
              focusDisgusted={focusDisgusted}   setFocusDisgusted={setFocusDisgusted}
              focusSurprised={focusSurprised}   setFocusSurprised={setFocusSurprised}
              isEmoNetFineTune={selectedOption?.value === 'emo-net'}
            />
          </div>

          <div className={`left-bottom${(leftPanelLocked || videoLoading) && !isWebcamActive ? ' locked' : ''}`}>
            {menuLocked && showCheckBox && !isWebcamActive && (
              <button
                className="run-button-ad"
                onClick={() => setMenuLocked(false)}
              >
                Confirm
              </button>
            )}
            {showCheckBox && sourceType === 'webcam' && !menuLocked && (
              <button
                className={!toRun && !isWebcamActive ? 'run-button-ad locked' : 'run-button-ad'}
                onClick={isWebcamActive ? handleStopWebcam : handleRunPendingFile}
              >
                {isWebcamActive ? 'Stop' : 'Run'}
              </button>
            )}
          </div>
        </div>
        <div className='middle-ad-panel'>
        <div className={`menu-container-ad${menuLocked ? ' locked' : ''}`}>
            <div className='menu-actions'>
              <div className='menu-item-ad'>
                <div className='image-item-ad' onClick={handleImageSourceClick}>
                  <img src={addimg} className='ad_add_img' alt="Import" />
                  <input
                    type="file"
                    id="imageInput"
                    ref={fileInputRef}
                    accept='image/*'
                    onChange={handleChange}
                    className="hidden"
                  />
                </div>
                <span className="type-ad">Import Image</span>
              </div>
              <div className='menu-item-ad video-menu-wrap' ref={dropdownRef}>
                <div className="video-item-ad" onClick={handleVideoSourceClick}>
                  <img
                    src={videoimg}
                    className="ad_add_img"
                    alt="Video"
                  />
                </div>

                {showDropdown && (
                  <div className="video-dropdown-outside">
                    <div
                      className="model-menu-item"
                      onClick={() => handleVideoModelSelect('default')}
                    >
                      Emo-Net
                    </div>
                    <div
                      className="model-menu-item"
                      onClick={() => handleVideoModelSelect('emo-net')}
                    >
                      'Emo-Net(finetune)'
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  ref={videoInputRef}
                  accept="video/*"
                  onChange={handleVideoChange}
                  className="hidden"
                />
                <span className="type-ad">Import Video</span>
              </div>

          <div className='menu-item-ad webcam-menu-wrap' ref={webcamDropdownRef}>
            <div className={`webcam-item-ad${isWebcamActive ? ' active' : ''}`}
                  onClick={handleWebcamSourceClick}
                >
                  {isWebcamActive ? '' : ''}
                  <img 
                    src={webcamimg} 
                    className='ad_add_img' 
                    alt="Webcam" 
                  />
            </div>
            {showWebcamDropdown && (
              <div className="webcam-dropdown-outside">
                <div
                  className="model-menu-item"
                  onClick={() => handleWebcamModelSelect('default')}
                >
                  Emo-Net
                </div>
                <div
                  className="model-menu-item"
                  onClick={() => handleWebcamModelSelect('emo-net')}
                >
                  Emo-Net (fine tune)
                </div>
              </div>
            )}
            <span className="type-ad">Webcam</span>
          </div>
          </div>
          <div className={((!prediction && webcamResults.length === 0) || isWebcamActive) ? 'button-5ad locked' : 'button-5ad'} onClick={handleViewResult}>
            <p>View Result</p>
          </div>
          </div>
              <div className='input-space'>
                {inputLocked && <div className="input-space-blur" />}
                {(preview && prediction?.faces && !isVideoReplaying) && (
                <ImagePreview
                  preview={preview}
                  prediction={prediction}
                  imgRef={imgRef}
                  imgSize={imgSize}
                  setImgSize={setImgSize}
                  useFaceDetect={useFaceDetect}
                  isFocused={isFocused}
                  pendingFileType={pendingFileType}
                  onReplay={() => { setIsVideoReplaying(true); setVideoEnded(false); }}
                />
              )}
                {(isVideoReplaying || videoBoxActive || (videoLoading && pendingFileUrl && pendingFileType === 'video' && (selectedOption?.value === 'emo-net' || selectedOption?.value === 'default'))) && pendingFileUrl && (
                  <VideoPlayer
                    pendingFileUrl={pendingFileUrl}
                    videoPlayerRef={videoPlayerRef}
                    videoCanvasRef={videoCanvasRef}
                    videoLoading={videoLoading}
                    boxQueueDone={boxQueueDone}
                    uploadProgress={uploadProgress}
                    detectedFrame={detectedFrame}
                    totalFrames={totalFrames}
                    videoEnded={videoEnded}
                    analyzingFrame={analyzingFrame}
                    videoCurrentTime={videoCurrentTime}
                    videoDuration={videoDuration}
                    formatTime={formatTime}
                    onVideoEnded={() => setVideoEnded(true)}
                    onTimeUpdate={() => setVideoCurrentTime(videoPlayerRef.current?.currentTime ?? 0)}
                    onLoadedMetadata={() => setVideoDuration(videoPlayerRef.current?.duration ?? 0)}
                    onReplay={handleBoxReplay}
                  />
                )}
                {isWebcamActive && (
                  <WebcamFeed
                    webcamRef={webcamRef}
                    webcamCanvasRef={webcamCanvasRef}
                    useFaceDetect={useFaceDetect}
                    webcamError={webcamError}
                    onUserMedia={() => {
                      const v = webcamRef.current?.video;
                      if (webcamCanvasRef.current && v) {
                        webcamCanvasRef.current.width = v.clientWidth || 20;
                        webcamCanvasRef.current.height = v.clientHeight || 240;
                      }
                    }}
                  />
                )}
                {pendingFileUrl && !preview && pendingFileType !== 'webcam' && !isVideoReplaying && !videoBoxActive && !(videoLoading && pendingFileType === 'video' && (selectedOption?.value === 'emo-net' || selectedOption?.value === 'default')) && (
                  <div className="source-preview-box">
                    <div className="source-preview-title"></div>
                    {pendingFileType === 'video' ? (
                      <div className="video-play-only-ad">
                        <video
                          ref={videoPlayerRef}
                          src={pendingFileUrl}
                          className="video-play-only-ad__el"
                          muted
                          onEnded={() => setVideoEnded(true)}
                        />
                        {!videoEnded ? (
                          <button className="video-play-only-ad__btn" onClick={() => { videoPlayerRef.current?.play(); setVideoEnded(false); }}>▶</button>
                        ) : (
                          <button className="video-play-only-ad__btn video-play-only-ad__btn--replay" onClick={() => { if (videoPlayerRef.current) { videoPlayerRef.current.currentTime = 0; videoPlayerRef.current.play(); setVideoEnded(false); } }}>↺</button>
                        )}
                      </div>
                    ) : (
                      <img src={pendingFileUrl} alt="Selected source" className="selected-image-preview-ad" />
                    )}
                  </div>
                )}
              </div>
            </div>
            {videoLoading && (
              <div className="video-loading-ad">
              </div>
            )}


          <div className='right-ad-panel'>
            <EmotionTimeline
              streamingSequences={streamingSequences}
              prediction={prediction}
              videoLoading={videoLoading}
              isFocused={isFocused}
              activeSeqIndex={activeSeqIndex}
            />
            {isWebcamActive && webcamLiveEmotion && webcamLiveEmotion.some(f => isFocused(f.emotion)) ? (
              <div className="face-list-ad">
                {webcamLiveEmotion.map((f, i) => isFocused(f.emotion) ? (
                  <div key={i} className="face-card-ad" style={{ border: `3px solid ${EMOTION_COLORS[f.emotion] ?? '#ffffff'}` }}>
                    <span className="face-card-num-ad" style={{ background: EMOTION_COLORS[f.emotion] ?? '#ffffff' }}>{i + 1}</span>
                    {f.thumb && <img src={f.thumb} alt="face" className="face-thumb-ad" />}
                    <div className="result-ad">
                      <span className="result-chip-ad" style={{ background: EMOTION_COLORS[f.emotion] ?? '#ffffff' }}>{f.emotion}</span>
                      <br />{(f.confidence * 100).toFixed(1)}%
                      {f.pose && <><br />Pose: {f.pose}</>}
                      {f.pan !== 0 && <><br />Pan: {f.pan.toFixed(1)}°</>}
                    </div>
                  </div>
                ) : null)}
              </div>
            ) : (
              <FaceCardList
                prediction={prediction}
                isFocused={isFocused}
                pendingFileType={pendingFileType}
                sourceElement={imgRef.current || (isWebcamActive ? webcamRef.current?.video ?? null : null)}
              />
            )}
        </div>
      </div>
      </div>

      {warnMsg && (
        <div className="save-popup-overlay" onClick={() => setWarnMsg(null)}>
          <div className="warn-popup" onClick={e => e.stopPropagation()}>
            <div className="warn-popup-icon">⚠</div>
            <div className="warn-popup-title">File Too Large</div>
            <div className="warn-popup-msg">{warnMsg}</div>
            <button className="warn-popup-btn" onClick={() => setWarnMsg(null)}>OK</button>
          </div>
        </div>
      )}
    </>
  );
}

export default Core_Ad;