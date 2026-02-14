import type { CandidateTrack } from "../candidateTrack";

type AppleItem = {
    id: string;
    type: string; // "songs", "library-songs", etc.
    attributes?: {
        name?: string;
        artistName?: string;
        isrc?: string;
        albumName?: string;
        durationInMillis?: number;
        artwork?: { url?: string };
    };
};

export function mapAppleItemsToCandidateTracks(
    items: AppleItem[],
    source: string
): CandidateTrack[] {
    return (items ?? [])
        .filter((x) => x?.id && x?.attributes?.name && x?.attributes?.artistName)
        .map((x, i) => ({
            provider: "apple",
            id: x.id,
            title: x.attributes!.name!,
            artist: x.attributes!.artistName!,
            isrc: x.attributes?.isrc,
            source: source as any,
            rank: i + 1,
            album: x.attributes?.albumName,
            artworkUrl: x.attributes?.artwork?.url
                ? x.attributes.artwork.url.replace("{w}", "300").replace("{h}", "300")
                : undefined,
            durationMs: x.attributes?.durationInMillis,
        }));
}
