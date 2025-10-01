# Instagram Analytics Dashboard

Windows desktop app built with Electron + Vite + React + TypeScript and SQLite (better-sqlite3). This foundation includes a secure preload, validated IPC, database migrations, a resilient scraping queue, and nightly DB backups. Use these instructions to run the app directly with `npx electron .` or via the dev server.

## Prerequisites

- Windows 10/11 (64‑bit)
- Node.js >= 18.0.0 (LTS recommended)
- ~2 GB free disk space for dependencies and prebuilt native modules

Verify your Node version:

```powershell
node -v
```

## Quick start (recommended)

1) Install dependencies

```powershell
npm install
```

2) Build the renderer bundle (used by Electron in non-dev)

```powershell
npm run build:renderer
```

3) Rebuild native modules for your Electron version (better-sqlite3)

```powershell
npm run rebuild:native
```

4) Launch the app

```powershell
npx electron .
```

On first launch, migrations will run automatically, the window opens with a basic dashboard, and nightly DB backups are scheduled.

Database path: `database/analytics.db` (WAL and foreign_keys enabled)

## Environment configuration

You can create a `.env` file in the project root (optional):

```
# Example environment variables
VITE_DEV_SERVER=true
LOG_LEVEL=info
```

Notes:
- `VITE_DEV_SERVER` is set by the dev script; you usually don’t need to set it manually.
- Optional proxy list for scraping: `PROXIES=http://user:pass@host:port,http://host2:port` (round‑robin)
- Keep secrets out of `.env`; never hardcode sensitive values (see AGENTS.md).

## Scripts

```powershell
## Development
npm run dev

## Build renderer bundle
npm run build:renderer

## Package Electron app (installer under dist/)
npm run package

## Rebuild native modules for Electron (better-sqlite3)
npm run rebuild:native

## Type-check (no emit)
npm run typecheck

## Run tests (vitest)
npm run test
```

Build packaging notes:
- Windows NSIS target is configured via `electron-builder.yml`
- Code signing is optional for local testing; for signed builds set `certificateFile` and `CERT_PASSWORD`

## Project layout (foundation)

```
public/
	electron/
		main.cjs          # Electron main process (contextIsolation, CSP in prod)
		preload.cjs       # Secure preload exposing a whitelisted API (no direct ipcRenderer)
		ipc-handlers.cjs  # IPC endpoints (Joi validation, DB + scraping orchestration)
		queue.cjs         # Concurrency, backoff, custom job runner
		scraper.cjs       # Puppeteer-extra stealth; profile + videos scraping
		proxy.cjs         # Simple round-robin proxy manager
	index.html
src/
	main/main.tsx     # React entry (MUI theme + basic dashboard)
	services/database/DatabaseService.ts  # TS DB service (future use in IPC/services)
	types/electron.d.ts # Preload API typings for window.electronAPI
database/
	migrations/        # SQL migrations (run on db:init)
	analytics.db       # SQLite DB file (created at runtime)
config/
	default.json
```

## Using the app

- Ping main: verifies secure IPC is working
- Add creator: inserts `username` into the DB
- Scrape (basic): queues a profile scrape for the username field
- Video limit + Scrape Profile + Videos: scrapes recent posts/reels and ingests videos + metrics with deltas
- Progress: shows running/video/success/error events during scraping

Tips:
- Keep the video limit small while testing (e.g., 3–5) to avoid rate-limits
- You can add a proxy list via `PROXIES` to rotate requests

## Troubleshooting

- Electron window doesn’t appear
	- Close any prior Electron/Vite processes; re-run `npm run dev`
	- Ensure firewall/antivirus isn’t blocking Electron
	- Wait for Vite to report: “Local: http://localhost:5173/”

- Port 5173 already in use
	- Stop the conflicting process or change the port: edit `package.json` dev script to `vite --port 5174`

- Native module error: "better_sqlite3.node is not a valid Win32 application"
	- Run: `npm run rebuild:native` to rebuild against your Electron version
	- If issues persist, delete `node_modules` and `package-lock.json`, then reinstall and rebuild

- TypeScript errors
	- Run: `npx tsc --noEmit` to see details
	- Ensure `@types/node` and `@types/better-sqlite3` are installed (they are in devDependencies)

- Blank/white screen or GPU errors on Windows
	- GPU is disabled by default in the app; if you still see issues, ensure your graphics drivers are up to date
	- Check logs under `logs/app.log` for details

- Tests fail on loading Vite config / ESM plugin
	- The config avoids loading ESM React plugin under Vitest; ensure you’ve pulled latest changes and run `npm install`

## Security notes

- Context Isolation is enabled and only a safe, minimal API is exposed via `preload.js`
- Do not expose `ipcRenderer` directly to the renderer
- All DB writes use parameterized queries; user inputs are validated with Joi

## Backups

- Nightly backups at 03:00 local time (SQLite file copy)
- Location: `database/backups/analytics-YYYYMMDDHH.db` (keeps last 7)

## Health check

You can call from the renderer:

```ts
await window.electronAPI.health(); // => { db: boolean, queue: boolean, scraper: boolean }
```

## Next steps (beyond foundation)

- Use `DatabaseService` within the main process and route all IPC DB calls through it
- Add Winston logging and custom error classes (DatabaseError, ValidationError, ScrapingError)
- Harden scraping (error classification, proxy health checks)
- Introduce Redux Toolkit state and charts (MUI DataGrid, @mui/x)
- Expand tests (unit + integration for DB ingestion and queue behavior)

---

If you want me to add an always-visible “System Health” indicator in the header and a one-click "Profile + Videos" demo flow, say "add health indicator" and I’ll wire it in.
