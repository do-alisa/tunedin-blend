import type { CandidateTrack } from "./candidateTrack";
import { getAppleMusicUserToken } from "../providers/appleTokens";
import { mapAppleItemsToCandidateTracks } from "./mappers/appleSongs";

async function fetchApple(endpoint: string, developerToken: string, userToken: string) {
    const r = await fetch(`https://api.music.apple.com${endpoint}`, {
        headers: {
            Authorization: `Bearer ${developerToken}`,
            "Music-User-Token": userToken,
        },
    });

    if (!r.ok) {
        const body = await r.text();
        throw new Error(`Apple Music API ${endpoint}: ${r.status} ${body}`);
    }
    return r.json() as Promise<any>;
}

// If you want: weight heavyRotation more than recentlyAdded later in your engine,
// you already have "source" and "rank" to do it.
export async function getTasteForAppleMusicUser(
    developerToken: string,
    opts?: { heavyLimit?: number; addedLimit?: number }
): Promise<CandidateTrack[]> {
    const userToken = getAppleMusicUserToken();
    if (!userToken) throw new Error("Apple Music not connected.");

    const heavyLimit = Math.min(50, Math.max(1, opts?.heavyLimit ?? 25));
    const addedLimit = Math.min(50, Math.max(1, opts?.addedLimit ?? 25));

    const [heavyRaw, addedRaw] = await Promise.all([
        fetchApple(`/v1/me/history/heavy-rotation?limit=${heavyLimit}`, developerToken, userToken),
        fetchApple(`/v1/me/library/recently-added?limit=${addedLimit}`, developerToken, userToken),
    ]);

    // Both endpoints typically return { data: [...] }
    const heavy = mapAppleItemsToCandidateTracks(heavyRaw?.data ?? [], "heavyRotation");
    const added = mapAppleItemsToCandidateTracks(addedRaw?.data ?? [], "recentlyAdded");

    // Dedupe by (isrc if present else title+artist) to reduce duplicates across surfaces
    const key = (t: CandidateTrack) =>
        t.isrc ? `isrc:${t.isrc}` : `na:${t.title.toLowerCase()}|${t.artist.toLowerCase()}`;

    const byKey = new Map<string, CandidateTrack>();
    for (const t of [...heavy, ...added]) {
        const k = key(t);
        const existing = byKey.get(k);
        if (!existing) byKey.set(k, t);
        else {
            // keep better rank (lower), prefer heavyRotation if tie
            const better =
                t.rank < existing.rank ||
                (t.rank === existing.rank && t.source === "heavyRotation" && existing.source !== "heavyRotation");
            if (better) byKey.set(k, t);
        }
    }

    return [...byKey.values()];
}
