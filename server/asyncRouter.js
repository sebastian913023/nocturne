const express = require('express');

const METHODS = ['get', 'post', 'patch', 'delete'];

// Express 4 does not catch rejected promises from async handlers; this
// forwards them to next() so the error middleware in index.js handles them.
function asyncRouter() {
  const router = express.Router();
  for (const method of METHODS) {
    const original = router[method].bind(router);
    router[method] = (path, ...handlers) =>
      original(path, ...handlers.map((h) => (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)));
  }
  return router;
}

module.exports = { asyncRouter };
