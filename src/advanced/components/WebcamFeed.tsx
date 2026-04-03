import React from 'react';
import Webcam from 'react-webcam';

interface Props {
  webcamRef: React.RefObject<Webcam>;
  webcamCanvasRef: React.RefObject<HTMLCanvasElement>;
  useFaceDetect: boolean;
  webcamError: string | null;
  onUserMedia: () => void;
}

export function WebcamFeed({ webcamRef, webcamCanvasRef, useFaceDetect, webcamError, onUserMedia }: Props) {
  return (
    <div className="webcam-container-ad">
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.7}
          videoConstraints={{ width: 320, height: 240, facingMode: 'user' }}
          className="webcam-feed-ad"
          onUserMedia={onUserMedia}
        />
        {useFaceDetect && (
          <canvas
            ref={webcamCanvasRef}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          />
        )}
      </div>
      {webcamError && (
        <div className="emonet-error-ad">{webcamError}</div>
      )}
    </div>
  );
}