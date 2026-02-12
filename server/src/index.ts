import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'server' });
});

// API routes
app.get('/api/ping', (_req, res) => {
  res.json({ message: 'pong', app: 'TunedIn Blend' });
});

app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
