export type Provider = "spotify" | "apple";
export type TrackSource = "top" | "heavyRotation" | "recentlyAdded" | string;

export interface InputTrack {
    id: string;
    title: string;
    artist: string;
    isrc?: string;
    source: TrackSource;
    rank: number;
}

export interface InputUser {
    userId: string;
    provider: Provider;
    tracks: InputTrack[];
}

export interface BlendInput {
    roomId: string;
    users: InputUser[];
}

/** pickedFor now: ["shared"] OR ["u1"] etc */
export type PickedFor = "shared" | string;

export interface OutputTrack {
    canonicalId: string;
    title: string;
    artist: string;
    isrc?: string;

    providerIds: { spotify?: string; apple?: string };
    sourceUserId: string;

    score: number;
    pickedFor: PickedFor[];     // keep name
    explain: string;            // keep name
    fallbackQuery: string;      // `${artist} ${title}`
}

export interface BlendOutput {
    tracks: OutputTrack[];
    stats: {
        perUserCounts: Record<string, number>;
        perArtistCounts: Record<string, number>;
        artistCap: number;
        userCap: number;
    };
}
