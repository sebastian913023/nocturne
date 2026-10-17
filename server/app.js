require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const anthropic = require('./anthropic');
const db = require('./db');
const { attachSession } = require('./auth');
const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/business');
const chatRoutes = require('./routes/chat');
const { router: billingRoutes, webhookHandler } = require('./routes/billing');
const statsRoutes = require('./routes/stats');
const cronRoutes = require('./routes/cron');

const app = express();
const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '60', 10);

app.disable('x-powered-by');

// Security headers.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' fonts.googleapis.com 'unsafe-inline'; " +
      "font-src fonts.gstatic.com; " +
      "img-src 'self' data:; " +
      "connect-src 'self' https://api.stripe.com; " +
      "frame-src https://js.stripe.com https://checkout.stripe.com;"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Stripe webhook needs the raw body for signature verification, so it must
// be registered before the JSON body parser.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), webhookHandler);

app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(attachSession);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'nocturne',
    anthropicConfigured: anthropic.isConfigured(),
    modelChain: anthropic.MODEL_CHAIN,
    timestamp: new Date().toISOString(),
  });
});

// Serverless entrypoints (Vercel) have no persistent process to run
// node-cron in, so db.init() runs once per cold start here and every
// request waits on it, instead of blocking app.listen() like the
// Railway/local entrypoint does.
const dbReady = db.init();
// Mark handled immediately so a cold start with no requests yet (and thus
// no code awaiting this) doesn't trip Node's unhandled-rejection crash; the
// real failure is still surfaced wherever dbReady is awaited below/in index.js.
dbReady.catch(() => {});
app.use(async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (e) {
    console.error('[db] not ready:', e.message);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: RATE_LIMIT_RPM,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Try again in a minute.' },
});
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/cron', cronRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Async route handlers forward rejections here (see asyncRouter.js).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server] unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Exposed so server/index.js (Railway/local) can wait on the same init
// promise before accepting connections, instead of racing it per-request.
app.dbReady = dbReady;

module.exports = app;
