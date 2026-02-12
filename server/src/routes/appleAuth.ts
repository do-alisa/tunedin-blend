import { Router } from 'express';
import { importPKCS8, SignJWT } from 'jose';
import fs from 'node:fs';
import path from 'node:path';

const router = Router();

router.get('/developer-token', async (_req, res) => {
  const teamId = process.env.APPLE_MUSIC_TEAM_ID;
  const keyId = process.env.APPLE_MUSIC_KEY_ID;
  const keyPath = process.env.APPLE_MUSIC_PRIVATE_KEY_PATH;

  if (!teamId || !keyId || !keyPath) {
    res.status(500).json({
      error: 'Missing Apple Music env vars',
      missing: [
        !teamId && 'APPLE_MUSIC_TEAM_ID',
        !keyId && 'APPLE_MUSIC_KEY_ID',
        !keyPath && 'APPLE_MUSIC_PRIVATE_KEY_PATH',
      ].filter(Boolean),
    });
    return;
  }

  const resolvedPath = path.resolve(keyPath);

  if (!fs.existsSync(resolvedPath)) {
    res.status(500).json({
      error: `Private key file not found at: ${resolvedPath}`,
    });
    return;
  }

  try {
    const privateKeyPem = fs.readFileSync(resolvedPath, 'utf-8');
    const privateKey = await importPKCS8(privateKeyPem, 'ES256');

    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .setExpirationTime(now + 60 * 60 * 24) // 24 hours
      .sign(privateKey);

    res.json({ token });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: `Failed to generate token: ${message}` });
  }
});

export default router;
