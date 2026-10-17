const express = require('express');
const { runCycleForAllBusinesses } = require('../nightCycle');

const router = express.Router();

// Vercel has no persistent process to host node-cron, so the nightly cycle
// (server/index.js's scheduleNightly, for Railway/local) is replaced on
// Vercel by a Cron Job (see vercel.json) hitting this route instead. Vercel
// attaches `Authorization: Bearer $CRON_SECRET` automatically when that env
// var is set on the project, so this checks it wasn't hit by anyone else.
router.get('/nightly', async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    await runCycleForAllBusinesses();
    res.json({ ok: true });
  } catch (e) {
    console.error('[cron] nightly run failed:', e.message);
    res.status(500).json({ error: 'Cycle failed' });
  }
});

module.exports = router;
