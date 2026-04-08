import { useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './View_Result.css'
import { useState } from 'react';

interface ViewResultProps {
  setTrigger?: (value: boolean) => void;
}

const EMOTION_COLORS: Record<string, string> = {
        Happiness: '#97d883',
        Sadness: '#2d49d7',
        Anger: '#9a2315',
        Surprise: '#b4a4cc',
        Fear: '#070605',
        Disgust: '#e95d22',
        Neutral: '#8f8e8e',
};

const ViewResult = (props: ViewResultProps) => {
  const location = useLocation();
  const sourceType = location.state?.sourceType;
  const [selectedFormat, setSelectedFormat] = useState(sourceType === 'image' ? 'PIE' : 'GRAPH');
  const [showSavePopup, setShowSavePopup] = useState(false);
  const [savePopupStep, setSavePopupStep] = useState<'choice' | 'formats'>('choice');
  const [saveFormats, setSaveFormats] = useState<Set<'graph' | 'csv' | 'json'>>(new Set());
  const [isForcedImageSave, setIsForcedImageSave] = useState(false);
  const [dynamicBoxSize, setDynamicBoxSize] = useState(14);
  const heatmapContainerRef = useRef<HTMLDivElement>(null);

  const prediction = location.state?.prediction;
  const webcamResults = location.state?.webcamResults || [];
  const inputFileName: string = location.state?.inputFileName || '';
  const focusedEmotions: string[] | null = location.state?.focusedEmotions ?? null;
  const modelValue: string = location.state?.modelValue ?? 'default';
  const allRows =
    sourceType === 'webcam'
      ? webcamResults
      : sourceType === 'image'
        ? (prediction?.faces || []).map((f: any, i: number) => ({ ...f, sequence_index: i, frameIndex: i }))
        : (prediction?.sequences || []);
  const rows = focusedEmotions
    ? allRows.filter((r: any) => focusedEmotions.includes(r.emotion))
    : allRows;

  useEffect(() => {
    const el = heatmapContainerRef.current;
    if (!el) return;
    const update = () => {
      const cols = rows.length;
      if (!cols) return;
      const gap = 4;
      const labelW = 92;
      const available = el.clientWidth - labelW - 20;
      const computed = Math.floor((available - cols * gap) / cols);
      setDynamicBoxSize(Math.max(18, Math.min(28, computed)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows.length]);

  const navigate = useNavigate();
  const handleHome = () => {
    navigate('/');
    if (props.setTrigger) props.setTrigger(false);
  };

  const handleAdvanced = () => {
    navigate('/advanced/Model_1', { replace: true, state: null });
    if (props.setTrigger) props.setTrigger(false);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const ALL_EMOTIONS: string[] = modelValue === 'emo-net'
    ? ['Happiness', 'Sadness', 'Surprise', 'Fear', 'Disgust', 'Anger']
    : ['Happiness', 'Sadness', 'Surprise', 'Fear', 'Disgust', 'Anger', 'Neutral'];

  const heatmap = useMemo<{
    emotions: string[];
    grid: number[][];
    timeLabels: string[];
  }>(() => {
    if (!rows.length) {
      return { emotions: ALL_EMOTIONS, grid: ALL_EMOTIONS.map(() => []), timeLabels: [] };
    }

    const emotions: string[] = focusedEmotions
      ? ALL_EMOTIONS.filter(e => focusedEmotions.includes(e))
      : ALL_EMOTIONS;

    const hasFrameTime = rows[0]?.frame_number != null && rows[0]?.fps != null;
    const t0 = hasFrameTime
      ? Number(rows[0].frame_number) / Number(rows[0].fps)
      : Number(rows[0]?.sequence_index ?? rows[0]?.frameIndex ?? 0);
    const timeLabels: string[] = rows.map((r: any, i: number) => {
      const secs = hasFrameTime
        ? Number(r.frame_number) / Number(r.fps) - t0
        : Number(r.sequence_index ?? r.frameIndex ?? i) - t0;
      return `${secs.toFixed(1)}s`;
    });

    const grid: number[][] = emotions.map((em: string) =>
      rows.map((r: any) => {
        const rowEmotion = String(r.emotion || 'Unknown');
        if (rowEmotion !== em) return 0;
        return Math.round(Number(r.confidence ?? 0) * 100);
      })
    );

    return { emotions, grid, timeLabels };
  }, [rows]);



  const buildChartDataUrl = (data: any[]): Promise<string> => {
    const counts: Record<string, number> = {};
    data.forEach((r: any) => { const e = r?.emotion || 'Unknown'; counts[e] = (counts[e] || 0) + 1; });
    const total = data.length || 1;
    const stats = Object.entries(counts).map(([emotion, count]) => ({ emotion, count }));
    const isMobile = window.innerWidth <= 380;
    const vrLeft = document.querySelector('.vr-left') as HTMLElement | null;
    const canvasSize = isMobile && vrLeft ? vrLeft.clientWidth : 500;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize; canvas.height = canvasSize;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, canvasSize, canvasSize);
    const palette: Record<string, string> = {
      Happiness: '#b9e7ab', Sadness: '#2d49d7', Anger: '#9a2315',
      Surprise: '#dacbf1', Fear: '#555', Disgust: '#e95d22', Neutral: '#b3b3b3',
    };
    const fallback = ['#b9e7ab','#2d49d7','#9a2315','#dacbf1','#555','#e95d22','#b3b3b3'];
    const scale = canvasSize / 500;
    const cx = Math.round(210 * scale), cy = Math.round(230 * scale), r = Math.round(150 * scale);
    let startAngle = -Math.PI / 2;
    stats.forEach((item, i) => {
      const slice = (item.count / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + slice);
      ctx.fillStyle = palette[item.emotion] || fallback[i % fallback.length];
      ctx.fill();
      startAngle += slice;
    });
    ctx.font = `${Math.round(13 * scale)}px sans-serif`;
    let ly = Math.round(60 * scale);
    stats.forEach((item, i) => {
      ctx.fillStyle = palette[item.emotion] || fallback[i % fallback.length];
      ctx.fillRect(Math.round(370 * scale), ly - Math.round(12 * scale), Math.round(14 * scale), Math.round(14 * scale));
      ctx.fillStyle = '#fff';
      const pct = ((item.count / total) * 100).toFixed(1);
      ctx.textAlign = 'left';
      ctx.fillText(`${item.emotion} ${pct}%`, Math.round(390 * scale), ly);
      ly += Math.round(22 * scale);
    });
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob ? URL.createObjectURL(blob!) : canvas.toDataURL()));
    });
  };

  const doDownload = (fmts: Set<'graph' | 'csv' | 'json'>) => {
    if (!fmts.size) return;
    const baseName = inputFileName.replace(/\.[^/.]+$/, '') || 'result';
    fmts.forEach(fmt => {
      if (fmt === 'json') {
        const data = sourceType === 'webcam' ? { sequences: rows } : prediction;
        downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${baseName}.json`);
      } else if (fmt === 'csv') {
        const csv = [
          ['index', 'emotion', 'confidence', 'pose', 'pan'],
          ...rows.map((row: any) => [
            sourceType === 'webcam' ? row.frameIndex : row.sequence_index,
            row.emotion ?? '', row.confidence ?? '', row.pose ?? '', row.pan ?? ''
          ])
        ].map(e => e.join(',')).join('\n');
        downloadBlob(new Blob([csv], { type: 'text/csv' }), `${baseName}.csv`);
      } else if (fmt === 'graph') {
        buildChartDataUrl(rows).then(url => {
          fetch(url).then(r => r.blob()).then(blob => downloadBlob(blob, `${baseName}.png`));
        });
      }
    });
  };

  const handleDownloadClick = () => {
    setSaveFormats(new Set());
    if (sourceType === 'image') {
      setIsForcedImageSave(true);
      setSaveFormats(new Set(['graph']));
      setSavePopupStep('formats');
    } else {
      setIsForcedImageSave(false);
      setSavePopupStep('choice');
    }
    setShowSavePopup(true);
  };

  const handleConfirmSave = () => {
    doDownload(saveFormats);
    setShowSavePopup(false);
  };

  const handleCancelSave = () => {
    setShowSavePopup(false);
  };

  const [selectedThumbIdx, setSelectedThumbIdx] = useState(0);

  const thumbnails = rows.map((row: any, i: number) => {
    const idx = sourceType === 'webcam' ? row.frameIndex : row.sequence_index;
    const emotion = row.emotion || 'Unknown';
    const pose = row.pose || '—';
    const pan = row.pan !== undefined && row.pan !== '' ? `${row.pan}°` : '—';
    const conf = row.confidence !== undefined && row.confidence !== '' ? `${Number(row.confidence * 100).toFixed(0)}%` : '';
    const color = EMOTION_COLORS[emotion] || '#aaa';
    const thumb = row.thumb ?? (row.face_thumb_base64 ? `data:image/jpeg;base64,${row.face_thumb_base64}` : null);
    return { idx, emotion, pose, pan, conf, color, key: i, thumb };
  });


  return (

    <>
    <svg className="box-grid-svg-filter-vr">
      <defs>
        <filter id="wavy-vr">
          <feTurbulence type="turbulence" baseFrequency="0.012" numOctaves="2" seed="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
    <div className="box-grid-bg-vr" />
    <div className="vr-root">
      {showSavePopup && (
        <div className="save-popup-overlay">
          <div className="save-popup">
            {isForcedImageSave ? (
              <>
                <div className="save-popup-title">Download Pie Chart</div>
                <div className="save-popup-subtitle">Your image result will be exported as a pie chart.</div>
                <div className="save-popup-row">
                  <button className="save-choice-btn save-choice-nosave" onClick={handleCancelSave}>Cancel</button>
                  <button className="save-popup-confirm" onClick={handleConfirmSave}>Download</button>
                </div>
              </>
            ) : savePopupStep === 'choice' ? (
              <>
                <div className="save-popup-title">Download Results</div>
                <div className="save-popup-subtitle">Select a format to export your analysis.</div>
                <div className="save-popup-choice-btns">
                  <button className="save-choice-btn save-choice-save" onClick={() => setSavePopupStep('formats')}>
                    Select Format
                  </button>
                  <button className="save-choice-btn save-choice-nosave" onClick={handleCancelSave}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="save-popup-title">Select Export Format</div>
                <div className="save-popup-subtitle">Select one or more formats to download.</div>
                <div className="save-popup-options">
                  {(['graph', 'csv', 'json'] as const).map(fmt => (
                    <div
                      key={fmt}
                      className={`save-popup-option${saveFormats.has(fmt) ? ' selected' : ''}`}
                      onClick={() => setSaveFormats(prev => {
                        const next = new Set(prev);
                        next.has(fmt) ? next.delete(fmt) : next.add(fmt);
                        return next;
                      })}
                    >
                      {fmt === 'graph' ? 'Pie Chart' : fmt.toUpperCase()}
                    </div>
                  ))}
                </div>
                <div className="save-popup-row">
                  <button className="save-popup-back" onClick={() => setSavePopupStep('choice')}>Back</button>
                  <button
                    className={`save-popup-confirm${saveFormats.size === 0 ? ' disabled' : ''}`}
                    disabled={saveFormats.size === 0}
                    onClick={handleConfirmSave}
                  >
                    Download
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="vr-header">
        <span className="vr-logo" onClick={handleHome}>        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 169.66 162.31" width="60" height="60">
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
                    </svg></span>
                <div className='nav-vr-item' onClick={handleAdvanced}>
          <div className='nav-vr-item-text'> go to ADVANCED</div>
        </div>
      </div>

      {/* Body */}
      <div className="vr-body">

        {/* LEFT: chart / data */}
        <div className="vr-left">
          <div className="vr-format-row">
            <div className='vr-chip'>
              <div className="vr-title">Emotions graph</div>
            </div>
          <button className="vr-download-btn" onClick={handleDownloadClick}>Download</button>
          </div>

          <div className="vr-data-panel">
            <div className="vr-chart-toggle-row">
            {sourceType !== 'image' && (
              <button
                className={`vr-chart-toggle-btn${selectedFormat === 'GRAPH' ? ' active' : ''}`}
                onClick={() => setSelectedFormat('GRAPH')}
              >Heat Map</button>
            )}
            <button
              className={`vr-chart-toggle-btn${selectedFormat === 'PIE' ? ' active' : ''}`}
              onClick={() => setSelectedFormat('PIE')}
            >Pie Chart</button>
          </div>
            {selectedFormat === 'GRAPH' && (() => {
              const { emotions, grid, timeLabels } = heatmap;
              const boxSize = dynamicBoxSize;
              const gap = 4;

              const getColor = (value: number, emotion: string) => {
                if (value === 0) return 'transparent';
                const base = EMOTION_COLORS[emotion] || '#ffffff';
                const opacity = 0.4 + (value / 100) * 0.6;
                return `${base}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`;
              };

              return (
                <div ref={heatmapContainerRef} style={{ overflow: 'auto', padding: '20px', flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start' , marginTop: '9%'}}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex' }}>
                      {/* Emotion labels column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                        {emotions.map((em: string) => (
                          <div key={em} style={{ width: 90, fontSize: 12, height: boxSize, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
                            {em}
                          </div>
                        ))}
                      </div>
                      {/* Chart area — only box rows inside the border */}
                      <div style={{
                        borderLeft: '2px solid #181c74',
                        borderBottom: '2px solid #181c74',
                        paddingLeft: 6,
                        paddingBottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}>
                        {emotions.map((em: string, rowIdx: number) => (
                          <div key={em} style={{ display: 'flex', gap }}>
                            {grid[rowIdx].map((val: number, colIdx: number) => (
                              <div
                                key={colIdx}
                                className="heatmap-box"
                                style={{ width: boxSize, height: boxSize, backgroundColor: getColor(val, em), borderRadius: 2 }}
                                title={`${em} ${val}%`}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Time tick labels — below the x-axis border */}
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: 90 + 2, flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: 6 }}>
                        <div style={{ display: 'flex', gap, marginTop: 4 }}>
                          {timeLabels.map((label: string, i: number) => {
                            const step = timeLabels.length > 15 ? Math.ceil(timeLabels.length / 10) : 1;
                            const show = i % step === 0 || i === timeLabels.length - 1;
                            return (
                              <div key={i} style={{ width: boxSize, fontSize: 9, color: '#555', textAlign: 'center', overflow: 'visible', opacity: show ? 1 : 0, whiteSpace: 'nowrap' }}>
                                {show ? label : ''}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: 11, color: '#181c74', fontWeight: 700, textAlign: 'center', marginTop: 4 }}>
                          Time (s)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {selectedFormat === 'PIE' && (() => {
              if (!rows.length) return <div style={{ padding: 20, color: '#888' }}>No data available</div>;
              const counts: Record<string, number> = {};
              rows.forEach((r: any) => { const e = r.emotion || 'Unknown'; counts[e] = (counts[e] || 0) + 1; });
              const total = rows.length;
              const stats = Object.entries(counts)
                .map(([emotion, count]) => ({ emotion, count }))
                .sort((a, b) => b.count - a.count);
              const cx = 190, cy = 175, r = 140;
              let angle = -Math.PI / 2;
              const slices = stats.map(item => {
                const sweep = (item.count / total) * Math.PI * 2;
                const endAngle = angle + sweep;
                const x1 = cx + r * Math.cos(angle);
                const y1 = cy + r * Math.sin(angle);
                const x2 = cx + r * Math.cos(endAngle);
                const y2 = cy + r * Math.sin(endAngle);
                const large = sweep > Math.PI ? 1 : 0;
                const d = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
                const result = { ...item, d };
                angle = endAngle;
                return result;
              });
              return (
                <div className="vr-chart-center">
                  <svg viewBox="0 0 520 360" className="vr-pie-chart-svg" preserveAspectRatio="xMidYMid meet">
                    {slices.map(s => (
                      <path key={s.emotion} d={s.d} fill={EMOTION_COLORS[s.emotion] || '#aaa'} stroke="#fff" strokeWidth={2} />
                    ))}
                    {stats.map((item, i) => (
                      <g key={item.emotion} transform={`translate(360, ${40 + i * 30})`}>
                        <rect width={14} height={14} fill={EMOTION_COLORS[item.emotion] || '#aaa'} rx={3} />
                        <text x={20} y={12} fontSize={13} fill="#222">
                          {item.emotion} {((item.count / total) * 100).toFixed(1)}%
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="vr-right">
          {thumbnails[selectedThumbIdx] && (
            <div className="vr-detail-card">
              {thumbnails[selectedThumbIdx].thumb && (
                <img src={thumbnails[selectedThumbIdx].thumb} alt="face" className="vr-detail-thumb" />
              )}
              <div className="vr-detail-body">
                <span className="vr-detail-label" style={{ background: thumbnails[selectedThumbIdx].color }}>
                  {thumbnails[selectedThumbIdx].emotion}
                </span>
                <span className="vr-detail-idx">
                  {sourceType === 'image' ? `Face ${thumbnails[selectedThumbIdx].idx + 1}` : `#${thumbnails[selectedThumbIdx].idx}`}
                </span>
                {thumbnails[selectedThumbIdx].conf && (
                  <span className="vr-detail-meta">{thumbnails[selectedThumbIdx].conf}</span>
                )}
                <span className="vr-detail-meta">Pose: {thumbnails[selectedThumbIdx].pose}</span>
                <span className="vr-detail-meta">Pan: {thumbnails[selectedThumbIdx].pan}</span>
              </div>
            </div>
          )}

          <div className="vr-thumb-panel">
            <div className="vr-thumb-title">{sourceType === 'image' ? 'Detected Faces' : 'Detected Events'}</div>
            <div className="vr-thumb-list">
              {thumbnails.length === 0 && (
                <div className="vr-thumb-empty">No detection data</div>
              )}
              {thumbnails.map((t: any, i: number) => (
                <div
                  className="vr-thumb-card"
                  key={t.key}
                  onClick={() => setSelectedThumbIdx(i)}
                  style={{ cursor: 'pointer', outline: selectedThumbIdx === i ? `2px solid ${t.color}` : 'none' }}
                >
                  <div className="vr-thumb-swatch" style={{ background: t.color }}>
                    <span className="vr-thumb-idx">{sourceType === 'image' ? `F${t.idx + 1}` : `#${t.idx}`}</span>
                  </div>
                  <div className="vr-thumb-info">
                    <div className="vr-thumb-emotion" style={{ color: t.color }}>{t.emotion}</div>
                    <div className="vr-thumb-meta">
                      <span>Pose: {t.pose}</span>
                      <span>Pan: {t.pan}</span>
                      {t.conf && <span>Conf: {t.conf}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
    </>
  );
};

export default ViewResult;
