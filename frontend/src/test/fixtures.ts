// Data shaped like the backend seed (`backend/seed`), for tests.

import type {
  LicenseChanged,
  LicenseState,
  Me,
  MembershipOption,
  Movie,
  Scene,
  Tenant,
  TokenResponse,
  Track,
  User,
} from "@/lib/api/types"

export const TENANT_ID = "11111111-1111-4111-8111-111111111111"
const NOW = "2026-11-02T10:00:00Z"

export const tenant: Tenant = {
  id: TENANT_ID,
  slug: "acme",
  name: "ACME BROS PICTURES",
  status: "active",
  created_at: NOW,
}

export const admin: User = {
  id: "22222222-2222-4222-8222-222222222221",
  tenant_id: TENANT_ID,
  email: "admin@acme.test",
  name: "Ada Admin",
  status: "active",
  scopes: ["*"],
  email_verified: true,
  otp_enabled: true,
  last_login_at: NOW,
  created_at: NOW,
}

export const me: Me = {
  user: admin,
  tenant,
  effective_scopes: ["*"],
  session_id: "s1",
}

export const membership: MembershipOption = {
  tenant_id: TENANT_ID,
  tenant_slug: "acme",
  tenant_name: "ACME BROS PICTURES",
  user_status: "active",
  auth_methods: { otp: true },
}

export const token: TokenResponse = {
  access_token: "access",
  refresh_token: "refresh",
  token_type: "Bearer",
  expires_in: 900,
  user: admin,
  tenant,
}

export const movie: Movie = {
  id: "44444444-4444-4444-8444-444444444441",
  tenant_id: TENANT_ID,
  title: "The Last Encore",
  synopsis: "A farewell tour that refuses to end.",
  release_year: 2026,
  status: "in_production",
  created_at: NOW,
  updated_at: NOW,
}

export const scene: Scene = {
  id: "55555555-5555-4555-8555-555555555551",
  tenant_id: TENANT_ID,
  movie_id: movie.id,
  position: 1,
  title: "Opening night",
  description: null,
  start_ms: 0,
  end_ms: 180_000,
  created_at: NOW,
  updated_at: NOW,
}

export function track(
  overrides: Partial<Track> & { state?: LicenseState } = {}
): Track {
  const { state = "pending", ...rest } = overrides
  const allowed: Record<LicenseState, Track["license"]["allowed_events"]> = {
    pending: ["request"],
    requested: ["start_negotiation", "reject"],
    negotiating: ["approve", "reject"],
    rejected: ["reopen"],
    approved: ["expire"],
    expired: [],
  }
  return {
    id: "77777777-7777-4777-8777-777777777773",
    tenant_id: TENANT_ID,
    movie_id: movie.id,
    scene_id: scene.id,
    song: {
      id: "66666666-6666-4666-8666-666666666661",
      title: "Velvet Static",
      artist: "The Marrow Lights",
      rights_holder: "Harbor Lane Records",
    },
    start_ms: 15_000,
    end_ms: 95_000,
    duration_ms: 80_000,
    usage: "background",
    created_at: NOW,
    updated_at: NOW,
    license: {
      state,
      updated_at: NOW,
      expires_at: null,
      allowed_events: allowed[state],
    },
    ...rest,
  }
}

export function licenseChanged(next: Track, position = 1): LicenseChanged {
  return {
    position,
    tenant_id: TENANT_ID,
    event: "request",
    from_state: "pending",
    to_state: next.license.state,
    source: "acme",
    seq: position,
    occurred_at: NOW,
    track: next,
  }
}
