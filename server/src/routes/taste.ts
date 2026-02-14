// server/src/routes/taste.ts
import { Router } from "express";
import type { CandidateTrack } from "../taste/candidateTrack";
import { getTasteForSpotifyUser } from "../taste/getTasteForSpotifyUser";

import { getSpotifyAccessTokenOrRefresh } from "../providers/spotifyTokens";
import { mapSpotifyTopTracks } from "../taste/mappers/spotifyTopTracks";

import { getTasteForAppleMusicUser } from "../taste/getTasteForAppleMusicUser";

const router = Router();

/**
 * GET /api/me/taste
 *
 * Default (new behavior):
 * - top 50 short_term + top 50 medium_term
 * - dedupe by track id (keep best rank)
 *
 * Optional (back-compat):
 * - if time_range=short_term|medium_term is provided, return only that range.
 */
router.get("/me/taste", async (req, res) => {
    const perRangeLimit = Math.min(50, Math.max(1, Number(req.query.limit ?? 50)));
    const time_range = req.query.time_range
        ? String(req.query.time_range)
        : undefined; // "short_term" | "medium_term" | undefined

    try {
        // Ensure connected
        const accessToken = await getSpotifyAccessTokenOrRefresh();
        if (!accessToken) {
            res.status(401).json({ error: "Spotify not connected. Connect first." });
            return;
        }

        // If caller explicitly asked for one range, keep old-ish behavior
        if (time_range === "short_term" || time_range === "medium_term") {
            const r = await fetch(
                `https://api.spotify.com/v1/me/top/tracks?${new URLSearchParams({
                    limit: String(perRangeLimit),
                    time_range,
                })}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (!r.ok) {
                const body = await r.text();
                res.status(r.status).json({ error: `Spotify API: ${body}` });
                return;
            }

            const raw = (await r.json()) as unknown;
            const tracks: CandidateTrack[] = mapSpotifyTopTracks(raw as any);

            res.json({
                tracks,
                meta: {
                    providers: ["spotify"],
                    counts: { spotify: tracks.length },
                    time_range,
                    mode: "single_range",
                    ranges: [time_range],
                },
            });
            return;
        }

        // New default behavior: combined short+medium, deduped
        const tracks = await getTasteForSpotifyUser(perRangeLimit);

        res.json({
            tracks,
            meta: {
                providers: ["spotify"],
                counts: { spotify: tracks.length },
                mode: "combined",
                ranges: ["short_term", "medium_term"],
                per_range_limit: perRangeLimit,
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

router.get("/me/apple/taste", async (_req, res) => {
    try {
        // reuse your existing dev-token endpoint logic OR just call it internally.
        // For hackathon simplicity: call your own endpoint or extract token generation to a shared helper.

        // easiest: hit your existing route from server-side:
        const tokenRes = await fetch("http://localhost:3001/api/auth/apple/developer-token");
        const { token: developerToken } = await tokenRes.json();

        const tracks = await getTasteForAppleMusicUser(developerToken, { heavyLimit: 25, addedLimit: 25 });

        res.json({
            tracks,
            meta: {
                providers: ["apple"],
                counts: { apple: tracks.length },
                sources: ["heavyRotation", "recentlyAdded"],
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message.toLowerCase().includes("not connected")) {
            res.status(401).json({ error: message });
            return;
        }
        res.status(500).json({ error: message });
    }
});


export default router;
