# Frontend

The client is a single-page application in `frontend/`: React 19 and
TypeScript on Vite, TanStack Router for file-based routing and TanStack
Query for server state, shadcn/ui primitives on Tailwind CSS v4,
react-hook-form with zod for forms, sonner for toasts. Package manager and
script runner: bun. The interface is in Spanish, dark only. How to run,
scripts and the folder layout are in [`../frontend/README.md`](../frontend/README.md);
this document records the decisions.

## What it covers

Every capability the backend exposes:

| Area          | Screens                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Access        | `/login` (email → organisation when the email belongs to several → six-digit code, resend with cooldown), `/accept-invitation#token=…` (preview, name, code, account created, sign in) |
| Movies        | `/movies` list with search, status filter and pagination; `/movies/$movieId` with the scene board, reorder, edit and delete |
| Scenes        | Create/edit in a side sheet (title, description, optional window), reorder with up/down, delete                     |
| Cues (tracks) | `/movies/$movieId/scenes/$sceneId`: timeline at full width, table with state filter, add/edit (song picker, usage, in/out) and remove |
| Licenses      | `/tracks/$trackId`: state, expiry, one button per allowed event, transition dialog (note, source, expiry on approve), history |
| Songs         | `/songs` with search; `/songs/$songId`; create/edit/delete                                                           |
| Admin         | `/admin/invitations` (invite with role and direct scopes, resend, revoke), `/admin/users` and `/admin/users/$userId` (suspend/reinstate, roles, direct scopes, effective scopes), `/admin/roles` |

Sections and buttons the signed-in user cannot use are hidden with
`useCan(scope)`, which mirrors the backend's scope matching (`*`,
`family:*`, exact). The backend still decides: a 403 is shown translated,
and admin routes throw the same 403 in `beforeLoad` when the scope is
missing, so the error screen names the permission.

## Architecture

```
routes/            URL → loader (ensureQueryData) + component (useSuspenseQuery)
components/        UI by domain; forms with react-hook-form + zod; shadcn primitives in ui/
lib/queries/       queryOptions factories and mutation hooks (cache writes + invalidation)
lib/api/           contracts (interfaces) → implementations over the HTTP client → wire types
lib/auth/          session renewal, scope matching, guards
lib/realtime/      EventSource → cache reducer → feed, toasts, indicator
```

**Router and Query share one cache.** The `QueryClient` travels in the
router context; loaders call `ensureQueryData` with the same
`queryOptions` the component reads with `useSuspenseQuery`, so navigation
waits for data once and re-renders come from the cache. `defaultPreload:
"intent"` prefetches on hover.

