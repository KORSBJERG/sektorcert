

## Self-Hosting with Docker Compose (Dockhand)

This project is a static React/Vite SPA that connects to Lovable Cloud (Supabase) as its backend. To self-host it, we need:

1. **`Dockerfile`** — Multi-stage build: Node to build the Vite app, then Nginx to serve the static files.
2. **`nginx.conf`** — SPA-friendly config that routes all paths to `index.html`.
3. **`docker-compose.yml`** — Single service definition with environment variable pass-through and port mapping.
4. **`.dockerignore`** — Exclude `node_modules`, `.git`, etc.

### Important notes

- The backend (database, edge functions, auth) stays on Lovable Cloud — Docker only hosts the frontend.
- The Supabase URL and anon key are baked into the build via `VITE_` environment variables. You can override them at build time using `--build-arg`.
- Edge functions are deployed automatically by Lovable and don't need to be in the Docker container.

### Files to create

**`Dockerfile`**
- Stage 1: `node:20-alpine` — install deps, run `npm run build`
- Stage 2: `nginx:alpine` — copy `dist/` to `/usr/share/nginx/html`, copy custom `nginx.conf`
- Accept `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as build args

**`nginx.conf`**
- Listen on port 80
- `try_files $uri $uri/ /index.html` for SPA routing
- Gzip enabled, cache static assets

**`docker-compose.yml`**
- Service `web`, build from `.`, map port `8080:80`
- Pass build args from `.env` or environment
- Optional healthcheck

**`.dockerignore`**
- `node_modules`, `.git`, `supabase`, `dist`

### Technical detail

```text
┌─────────────────────────────┐
│  docker-compose up --build  │
│                             │
│  ┌───────────────────────┐  │
│  │  nginx:alpine (:80)   │  │
│  │  serves dist/ static  │──── port 8080 on host
│  └───────────────────────┘  │
│                             │
│  Build args:                │
│   VITE_SUPABASE_URL         │
│   VITE_SUPABASE_PUBLISHABLE_KEY
│   VITE_SUPABASE_PROJECT_ID  │
└─────────────────────────────┘
         │
         ▼ API calls at runtime
  Lovable Cloud (Supabase)
```

