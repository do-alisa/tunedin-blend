// Minimal MusicKit JS v1 type declarations
interface MusicKitInstance {
  authorize(): Promise<string>;
  musicUserToken: string;
  isAuthorized: boolean;
  api: {
    library: {
      playlists(params?: Record<string, unknown>): Promise<{ data: AppleMusicPlaylist[] }>;
    };
  };
}

interface AppleMusicPlaylist {
  id: string;
  attributes: {
    name: string;
    description?: { standard?: string };
    dateAdded?: string;
  };
}

interface MusicKitConfigureOptions {
  developerToken: string;
  app: { name: string; build: string };
}

interface MusicKitStatic {
  configure(options: MusicKitConfigureOptions): MusicKitInstance;
  getInstance(): MusicKitInstance;
}

interface Window {
  MusicKit?: MusicKitStatic;
}
