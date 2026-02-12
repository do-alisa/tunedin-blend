import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface PingResponse {
  message: string;
  app: string;
}

export default function AppPage() {
  const [data, setData] = useState<PingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/ping`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

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

            {error && (
              <div className="text-red-400 text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-2" />
                Failed to connect: {error}
              </div>
            )}

            {data && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Response</span>
                  <span className="text-green-400 font-medium">{data.message}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">App</span>
                  <span className="text-text-primary font-medium">{data.app}</span>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-green-400 text-xs">Connected</span>
                </div>
              </div>
            )}

            {!data && !error && (
              <div className="text-text-secondary text-sm animate-pulse">Connecting...</div>
            )}
          </div>

          {/* Placeholder for future auth buttons */}
          <div className="mt-6 space-y-3">
            <button
              disabled
              className="w-full py-3 rounded-xl bg-surface-overlay border border-border text-text-secondary text-sm font-medium cursor-not-allowed opacity-50"
            >
              Connect Spotify (coming soon)
            </button>
            <button
              disabled
              className="w-full py-3 rounded-xl bg-surface-overlay border border-border text-text-secondary text-sm font-medium cursor-not-allowed opacity-50"
            >
              Connect Apple Music (coming soon)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
