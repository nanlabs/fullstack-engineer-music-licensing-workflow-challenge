# Frontend

React SPA for the music licensing workflow platform. Two workspaces (Studio for movie teams, Rights for labels/artists), real-time SSE notifications, and full license negotiation UI.

## Stack

| Tool | Purpose |
|---|---|
| [React 19](https://react.dev) | UI framework |
| [TypeScript](https://typescriptlang.org) | Type safety |
| [Vite](https://vite.dev) | Build tool + dev server |
| [Tailwind CSS v4](https://tailwindcss.com) | Styling |
| [shadcn/ui](https://ui.shadcn.com) + [Base UI](https://base-ui.com) | Component primitives |
| [React Router v7](https://reactrouter.com) | Client-side routing |
| [Lucide](https://lucide.dev) | Icons |
| [Sonner](https://sonner.emilkowal.dev) | Toast notifications |

## Running

### Via Docker Compose (recommended)

From the repo root:

```bash
docker compose up --build
# → http://localhost:3000
```

The frontend is served by Nginx, which proxies `/api/*` requests to the backend container.

### Local dev server

```bash
npm install
npm run dev
# → http://localhost:5173
```

Vite proxies `/api` to `http://localhost:8080` (configurable in `vite.config.ts`). You need the backend running locally or via Docker.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_USE_MOCK_API` | `false` | Set to `true` to use the in-memory mock API instead of the real backend. Useful for offline UI development — no backend needed. |

Set via a `.env` file in this directory, shell export, or Docker build arg. See [`.env.example`](.env.example).

## Project Structure

```
src/
├── api/                  # API client layer
│   ├── index.ts          # Proxy that dispatches to real or mock backend
│   ├── real.ts           # HTTP client calling the real backend
│   ├── http.ts           # Fetch wrapper (auth headers, error handling)
│   ├── types.ts          # Api interface contract (what both backends implement)
│   ├── mode.ts           # Build-time mock/real switch (VITE_USE_MOCK_API)
│   ├── error.ts          # ApiError class
│   └── mock/             # In-memory mock backend (mirrors real API)
│       ├── backend.ts    # Mock implementation of Api interface
│       ├── data.ts       # Seed data (users, movies, songs, labels, licenses)
│       └── actor.ts      # Mock actor switching
├── components/
│   ├── app-layout.tsx    # Main layout (sidebar, header, user menu)
│   ├── notification-bell.tsx  # SSE-powered notification dropdown
│   ├── require-auth.tsx  # Auth gate for protected routes
│   ├── ui/               # shadcn/ui primitives (button, dialog, etc.)
│   └── ...               # Domain components (cards, badges, timeline)
├── lib/
│   ├── auth.tsx          # AuthProvider (login, logout, token refresh)
│   ├── rights-persona.tsx # Rights holder persona context
│   ├── rights-data.ts    # Data fetching for rights workspace
│   ├── user-name.ts      # User ID → display name resolution
│   └── utils.ts          # cn() classname helper
├── pages/
│   ├── login.tsx         # Login page with demo account quick-fill
│   ├── studio/           # Movie team workspace
│   │   ├── dashboard.tsx        # Movie list
│   │   ├── movie-detail.tsx     # Movie detail (scenes, team, progress)
│   │   ├── scene-detail.tsx     # Scene tracks + add track dialog
│   │   ├── license-detail.tsx   # License negotiation view
│   │   ├── licenses-list.tsx    # License status overview
│   │   └── movies-list.tsx      # Search/filter movies
│   └── rights/           # Rights holder workspace
│       ├── dashboard.tsx        # Overview stats
│       ├── inbox.tsx            # Incoming license requests
│       ├── catalog.tsx          # Song catalog
│       ├── song-detail.tsx      # Song detail + placements
│       ├── license-detail.tsx   # Respond to license requests
│       └── members.tsx          # Label member management
├── types/
│   └── dto.ts            # TypeScript types matching backend DTOs
├── App.tsx               # Router + providers
└── main.tsx              # Entry point
```

## Workspaces

### Studio (movie teams)

Path: `/studio/*`

- Create and manage movies with team members (Owner, Supervisor, Editor, Viewer)
- Add scenes with timecodes, place songs as tracks
- Create license requests with terms (fee, territory, media rights, exclusivity)
- Submit drafts, counter-offer, accept, or cancel
- Track license status across all movies

### Rights Holder (labels and artists)

Path: `/rights/*`

- Manage song catalog (add, edit, view placements)
- Review incoming license requests in a filtered inbox
- Accept, counter-offer (with new terms), or reject with reason
- Manage label members and roles
- Four persona contexts: Label Owner, Label Rep, Label Artist, Independent Artist

### Shared Features

- **Real-time notifications**: SSE connection to `GET /api/licenses/events` — toast + bell updates when the other party acts
- **Responsive layout**: collapsible sidebar on desktop, drawer on mobile
- **Dark/light theme**: toggle in user menu, persisted in localStorage
- **Workspace switcher**: switch between Studio and Rights from the user menu

## API Client

The frontend talks to the backend through a typed `Api` interface (`src/api/types.ts`). Two implementations exist:

1. **`real.ts`** — HTTP calls to `/api/*` via the fetch wrapper in `http.ts`
2. **`mock/backend.ts`** — in-memory implementation with seed data (enabled by `VITE_USE_MOCK_API=true`)

A proxy object in `src/api/index.ts` dispatches to whichever is active. Pages and components import `api` from `@/api` and never call `fetch()` directly.

## Scripts

```bash
npm run dev       # Vite dev server (http://localhost:5173)
npm run build     # TypeScript check + production build
npm run preview   # Preview the production build locally
npm run lint      # oxlint
```

Or from the repo root: `make frontend-dev`, `make frontend-build`, `make frontend-lint`.
