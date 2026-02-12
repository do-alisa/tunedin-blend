// server/src/routes/blend.ts
import { Router } from "express";
import { generateBlend } from "../blendEngine/generateBlend";
import type { BlendInput } from "../blendEngine/types";
import { getTasteForSpotifyUser } from "../taste/getTasteForSpotifyUser";

const router = Router();

/**
 * GET /api/me/blend-preview
 * MVP: single-user blend (sanity check that engine works on live taste data)
 */
router.get("/me/blend-preview", async (req, res) => {
    try {
        const K = Math.min(100, Math.max(1, Number(req.query.k ?? 20)));
        const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 50)));

        const taste = await getTasteForSpotifyUser(limit);

        const input: BlendInput = {
            roomId: "preview",
            users: [
                {
                    userId: "me",
                    provider: "spotify",
                    tracks: taste.map((t) => ({
                        id: t.id,
                        title: t.title,
                        artist: t.artist,
                        isrc: t.isrc,
                        source: t.source,
                        rank: t.rank,
                    })),
                },
            ],
        };

        const blend = generateBlend(input, K);
        res.json(blend);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        // If Spotify isn't connected, your helper throws "Spotify not connected."
        if (message.toLowerCase().includes("not connected")) {
            res.status(401).json({ error: message });
            return;
        }
        res.status(500).json({ error: message });
    }
});

/**
 * GET /api/me/blend-preview-2
 * Optional: fake 2-user blend using your own taste twice (useful to test "shared" logic)
 */
router.get("/me/blend-preview-2", async (req, res) => {
    try {
        const K = Math.min(100, Math.max(1, Number(req.query.k ?? 40)));
        const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 50)));

        const taste = await getTasteForSpotifyUser(limit);

        const input: BlendInput = {
            roomId: "preview-2",
            users: [
                {
                    userId: "u1",
                    provider: "spotify",
                    tracks: taste.map((t) => ({
                        id: t.id,
                        title: t.title,
                        artist: t.artist,
                        isrc: t.isrc,
                        source: t.source,
                        rank: t.rank,
                    })),
                },
                {
                    userId: "u2",
                    provider: "spotify",
                    // shift so there’s overlap + some uniqueness
                    tracks: taste.slice(10).map((t, i) => ({
                        id: t.id,
                        title: t.title,
                        artist: t.artist,
                        isrc: t.isrc,
                        source: t.source,
                        rank: i + 1,
                    })),
                },
            ],
        };

        const blend = generateBlend(input, K);
        res.json(blend);
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
