// Railway/local entrypoint: a persistent process, so the nightly cycle runs
// as a real in-process node-cron timer here. The Vercel entrypoint
// (api/index.js) skips this — see server/routes/cron.js.
const app = require('./app');
const anthropic = require('./anthropic');
const { scheduleNightly } = require('./nightCycle');

const PORT = process.env.PORT || 3000;

app.dbReady
  .then(() => {
    scheduleNightly();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`◐ Nocturne running on port ${PORT}`);
      console.log(`   Health:     /health`);
      console.log(`   Anthropic:  ${anthropic.isConfigured() ? 'configured ✓' : 'MISSING ✗ (fallback data will be used)'}`);
      console.log(`   Models:     ${anthropic.MODEL_CHAIN.join(' → ')}`);
    });
  })
  .catch((e) => {
    console.error('Failed to initialize database:', e.message);
    process.exit(1);
  });
