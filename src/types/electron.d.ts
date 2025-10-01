export {}; // ensure this is a module

declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>;
      db?: {
        init: () => Promise<{ ok: boolean }>;
        addCreator: (data: { username: string; displayName?: string }) => Promise<{ id: number }>;
        listCreators: () => Promise<Array<{ id: number; username: string; display_name?: string }>>;
      };
      scrape?: {
        enqueue: (username: string) => Promise<{ enqueued: boolean }>;
        bulk: (usernames: string[]) => Promise<{ enqueued: number }>;
        onProgress: (handler: (payload: { username: string; status: 'success' | 'error'; data?: unknown; error?: string }) => void) => () => void;
      };
    };
  }
}
