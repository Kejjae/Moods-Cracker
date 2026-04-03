import React from 'react';
import type { SequenceResult, PredictionResult } from '../../types/face';

interface EmotionTimelineProps {
  streamingSequences: SequenceResult[];
  prediction: PredictionResult | null;
  videoLoading: boolean;
  isFocused: (emotion: string | undefined) => boolean;
  activeSeqIndex: number | null;
}

const EMO_COLORS: Record<string, string> = {
  Happiness: '#b9e7ab', Sadness: '#2d49d7', Anger: '#9a2315',
  Surprise: '#dacbf1', Fear: '#070605', Disgust: '#e95d22', Neutral: '#9b9999',
};

export function EmotionTimeline({
  streamingSequences, prediction, videoLoading, isFocused, activeSeqIndex,
}: EmotionTimelineProps) {
  const hasData = streamingSequences.length > 0 || (prediction?.sequences && prediction.sequences.length > 0);
  if (!hasData) return null;

  const sequences = videoLoading
    ? streamingSequences
    : (prediction?.sequences?.length ? prediction.sequences : streamingSequences);

  const displaySequences = [...sequences].reverse();

  return (
    <div className="emotion-timeline-ad">
      <div className="timeline-title-ad">Emotion Timeline</div>
      {displaySequences.map((seq: SequenceResult) => {
        if (seq.no_face) {
          return (
            <div
              key={`no-face-${seq.sequence_index}-${seq.face_index ?? 0}`}
              className="timeline-row-ad"
              style={{ border: '2px solid #e75480', background: 'rgba(231,84,128,0.08)' }}
            >
              <div className="timeline-thumb-placeholder-ad" style={{ background: '#e7548033' }} />
              <div className="timeline-info-ad">
                <span className="timeline-seq-ad" style={{ color: '#e75480' }}>#{seq.sequence_index + 1}</span>
                <span className="timeline-chip-ad" style={{ background: '#e75480' }}>No Detected</span>
              </div>
            </div>
          );
        }
        if (!isFocused(seq.emotion)) return null;
        const chipColor = EMO_COLORS[seq.emotion] || '#ffff';
        return (
          <div
            key={`${seq.sequence_index}-${seq.face_index ?? 0}`}
            className={`timeline-row-ad${activeSeqIndex === seq.sequence_index ? ' active' : ''}`}
          >
            {seq.face_thumb_base64 ? (
              <img
                src={`data:image/jpeg;base64,${seq.face_thumb_base64}`}
                alt={`seq-${seq.sequence_index}`}
                className="timeline-thumb-ad"
              />
            ) : (
              <div className="timeline-thumb-placeholder-ad" />
            )}
            <div className="timeline-info-ad">
              <span className="timeline-seq-ad">Face {(seq.face_index ?? 0) + 1} #{seq.sequence_index + 1}</span>
              <span className="timeline-chip-ad" style={{ background: chipColor }}>{seq.emotion}</span>
              <span className="timeline-meta-ad">Pose: {seq.pose ?? 'N/A'}</span>
              <span className="timeline-meta-ad">Pan: {seq.pan?.toFixed(1) ?? '0.0'}°</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
