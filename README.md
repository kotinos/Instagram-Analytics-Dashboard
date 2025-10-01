# Instagram Analytics Dashboard

A Windows desktop app scaffold built with Electron + Vite + React + TypeScript and SQLite (better-sqlite3). This Phase 1 foundation includes a secure Electron preload, IPC handlers with Joi validation, and database migrations so you can run the app locally and verify end-to-end IPC and DB operations.

## Prerequisites

- Windows 10/11 (64‑bit)
- Node.js >= 18.0.0 (LTS recommended)
- ~2 GB free disk space for dependencies and prebuilt native modules

Verify your Node version:

```powershell
node -v
```

## Run locally

1) Install dependencies

```powershell
npm install
```

2) Start the dev environment (Vite + Electron)

```powershell
npm run dev
```

What happens:
- Vite dev server starts on http://localhost:5173
- Electron launches and loads the renderer (with context isolation + secure preload)

3) Smoke test in the app
- Click “Ping main” to verify secure IPC (expect: Reply: pong)
- Add a creator username and click “Add” to insert a record
- Click “Refresh” to list creators from the local SQLite database

Database location:
- `database/analytics.db`
- Migrations run automatically when the app initializes the DB (via `db:init` IPC handler)

## Environment configuration

You can create a `.env` file in the project root (optional):

```
# Example environment variables
VITE_DEV_SERVER=true
LOG_LEVEL=info
```

Notes:
- `VITE_DEV_SERVER` is set by the dev script; you typically don’t need to change it.
- Keep secrets out of `.env`; never hardcode sensitive values (see AGENTS.md).

## Scripts

```powershell
# Start Vite + Electron (development)
npm run dev

# Build the renderer only (Vite)
npm run build:renderer

# Package the Electron app (creates distributables under dist/)
npm run package

# Type-check the project (no emit)
npx tsc --noEmit
```

Build packaging notes:
- Windows NSIS target is configured via `electron-builder.yml`
- Code signing is optional for local testing; for signed builds set `certificateFile` and `CERT_PASSWORD`

## Project layout (Phase 1)

```
public/
	electron/
		main.js          # Electron main process (contextIsolation enabled)
		preload.js       # Secure preload exposing a small, whitelisted API
		ipc-handlers.js  # IPC endpoints (Joi validation + better-sqlite3)
	index.html
src/
	main/main.tsx     # React entry (MUI theme + basic dashboard)
	services/database/DatabaseService.ts  # DB service (strict TS), for future adoption by IPC
	types/electron.d.ts # Preload API typings for window.electronAPI
database/
	migrations/        # SQL migrations (run on db:init)
	analytics.db       # SQLite DB file (created at runtime)
config/
	default.json
```

## Troubleshooting

- Electron window doesn’t appear
	- Close any prior Electron/Vite processes; re-run `npm run dev`
	- Ensure firewall/antivirus isn’t blocking Electron
	- Wait for Vite to report: “Local: http://localhost:5173/”

- Port 5173 already in use
	- Stop the conflicting process or change the port: edit `package.json` dev script to `vite --port 5174`

- Native module errors for better-sqlite3
	- We use prebuilt binaries via `electron-builder install-app-deps` after install
	- If you still hit issues: `npm rebuild` or delete `node_modules` and run `npm install` again

- TypeScript errors
	- Run: `npx tsc --noEmit` to see details
	- Ensure `@types/node` and `@types/better-sqlite3` are installed (they are in devDependencies)

- Blank/white screen
	- Open DevTools (Ctrl+Shift+I) and check the console for CSP or runtime errors
	- In dev, CSP allows Vite HMR; if you changed CSP, restore the defaults in `public/electron/main.js`

## Security notes

- Context Isolation is enabled and only a safe, minimal API is exposed via `preload.js`
- Do not expose `ipcRenderer` directly to the renderer
- All DB writes use parameterized queries; user inputs are validated with Joi

## Next steps (beyond Phase 1)

- Use `DatabaseService` within the main process and route all IPC DB calls through it
- Add Winston logging and custom error classes (DatabaseError, ValidationError, ScrapingError)
- Implement scraper scaffolding with `puppeteer-extra` stealth
- Introduce Redux Toolkit store and hook-based data access for the UI

---

If you want me to wire the IPC layer to `DatabaseService` and add logging now, say “refactor IPC to DatabaseService” and I’ll implement it in one pass.
