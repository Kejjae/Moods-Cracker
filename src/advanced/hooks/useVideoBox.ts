import { useRef } from 'react';
import type React from 'react';
import type { BoxQueueItem, SequenceResult } from '../../types/face';

export function useVideoBox(
  videoCanvasRef: React.RefObject<HTMLCanvasElement>,
  videoPlayerRef: React.RefObject<HTMLVideoElement>,
  setActiveSeqIndex: (idx: number | null) => void,
  setStreamingSequences: React.Dispatch<React.SetStateAction<SequenceResult[]>>,
  setBoxQueueDone: (v: boolean) => void,
) {
  const seqBoxQueueRef = useRef<BoxQueueItem[]>([]);
  const allBoxItemsRef = useRef<BoxQueueItem[]>([]);
  const boxPlayingRef = useRef(false);
  const isReplayRef = useRef(false);
  const BOX_DISPLAY_MS = 1500;

  const drawSeqBox = (item: BoxQueueItem) => {
    const canvas = videoCanvasRef.current;
    const video = videoPlayerRef.current;
    if (!canvas) return;
    const { box, emotion, imgW, imgH, faceIndex } = item;
    const displayW = video ? video.clientWidth : canvas.width;
    const displayH = video ? video.clientHeight : canvas.height;
    canvas.width = displayW;
    canvas.height = displayH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, displayW, displayH);
    const videoNatW = video?.videoWidth || imgW;
    const videoNatH = video?.videoHeight || imgH;
    const containerAspect = displayW / displayH;
    const videoAspect = videoNatW / videoNatH;
    let renderW: number, renderH: number, offsetX: number, offsetY: number;
    if (videoAspect > containerAspect) {
      renderW = displayW; renderH = displayW / videoAspect;
      offsetX = 0; offsetY = (displayH - renderH) / 2;
    } else {
      renderH = displayH; renderW = displayH * videoAspect;
      offsetX = (displayW - renderW) / 2; offsetY = 0;
    }
    const emotionColors: Record<string, string> = {
      Happiness: '#b9e7ab', Sadness: '#2d49d7', Anger: '#9a2315',
      Surprise: '#dacbf1', Fear: '#070605', Disgust: '#e95d22', Neutral: '#b3b3b3',
    };
    const color = emotionColors[emotion] || '#a91f29';
    const scaleX = renderW / imgW;
    const scaleY = renderH / imgH;
    const rx = box.x * scaleX + offsetX, ry = box.y * scaleY + offsetY;
    const rw = box.w * scaleX, rh = box.h * scaleY;
    const { confidence, pose, pan } = item.seqData;
    const line1 = `#${faceIndex + 1} ${emotion}${confidence !== undefined ? ` ${(confidence * 100).toFixed(0)}%` : ''}`;
    const line2Parts = [pose, pan !== undefined ? `${pan.toFixed(1)}°` : null].filter(Boolean) as string[];
    const line2 = line2Parts.join(' | ');
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
  };

  const processBoxQueue = () => {
    if (boxPlayingRef.current) return;
    if (seqBoxQueueRef.current.length === 0) return;
    boxPlayingRef.current = true;
    const item = seqBoxQueueRef.current.shift()!;
    const video = videoPlayerRef.current;

    const doDisplay = () => {
      if (video) video.pause();
      setActiveSeqIndex(item.seqIndex);
      if (!isReplayRef.current) setStreamingSequences(prev => [...prev, item.seqData]);
      drawSeqBox(item);
      setTimeout(() => {
        const canvas = videoCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
        boxPlayingRef.current = false;
        if (seqBoxQueueRef.current.length > 0) {
          processBoxQueue();
        } else {
          setBoxQueueDone(true);
          setActiveSeqIndex(null);
        }
      }, BOX_DISPLAY_MS);
    };

    if (video && item.fps > 0) {
      const seekTime = Math.max(0, (item.frameNumber - 1) / item.fps);
      video.pause();
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        doDisplay();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = seekTime;
    } else {
      doDisplay();
    }
  };

  const handleBoxReplay = () => {
    if (!allBoxItemsRef.current.length) return;
    setBoxQueueDone(false);
    seqBoxQueueRef.current = [...allBoxItemsRef.current];
    boxPlayingRef.current = false;
    isReplayRef.current = true;
    processBoxQueue();
  };

  const reset = () => {
    seqBoxQueueRef.current = [];
    allBoxItemsRef.current = [];
    boxPlayingRef.current = false;
    isReplayRef.current = false;
  };

  return { seqBoxQueueRef, allBoxItemsRef, boxPlayingRef, isReplayRef, processBoxQueue, handleBoxReplay, reset };
}
