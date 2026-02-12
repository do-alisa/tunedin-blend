// server/src/taste/getTasteForSpotifyUser.ts
import { getSpotifyAccessTokenOrRefresh } from "../providers/spotifyTokens";
import { mapSpotifyTopTracks } from "./mappers/spotifyTopTracks";
import type { CandidateTrack } from "./candidateTrack";

async function fetchTopTracks(accessToken: string, time_range: "short_term" | "medium_term", limit: number) {
    const r = await fetch(
        `https://api.spotify.com/v1/me/top/tracks?${new URLSearchParams({
            limit: String(limit),
            time_range,
        })}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!r.ok) {
        const body = await r.text();
        throw new Error(`Spotify API (${time_range}): ${body}`);
    }

    return (await r.json()) as any;
}

/**
 * Fetches Spotify taste as:
 * - top tracks (medium_term) 50
 * - top tracks (short_term) 50
 * then dedupes by track id (keeps the best rank).
 */
export async function getTasteForSpotifyUser(perRangeLimit = 50): Promise<CandidateTrack[]> {
    const accessToken = await getSpotifyAccessTokenOrRefresh();
    if (!accessToken) throw new Error("Spotify not connected.");

    const limit = Math.min(50, Math.max(1, perRangeLimit));

    // Fetch both ranges
    const [rawMedium, rawShort] = await Promise.all([
        fetchTopTracks(accessToken, "medium_term", limit),
        fetchTopTracks(accessToken, "short_term", limit),
    ]);

    // Map both. We label sources differently so you can debug later.
    const medium = mapSpotifyTopTracks(rawMedium).map((t) => ({
        ...t,
        source: "top_medium", // TrackSource allows string
    }));

    const short = mapSpotifyTopTracks(rawShort).map((t) => ({
        ...t,
        source: "top_short",
    }));

    // Deduplicate by Spotify track id, keep whichever has the better (lower) rank.
    const byId = new Map<string, CandidateTrack>();
    for (const t of [...short, ...medium]) {
        const existing = byId.get(t.id);
        if (!existing || t.rank < existing.rank) {
            byId.set(t.id, t);
        }
    }

    // Return in a stable order: best ranks first (rank is per-list, but good enough)
    return [...byId.values()].sort((a, b) => a.rank - b.rank);
}
