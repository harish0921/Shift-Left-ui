# ShiftLeft

Quick local run guide (Windows / PowerShell).

## Prerequisites

- Node.js `v20.19.2` (from `.nvmrc`)
- `pnpm` 10+

## Install

```powershell
cd c:\Users\SYS-02\Desktop\shift-left\ShiftLeft
pnpm install
```

## Run Backend (API only, port 3000)

```powershell
cd packages\server
pnpm dev
```

Health check:

```powershell
curl http://localhost:3000/api/v1/ping
```

Expected:

```json
{"status":"ok","message":"pong"}
```

## Run Frontend (port 8080)

```powershell
cd packages\ui
pnpm dev -- --port 8080 --host 0.0.0.0
```

Open:

- `http://localhost:8080`

## UI environment

`packages/ui/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_PORT=8080
```

`packages/ui/vite.config.js` should proxy `/api` to `http://localhost:3000`.

## First-time usage notes

- In `/v2/agentcanvas`, **Generate** creates nodes only. You still need to configure required model/credential fields if prompted.
- On a new unsaved agent canvas (`/v2/agentcanvas`), Chat/Validation requires a saved flow id.
  - Save first (disk icon), then test chat and validation.
- If a generated flow shows:
  - `Missing credentials. Please pass an apiKey...`
  - Select a model with valid credential and regenerate (or update model config on generated nodes).

## Troubleshooting

- If UI looks stale after changes: hard refresh with `Ctrl + Shift + R`.
- If backend is running but UI actions fail, verify:
  - `http://localhost:3000/api/v1/ping`
  - `http://localhost:3000/api/v1/nodes`

## Useful commands

- Run all workspace dev apps: `pnpm dev`
- Build all packages: `pnpm build`
- Run tests: `pnpm test`
