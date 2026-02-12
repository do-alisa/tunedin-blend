// server/src/taste/candidateTrack.ts

import type { Provider, TrackSource, InputTrack } from "../blendEngine/types";

/**
 * Canonical taste signal item produced by provider fetchers + mappers.
 * Provider fetchers should output CandidateTrack[].
 */
export type CandidateTrack = {
  provider: Provider; // "spotify" | "apple"
  id: string;         // provider track id (spotify track id OR apple song id)
  title: string;
  artist: string;
  isrc?: string;

  source: TrackSource; // "top" | "heavyRotation" | "recentlyAdded" | ...
  rank: number;        // 1..N within that source list

  // Optional extras (nice for UI/debug; engine ignores)
  album?: string;
  artworkUrl?: string;
  durationMs?: number;
};

/**
 * Convert a CandidateTrack into the engine's InputTrack shape.
 * (Engine's user/provider handling stays the same for now.)
 */
export function toInputTrack(t: CandidateTrack): InputTrack {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    isrc: t.isrc,
    source: t.source,
    rank: t.rank,
  };
}
