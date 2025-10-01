export {}; // ensure this is a module

declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>;
  health: () => Promise<{ db: boolean; queue: boolean; scraper: boolean }>;
      db?: {
        init: () => Promise<{ ok: boolean }>;
        addCreator: (data: { username: string; displayName?: string }) => Promise<{ id: number }>;
        listCreators: () => Promise<Array<{ id: number; username: string; display_name?: string }>>;
      };
      scrape?: {
        enqueue: (username: string) => Promise<{ enqueued: boolean }>;
        bulk: (usernames: string[]) => Promise<{ enqueued: number }>;
        profileAndVideos: (username: string, limit?: number) => Promise<{ enqueued: boolean; session_id?: string } | { profile: unknown; videos_scraped: number }>;
        onProgress: (handler: (payload: { username: string; status: 'success' | 'error' | 'running' | 'video'; data?: unknown; error?: string; session_id?: string; shortcode?: string; count?: number }) => void) => () => void;
      };
    };
  }
}
