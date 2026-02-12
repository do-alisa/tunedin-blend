import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* Glow effect */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/20 rounded-full blur-[128px] pointer-events-none" />

      <div className="relative z-10 max-w-lg text-center">
        {/* Logo mark */}
        <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-border bg-surface-raised">
          <span className="text-accent text-lg">&#9835;</span>
          <span className="text-sm font-medium text-text-secondary tracking-wide uppercase">
            TunedIn Blend
          </span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-b from-text-primary to-text-secondary bg-clip-text text-transparent">
          Your music,
          <br />
          blended together.
        </h1>

        <p className="text-text-secondary text-lg leading-relaxed mb-10">
          Connect your Spotify or Apple Music with a friend and discover what you share. See who
          brought each track, then export your blend as a playlist.
        </p>

        <button
          onClick={() => navigate('/app')}
          className="px-8 py-3.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-colors cursor-pointer text-base"
        >
          Get Started
        </button>
      </div>

      <footer className="absolute bottom-8 text-text-secondary text-xs">
        TunedIn Blend &middot; Two listeners, one playlist
      </footer>
    </div>
  );
}
