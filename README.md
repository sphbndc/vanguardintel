# Vanguard Intel

Vanguard Intel is a FastAPI and vanilla JavaScript threat-intelligence dashboard that correlates CISA Known Exploited Vulnerabilities, AlienVault OTX pulses, and critical GitHub Security Advisories. It turns each record into ATT&CK context, remediation guidance, a SIEM hunting query, and a three-step Tier 1 response simulation.

## Features

- Concurrent, timeout-bound OSINT ingestion with normalized source records
- 15-minute in-memory TTL cache with an `asyncio.Lock` to prevent refresh stampedes
- Graceful partial-source, stale-cache, and empty degraded responses
- Keyword-driven MITRE ATT&CK mapping and threat-specific playbooks
- Responsive actionability matrix, search, source filtering, Sigma starters, and accessible modal behavior
- Persistent light/dark theme based on the supplied Vanguard palette
- Public dashboard surface with developer documentation routes disabled

## Run locally

Python 3.11+ is recommended.

```powershell
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Build the React dashboard once, then start FastAPI:

```powershell
cd frontend
npm install
npm run build
cd ..
uvicorn app.main:app --reload
```

Open <http://127.0.0.1:8000>. FastAPI serves the built React dashboard at `/`; the JSON feed remains available at <http://127.0.0.1:8000/api/v1/threats>.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `OTX_API_KEY` | No | Enables the authenticated `/pulses/subscribed` OTX collection. Without it, OTX reports `unconfigured`. |
| `GITHUB_TOKEN` | No | Raises GitHub API rate limits. Public advisories work without a token. |
| `HTTP_TIMEOUT_SECONDS` | No | Overall upstream request timeout; defaults to 12 seconds. |
| `FRONTEND_ORIGINS` | No | Comma-separated HTTPS origins allowed to call the API when hosting the frontend separately (for example, Vercel). |

Never commit `.env` or API keys. For production, terminate TLS at a trusted reverse proxy, use a secrets manager, pin allowed hosts/origins, and replace the single-process cache with Redis if running multiple workers.

AlienVault OTX community access is free, but its API endpoints require an account-specific API key. Create an OTX account, copy `.env.example` to `.env`, set `OTX_API_KEY`, and restart FastAPI. The repository deliberately does not include a shared token because committed API credentials can be stolen and abused.

## API response behavior

`GET /api/v1/threats` always returns a structured payload. `status` is `operational` only when every configured source is healthy; otherwise it is `degraded`. Individual source objects expose `operational`, `unconfigured`, or `degraded` state. `cache.state` is one of `hit`, `miss`, `stale`, or `empty`.

The generated detection rule and response checklist are analyst starting points, not autonomous controls. Validate them against local telemetry, asset criticality, change management, and incident response procedures.

## React/shadcn component surface

The React/TypeScript dashboard lives under `frontend/` and contains the shadcn-compatible logo marquee and actionability matrix. See [`frontend/README.md`](frontend/README.md) for development setup. `npm run build` produces the files FastAPI serves at the main `/` route; `npm run dev` remains available for hot-reload development on port 5173.

## Render Free deployment

The repository includes a multi-stage [`Dockerfile`](Dockerfile) and [`render.yaml`](render.yaml). In Render, choose **New → Blueprint**, connect this repository, and deploy the blueprint. Render builds the React bundle into the Docker image, serves it through FastAPI, and uses `/health` for health checks. Add `OTX_API_KEY` and `GITHUB_TOKEN` as secret environment variables in the Render dashboard when available.

The free plan has an ephemeral filesystem: Render documents that local SQLite files are lost when a service redeploys, restarts, or spins down. This project therefore treats SQLite history as a best-effort 90-day window and shows that limitation in the dashboard. A persistent Render disk requires a paid service; an external managed PostgreSQL database is the durable upgrade path.

## Optional Vercel frontend

Render is the recommended full-stack deployment. If you also want a separate Vercel frontend, import this repository in Vercel with the root directory set to `frontend`, build command `npm run build`, and output directory `dist`. Set `VITE_API_BASE_URL` to the deployed Render URL, then set `FRONTEND_ORIGINS` on Render to the exact Vercel origin (for example, `https://vanguardintel.vercel.app`).
