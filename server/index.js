const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '200kb' }));

const core = require('./routes/core').router;
const social = require('./routes/social').router;

app.use('/api', core);
app.use('/api', social);
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Also handle requests if /api prefix is stripped by serverless rewrites
app.use('/', core);
app.use('/', social);
app.get('/health', (req, res) => res.json({ ok: true }));

// In production, serve the built React app from the same port.
const dist = path.join(__dirname, '..', 'client', 'dist');
if (!process.env.VERCEL && fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use('/api', (req, res) => res.status(404).json({ error: 'no such endpoint' }));

app.use((err, req, res, next) => {
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'server tripped over something 🫠' });
});

const { db, FILE } = require('./db');

if (require.main === module) {
  const PORT = process.env.PORT || 5050;
  const server = app.listen(PORT, () => console.log(`🍛 MessMate API on http://localhost:${PORT} · SQLite: ${FILE}`));

  // Close the database cleanly on Ctrl+C / container stop.
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => server.close(() => { db.close(); process.exit(0); }));
  }
}

module.exports = app;
