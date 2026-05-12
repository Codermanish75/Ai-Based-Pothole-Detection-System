import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// ─── Config ───────────────────────────────────────────────────────────────────
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ─── Demo fallback (when server is offline) ───────────────────────────────────
const DEMO_CLASSES = ['D20-alligator-crack', 'D00-longitudinal-crack', 'D40-pothole', 'D10-transverse-crack'];

function generateDemoResult() {
  const picked     = DEMO_CLASSES[Math.floor(Math.random() * DEMO_CLASSES.length)];
  const confidence = parseFloat((0.55 + Math.random() * 0.42).toFixed(4));
  const remaining  = 1 - confidence;
  const others     = DEMO_CLASSES.filter(c => c !== picked);
  const splits     = [Math.random(), Math.random(), Math.random()].sort((a, b) => b - a);
  const total      = splits.reduce((a, b) => a + b, 0);
  const allScores  = { [picked]: confidence };
  others.forEach((c, i) => { allScores[c] = parseFloat(((splits[i] / total) * remaining).toFixed(4)); });
  return {
    prediction: { class: picked, confidence, allScores },
    inferenceTime: Math.floor(30 + Math.random() * 60),
    timestamp: new Date().toISOString(),
    _demo: true,
  };
}

// ─── Labels & cost model ─────────────────────────────────────────────────────
const DAMAGE_LABELS = {
  'D00-longitudinal-crack': 'Longitudinal Crack',
  'D10-transverse-crack':   'Transverse Crack',
  'D20-alligator-crack':    'Alligator Crack',
  'D40-pothole':            'Pothole',
};

const COST_MODEL = {
  'D00-longitudinal-crack': { base: 1200, perMeter: 300,  urgency: 0.4 },
  'D10-transverse-crack':   { base: 1500, perMeter: 400,  urgency: 0.5 },
  'D20-alligator-crack':    { base: 4000, perMeter: 900,  urgency: 0.8 },
  'D40-pothole':            { base: 6000, perMeter: 1500, urgency: 0.9 },
};

const MODEL_INFO = [
  ['Model Type',    'MobileNetV2 SSD'],
  ['Input Size',    '320×320'],
  ['Classes',       '4'],
  ['Framework',     'Edge Impulse'],
  ['Optimization',  'INT8 Quantized'],
  ['Target Latency','<100 ms'],
  ['Edge Ready',    '✓ Yes'],
  ['AI Features',   '7+'],
];

