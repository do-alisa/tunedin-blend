import { getSpotifyAccessTokenOrRefresh } from "../providers/spotifyTokens";
import { mapSpotifyTopTracks } from "./mappers/spotifyTopTracks";

export async function getTasteForSpotifyUser(limit = 50) {
    const accessToken = await getSpotifyAccessTokenOrRefresh();
    if (!accessToken) {
        throw new Error("Spotify not connected.");
    }

    const r = await fetch(
        `https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=medium_term`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!r.ok) {
        const body = await r.text();
        throw new Error(`Spotify API: ${body}`);
    }

    const raw = await r.json();
    return mapSpotifyTopTracks(raw);
}
