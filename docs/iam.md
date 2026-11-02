# Identity and access management

Multi-tenant, passwordless, invitation-only. One email can belong to several
tenants; a one-time code proves the mailbox, the invitation proves the
membership.

## Model

| Table                  | Purpose                                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants`              | Organisations. `status` is `active` or `suspended`. The seed creates `acme`.                                                                                                                                                            |
| `users`                | Membership of an email in a tenant (`unique (tenant_id, email)`). `status` is `pending`, `active` or `suspended`. Holds direct `scopes`, `credential_version` (bumped on suspend to kill every token), `email_verified`, `otp_enabled`. |
| `roles` / `user_roles` | Named scope bundles per tenant and their assignment. Effective scopes = direct scopes ∪ role scopes.                                                                                                                                    |
| `invitations`          | `email`, hashed token, `scopes`, optional `role_id`, `invited_by`, `status` (`pending`, `accepted`, `revoked`, `expired`), `expires_at`. One pending invitation per tenant and email.                                                   |
| `otps`                 | `contact`, hashed code, `purpose` (`signup`, `login`), `expires_at`, `verified_at`, `attempts`, `max_attempts`. No `tenant_id`: a code proves a mailbox, not a membership.                                                              |
| `sessions`             | One per login: user, tenant, ip, user agent, `expires_at`, `revoked_at`, `last_activity_at`.                                                                                                                                            |
| `refresh_tokens`       | Opaque, hashed, bound to a session and to the user's `credential_version`. Rotated on every use.                                                                                                                                        |

Tokens and codes are never stored or returned in clear text:

- OTP codes: SHA-256 over `purpose | contact | code`, compared in constant time.
- Invitation tokens and refresh tokens: 32 random bytes, base64url to the
  user, SHA-256 in the database.
- Access tokens: HS256 JWT with `sub` (user), `tid` (tenant), `sid` (session),
  `email`, `name`, `scopes`, `cv` (credential version), `iss`, `aud`, `exp`, `jti`.

## Scopes

Catalogue (`GET /api/v1/scopes`): `users:read|write`, `scopes:read|write`,
`roles:read|write|assign`, `invitations:read|write`, `tenants:read`,
`movies:read|write`, `licenses:read|write`.

Matching rules (`kernel::scope`): exact match, `*` matches everything in the
tenant, `resource:*` matches every action on that resource. `platform:*`
scopes are rejected everywhere.

Granting rules (`iam::scopes::ensure_can_grant`): a caller can only grant
scopes they hold (by exact match or wildcard coverage) and only scopes from
the catalogue or `*`. This applies to `PUT /users/{id}/scopes`, role
creation and update, and invitation creation.

## Flows

### Signup (invitation + OTP)

```
admin ──POST /invitations {email, scopes, role_id}──▶ API ──▶ invitation stored (hash), email rendered by `notifx` (console today)
invitee ──opens {APP_PUBLIC_URL}/accept-invitation#token=…──▶ POST /auth/passwordless/signup/invitation {invitation_token} ──▶ who invited whom, where, until when
invitee ──POST /auth/passwordless/signup/initiate {email, name, invitation_token}──▶ invitation checked ──▶ signup OTP delivered
invitee ──POST /auth/passwordless/signup/verify {email, name, invitation_token, tenant_id, code}──▶ one transaction:
          lock latest signup OTP → check expiry/attempts → constant-time compare → record attempt
          lock invitation → pending, not expired, email matches, tenant active
          upsert user (active, email_verified, otp_enabled, scopes merged) → assign role → mark invitation accepted
