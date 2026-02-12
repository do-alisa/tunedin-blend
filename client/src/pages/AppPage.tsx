import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface PingResponse {
  message: string;
  app: string;
}

type AppleState =
  | { step: 'idle' }
  | { step: 'loading'; message: string }
  | { step: 'authorized'; tokenLength: number }
  | { step: 'playlists'; names: string[] }
  | { step: 'error'; message: string };

type SpotifyState =
  | { step: 'idle' }
  | { step: 'loading' }
  | { step: 'connected'; displayName: string }
  | { step: 'error'; message: string };

export default function AppPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [ping, setPing] = useState<PingResponse | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);
  const [apple, setApple] = useState<AppleState>({ step: 'idle' });
  const [spotify, setSpotify] = useState<SpotifyState>({ step: 'idle' });

  // Health ping on mount
  useEffect(() => {
    fetch(`${API_URL}/api/ping`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setPing)
      .catch((err) => setPingError(err.message));
  }, []);

  // Handle Spotify OAuth redirect
  useEffect(() => {
    const spotifyParam = searchParams.get('spotify');
    if (!spotifyParam) return;

    // Clean up query params so a refresh doesn't re-trigger
    setSearchParams({}, { replace: true });

    if (spotifyParam === 'connected') {
      setSpotify({ step: 'loading' });
      fetch(`${API_URL}/api/spotify/me`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((profile) => {
          setSpotify({ step: 'connected', displayName: profile.display_name ?? profile.id });
        })
        .catch((err) => {
          setSpotify({ step: 'error', message: err.message });
        });
    } else if (spotifyParam === 'error') {
      const reason = searchParams.get('reason') || 'unknown';
      setSpotify({ step: 'error', message: reason });
    }
  }, [searchParams, setSearchParams]);

  async function connectAppleMusic() {
    try {
      // 1. Check MusicKit loaded
      if (!window.MusicKit) {
        setApple({ step: 'error', message: 'MusicKit JS not loaded. Check index.html script tag.' });
        return;
      }

      // 2. Fetch developer token
      setApple({ step: 'loading', message: 'Fetching developer token...' });
      const tokenRes = await fetch(`${API_URL}/api/auth/apple/developer-token`);
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => null);
        throw new Error(body?.error || `Server returned ${tokenRes.status}`);
      }
      const { token: developerToken } = await tokenRes.json();

      // 3. Configure MusicKit
      setApple({ step: 'loading', message: 'Configuring MusicKit...' });
      window.MusicKit.configure({
        developerToken,
        app: { name: 'TunedIn Blend', build: '0.1.0' },
      });

      // 4. Authorize (opens Apple sign-in popup)
      setApple({ step: 'loading', message: 'Waiting for Apple sign-in...' });
      const music = window.MusicKit.getInstance();
      await music.authorize();

      const userToken = music.musicUserToken;
      if (!userToken) throw new Error('Authorization succeeded but no user token received.');

      setApple({ step: 'authorized', tokenLength: userToken.length });

      // 5. Fetch library playlists
      setApple({ step: 'loading', message: 'Fetching your playlists...' });
      const playlistRes = await fetch(
        'https://api.music.apple.com/v1/me/library/playlists?limit=10',
        {
          headers: {
            Authorization: `Bearer ${developerToken}`,
            'Music-User-Token': userToken,
          },
        },
      );

      if (!playlistRes.ok) {
        throw new Error(`Apple Music API returned ${playlistRes.status}`);
      }

      const playlistData = await playlistRes.json();
      const names: string[] = (playlistData.data ?? []).map(
        (p: AppleMusicPlaylist) => p.attributes.name,
      );

      setApple({ step: 'playlists', names });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setApple({ step: 'error', message });
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm mb-8 transition-colors"
        >
          &larr; Back
        </Link>

        <div className="rounded-2xl border border-border bg-surface-raised p-8">
          <h2 className="text-2xl font-bold mb-2">Your Blend</h2>
          <p className="text-text-secondary text-sm mb-6">
            Connect your streaming accounts to start blending.
          </p>

          {/* API status card */}
          <div className="rounded-xl bg-surface-overlay border border-border p-4">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3">
              API Status
            </p>

            {pingError && (
              <div className="text-red-400 text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-2" />
                Failed to connect: {pingError}
              </div>
            )}

            {ping && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Response</span>
                  <span className="text-green-400 font-medium">{ping.message}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">App</span>
                  <span className="text-text-primary font-medium">{ping.app}</span>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-green-400 text-xs">Connected</span>
                </div>
              </div>
            )}

            {!ping && !pingError && (
              <div className="text-text-secondary text-sm animate-pulse">Connecting...</div>
            )}
          </div>

          {/* Connect buttons */}
          <div className="mt-6 space-y-3">
            {spotify.step === 'connected' ? (
              <div className="w-full py-3 rounded-xl bg-surface-overlay border border-border text-center text-green-400 text-sm font-medium">
                Spotify connected
              </div>
            ) : (
              <a
                href={`${API_URL}/api/auth/spotify/start`}
                className="block w-full py-3 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black text-sm font-semibold text-center transition-colors"
              >
                {spotify.step === 'loading' ? 'Connecting...' : 'Connect Spotify'}
              </a>
            )}
            <button
              onClick={connectAppleMusic}
              disabled={apple.step === 'loading'}
              className="w-full py-3 rounded-xl bg-surface-overlay border border-border text-text-primary text-sm font-medium hover:bg-[#1c1c26]/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {apple.step === 'loading' ? apple.message : 'Connect Apple Music'}
            </button>
          </div>

          {/* Apple Music status */}
          {apple.step === 'authorized' && (
            <div className="mt-4 rounded-xl bg-surface-overlay border border-border p-4">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                <span className="text-green-400 text-sm font-medium">Apple Music Authorized</span>
              </div>
              <p className="text-text-secondary text-xs mt-1">
                User token length: {apple.tokenLength} chars
              </p>
            </div>
          )}

          {apple.step === 'playlists' && (
            <div className="mt-4 rounded-xl bg-surface-overlay border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                <span className="text-green-400 text-sm font-medium">Apple Music Connected</span>
              </div>
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                Your Playlists
              </p>
              {apple.names.length === 0 ? (
                <p className="text-text-secondary text-sm">No playlists found.</p>
              ) : (
                <ul className="space-y-1">
                  {apple.names.map((name) => (
                    <li
                      key={name}
                      className="text-sm text-text-primary py-1.5 px-3 rounded-lg bg-surface/50"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {apple.step === 'error' && (
            <div className="mt-4 rounded-xl bg-red-950/30 border border-red-900/50 p-4">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                <span className="text-red-400 text-sm font-medium">Apple Music Error</span>
              </div>
              <p className="text-red-300/80 text-xs mt-1">{apple.message}</p>
            </div>
          )}

          {/* Spotify status */}
          {spotify.step === 'connected' && (
            <div className="mt-4 rounded-xl bg-surface-overlay border border-border p-4">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#1DB954]" />
                <span className="text-[#1DB954] text-sm font-medium">Spotify Connected</span>
              </div>
              <p className="text-text-secondary text-xs mt-1">
                Signed in as {spotify.displayName}
              </p>
            </div>
          )}

          {spotify.step === 'error' && (
            <div className="mt-4 rounded-xl bg-red-950/30 border border-red-900/50 p-4">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                <span className="text-red-400 text-sm font-medium">Spotify Error</span>
              </div>
              <p className="text-red-300/80 text-xs mt-1">{spotify.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
