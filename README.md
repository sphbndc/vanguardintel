# Vanguard Intel

Vanguard Intel is a FastAPI backend with a React/TypeScript dashboard (plus a Jinja/vanilla JavaScript fallback) that correlates CISA Known Exploited Vulnerabilities, AlienVault OTX pulses, and critical GitHub Security Advisories. It turns each record into ATT&CK context, remediation guidance, a SIEM hunting query, and a three-step Tier 1 response simulation.

## Features

- Concurrent, timeout-bound OSINT ingestion with normalized source records
- 15-minute in-memory TTL cache with an `asyncio.Lock` to prevent refresh stampedes
- Graceful partial-source, stale-cache, and empty degraded responses
- Keyword-driven MITRE ATT&CK mapping and threat-specific playbooks
- Responsive actionability matrix, search, source filtering, Sigma starters, and accessible modal behavior
- Persistent light/dark theme based on the supplied Vanguard palette
- Public dashboard surface with developer documentation routes disabled

## Current project state

The current production target is a single Vercel project: Vercel builds `frontend/` and runs the FastAPI application as a Python Function.

- GitHub repository: <https://github.com/sphbndc/vanguardintel>
- Dashboard route: `/`
- Health check: `/health`
- JSON integration feed: `/api/v1/threats`
- FastAPI Swagger, ReDoc, and OpenAPI routes are intentionally disabled for the public portfolio surface.
- CISA KEV and GitHub advisories work without private credentials. AlienVault OTX requires your own `OTX_API_KEY`; without it the source is marked `unconfigured`.
- A source timeout produces `degraded` status while the other sources continue to load. OTX can be slower than the other feeds; set `HTTP_TIMEOUT_SECONDS=30` in Vercel if necessary.
- Threat observations are cached for 15 minutes. Refreshing during that window normally returns the cached snapshot.
- SQLite history is retained for up to 90 days on a best-effort basis. Vercel's serverless filesystem is ephemeral, so history can reset after function replacement.
- The application provides recommendations and analyst starting points only. It does not automatically isolate hosts, block indicators, or install patches.

## How an analyst uses Vanguard Intel

This is the normal Tier 1/Tier 2 workflow:

1. Open the dashboard and check **OSINT source telemetry**. Confirm which feeds are operational and note any degraded or unconfigured source.
2. Start with the highest-risk records. CISA KEV entries represent vulnerabilities known to be exploited; then consider severity, affected product, asset exposure, and whether the product is business-critical.
3. Use the search box and source filter to narrow the queue by CVE, vendor, product, pulse name, or IoC.
4. Read the **Actionability Matrix**. The left side provides the title, source, date, description, source visual, and keyword-derived MITRE ATT&CK techniques. The right side provides remediation guidance, the vendor reference link, IoCs, and a Sigma detection starter.
5. Select **Simulate Incident Response** to open the generated three-step checklist:
   - **Containment:** restrict or isolate affected hosts while preserving evidence.
   - **Investigation:** run the displayed SIEM query, validate hits against real assets, users, processes, and timestamps, and preserve the timeline.
   - **Remediation:** open the vendor guidance, confirm the vulnerable version, test the fix, and follow change-control procedures.
6. Treat a confirmed malicious hit as an incident. Escalate according to your organization's severity matrix; treat an exposed but inactive vulnerability as a patch/remediation ticket when appropriate.
7. Validate the result. Confirm the patched version or compensating control, rerun vulnerability checks, verify service health, and hunt again for suspicious activity.
8. Document the ticket: threat ID, affected assets, evidence, containment actions, patch/change record, detection updates, owner, and verification result.

### Implementing mitigations in real tools

Vanguard Intel does not make production changes for you. An analyst implements the recommendation in approved security and IT tools:

- **Vulnerability:** identify every affected host, apply the vendor patch in staging, roll out by change window/canary, verify versions, then complete the fleet rollout.
- **Known exploitation:** prioritize internet-facing and critical assets, restrict exposure immediately, apply the CISA/vendor action, and monitor for exploitation attempts.
- **OTX IoC:** validate the indicator first, then block it at the appropriate firewall, DNS, proxy, EDR, or email-control layer. Search historical logs before closing the alert; an indicator match may require account reset or persistence removal.
- **Detection starter:** copy the Sigma scaffold, replace `<add validated artifact>` with a confirmed command/path/hash/event, test against known-good and known-bad telemetry, tune false positives, and obtain peer/change approval before production deployment.

The generated query and Sigma rule are templates. Field names differ between Splunk, Elastic, Sentinel, Chronicle, and other SIEMs, so adapt them to your local schema.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `OTX_API_KEY` | No | Enables the authenticated `/pulses/subscribed` OTX collection. Without it, OTX reports `unconfigured`. |
| `GITHUB_TOKEN` | No | Raises GitHub API rate limits. Public advisories work without a token. |
| `HTTP_TIMEOUT_SECONDS` | No | Overall upstream request timeout; defaults to 12 seconds. |
| `THREAT_RETENTION_DAYS` | No | SQLite retention window; defaults to 90 days. |
| `MAX_API_RECORDS` | No | Maximum number of historical records returned by the API; defaults to 250. |
| `DATABASE_PATH` | No | SQLite location. On Vercel, unset values default to writable `/tmp/vanguardintel.db`. |

Never commit `.env` or API keys. For production, terminate TLS at a trusted reverse proxy, use a secrets manager, pin allowed hosts/origins, and replace the single-process cache with Redis if running multiple workers.

AlienVault OTX community access is free, but its API endpoints require an account-specific API key. Create an OTX account, copy `.env.example` to `.env`, set `OTX_API_KEY`, and restart FastAPI. The repository deliberately does not include a shared token because committed API credentials can be stolen and abused.

## API response behavior

`GET /api/v1/threats` always returns a structured payload. `status` is `operational` only when every configured source is healthy; otherwise it is `degraded`. Individual source objects expose `operational`, `unconfigured`, or `degraded` state. `cache.state` is one of `hit`, `miss`, `stale`, or `empty`.

The generated detection rule and response checklist are analyst starting points, not autonomous controls. Validate them against local telemetry, asset criticality, change management, and incident response procedures.

## React/shadcn component surface

The React/TypeScript dashboard lives under `frontend/` and contains the shadcn-compatible logo marquee and actionability matrix. See [`frontend/README.md`](frontend/README.md) for development setup. `npm run build` produces the files FastAPI serves at the main `/` route; `npm run dev` remains available for hot-reload development on port 5173.

## Vercel-only deployment

The repository includes [`vercel.json`](vercel.json). Import the GitHub repository as one Vercel project from the repository root; Vercel builds `frontend/` and detects the FastAPI instance in `app/main.py` as a Python Function. Add `OTX_API_KEY` and optional `GITHUB_TOKEN` in Vercel environment variables. Vercel automatically defaults SQLite to `/tmp/vanguardintel.db` when `DATABASE_PATH` is not set. The `/api/v1/threats` endpoint and dashboard are served from the same Vercel domain. Local SQLite remains ephemeral on Vercel, so use PostgreSQL when threat history must survive function replacement.
