# Vanguard Intel React surface

The original application is intentionally FastAPI + Jinja + vanilla JavaScript. This folder adds the React/TypeScript surface required by the supplied `LogoCloudMarquee` component without breaking the original dashboard.

## Component path

This Vite app uses `frontend/src` as the TypeScript alias root (`@/*`). Therefore the shadcn-standard component path is:

```text
frontend/src/components/ui
```

`components.json` points `ui` to `@/components/ui`. Keeping UI primitives in this folder makes shadcn CLI-generated components, imports, and aliases consistent. The supporting `cn` helper lives at `frontend/src/lib/utils.ts`.

## Run

In one terminal, start the FastAPI API from the repository root:

```powershell
uvicorn app.main:app --reload
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` requests to the FastAPI server at `127.0.0.1:8000`.

For the integrated production-style route, run `npm run build` and open <http://127.0.0.1:8000>. FastAPI serves `frontend/dist/index.html`, its compiled assets, and the local OSINT source icons directly.

The repository also includes a Docker-based Render Free deployment. The multi-stage image builds this frontend and packages it with FastAPI; see the root [`render.yaml`](../render.yaml) and [`Dockerfile`](../Dockerfile). SQLite history is intentionally ephemeral on Render Free.

For an optional separate Vercel deployment, use `frontend` as the project root, `npm run build` as the build command, and `dist` as the output directory. Set `VITE_API_BASE_URL` to the Render API origin; configure the matching Vercel origin in Render's `FRONTEND_ORIGINS` variable.

## Starting from a fresh React app

If you move this surface into a separate project, the equivalent setup is:

```powershell
npm create vite@latest vanguardintel-frontend -- --template react-ts
cd vanguardintel-frontend
npx shadcn@latest init
npm install motion clsx tailwind-merge tw-animate-css
```

Choose TypeScript, Tailwind CSS, `src/index.css`, and the `@/components` alias when prompted. Then place `logo-cloud-marquee.tsx` and its `logo-cloud-marquee-utils/flowing-logos.tsx` dependency in `src/components/ui`. The `frontend/` scaffold already contains these choices and the Tailwind 4 keyframes requested by the component.
