require('dotenv').config();
const express  = require('express');
const multer   = require('multer');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const FormData = require('form-data');
const fetch    = require('node-fetch');
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─────────────────────────────────────────────────────────────────────────────
// Edge Impulse Configuration
// ─────────────────────────────────────────────────────────────────────────────
const EDGE_IMPULSE_API_KEY    = process.env.EDGE_IMPULSE_API_KEY;
const EDGE_IMPULSE_PROJECT_ID = process.env.EDGE_IMPULSE_PROJECT_ID;
const JWT_SECRET              = process.env.JWT_SECRET || '874498dsnjnff';
let   useEdgeImpulseAPI       = false;

// ─────────────────────────────────────────────────────────────────────────────
// MongoDB Connection
// ─────────────────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://manishsingh7518_db_user:RwX8X6y3NBBWGWmc@cluster0.jjtkdzg.mongodb.net/';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✓ MongoDB connected successfully'))
  .catch(err => console.error('✗ MongoDB connection error:', err.message));

// ─── Schemas ──────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const detectionSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  damageClass:   { type: String, required: true },
  confidence:    { type: Number, required: true },
  allScores:     { type: Object, default: {} },
  inferenceTime: { type: Number },
  usingRealModel:{ type: Boolean, default: false },
  timestamp:     { type: Date, default: Date.now },
});

