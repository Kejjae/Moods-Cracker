export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FaceData {
  box?: FaceBox | null;
  emotion?: string;
  pose?: string;
  pan?: number;
  confidence?: number;
}

export interface SequenceResult {
  sequence_index: number;
  face_index?: number;
  emotion: string;
  confidence: number;
  pose?: string;
  pan?: number;
  face_thumb_base64?: string;
  no_face?: boolean;
}

export interface PredictionResult {
  ready?: boolean;
  prediction?: string;
  confidence?: number;
  face_count?: number;
  faces?: FaceData[];
  preview_base64?: string;
  preview_base64_list?: string[];
  preview_mime?: string;
  image_width: number;
  image_height: number;
  sequences?: SequenceResult[];
}

export interface FaceTracked {
  box: FaceBox;        // target from server
  currentBox: FaceBox; // animated position
  velBox: FaceBox;     // spring velocity
  emoHistory: Array<{ emotion: string; confidence: number }>;
  dominantEmotion: string;
  avgConf: number;
  color: string;
  line1: string;
  line2: string;
}

export interface BoxQueueItem {
  box: { x: number; y: number; w: number; h: number };
  emotion: string;
  imgW: number;
  imgH: number;
  seqIndex: number;
  faceIndex: number;
  frameNumber: number;
  fps: number;
  seqData: SequenceResult;
}

export interface DropdownOption {
  id: number;
  label: string;
  value: string;
}

export interface CardAdProps {
  setTrigger?: (value: boolean) => void;
  hideHeader?: boolean;
}
