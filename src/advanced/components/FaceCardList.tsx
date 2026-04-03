import React from 'react';
import type { FaceData, PredictionResult } from '../../types/face';

interface FaceCardListProps {
  prediction: PredictionResult | null;
  isFocused: (emotion: string | undefined) => boolean;
  pendingFileType: 'image' | 'video' | 'webcam' | null;
  sourceElement: HTMLImageElement | HTMLVideoElement | null;
}

const EMOTION_COLORS: Record<string, string> = {
  Happiness: '#b9e7ab',
  Sadness: '#2d49d7',
  Anger: '#9a2315',
  Surprise: '#dacbf1',
  Fear: '#070605',
  Disgust: '#e95d22',
  Neutral: '#b3b3b3',
};

export function FaceCardList({ prediction, isFocused, pendingFileType, sourceElement }: FaceCardListProps) {
  if (pendingFileType === 'video') return null;

  return (
    <div className="face-list-ad">
      {prediction?.faces?.map((face: FaceData, index: number) => {
        if (!isFocused(face.emotion)) return null;
        const borderColor = EMOTION_COLORS[face.emotion ?? 'N/A'] || '#a91f29';

        if (!face?.box) {
          return (
            <div key={index} className="face-card-ad" style={{ border: '3px solid ' + borderColor }}>
              <span className="face-card-num-ad" style={{ background: borderColor }}>{index + 1}</span>
              <div className='result-ad'>
                {face.emotion}<br />
                {face.confidence !== undefined ? `${(face.confidence * 100).toFixed(1)}%` : ''}
                {face.pose ? <><br />{face.pose}</> : null}
                {face.pan !== undefined ? <><br />{face.pan.toFixed(2)}°</> : null}
              </div>
            </div>
          );
        }

        const { x, y, w, h } = face.box;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let faceUrl = '';

        if (sourceElement && ctx) {
          const naturalWidth = sourceElement instanceof HTMLVideoElement ? sourceElement.videoWidth : sourceElement.naturalWidth;
          const naturalHeight = sourceElement instanceof HTMLVideoElement ? sourceElement.videoHeight : sourceElement.naturalHeight;
          const ratioX = naturalWidth / prediction.image_width;
          const ratioY = naturalHeight / prediction.image_height;
          const cropX = Math.max(0, x * ratioX);
          const cropY = Math.max(0, y * ratioY);
          const cropW = Math.min(naturalWidth - cropX, w * ratioX);
          const cropH = Math.min(naturalHeight - cropY, h * ratioY);
          canvas.width = cropW;
          canvas.height = cropH;
          ctx.drawImage(sourceElement, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          faceUrl = canvas.toDataURL('image/jpeg');
        }

        return (
          <div key={index} className="face-card-ad" style={{ border: '3px solid ' + borderColor }}>
            <span className="face-card-num-ad" style={{ background: borderColor }}>{index + 1}</span>
            {faceUrl && (
              <img src={faceUrl} alt={`face-${index}`} className="face-thumb-ad" />
            )}
            <div className='result-ad'>
              <span className='result-chip-ad' style={{ background: borderColor }}>{face.emotion}</span>
              <br />
              Pose: {face.pose}<br />
              Pan: {face.pan?.toFixed(2)}°
            </div>
          </div>
        );
      })}
    </div>
  );
}