const User      = mongoose.model('User', userSchema);
const Detection = mongoose.model('Detection', detectionSchema);

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Multer configuration
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ─── JWT Auth Middleware ───────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Routes
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/signup
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ success: false, message: 'Name, email and password are required.' });

  if (password.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ success: false, message: 'This email is already registered.' });

    const hashed  = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, email, password: hashed });

    const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: '7d' });

    console.log(`[SIGNUP] ${email}`);
    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: { id: newUser._id, name: newUser.name, email: newUser.email },
    });
  } catch (err) {
    console.error('[SIGNUP]', err.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password are required.' });

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    console.log(`[LOGIN] ${email}`);
    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('[LOGIN]', err.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// POST /api/logout  (stateless JWT — client discards the token)
app.post('/api/logout', authMiddleware, (_req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/me  — return current user info
app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Detection History Routes
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/history  — paginated list of detections for logged-in user
app.get('/api/history', authMiddleware, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Detection.find({ userId: req.userId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      Detection.countDocuments({ userId: req.userId }),
    ]);

    res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch history.' });
  }
});

// DELETE /api/history/:id
app.delete('/api/history/:id', authMiddleware, async (req, res) => {
  try {
    const doc = await Detection.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!doc) return res.status(404).json({ success: false, message: 'Record not found.' });
    res.json({ success: true, message: 'Record deleted.' });
  } catch {
    res.status(500).json({ success: false, message: 'Could not delete record.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Impulse / Model Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function loadModel() {
  if (
    EDGE_IMPULSE_API_KEY &&
    EDGE_IMPULSE_PROJECT_ID &&
    EDGE_IMPULSE_API_KEY !== 'your_api_key_here'
  ) {
    useEdgeImpulseAPI = true;
    console.log('✓ Edge Impulse API configured — Project ID:', EDGE_IMPULSE_PROJECT_ID);
  } else {
    console.log('ℹ  Running in DEMO MODE — add real keys to .env to enable Edge Impulse');
  }
}

function generateAIInsights(predictions, inferenceTime) {
  const scores = Object.values(predictions);
  const sorted = Object.entries(predictions).sort((a, b) => b[1] - a[1]);

  const entropy       = -scores.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
  const normalizedEnt = entropy / Math.log2(scores.length);
  const margin        = sorted[0][1] - (sorted[1] ? sorted[1][1] : 0);
  const calibrated    = sorted[0][1] * (1 - normalizedEnt * 0.3);
  const perfScore     = inferenceTime < 50 ? 'Excellent'
                      : inferenceTime < 100 ? 'Good'
                      : inferenceTime < 200 ? 'Fair' : 'Needs Optimisation';

  return {
    entropy:              normalizedEnt.toFixed(4),
    margin:               margin.toFixed(4),
    calibratedConfidence: calibrated.toFixed(4),
    performanceScore:     perfScore,
    recommendManualReview: normalizedEnt > 0.7 || margin < 0.2,
    topAlternative: sorted[1] ? { class: sorted[1][0], confidence: sorted[1][1] } : null,
  };
}

const MOCK_CLASSES = [
  'D00-longitudinal-crack',
  'D10-transverse-crack',
  'D20-alligator-crack',
  'D40-pothole',
];

function generateDemoPrediction() {
  const idx     = Math.floor(Math.random() * MOCK_CLASSES.length);
  const topConf = 0.75 + Math.random() * 0.17;
  const predictions = { [MOCK_CLASSES[idx]]: topConf };

  let remaining = 1 - topConf;
  const others  = MOCK_CLASSES.filter((_, i) => i !== idx);
  others.forEach((cls, i) => {
    const val = i === others.length - 1 ? remaining : remaining * (0.3 + Math.random() * 0.4);
    predictions[cls] = val;
    remaining -= val;
  });

  // Normalise
  const sum = Object.values(predictions).reduce((a, b) => a + b, 0);
  Object.keys(predictions).forEach(k => (predictions[k] /= sum));

  return predictions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Predict Route (protected)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/predict', authMiddleware, upload.single('image'), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: 'No image provided' });

  const imagePath = req.file.path;

  try {
    const startTime    = Date.now();
    let predictions    = {};
    let usingRealModel = false;

    // ── Try Edge Impulse API ────────────────────────────────────────────────
    if (useEdgeImpulseAPI) {
      try {
        const form = new FormData();
        form.append('image', fs.createReadStream(imagePath), {
          filename:    req.file.originalname || 'image.jpg',
          contentType: req.file.mimetype || 'image/jpeg',
        });

        const response = await fetch(
          `https://studio.edgeimpulse.com/v1/api/${EDGE_IMPULSE_PROJECT_ID}/classify/image`,
          {
            method:  'POST',
            headers: { 'x-api-key': EDGE_IMPULSE_API_KEY, ...form.getHeaders() },
            body:    form,
          }
        );

        if (!response.ok) throw new Error(`API returned ${response.status}`);

        const result = await response.json();

        // Handle different Edge Impulse response shapes
        if (result.result?.classification) {
          Object.assign(predictions, result.result.classification);
        } else if (result.classification) {
          result.classification.forEach(i => { predictions[i.label] = i.value; });
        } else if (result.results) {
          result.results.forEach(i => { predictions[i.label] = i.value; });
        } else {
          throw new Error('Unrecognised Edge Impulse response shape');
        }

        if (Object.keys(predictions).length) {
          usingRealModel = true;
        } else {
          throw new Error('Empty predictions from API');
        }
      } catch (apiErr) {
        console.warn('[Edge Impulse] Falling back to demo mode:', apiErr.message);
        predictions = {};
      }
    }

    // ── Demo / fallback ─────────────────────────────────────────────────────
    if (!usingRealModel) {
      await new Promise(r => setTimeout(r, 60 + Math.random() * 40));
      predictions = generateDemoPrediction();
    }

    const inferenceTime  = Date.now() - startTime;
    const sorted         = Object.entries(predictions).sort((a, b) => b[1] - a[1]);
    const [topClass, topConf] = sorted[0];
    const aiInsights     = generateAIInsights(predictions, inferenceTime);

    // Persist to DB
    await Detection.create({
      userId:         req.userId,
      damageClass:    topClass,
      confidence:     topConf,
      allScores:      predictions,
      inferenceTime,
      usingRealModel,
    });

    // Clean up temp file
    fs.unlink(imagePath, () => {});

    res.json({
      success: true,
      prediction: { class: topClass, confidence: topConf, allScores: predictions },
      inferenceTime,
      timestamp:   new Date().toISOString(),
      aiInsights,
      usingRealModel,
      modelInfo: {
        framework: 'Edge Impulse',
        mode:      usingRealModel ? 'API' : 'Demo',
        projectId: usingRealModel ? EDGE_IMPULSE_PROJECT_ID : null,
      },
    });
  } catch (err) {
    console.error('[PREDICT]', err);
    fs.unlink(imagePath, () => {});
    res.status(500).json({ error: 'Prediction failed', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Utility Routes
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:      'ok',
    modelLoaded: useEdgeImpulseAPI,
    mode:        useEdgeImpulseAPI ? 'Edge Impulse API' : 'Demo Mode',
    dbState:     mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp:   new Date().toISOString(),
  });
});

app.get('/model-info', (_req, res) => {
  res.json({
    mode:      useEdgeImpulseAPI ? 'Edge Impulse API' : 'Demo Mode',
    projectId: useEdgeImpulseAPI ? EDGE_IMPULSE_PROJECT_ID : null,
    classes:   MOCK_CLASSES,
    framework: 'Edge Impulse',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────
loadModel().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 RoadGuard AI Backend`);
    console.log(`📡 http://localhost:${PORT}`);
    console.log(`🧠 Model: ${useEdgeImpulseAPI ? 'Edge Impulse API' : 'Demo Mode'}`);
    console.log(`🔐 Auth: /api/signup  /api/login  /api/logout\n`);
  });
});
