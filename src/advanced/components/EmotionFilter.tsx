import React from 'react';

interface EmotionFilterProps {
  showCheckBox: boolean;
  checkboxDropdownOpen: boolean;
  setCheckboxDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  useFaceDetect: boolean;
  setUseFaceDetect: (v: boolean) => void;
  allEmotionsSelected: boolean;
  focusNeutral: boolean;    setFocusNeutral: (v: boolean) => void;
  focusHappiness: boolean;  setFocusHappiness: (v: boolean) => void;
  focusSad: boolean;        setFocusSad: (v: boolean) => void;
  focusAngry: boolean;      setFocusAngry: (v: boolean) => void;
  focusFearful: boolean;    setFocusFearful: (v: boolean) => void;
  focusDisgusted: boolean;  setFocusDisgusted: (v: boolean) => void;
  focusSurprised: boolean;  setFocusSurprised: (v: boolean) => void;
  isEmoNetFineTune?: boolean;
}

export function EmotionFilter({
  showCheckBox, checkboxDropdownOpen, setCheckboxDropdownOpen,
  useFaceDetect, setUseFaceDetect, allEmotionsSelected,
  focusNeutral, setFocusNeutral,
  focusHappiness, setFocusHappiness,
  focusSad, setFocusSad,
  focusAngry, setFocusAngry,
  focusFearful, setFocusFearful,
  focusDisgusted, setFocusDisgusted,
  focusSurprised, setFocusSurprised,
  isEmoNetFineTune = false,
}: EmotionFilterProps) {
  if (!showCheckBox) return null;
  return (
    <div className="checkbox-dropdown-mobile">
      <button
        className="checkbox-dropdown-btn"
        onClick={() => setCheckboxDropdownOpen(o => !o)}
      >
        Filters {checkboxDropdownOpen ? '▲' : '▼'}
      </button>
      <div className={`run-check-list${checkboxDropdownOpen ? ' open checkbox-dropdown-panel' : ''}`}>
        <label className="run-check-row">
          <input
            type="checkbox"
            checked={useFaceDetect}
            onChange={(e) => setUseFaceDetect(e.target.checked)}
          />
          <span>Bounding Box</span>
        </label>
        <label className="run-check-row">
          <input
            type="checkbox"
            checked={allEmotionsSelected}
            onChange={(e) => {
              const v = e.target.checked;
              setFocusNeutral(v); setFocusHappiness(v); setFocusSad(v);
              setFocusAngry(v); setFocusFearful(v); setFocusDisgusted(v); setFocusSurprised(v);
            }}
          />
          <span>All Emotions</span>
        </label>
        <label className={`run-check-row${isEmoNetFineTune ? ' disabled-emotion' : ''}`} style={{ paddingLeft: '22px' }}>
          <input type="checkbox" checked={focusNeutral} onChange={(e) => setFocusNeutral(e.target.checked)} />
          <span>Neutral</span>
        </label>
        <label className="run-check-row" style={{ paddingLeft: '22px' }}>
          <input type="checkbox" checked={focusHappiness} onChange={(e) => setFocusHappiness(e.target.checked)} />
          <span>Happiness</span>
        </label>
        <label className="run-check-row" style={{ paddingLeft: '22px' }}>
          <input type="checkbox" checked={focusSad} onChange={(e) => setFocusSad(e.target.checked)} />
          <span>Sadness</span>
        </label>
        <label className="run-check-row" style={{ paddingLeft: '22px' }}>
          <input type="checkbox" checked={focusAngry} onChange={(e) => setFocusAngry(e.target.checked)} />
          <span>Anger</span>
        </label>
        <label className="run-check-row" style={{ paddingLeft: '22px' }}>
          <input type="checkbox" checked={focusFearful} onChange={(e) => setFocusFearful(e.target.checked)} />
          <span>Fear</span>
        </label>
        <label className="run-check-row" style={{ paddingLeft: '22px' }}>
          <input type="checkbox" checked={focusDisgusted} onChange={(e) => setFocusDisgusted(e.target.checked)} />
          <span>Disgust</span>
        </label>
        <label className="run-check-row" style={{ paddingLeft: '22px' }}>
          <input type="checkbox" checked={focusSurprised} onChange={(e) => setFocusSurprised(e.target.checked)} />
          <span>Surprise</span>
        </label>
      </div>
    </div>
  );
}
