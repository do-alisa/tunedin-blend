import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import appleAuthRouter from './routes/appleAuth.js';
import { spotifyAuthRouter, spotifyApiRouter } from './routes/spotifyAuth.js';
import tasteRouter from "./routes/taste";
import blendRouter from "./routes/blend";

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

app.use('/api/auth/apple', appleAuthRouter);
app.use('/api/auth/spotify', spotifyAuthRouter);
app.use('/api/spotify', spotifyApiRouter);
app.use("/api", tasteRouter);
app.use("/api", blendRouter);

app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
