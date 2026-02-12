import { Router } from "express";
import { mapSpotifyTopTracks } from "../taste/mappers/spotifyTopTracks";
import type { CandidateTrack } from "../taste/candidateTrack";

const router = Router();

/**
 * TEMP (MVP): import or re-create access to the in-memory tokenStore.
 *
 * Best practice: move tokenStore + refresh logic into a shared module
 * (e.g. server/src/providers/spotifyTokens.ts) and import it from both places.
 *
 * For now, simplest is to export tokenStore + refresh helper from spotifyAuth.ts
 * and import them here.
 */
import { getSpotifyAccessTokenOrRefresh } from "../providers/spotifyTokens";

/**
 * GET /api/me/taste
 * Returns the "taste tracks" for the currently connected user.
 * MVP: Spotify top tracks only.
 */
router.get("/me/taste", async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 50)));
    const time_range = String(req.query.time_range ?? "medium_term"); // short_term|medium_term|long_term

    try {
        const accessToken = await getSpotifyAccessTokenOrRefresh();
        if (!accessToken) {
            res.status(401).json({ error: "Spotify not connected. Connect first." });
            return;
        }

        const r = await fetch(
            `https://api.spotify.com/v1/me/top/tracks?${new URLSearchParams({
                limit: String(limit),
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
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({ error: message });
    }
});

export default router;
