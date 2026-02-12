import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generateBlend } from "./blendEngine/generateBlend";
import type { BlendInput } from "./blendEngine/types";

const app = express();
app.use(express.json()); // IMPORTANT: lets you read req.body
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

app.post("/blend", (req, res) => {
  const input = req.body as BlendInput;
  const result = generateBlend(input, 40);
  res.json(result);
});

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