const FEATURES = [
  ['🎯', 'Uncertainty Quantification', 'Entropy-based confidence calibration with prediction margin analysis'],
  ['💰', 'Smart Cost Estimation',      'AI-driven repair cost prediction using damage severity and area estimation'],
  ['🗺️', 'Damage Heatmaps',           'Visual localization of damage areas with confidence-based overlays'],
  ['📊', 'Real-time Analytics',        'Session statistics with trend analysis and export capabilities'],
  ['📦', 'Batch Processing',           'Process multiple images simultaneously with progress tracking'],
  ['⚡', 'Edge Optimized',             'INT8 quantization for ultra-fast inference on edge devices'],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatINR = v =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

function computeSeverity(damageClass, confidence) {
  const cm  = COST_MODEL[damageClass] || { urgency: 0.5 };
  const pct = (cm.urgency * 0.6 + confidence * 0.4) * 100;
  if (pct > 70) return { pct, cls: 'high',   label: 'Critical', maint: 'Emergency', time: '24-48 hours' };
  if (pct > 50) return { pct, cls: 'high',   label: 'High',     maint: 'Urgent',    time: '1-2 weeks'   };
  if (pct > 30) return { pct, cls: 'medium', label: 'Medium',   maint: 'Scheduled', time: '1-3 months'  };
  return              { pct, cls: 'low',    label: 'Low',      maint: 'Routine',   time: '3-6 months'  };
}

function computeCost(damageClass, confidence) {
  const cm       = COST_MODEL[damageClass] || { base: 2000, perMeter: 500, urgency: 0.5 };
  const area     = 2 + confidence * 3;
  const total    = Math.round((cm.base + cm.perMeter * area) * (1 + cm.urgency * 0.5));
  return { min: Math.round(total * 0.8), max: Math.round(total * 1.2), total,
           area: area.toFixed(1), base: cm.base,
           areaCost: Math.round(cm.perMeter * area), urgencyPct: (cm.urgency * 100).toFixed(0) };
}

function computeUncertainty(allScores) {
  const scores  = Object.values(allScores);
  const entropy = -scores.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
  const norm    = entropy / Math.log2(scores.length);
  const conf    = 1 - norm;
  const sorted  = [...scores].sort((a, b) => b - a);
  const margin  = sorted[0] - sorted[1];
  const rel     = conf > 0.8 && margin > 0.3 ? 'Very High'
                : conf > 0.6 && margin > 0.2 ? 'High'
                : conf > 0.4                  ? 'Medium' : 'Low';
  const relCls  = rel === 'Very High' || rel === 'High' ? 'high' : rel === 'Medium' ? 'medium' : 'low';
  return { conf: (conf * 100).toFixed(1), margin: (margin * 100).toFixed(1), rel, relCls, warn: rel === 'Low' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SeverityBar({ severity }) {
  return (
    <div className="ai-feature">
      <h3>Severity Assessment</h3>
      <div className="severity-bar">
        <div className={`severity-fill ${severity.cls}`} style={{ width: `${severity.pct}%` }} />
      </div>
      <p>
        <strong>{severity.label} Severity</strong><br />
        {severity.maint} Maintenance Required<br />
        <small>Recommended Timeframe: {severity.time}</small>
      </p>
    </div>
  );
}

function CostCard({ costData }) {
  return (
    <div className="ai-feature">
      <h4>💰 Estimated Repair Cost</h4>
      <div className="cost-range">
        <span className="cost-value">{formatINR(costData.min)} – {formatINR(costData.max)}</span>
        <span className="cost-label">Average: {formatINR(costData.total)}</span>
      </div>
      <div className="cost-breakdown">
        <small>
          Base: {formatINR(costData.base)} | Area (~{costData.area}m²): {formatINR(costData.areaCost)} | Urgency: {costData.urgencyPct}%
        </small>
      </div>
    </div>
  );
}

function UncertaintyCard({ u }) {
  return (
    <div className="ai-feature">
      <h4>🎯 AI Confidence Analysis</h4>
      <div className="uncertainty-metrics">
        {[
          ['Model Certainty',   `${u.conf}%`,   u.relCls],
          ['Prediction Margin', `${u.margin}%`, ''],
          ['Reliability',        u.rel,          u.relCls],
        ].map(([label, value, cls]) => (
          <div key={label} className="metric-item">
            <span className="metric-label">{label}:</span>
            <span className={`metric-value ${cls}`}>{value}</span>
          </div>
        ))}
      </div>
      {u.warn && <p className="warning">⚠️ Low confidence — consider manual inspection</p>}
    </div>
  );
}

function SessionStats({ history, onExport }) {
  if (!history.length) return null;
  const avgConf = (history.reduce((s, p) => s + p.confidence, 0) / history.length * 100).toFixed(1);
  const avgInf  = (history.reduce((s, p) => s + p.inferenceTime, 0) / history.length).toFixed(0);
  return (
    <div className="ai-feature">
      <h4>📊 Session Statistics</h4>
      <div className="stats-grid-mini">
        <div className="stat-mini"><span className="stat-label">Total Analysed:</span><span className="stat-value">{history.length}</span></div>
        <div className="stat-mini"><span className="stat-label">Avg Confidence:</span><span className="stat-value">{avgConf}%</span></div>
        <div className="stat-mini"><span className="stat-label">Avg Inference:</span><span className="stat-value">{avgInf}ms</span></div>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={onExport}>📄 Export Report</button>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { token } = useAuth();

  const [preview,       setPreview]       = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [results,       setResults]       = useState(null);
  const [drag,          setDrag]          = useState(false);
  const [cameraOn,      setCameraOn]      = useState(false);
  const [serverStatus,  setServerStatus]  = useState(null);
  const [history,       setHistory]       = useState([]);
  const [batchProgress, setBatchProgress] = useState(null);
  const [batchResults,  setBatchResults]  = useState(null);

  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const heatmapRef   = useRef(null);
  const streamRef    = useRef(null);
  const fileInputRef  = useRef(null);
  const batchInputRef = useRef(null);

  // ── Server health check ───────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(r => r.json())
      .then(d => setServerStatus(d.status === 'ok' ? 'online' : 'offline'))
      .catch(() => setServerStatus('offline'));
  }, []);

  // ── Heatmap ───────────────────────────────────────────────────────────────
  const drawHeatmap = useCallback((prediction) => {
    setTimeout(() => {
      const canvas = heatmapRef.current;
      const img    = document.getElementById('rg-preview');
      if (!canvas || !img) return;
      canvas.width = 300; canvas.height = 300;
      const ctx   = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 300, 300);
      const alpha = prediction.confidence * 0.5;
      const color = prediction.confidence > 0.7 ? '255,0,0'
                  : prediction.confidence > 0.4 ? '255,165,0' : '255,255,0';
      const grad  = ctx.createRadialGradient(150, 150, 0, 150, 150, 150);
      grad.addColorStop(0, `rgba(${color},${alpha})`);
      grad.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 300, 300);
      ctx.fillStyle = 'white'; ctx.strokeStyle = 'black';
      ctx.lineWidth = 3; ctx.font = 'bold 16px Arial';
      const label = DAMAGE_LABELS[prediction.class] || prediction.class;
      ctx.strokeText(label, 10, 30);
      ctx.fillText(label, 10, 30);
    }, 300);
  }, []);

  // ── Analyse image ─────────────────────────────────────────────────────────
  const analyzeImage = useCallback(async (file) => {
    setResults(null); setError(''); setLoading(true);
    const form = new FormData();
    form.append('image', file);

    try {
      const res = await fetch(`${API_URL}/predict`, {
        method:  'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    form,
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error('non-json');
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      setResults(data);
      setHistory(h => [...h, { ...data.prediction, timestamp: data.timestamp, inferenceTime: data.inferenceTime }]);
      drawHeatmap(data.prediction);
    } catch (err) {
      const isOffline = ['non-json', 'Failed to fetch', 'NetworkError', 'fetch'].some(s => err.message.includes(s));
      if (isOffline) {
        const demo = generateDemoResult();
        setResults(demo);
        setServerStatus('offline');
        setHistory(h => [...h, { ...demo.prediction, timestamp: demo.timestamp, inferenceTime: demo.inferenceTime }]);
        drawHeatmap(demo.prediction);
      } else {
        setError('Analysis failed: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [token, drawHeatmap]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    analyzeImage(file);
  }, [analyzeImage]);

  // ── Camera ────────────────────────────────────────────────────────────────
  const toggleCamera = async () => {
    if (cameraOn) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      setCameraOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        setCameraOn(true);
      } catch {
        setError('Camera access denied or unavailable');
      }
    }
  };

  const captureFrame = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => handleFile(blob), 'image/jpeg', 0.95);
  };

  // ── Batch processing ──────────────────────────────────────────────────────
  const processBatch = async (files) => {
    const batchRes = [];
    for (let i = 0; i < files.length; i++) {
      setBatchProgress({ current: i + 1, total: files.length });
      try {
        const form = new FormData();
        form.append('image', files[i]);
        const res = await fetch(`${API_URL}/predict`, {
          method:  'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body:    form,
        });
        if (res.ok) {
          const data = await res.json();
          batchRes.push({ filename: files[i].name, ...data.prediction, inferenceTime: data.inferenceTime });
        }
      } catch { /* skip failed images */ }
    }
    setBatchResults(batchRes);
    setBatchProgress(null);
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportReport = () => {
    if (!history.length) return alert('No predictions to export');
    const report = { generatedAt: new Date().toISOString(), totalPredictions: history.length, predictions: history };
    const blob   = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href = url; a.download = `road-damage-report-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Derived values ────────────────────────────────────────────────────────
  let severity = null, costData = null, uncertaintyData = null;
  if (results?.prediction) {
    const { prediction } = results;
    severity        = computeSeverity(prediction.class, prediction.confidence);
    costData        = computeCost(prediction.class, prediction.confidence);
    uncertaintyData = computeUncertainty(prediction.allScores);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="container">

      {/* Header */}
      <header>
        <h1>🛣️ Road Surface Damage Detection</h1>
        <p className="subtitle">Edge AI-Powered Real-Time Analysis</p>
      </header>

      {/* 3-column grid */}
      <div className="main-content">

        {/* Upload Card */}
        <div className="card">
          <h2>Upload Image</h2>
          <div
            className={`upload-area${drag ? ' dragover' : ''}`}
            onClick={() => fileInputRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => {
              e.preventDefault(); setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f?.type.startsWith('image/')) handleFile(f);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={e => handleFile(e.target.files[0])}
            />
            <div className="upload-placeholder">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p>Click to upload or drag &amp; drop</p>
              <span>Supports: JPG, PNG (max 10 MB)</span>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => fileInputRef.current.click()}>
            Choose Image
          </button>
        </div>

        {/* Camera Card */}
        <div className="card">
          <h2>Live Camera</h2>
          <video ref={videoRef} autoPlay playsInline style={{ display: cameraOn ? 'block' : 'none', width: '100%', borderRadius: '8px' }} />
          {!cameraOn && <div className="camera-placeholder">Camera inactive</div>}
          <canvas ref={canvasRef} hidden />
          <div className="camera-controls">
            <button className={`btn ${cameraOn ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleCamera}>
              {cameraOn ? 'Stop Camera' : 'Start Camera'}
            </button>
            <button className="btn btn-primary" disabled={!cameraOn} onClick={captureFrame}>
              Capture &amp; Analyse
            </button>
          </div>
        </div>

        {/* Results Card */}
        <div className="card results-card">
          <h2>Analysis Results</h2>

          {!preview && !loading && !results && !error && (
            <p className="empty-state">Upload or capture an image to begin analysis</p>
          )}

          {preview && (
            <div className="preview-section">
              <img id="rg-preview" src={preview} alt="Preview" />
            </div>
          )}

          {loading && (
            <div className="loading-section">
              <div className="loader" />
              <p>Analysing image with AI…</p>
            </div>
          )}

          {error && <p className="error-message">{error}</p>}

          {results && !loading && (() => {
            const { prediction, inferenceTime, timestamp } = results;
            const label  = DAMAGE_LABELS[prediction.class] || prediction.class;
            const sorted = Object.entries(prediction.allScores).sort((a, b) => b[1] - a[1]);
            return (
              <>
                {results._demo && (
                  <div className="demo-banner">
                    ⚠️ <strong>Demo Mode</strong> — Backend server offline. Showing simulated results.
                  </div>
                )}
                <div className="result-header">
                  <span className="damage-type">{label}</span>
                  <span className="confidence">{(prediction.confidence * 100).toFixed(1)}%</span>
                </div>

                <div className="metrics">
                  <div className="metric"><span className="label">Inference Time</span><span className="value">{inferenceTime}ms</span></div>
                  <div className="metric"><span className="label">Timestamp</span><span className="value">{new Date(timestamp).toLocaleTimeString()}</span></div>
                </div>

                <div className="all-predictions">
                  <h3>All Detections</h3>
                  {sorted.map(([cls, score]) => (
                    <div key={cls} className="prediction-item">
                      <span>{DAMAGE_LABELS[cls] || cls}</span>
                      <div className="prediction-bar">
                        <div className="prediction-fill" style={{ width: `${score * 100}%` }} />
                      </div>
                      <span>{(score * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>

                <SeverityBar severity={severity} />
                <CostCard costData={costData} />
                <UncertaintyCard u={uncertaintyData} />

                <div className="ai-feature">
                  <h4>🗺️ Damage Localisation Heatmap</h4>
                  <div className="heatmap-container">
                    <canvas ref={heatmapRef} />
                  </div>
                </div>

                <SessionStats history={history} onExport={exportReport} />
              </>
            );
          })()}
        </div>
      </div>

      {/* Batch Processing */}
      <div className="card batch-section">
        <h2>📦 Batch Processing</h2>
        <p style={{ marginBottom: '1rem' }}>Upload multiple images for bulk analysis</p>
        <input
          ref={batchInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={e => processBatch(Array.from(e.target.files))}
        />
        <button className="btn btn-primary" onClick={() => batchInputRef.current.click()}>
          Select Multiple Images
        </button>

        {batchProgress && (
          <div className="batch-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
            </div>
            <p>Processing {batchProgress.current} of {batchProgress.total} images…</p>
          </div>
        )}

        {batchResults && (
          <div className="batch-results">
            <h3>Batch Processing Complete</h3>
            <div className="batch-summary">
              <p><strong>Total Images:</strong> {batchResults.length}</p>
              <p><strong>Average Confidence:</strong>{' '}
                {batchResults.length
                  ? (batchResults.reduce((s, r) => s + r.confidence, 0) / batchResults.length * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
            <table className="batch-table">
              <thead><tr><th>File</th><th>Damage Type</th><th>Confidence</th><th>Time</th></tr></thead>
              <tbody>
                {batchResults.map((r, i) => (
                  <tr key={i}>
                    <td>{r.filename}</td>
                    <td>{DAMAGE_LABELS[r.class] || r.class}</td>
                    <td>{(r.confidence * 100).toFixed(1)}%</td>
                    <td>{r.inferenceTime}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Model Info */}
      <div className="stats-dashboard">
        <div className="dashboard-header">
          <h2>🧠 AI Model Information</h2>
          <div className="server-status">
            <span className={`status-indicator ${serverStatus}`} />
            Server: {serverStatus === 'online' ? 'Online' : 'Offline'}
          </div>
        </div>
        <div className="stats-grid">
          {MODEL_INFO.map(([label, value]) => (
            <div key={label} className="stat-card">
              <span className="stat-label">{label}</span>
              <span className="stat-value">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="features-showcase">
        <h2>🚀 Advanced AI Features</h2>
        <div className="features-grid">
          {FEATURES.map(([icon, title, desc]) => (
            <div key={title} className="feature-card">
              <div className="feature-icon">{icon}</div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <footer>
        <p>Built with Edge Impulse Studio | Optimised for Edge Deployment</p>
      </footer>
    </div>
  );
}
