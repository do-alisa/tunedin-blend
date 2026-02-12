// server/src/providers/spotifyTokens.ts
const tokenStore: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
} = {};

export function setSpotifyTokens(tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
}) {
    tokenStore.accessToken = tokens.accessToken;
    if (tokens.refreshToken) tokenStore.refreshToken = tokens.refreshToken;
    if (tokens.expiresAt) tokenStore.expiresAt = tokens.expiresAt;
}

function getRequiredEnv(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`Missing env var: ${key}`);
    return val;
}

async function refreshSpotifyAccessToken(): Promise<boolean> {
    if (!tokenStore.refreshToken) return false;

    const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID");
    const clientSecret = getRequiredEnv("SPOTIFY_CLIENT_SECRET");

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: tokenStore.refreshToken,
        }),
    });

    if (!tokenRes.ok) return false;

    const tokens = (await tokenRes.json()) as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
    };

    tokenStore.accessToken = tokens.access_token;
    tokenStore.expiresAt = Date.now() + tokens.expires_in * 1000;
    if (tokens.refresh_token) tokenStore.refreshToken = tokens.refresh_token;

    return true;
}

/**
 * Returns a valid access token, refreshing if expired.
 * Returns undefined if not connected.
 */
export async function getSpotifyAccessTokenOrRefresh(): Promise<string | undefined> {
    if (!tokenStore.accessToken) return undefined;

    if (tokenStore.expiresAt && Date.now() > tokenStore.expiresAt) {
        const ok = await refreshSpotifyAccessToken();
        if (!ok) return undefined;
    }

    return tokenStore.accessToken;
}
