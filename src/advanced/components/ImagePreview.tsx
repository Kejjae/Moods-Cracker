import React from 'react';
import type { FaceData, PredictionResult } from '../../types/face';

interface Props {
  preview: string;
  prediction: PredictionResult;
  imgRef: React.RefObject<HTMLImageElement>;
  imgSize: { width: number; height: number };
  setImgSize: (size: { width: number; height: number }) => void;
  useFaceDetect: boolean;
  isFocused: (emotion: string | undefined) => boolean;
  pendingFileType: 'image' | 'video' | 'webcam' | null;
  onReplay: () => void;
}

const emotionColors: Record<string, string> = {
  Happiness: '#b9e7ab',
  Sadness: '#2d49d7',
  Anger: '#9a2315',
  Surprise: '#dacbf1',
  Fear: '#070605',
  Disgust: '#e95d22',
  Neutral: '#b3b3b3',
};

export function ImagePreview({ preview, prediction, imgRef, imgSize, setImgSize, useFaceDetect, isFocused, pendingFileType, onReplay }: Props) {
  return (
    <div className='preview-container-ad'>
      <div className="preview-frame-ad">
        <img
          ref={imgRef}
          src={preview}
          className="preview-image-ad"
          alt="Preview"
          onLoad={() => { if (imgRef.current) { setImgSize({ width: imgRef.current.clientWidth, height: imgRef.current.clientHeight }); } }}
        />
        {useFaceDetect && prediction.faces!.map((face: FaceData, index: number) => {
          if (!face?.box) return null;
          if (!isFocused(face.emotion)) return null;
          const { x, y, w, h } = face.box;
          const renderedWidth = imgSize?.width || imgRef.current?.clientWidth || prediction.image_width;
          const renderedHeight = imgSize?.height || imgRef.current?.clientHeight || prediction.image_height;
          const scaleX = renderedWidth / prediction.image_width;
          const scaleY = renderedHeight / prediction.image_height;
          const left = Math.max(0, x * scaleX);
          const top = Math.max(0, y * scaleY);
          const width = Math.min(renderedWidth - left, w * scaleX);
          const height = Math.min(renderedHeight - top, h * scaleY);
          const borderColor = emotionColors[face.emotion ?? 'N/A'] || '#a91f29';
          return (
            <div
              key={index}
              className="face-box-ad"
              style={{ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`, border: `3px solid ${borderColor}` }}
            >
              <div className="face-box-label-ad" style={{ background: borderColor }}>
                <span>#{index + 1} {face.emotion ?? '—'}{face.confidence !== undefined ? ` ${(face.confidence * 100).toFixed(0)}%` : ''}</span>
                {(face.pose || face.pan !== undefined) && (
                  <span>{[face.pose, face.pan !== undefined ? `${face.pan.toFixed(1)}°` : null].filter(Boolean).join(' | ')}</span>
                )}
              </div>
            </div>
          );
        })}
        {pendingFileType === 'video' && (
          <button
            className="video-play-only-ad__btn video-play-only-ad__btn--replay"
            onClick={onReplay}
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}