// Vercel serverless entrypoint. An Express app is itself a valid
// (req, res) handler, so this just hands it to Vercel's Node runtime
// directly — no adapter package needed.
module.exports = require('../server/app');
