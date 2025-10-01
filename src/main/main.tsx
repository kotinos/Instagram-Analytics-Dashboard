import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline, Container, Box, Typography, Button, Stack, TextField, Alert, Chip } from '@mui/material';

const theme = createTheme({
  palette: {
    primary: { main: '#E1306C' },
    secondary: { main: '#405DE6' },
    background: { default: '#FAFAFA', paper: '#FFFFFF' },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: 'Inter, Roboto, Helvetica, Arial, sans-serif' },
});

const App: React.FC = () => {
  const [pong, setPong] = React.useState<string>('');
  const [creators, setCreators] = React.useState<Array<{ id: number; username: string }>>([]);
  const [username, setUsername] = React.useState('');
  const [progress, setProgress] = React.useState<Array<{ username: string; status: string; error?: string }>>([]);
  const [dbReady, setDbReady] = React.useState(false);
  const [lastError, setLastError] = React.useState<string | null>(null);
  const [limit, setLimit] = React.useState<number>(8);
  const bridgeOk = Boolean((window as any).electronAPI);

  const handlePing = async () => {
    const res = await window.electronAPI?.ping?.();
    setPong(res);
  };

  const initDb = async () => {
    try {
      await window.electronAPI?.db?.init?.();
      setDbReady(true);
    } catch (e) {
      setLastError((e as Error).message);
    }
    await refreshCreators();
  };

  const refreshCreators = async () => {
    const list = await window.electronAPI?.db?.listCreators?.();
    setCreators(list ?? []);
  };

  const addCreator = async () => {
    if (!username.trim()) return;
    await window.electronAPI?.db?.addCreator?.({ username: username.trim() });
    setUsername('');
    await refreshCreators();
  };

  const enqueueScrape = async () => {
    const u = username.trim();
    if (!u) return;
    await window.electronAPI?.scrape?.enqueue?.(u);
  };

  const scrapeProfileAndVideos = async () => {
    const u = username.trim();
    if (!u) return;
    try {
      await window.electronAPI?.scrape?.profileAndVideos?.(u, limit);
    } catch (e) {
      setLastError((e as Error).message);
    }
  };

  React.useEffect(() => {
    initDb();
    const off = window.electronAPI?.scrape?.onProgress?.((p) => {
      setProgress((prev) => [{ username: p.username, status: p.status, error: p.error }, ...prev].slice(0, 10));
    });
    return () => {
      off && off();
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ py: 4 }}>
        {!(window as any).electronAPI && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Electron bridge is not available. If you're viewing the Vite URL in a browser tab, open the Electron app window instead.
          </Alert>
        )}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" fontWeight={600}>Instagram Analytics Dashboard</Typography>
          <Typography color="text.secondary">Phase 1 scaffold • Electron + Vite + React + SQLite</Typography>
        </Box>
        {/* Status strip */}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Chip size="small" label={bridgeOk ? 'Bridge: OK' : 'Bridge: Missing'} color={bridgeOk ? 'success' : 'warning'} />
          <Chip size="small" label={dbReady ? 'DB: Ready' : 'DB: Init'} color={dbReady ? 'success' : 'default'} />
          {lastError && <Chip size="small" label={`Last error: ${lastError}`} color="error" />}
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Button variant="contained" color="primary" onClick={handlePing}>Ping main</Button>
          {pong && <Typography>Reply: {pong}</Typography>}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField label="Add creator username" value={username} onChange={(e) => setUsername(e.target.value)} size="small" />
          <Button variant="outlined" onClick={addCreator}>Add</Button>
          <Button variant="contained" color="secondary" onClick={enqueueScrape}>Scrape</Button>
          <Button variant="text" onClick={refreshCreators}>Refresh</Button>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField label="Video limit" type="number" size="small" value={limit}
            onChange={(e) => setLimit(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            sx={{ width: 140 }} />
          <Button variant="contained" onClick={scrapeProfileAndVideos}>Scrape Profile + Videos</Button>
        </Stack>
        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Creators</Typography>
          {creators.length === 0 ? (
            <Typography color="text.secondary">No creators yet.</Typography>
          ) : (
            <ul>
              {creators.map(c => (
                <li key={c.id}>{c.username}</li>
              ))}
            </ul>
          )}
        </Box>
        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2, mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Scrape Progress</Typography>
          {progress.length === 0 ? (
            <Typography color="text.secondary">No activity.</Typography>
          ) : (
            <ul>
              {progress.map((p, idx) => (
                <li key={idx}>{p.username}: {p.status}{p.error ? ` - ${p.error}` : ''}</li>
              ))}
            </ul>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Could send to a logger here
    console.error('Renderer error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            A runtime error occurred in the renderer.
          </Alert>
          <Box sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
            {String(this.state.error.stack || this.state.error.message)}
          </Box>
        </Container>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
