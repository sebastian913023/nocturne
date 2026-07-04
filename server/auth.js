const jwt = require('jsonwebtoken');

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set (see .env.example)');
}
const COOKIE_NAME = 'nocturne_session';
const TOKEN_TTL = '30d';

function signSession(userId) {
  return jwt.sign({ uid: userId }, SESSION_SECRET, { expiresIn: TOKEN_TTL });
}

function setSessionCookie(res, userId) {
  const token = signSession(userId);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

// Attaches req.userId if a valid session cookie is present; does not reject.
function attachSession(req, _res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, SESSION_SECRET);
      req.userId = payload.uid;
    } catch (e) {
      // invalid/expired token — treat as logged out
    }
  }
  next();
}

// Rejects with 401 if there's no valid session.
function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Not signed in' });
  next();
}

module.exports = { setSessionCookie, clearSessionCookie, attachSession, requireAuth, COOKIE_NAME };
