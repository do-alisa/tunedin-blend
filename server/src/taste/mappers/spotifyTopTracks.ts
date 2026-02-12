import type { CandidateTrack } from "../candidateTrack";

type SpotifyTopTracksResponse = {
    items: Array<{
        id: string;
        name: string;
        artists: Array<{ name: string }>;
        album?: { name?: string; images?: Array<{ url: string }> };
        duration_ms?: number;
        external_ids?: { isrc?: string }; // may be missing
    }>;
};

export function mapSpotifyTopTracks(raw: SpotifyTopTracksResponse): CandidateTrack[] {
    const items = raw?.items ?? [];
    return items
        .filter(t => t?.id && t?.name && t?.artists?.length)
        .map((t, i) => ({
            provider: "spotify",
            id: t.id,
            title: t.name,
            artist: t.artists.map(a => a.name).join(", "),
            isrc: t.external_ids?.isrc,
            source: "top",
            rank: i + 1,
            album: t.album?.name,
            artworkUrl: t.album?.images?.[0]?.url,
            durationMs: t.duration_ms,
        }));
}
