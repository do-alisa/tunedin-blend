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

export type PickedFor = "shared" | string; // string = userId label

export interface OutputTrack {
    canonicalId: string;
    title: string;
    artist: string;
    score: number;
    pickedFor: PickedFor[];
    explain: string;
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
