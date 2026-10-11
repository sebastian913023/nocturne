const db = require('../db');
const { asyncRouter } = require('../asyncRouter');

const router = asyncRouter();

// Public aggregate for the landing page — a single count, no per-user data.
router.get('/', async (req, res) => {
  const { rows: [row] } = await db.query('SELECT COUNT(*)::int AS companies FROM businesses');
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ companies: row.companies });
});

module.exports = router;
