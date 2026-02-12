import { Router } from 'express';
import crypto from 'node:crypto';

const authRouter = Router();
const apiRouter = Router();

// ── In-memory stores (MVP only — replace with DB/session later) ─────────────
const pkceStore = new Map<string, string>(); // state -> code_verifier
const tokenStore: {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
} = {};

// ── Helpers ──────────────────────────────────────────────────────────────────
function base64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function generateCodeVerifier(): string {
  return base64url(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

function getRequiredEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

// ── GET /start — redirect user to Spotify authorize ─────────────────────────
authRouter.get('/start', (_req, res) => {
  try {
    const clientId = getRequiredEnv('SPOTIFY_CLIENT_ID');
    const redirectUri = getRequiredEnv('SPOTIFY_REDIRECT_URI');

    const state = base64url(crypto.randomBytes(16));
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    pkceStore.set(state, codeVerifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'user-read-email user-top-read',
      redirect_uri: redirectUri,
      state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    res.redirect(`https://accounts.spotify.com/authorize?${params}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ── GET /callback — exchange code for tokens ────────────────────────────────
authRouter.get('/callback', async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  try {
    const { code, state, error } = req.query as Record<string, string | undefined>;

    if (error) {
      res.redirect(`${clientUrl}/app?spotify=error&reason=${encodeURIComponent(error)}`);
      return;
    }

    if (!state || !pkceStore.has(state)) {
      res.redirect(`${clientUrl}/app?spotify=error&reason=invalid_state`);
      return;
    }

    if (!code) {
      res.redirect(`${clientUrl}/app?spotify=error&reason=missing_code`);
      return;
    }

    const codeVerifier = pkceStore.get(state)!;
    pkceStore.delete(state);

    const clientId = getRequiredEnv('SPOTIFY_CLIENT_ID');
    const clientSecret = getRequiredEnv('SPOTIFY_CLIENT_SECRET');
    const redirectUri = getRequiredEnv('SPOTIFY_REDIRECT_URI');

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error('[spotify] token exchange failed:', tokenRes.status, body);
      res.redirect(`${clientUrl}/app?spotify=error&reason=token_exchange_failed`);
      return;
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    tokenStore.accessToken = tokens.access_token;
    tokenStore.refreshToken = tokens.refresh_token;
    tokenStore.expiresAt = Date.now() + tokens.expires_in * 1000;

    console.log('[spotify] tokens stored, expires in', tokens.expires_in, 's');
    res.redirect(`${clientUrl}/app?spotify=connected`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[spotify] callback error:', message);
    res.redirect(`${clientUrl}/app?spotify=error&reason=server_error`);
  }
});

// ── GET /me — proxy to Spotify /v1/me ───────────────────────────────────────
apiRouter.get('/me', async (_req, res) => {
  if (!tokenStore.accessToken) {
    res.status(401).json({ error: 'Not connected. Call /api/auth/spotify/start first.' });
    return;
  }

  if (tokenStore.expiresAt && Date.now() > tokenStore.expiresAt) {
    res.status(401).json({ error: 'Token expired. Re-connect Spotify.' });
    return;
  }

  try {
    const profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokenStore.accessToken}` },
    });

    if (!profileRes.ok) {
      const body = await profileRes.text();
      res.status(profileRes.status).json({ error: `Spotify API: ${body}` });
      return;
    }

    const profile = await profileRes.json();
    res.json(profile);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export { authRouter as spotifyAuthRouter, apiRouter as spotifyApiRouter };
