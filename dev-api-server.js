// Local dev API server — serves the same /api/* handlers that Vercel uses in prod.
// Run via: node dev-api-server.js  (or: npm run dev, which starts both this + CRA)
// CRA's src/setupProxy.js forwards /api/* here on port 3001.

const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.json());

// Load env vars from .env.local if present (mirrors Vercel dev behaviour)
try {
  require('fs').readFileSync('.env.local', 'utf8')
    .split('\n')
    .forEach(line => {
      const [k, ...rest] = line.split('=');
      if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
    });
} catch (_) {}

function wrapHandler(handler) {
  return (req, res) => handler(req, res);
}

// /api/token/:addr  →  api/token/[addr].js
const tokenHandler = require('./api/token/[addr]');
app.all('/api/token/:addr', (req, res) => {
  req.query.addr = req.params.addr;
  tokenHandler(req, res);
});

// /api/trades/:addr  →  api/trades/[addr].js
const tradesHandler = require('./api/trades/[addr]');
app.all('/api/trades/:addr', (req, res) => {
  req.query.addr = req.params.addr;
  tradesHandler(req, res);
});

// /api/tokens  →  api/tokens.js
app.all('/api/tokens', wrapHandler(require('./api/tokens')));

// /api/events  →  api/events.js (if present)
try {
  app.all('/api/events', wrapHandler(require('./api/events')));
} catch (_) {}

app.listen(PORT, () => {
  console.log(`[dev-api] API server running on http://localhost:${PORT}`);
  console.log('[dev-api] GEOMI_API_KEY:', process.env.GEOMI_API_KEY || process.env.REACT_APP_GEOMI_API_KEY ? 'set' : 'NOT SET');
});
