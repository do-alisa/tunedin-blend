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

/**
 * GET /api/me/blend-preview-3
 * Fake 2-user blend with NO shared tracks:
 *  - u1 gets your top 1-10
 *  - u2 gets your top 11-20
 *
 * This should produce mostly "bridge" and then "unique" (depending on your caps).
 */
router.get("/me/blend-preview-3", async (req, res) => {
    try {
        const K = Math.min(100, Math.max(1, Number(req.query.k ?? 20)));
        const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));

        // Ensure we have at least 20 to slice safely
        const taste = await getTasteForSpotifyUser(Math.max(limit, 20));

        const u1Taste = taste.slice(0, 10);
        const u2Taste = taste.slice(10, 20);

        const input: BlendInput = {
            roomId: "preview-3",
            users: [
                {
                    userId: "u1",
                    provider: "spotify",
                    tracks: u1Taste.map((t, i) => ({
                        id: t.id,
                        title: t.title,
                        artist: t.artist,
                        isrc: t.isrc,
                        source: t.source,
                        rank: i + 1, // re-rank 1..10 within this user's list
                    })),
                },
                {
                    userId: "u2",
                    provider: "spotify",
                    tracks: u2Taste.map((t, i) => ({
                        id: t.id,
                        title: t.title,
                        artist: t.artist,
                        isrc: t.isrc,
                        source: t.source,
                        rank: i + 1, // re-rank 1..10 within this user's list
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

/**
 * GET /api/me/blend-preview-artist-overlap
 * Fake 2-user test:
 *  - u1 uses full artist string (e.g. "DJ Snake, Justin Bieber")
 *  - u2 uses ONLY the first artist from that string (e.g. "DJ Snake")
 *
 * With the new generateBlend.ts, collabs should now count as artist overlap.
 */
router.get("/me/blend-preview-artist-overlap", async (req, res) => {
    try {
        const K = Math.min(100, Math.max(1, Number(req.query.k ?? 40)));
        const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 50)));

        const taste = await getTasteForSpotifyUser(limit);

        const u1 = taste.map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.artist, // full string (may contain commas)
            isrc: t.isrc,
            source: t.source,
            rank: t.rank,
        }));

        const u2 = taste.map((t, i) => ({
            id: t.id,
            title: t.title,
            // ONLY first artist (simulates "Sorry" vs "DJ Snake, Justin Bieber" style mismatch)
            artist: t.artist.split(",")[0].trim(),
            isrc: t.isrc,
            source: t.source,
            rank: i + 1,
        }));

        const input: BlendInput = {
            roomId: "preview-artist-overlap",
            users: [
                { userId: "u1", provider: "spotify", tracks: u1 },
                { userId: "u2", provider: "spotify", tracks: u2 },
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
