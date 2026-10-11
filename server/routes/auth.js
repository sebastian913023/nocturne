const bcrypt = require('bcryptjs');
const db = require('../db');
const { asyncRouter } = require('../asyncRouter');
const { setSessionCookie, clearSessionCookie, requireAuth } = require('../auth');

const router = asyncRouter();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(row) {
  return { id: row.id, email: row.email };
}

router.post('/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  const { rows: [created] } = await db.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id',
    [normalizedEmail, passwordHash]
  );
  if (!created) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  setSessionCookie(res, created.id);
  res.status(201).json({ user: { id: created.id, email: normalizedEmail } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const { rows: [user] } = await db.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
  setSessionCookie(res, user.id);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows: [user] } = await db.query('SELECT id, email FROM users WHERE id = $1', [req.userId]);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  res.json({ user });
});

module.exports = router;
