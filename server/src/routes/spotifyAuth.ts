// server/src/routes/spotifyAuth.ts  (adjust path/name to match your repo)

import { Router } from "express";
import crypto from "node:crypto";
import { getSpotifyAccessTokenOrRefresh, setSpotifyTokens } from "../providers/spotifyTokens"; // <-- adjust relative path if needed

const authRouter = Router();
const apiRouter = Router();

// ── In-memory PKCE store (MVP only — replace with DB/session later) ─────────
const pkceStore = new Map<string, string>(); // state -> code_verifier

// ── Helpers ────────────────────────────────────────────────────────────────
function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function generateCodeVerifier(): string {
  return base64url(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  return base64url(crypto.createHash("sha256").update(verifier).digest());
}

function getRequiredEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

// ── GET /start — redirect user to Spotify authorize ────────────────────────
authRouter.get("/start", (_req, res) => {
  try {
    const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID");
    const redirectUri = getRequiredEnv("SPOTIFY_REDIRECT_URI");

    const state = base64url(crypto.randomBytes(16));
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    pkceStore.set(state, codeVerifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      // Add scopes as needed:
      // user-top-read for top tracks
      // user-read-email for /me
      scope: "user-read-email user-top-read",
      redirect_uri: redirectUri,
      state,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
    });

    res.redirect(`https://accounts.spotify.com/authorize?${params}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// ── GET /callback — exchange code for tokens ───────────────────────────────
authRouter.get("/callback", async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

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

    const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID");
    const clientSecret = getRequiredEnv("SPOTIFY_CLIENT_SECRET");
    const redirectUri = getRequiredEnv("SPOTIFY_REDIRECT_URI");

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("[spotify] token exchange failed:", tokenRes.status, body);
      res.redirect(`${clientUrl}/app?spotify=error&reason=token_exchange_failed`);
      return;
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    // Store tokens via shared provider module (replaces old tokenStore)
    setSpotifyTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    });

    console.log("[spotify] tokens stored, expires in", tokens.expires_in, "s");
    res.redirect(`${clientUrl}/app?spotify=connected`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[spotify] callback error:", message);
    res.redirect(`${clientUrl}/app?spotify=error&reason=server_error`);
  }
});

// ── GET /me — proxy to Spotify /v1/me ──────────────────────────────────────
apiRouter.get("/me", async (_req, res) => {
  try {
    const accessToken = await getSpotifyAccessTokenOrRefresh();
    if (!accessToken) {
      res.status(401).json({ error: "Not connected. Call /api/auth/spotify/start first." });
      return;
    }

    const profileRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      const body = await profileRes.text();
      res.status(profileRes.status).json({ error: `Spotify API: ${body}` });
      return;
    }

    const profile = await profileRes.json();
    res.json(profile);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// ── GET /top-tracks — proxy to Spotify /v1/me/top/tracks ────────────────────
apiRouter.get("/top-tracks", async (req, res) => {
  try {
    const accessToken = await getSpotifyAccessTokenOrRefresh();
    if (!accessToken) {
      res.status(401).json({ error: "Not connected. Call /api/auth/spotify/start first." });
      return;
    }

    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 50)));
    const time_range = String(req.query.time_range ?? "medium_term"); // short_term|medium_term|long_term

    const r = await fetch(
      `https://api.spotify.com/v1/me/top/tracks?${new URLSearchParams({
        limit: String(limit),
        time_range,
      })}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const text = await r.text();
    if (!r.ok) {
      res.status(r.status).json({ error: `Spotify API: ${text}` });
      return;
    }

    res.type("json").send(text); // keep raw for now
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export { authRouter as spotifyAuthRouter, apiRouter as spotifyApiRouter };
