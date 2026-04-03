import React, { useRef, useEffect } from 'react';

interface Props {
  pendingFileUrl: string;
  videoPlayerRef: React.RefObject<HTMLVideoElement>;
  videoCanvasRef: React.RefObject<HTMLCanvasElement>;
  videoLoading: boolean;
  boxQueueDone: boolean;
  uploadProgress: number;
  detectedFrame: number;
  totalFrames: number;
  videoEnded: boolean;
  analyzingFrame: string;
  videoCurrentTime: number;
  videoDuration: number;
  formatTime: (sec: number) => string;
  onVideoEnded: () => void;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onReplay: () => void;
}

export function VideoPlayer({ pendingFileUrl, videoPlayerRef, videoCanvasRef, videoLoading, boxQueueDone, uploadProgress, detectedFrame, totalFrames, videoEnded, analyzingFrame, videoCurrentTime, videoDuration, formatTime, onVideoEnded, onTimeUpdate, onLoadedMetadata, onReplay }: Props) {
  const maxFrontRef = useRef(0);
  const maxBackRef = useRef(0);

  useEffect(() => {
    maxFrontRef.current = 0;
    maxBackRef.current = 0;
  }, [videoLoading]);

  const playbackPct = (videoEnded || boxQueueDone) ? 100 : (videoDuration > 0 ? Math.min((videoCurrentTime / videoDuration) * 100, 100) : 0);

  const rawBack = videoLoading ? uploadProgress : playbackPct;
  maxBackRef.current = Math.max(maxBackRef.current, rawBack);
  const backProgress = maxBackRef.current;

  const rawFront = videoLoading
    ? (totalFrames > 0 ? (detectedFrame / totalFrames) * 100 : 0)
    : playbackPct;
  maxFrontRef.current = Math.max(maxFrontRef.current, rawFront);
  const frontProgress = Math.min(maxFrontRef.current, backProgress);

  const label = videoLoading
    ? (totalFrames > 0 ? `Loading ${formatTime(totalFrames > 0 ? (detectedFrame / totalFrames) * videoDuration : 0)} / ${formatTime(videoDuration)}` : (analyzingFrame || `Analyzing… ${Math.floor(uploadProgress)}%`))
    : `${formatTime((videoEnded || boxQueueDone) ? videoDuration : videoCurrentTime)} / ${formatTime(videoDuration)}`;

  return (
    <div className="video-with-progress-ad">
      <div className="video-play-only-ad" style={{ position: 'relative' }}>
        <video
          ref={videoPlayerRef}
          src={pendingFileUrl}
          className="video-play-only-ad__el"
          autoPlay={videoLoading}
          muted
          onEnded={onVideoEnded}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
        />
        <canvas
          ref={videoCanvasRef}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%' }}
        />
        {!videoLoading && boxQueueDone && (
          <button className="video-play-only-ad__btn video-play-only-ad__btn--replay" onClick={onReplay}>↺</button>
        )}
      </div>
      <div className="predict-progress-ad video-progress-bar-ad">
        <div className="predict-progress-label-ad">{label}</div>
        <div className="predict-progress-track-ad">
          <div className="predict-progress-back-fill-ad" style={{ width: `${backProgress}%` }} />
          <div className="predict-progress-fill-ad" style={{ width: `${frontProgress}%` }} />
        </div>
      </div>
    </div>
  );
}