**The API client is contract-first.** `lib/api/contracts.ts` declares one
interface per domain and `Api` groups them; `lib/api/<domain>.ts`
implements each with one typed call per method; `lib/api/http.ts` is the
only `fetch`. Return types are guaranteed by the contract, so a screen that
compiles cannot read a field the backend does not send. Error envelopes
become `ApiError` with the backend `code`, and `describeError` turns codes
into Spanish text with a what-to-do line (for example
`TRACK_LOCKED_BY_LICENSE` → "El cue está congelado por su licencia. La
licencia está aprobada. Recházala o márcala como expirada antes de cambiar
el cue").

**Cache keys are hierarchical.** `["tracks"]` → `["tracks","scene",id,filter]`
and `["tracks","detail",id]`; mutations write their answer with
`setQueryData` and invalidate the lists in `onSettled`, so the acting tab
is correct even without the stream.

## Session and authentication

- **Cookies, same origin.** The backend sets `access_token` (15 min) and
  `refresh_token` (7 days) as HttpOnly cookies. The client never holds a
  token: Vite proxies `/api` in development and nginx does in the image, so
  there is no CORS and `EventSource` authenticates with the cookie alone.
- **Renewal.** Any 401 outside the auth endpoints triggers one refresh and
  one retry; after a login or a refresh a timer renews a minute before the
  access token expires. Refreshes are single-flight within the tab and
  serialised across tabs with `navigator.locks` (the cookie jar is shared),
  because the backend revokes the session when a refresh token is presented
  twice. When the refresh fails with a 401 the cache is cleared and the user
  goes to `/login?redirect=…`.
- **Login.** `POST /auth/passwordless/tenants` lists the organisations of
  the email; one → the code is requested at once, several → picker, none →
  the form says so (that endpoint already reveals membership, so pretending
  otherwise would only confuse). A 429 on request keeps the user on the code
  step with the server's `retry_after`. After `login/verify`, `me` is
  fetched so the effective scopes include the roles (the token answer only
  carries direct scopes).
- **Invitations.** The token travels in the URL fragment, so it never
  reaches a server log; the flow previews the invitation, asks for the
  name, verifies the email with a code, then requests the login code for
  the new account (or shows the wait if the cooldown applies).

## Real-time

One `EventSource` per tab, opened under the protected layout.
`license.changed` events are folded into the cache by `applyLicenseChange`:
the track detail is replaced; every cached list by scene or movie that
holds the track gets it replaced (or removed, if the list is filtered by a
state it no longer matches); a list that should hold it but does not is
invalidated; the history is invalidated. The change is added to the
"Actividad en vivo" feed (movie page) and shown as a toast whose id is
shared with the mutation's own toast, so the acting tab sees one
notification, not two. The browser handles the server's 15-minute close
with `Last-Event-ID`; a non-200 (expired cookie) closes the stream for
good, so the hook renews the session and opens a new one, asking for a
resync because the new stream starts at the head. Only license changes
travel; creation and edits of movies, scenes, cues and songs reach other
tabs through `staleTime` and navigation.

## Visual identity: "mesa de montaje"

The work surface of an editing desk. One palette, one accent, one
memorable element.

- **Colour** (`src/index.css`, oklch): background `oklch(0.19 0.02 250)`,
  surface `0.23`, elevated `0.27`, line `0.34`, warm white text
  `oklch(0.93 0.01 80)`, secondary text `oklch(0.70 0.01 250)`, accent amber
  `oklch(0.80 0.15 75)` for primary actions, focus and the brand mark.
  License states each have a token, always paired with an icon and a label:
  pending grey, requested blue `oklch(0.72 0.12 230)`, negotiating violet
  `oklch(0.72 0.14 300)`, approved green `oklch(0.74 0.16 150)`, rejected red
  `oklch(0.66 0.19 25)`, expired grey with stripes (`license-stripes`).
- **Type.** IBM Plex Sans (400/500/600) with tabular figures everywhere;
  IBM Plex Mono only for timecodes, identifiers and the ruler (`timecode`
  utility). Radius 6 px: a tool, not a consumer app.
- **Layout.** A 232 px sidebar (sections, admin when allowed, live
  indicator, user and organisation, sign out); content left-aligned up to
  1280 px; 40 px rows. Below 1024 px the sidebar becomes a top bar with the
  brand, the live indicator and a menu button that opens the same
  navigation in a sheet; the scene board scrolls sideways instead of
  squeezing.
- **The memorable element: the timeline.** On a movie, every scene is a
  strip on the movie's time axis with its window as a band and its cues as
  bars coloured by license state (`SceneBoard`); on a scene the strip takes
  the full width with a timecode ruler (`CueTimeline`). Overlapping cues
  stack in lanes. Everything else is quiet: tables, side sheets, dialogs,
  no shadows or gradients.
- **Motion** only answers an action or a live event (a bar changes colour in
  300 ms, a toast enters); `prefers-reduced-motion` turns it off.
- **Copy.** Spanish, active voice, the exact verb on every action (Solicitar
  licencia, Iniciar negociación, Aprobar, Rechazar, Reabrir, Marcar como
  expirada; Invitar, Reenviar, Revocar; Suspender, Reinstaurar). Errors say
  what happened and what to do; empty states invite the next action.

## Tests

Vitest with jsdom, Testing Library and msw: the HTTP client, the session
manager, timecode and timeline geometry, error texts, scope matching,
license actions per state, the live-change reducer and the login flow. CI
(`.github/workflows/frontend.yml`) runs install, build, lint, typecheck and
test, then builds the image.

## Delivery

`frontend/Dockerfile` (bun build → nginx) and `frontend/nginx.conf` (SPA
fallback, long cache for hashed assets, `/api/` proxied to the backend with
buffering off). `compose.yml` adds the `frontend` service on
`${FRONTEND_PORT:-5173}`, the same port as the Vite dev server, so
`APP_PUBLIC_URL` and `CORS_ORIGINS` hold in both modes. Makefile:
`fe-install`, `fe-dev`, `fe-check`, `fe-build`, `fe-logs`; `make up` starts
the whole stack.

## Design notes and sources

### TanStack Router with TanStack Query

The router coordinates and Query caches. The documented pattern
([External data loading](https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading))
puts the `QueryClient` in the router context
(`createRootRouteWithContext`), calls `ensureQueryData` from loaders and
reads with `useSuspenseQuery` in components; `defaultPreloadStaleTime: 0`
leaves freshness to Query's `staleTime`. Protected routes follow
[Authenticated routes](https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes):
a pathless layout (`_app.tsx`) whose `beforeLoad` loads `me` and throws
`redirect({ to: "/login", search: { redirect } })`. Routes are files
([File-based routing](https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing)),
with `@tanstack/router-plugin/vite` registered before the React plugin and
the generated tree committed so `tsc` can run without Vite.

### shadcn/ui on Vite with Tailwind v4

Set up per [Installation: Vite](https://ui.shadcn.com/docs/installation/vite):
`@tailwindcss/vite`, `@import "tailwindcss"` in `index.css`, the `@/*`
alias in both tsconfig files before `shadcn init`, components added with
`shadcn add`. Tokens are CSS variables mapped through `@theme inline`;
there is no `tailwind.config`. Because the app is dark only, every token
lives on `:root` and `<html class="dark">` exists for the components'
`dark:` variants.

### Server-Sent Events in the browser

`EventSource` cannot set headers, so authentication is the cookie; with the
same-origin proxy `withCredentials` is irrelevant. The browser resends
`Last-Event-ID` only on its own reconnects, and a non-200 response leaves
the object `CLOSED` for good
([MDN: EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource)).
Hence the hook: let the browser handle the server's periodic close, and on
`CLOSED` renew the session, open a new stream and request a resync. The
backend sends `retry: 3000` and closes streams after
`SSE_MAX_CONNECTION_AGE` (15 min, the access token's lifetime).

### Single-use refresh tokens across tabs

The backend rotates the refresh token on every use and revokes the session
when one is presented twice (`iam.md`). The cookie is shared by every tab,
so two tabs refreshing at once would log each other out. The Web Locks API
(`navigator.locks.request`, Chrome 69+, Firefox 96+, Safari 15.4+)
serialises renewals across tabs; a shared promise does it within a tab;
without the API the in-tab single flight remains.

### The API contract, verified in the backend code

Error envelope `{ error: { code, kind, message, details? } }`; pagination
`{ items, pagination: { page, page_size, total, pages }, empty }` and flat
lists `{ items, count }`; `Track` embeds a song summary and
`license: { state, updated_at, expires_at, allowed_events }`;
`start_ms`/`end_ms` are milliseconds on the movie timeline and must fall
inside the scene window when there is one; transitions are
`POST /tracks/{id}/license/{event}` with `{ note?, source?, expires_at?,
expected_state? }` and answer `422 LICENSE_INVALID_TRANSITION` or
`409 LICENSE_STATE_STALE`; guards answer 409 with `track_ids`
(`MOVIE_HAS_ACTIVE_LICENSES`, `SCENE_HAS_ACTIVE_LICENSES`,
`SCENE_WINDOW_CONFLICT`) or without (`TRACK_LOCKED_BY_LICENSE`,
`SONG_IN_USE`). The frontend relies on `allowed_events` from the server
rather than re-deriving the state machine, and sends `expected_state` so a
stale screen cannot move a license someone else already moved.

## Intentionally not here yet

- A "cues by song" list on the song page: the API has no such endpoint.
- Drag-and-drop reordering of scenes: up/down buttons call the same
  `PUT /movies/{id}/scenes/order` without another dependency.
- Live updates for movie, scene, cue and song edits: the stream carries
  license changes only.
- A light theme: the tokens are on `:root` and would need a second set.