invitee ──login flow below──▶ tokens
```

A wrong code counts as an attempt even though the rest of the transaction is
rolled back. Accepting an invitation never issues tokens; the member logs in
afterwards, which keeps the "prove the mailbox" and "start a session" steps
independent. The preview step is optional and public: the token is the
credential, it travels in the body (never in a path or query string), and any
token that is not usable answers `INVITATION_INVALID` without saying why.
What the messages look like and how the link is built is in
`notifications.md`.

### Login (OTP)

```
POST /auth/passwordless/tenants {email}              → tenants where the email is a member (empty list if none)
POST /auth/passwordless/login/initiate {email, tenant_id} → generic message if unknown; 403 if suspended; OTP delivered
POST /auth/passwordless/login/verify {email, tenant_id, code} → session + access JWT + refresh token (body and HttpOnly cookies)
```

Rate limits per contact and purpose: a new code is refused with
`OTP_TOO_MANY_REQUESTS` and `details.retry_after` for `OTP_RATE_LIMIT_WINDOW`
after the previous one was issued, whatever became of it (still valid,
consumed, or dead after too many attempts). Counting from the issue time
rather than from validity keeps the budget at `OTP_MAX_ATTEMPTS` guesses per
window: burning the attempts does not buy a fresh code. Wrong codes
decrement `details.attempts_remaining`; after `OTP_MAX_ATTEMPTS` the code is
dead (`OTP_TOO_MANY_ATTEMPTS`). Verification always looks up the latest code
for the contact and purpose, never by code value.

### Refresh and logout

```
POST /auth/refresh {refresh_token} or cookie → new access + refresh; the presented refresh token is revoked
POST /auth/logout                             → revokes the current session and its refresh tokens, clears cookies
POST /auth/logout/all                         → revokes every session of the user
```

Presenting an already-revoked refresh token is treated as theft: the whole
session is revoked and every token issued for it stops working. The
rotation itself is a conditional consume (`UPDATE … WHERE revoked_at IS
NULL`), so two requests racing with the same token end the same way: the
one whose update flips the row gets new tokens, the other counts as a reuse,
and the session is revoked under both of them (the server cannot tell which
copy was legitimate). Clients serialize their refreshes. Consume and issue
are not one transaction on purpose: if issuing fails after the consume, the
client holds no valid refresh token and logs in again, never two valid
tokens. Suspending a user bumps `credential_version`, revokes sessions and
refresh tokens, so existing access tokens are rejected on the next request.

## Middleware

Two variants, both built with `actix_web::middleware::from_fn`:

- `authenticate`: Bearer header first, access cookie second (a non-empty but
  invalid Bearer never falls back to the cookie). Validates the JWT, reloads
  the user (`can_login`, same `credential_version`), the tenant (active) and
  the session (alive, same user and tenant), touches `last_activity_at` and
  inserts an `AuthContext` with the token scopes.
- `authenticate_user_jwt`: same checks, scopes stripped. Used for
  `/auth/me`, `/auth/sessions`, `/auth/logout*`.

Handlers receive the context through the `Auth` extractor (401 if absent).

## Endpoints (`/api/v1`)

| Method | Path                                   | Auth          | Scope                                                                                  |
| ------ | -------------------------------------- | ------------- | -------------------------------------------------------------------------------------- |
| POST   | `/auth/passwordless/tenants`           | none          |                                                                                        |
| POST   | `/auth/passwordless/signup/invitation` | none          | Preview by token: `email`, `tenant_id`, `tenant_name`, `invited_by_name`, `expires_at` |
| POST   | `/auth/passwordless/signup/initiate`   | none          |                                                                                        |
| POST   | `/auth/passwordless/signup/verify`     | none          |                                                                                        |
| POST   | `/auth/passwordless/login/initiate`    | none          |                                                                                        |
| POST   | `/auth/passwordless/login/verify`      | none          |                                                                                        |
| POST   | `/auth/passwordless/resend-otp`        | none          |                                                                                        |
| POST   | `/auth/refresh`                        | refresh token |                                                                                        |
| POST   | `/auth/logout`                         | JWT           |                                                                                        |
| POST   | `/auth/logout/all`                     | JWT           |                                                                                        |
| GET    | `/auth/me`                             | JWT           |                                                                                        |
| GET    | `/auth/sessions`                       | JWT           |                                                                                        |
| GET    | `/scopes`                              | JWT           | `scopes:read`                                                                          |
| GET    | `/tenants/me`                          | JWT           | `tenants:read`                                                                         |
| GET    | `/users`                               | JWT           | `users:read`                                                                           |
| GET    | `/users/{id}`                          | JWT           | `users:read`                                                                           |
| POST   | `/users/{id}/suspend`                  | JWT           | `users:write`                                                                          |
| POST   | `/users/{id}/reinstate`                | JWT           | `users:write`                                                                          |
| PUT    | `/users/{id}/scopes`                   | JWT           | `users:write` + `scopes:write` + grant coverage                                        |
| GET    | `/users/{id}/roles`                    | JWT           | `roles:read`                                                                           |
| GET    | `/roles`                               | JWT           | `roles:read`                                                                           |
| POST   | `/roles`                               | JWT           | `roles:write` + grant coverage                                                         |
| GET    | `/roles/{id}`                          | JWT           | `roles:read`                                                                           |
| PUT    | `/roles/{id}`                          | JWT           | `roles:write` + grant coverage                                                         |
| DELETE | `/roles/{id}`                          | JWT           | `roles:write`                                                                          |
| POST   | `/roles/{id}/users`                    | JWT           | `roles:assign` + grant coverage of the role scopes                                     |
| DELETE | `/roles/{id}/users/{user_id}`          | JWT           | `roles:assign`                                                                         |
| GET    | `/invitations?status=`                 | JWT           | `invitations:read` (`status`: `pending`, `accepted`, `revoked`, `expired`)             |
| POST   | `/invitations`                         | JWT           | `invitations:write` + grant coverage                                                   |
| GET    | `/invitations/{id}`                    | JWT           | `invitations:read`                                                                     |
| POST   | `/invitations/{id}/resend`             | JWT           | `invitations:write`                                                                    |
| POST   | `/invitations/{id}/revoke`             | JWT           | `invitations:write`                                                                    |

## Error codes

| Code                             | HTTP | When                                                                     |
| -------------------------------- | ---- | ------------------------------------------------------------------------ |
| `VALIDATION_ERROR`               | 400  | Body fails to parse or validate (`details.fields`)                       |
| `UNAUTHORIZED`                   | 401  | Missing or invalid credentials                                           |
| `ACCESS_DENIED`                  | 403  | Scope missing or tenant mismatch (`details.required_scope`)              |
| `ROUTE_NOT_FOUND`                | 404  | Unknown path                                                             |
| `AUTH_FAILED`                    | 401  | Login could not be completed                                             |
| `AUTH_INVALID_REFRESH_TOKEN`     | 401  | Unknown, expired, revoked, reused or concurrently consumed refresh token |
| `AUTH_SESSION_EXPIRED`           | 401  | Session gone while the refresh token was still valid                     |
| `AUTH_ACCOUNT_NOT_ACTIVE`        | 403  | Pending or suspended member                                              |
| `AUTH_EMAIL_NOT_VERIFIED`        | 403  | Member exists but never verified the mailbox                             |
| `AUTH_OTP_NOT_ENABLED`           | 400  | Member cannot use codes                                                  |
| `OTP_INVALID`                    | 400  | Wrong code (`details.attempts_remaining`)                                |
| `OTP_EXPIRED`                    | 400  | Code past its TTL                                                        |
| `OTP_ALREADY_USED`               | 400  | Code already verified                                                    |
| `OTP_TOO_MANY_ATTEMPTS`          | 429  | Attempt limit reached                                                    |
| `OTP_TOO_MANY_REQUESTS`          | 429  | Previous code still valid (`details.retry_after`)                        |
| `INVITATION_INVALID`             | 400  | Unknown, expired, revoked, accepted, or email/tenant mismatch            |
| `INVITATION_NOT_FOUND`           | 404  | Id not in this tenant                                                    |
| `INVITATION_NOT_PENDING`         | 409  | Resend or revoke on a non-pending invitation                             |
| `INVITATION_ALREADY_PENDING`     | 409  | Second pending invitation for the same email                             |
| `INVITATION_MEMBER_NOT_ELIGIBLE` | 422  | Email already an active or suspended member                              |
| `USER_NOT_FOUND`                 | 404  |                                                                          |
| `USER_INVALID_STATUS`            | 409  | Suspend/reinstate from the wrong status                                  |
| `USER_CANNOT_MODIFY_SELF`        | 422  | Suspending or re-scoping yourself                                        |
| `USER_ALREADY_EXISTS`            | 409  |                                                                          |
| `ROLE_NOT_FOUND`                 | 404  |                                                                          |
| `ROLE_ALREADY_EXISTS`            | 409  | Duplicate name in the tenant                                             |
| `TENANT_NOT_FOUND`               | 404  |                                                                          |
| `INTERNAL_ERROR`                 | 500  | Unexpected failure; details only in development                          |

## Configuration

| Variable                                                                                 | Default                                                                                                     | Notes                                                   |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `JWT_SECRET`                                                                             | required                                                                                                    | At least 32 bytes                                       |
| `JWT_ISSUER` / `JWT_AUDIENCE`                                                            | `music-licensing` / `music-licensing-api`                                                                   | Audience accepts a comma-separated list                 |
| `JWT_ACCESS_TOKEN_TTL` / `JWT_REFRESH_TOKEN_TTL`                                         | `15m` / `7d`                                                                                                | humantime durations                                     |
| `OTP_CODE_LENGTH` / `OTP_EXPIRATION_TIME` / `OTP_MAX_ATTEMPTS` / `OTP_RATE_LIMIT_WINDOW` | `6` / `10m` / `5` / `1m`                                                                                    |                                                         |
| `SESSION_MAX_PER_USER` / `SESSION_CLEANUP_INTERVAL`                                      | `10` / `1h`                                                                                                 | Oldest session is evicted at the limit                  |
| `INVITATION_TTL`                                                                         | `7d`                                                                                                        |                                                         |
| `NOTIFY_*`, `APP_PUBLIC_URL`                                                             | see `notifications.md`                                                                                      | Provider (`console`), sender, frontend origin for links |
| `COOKIE_*`                                                                               | `access_token`, `refresh_token`, `COOKIE_SECURE=false` in development, `HttpOnly`, `SameSite=Lax`, path `/` | Set `COOKIE_SECURE=true` behind HTTPS                   |

## Seed data (migration `0002_seed_acme.sql`)

| What                  | Value                                                       |
| --------------------- | ----------------------------------------------------------- |
| Tenant                | `acme` (`11111111-1111-4111-8111-111111111111`)             |
| `admin@acme.test`     | active, scopes `*`                                          |
| `licensing@acme.test` | active, role `licensing-manager` (`movies:*`, `licenses:*`) |

## Design notes and sources

### A refresh token is consumed once; reuse ends the session

RFC 9700 (OAuth 2.0 Security Best Current Practice, 2025) §4.14.2 describes
refresh token rotation: the server "issues a new refresh token with every
access token refresh response" and "the previous refresh token is
invalidated"; when an invalidated token is presented, the server "cannot
determine which party submitted the invalid refresh token", so "it will
revoke the active refresh token", "at the cost of forcing the legitimate
client to obtain a fresh authorization grant"
([RFC 9700 §4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14)).
`refresh` applies that to the race as well as to the replay: the rotation
is `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND
revoked_at IS NULL`, and a request whose update touched no row lost the
consume to a concurrent one and is treated as the reuse it cannot be told
from. `crates/iam/tests/concurrency.rs` parks two refreshes on a row lock,
releases them together and checks that exactly one wins and the session is
gone for both. Documented extension, not built: a short grace period in
which the loser of a race gets the winner's answer (what some providers do
for clients that retry); the frontend serializes its refreshes instead.

### One-time codes: ten minutes, one use, a budget of guesses

NIST SP 800-63B-4 §3.1.3.2 asks that an out-of-band secret be "considered
invalid unless completed within 10 minutes", that verifiers "accept a given
authentication secret as valid only once during the validity period" and
that "generating a new authentication secret SHALL NOT reset the failed
authentication count"; §3.2.2 limits consecutive failed attempts and
suggests escalating delays
([NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)).
Codes here live `OTP_EXPIRATION_TIME` (10m), are consumed once and die after
`OTP_MAX_ATTEMPTS`. The cooldown between codes counts from the previous
code's `created_at` regardless of its state: otherwise exhausting the
attempts was the fastest way to a fresh code with a fresh budget, and the
attempt limit was no limit at all. Documented extension, not built: a
failure budget that carries over from one code to the next for the same
contact (what NIST asks literally), with growing waits.

## Not implemented yet

API keys, OAuth/social login, a real email provider (`notifications.md`),
tenant self-service signup, per-tenant settings. The ports and the `Actor`
enum are the extension points.
