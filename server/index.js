require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const anthropic = require('./anthropic');
const { attachSession } = require('./auth');
const { scheduleNightly } = require('./nightCycle');
const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/business');
const chatRoutes = require('./routes/chat');
const { router: billingRoutes, webhookHandler } = require('./routes/billing');

const app = express();
const PORT = process.env.PORT || 3000;
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

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

scheduleNightly();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`◐ Nocturne running on port ${PORT}`);
  console.log(`   Health:     /health`);
  console.log(`   Anthropic:  ${anthropic.isConfigured() ? 'configured ✓' : 'MISSING ✗ (fallback data will be used)'}`);
  console.log(`   Models:     ${anthropic.MODEL_CHAIN.join(' → ')}`);
});
