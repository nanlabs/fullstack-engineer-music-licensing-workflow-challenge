# Notifications (`crates/notifx`)

How one-time codes and invitations leave the system. Today they leave through
the log: there is no email provider. What exists is the shape a provider slots
into, and the messages a provider would send.

## Where it sits

```
iam ──(ports: OtpNotifier, InvitationNotifier)──▶ notifx::mailers ──▶ notifx::EmailSender ──▶ console | (smtp | api, later)
```

`notifx` depends on the contexts whose notifier ports it implements, never the
other way round. `iam` knows that a code or an invitation gets delivered, and
what the delivery needs (`OtpDelivery`, `InvitationDelivery` in the ports); it
does not know what a message looks like or where it goes. The licensing
context has no notifier port yet; when it needs one (for example, telling a
rights holder that a license was requested), it declares the port and `notifx`
adds the adapter and the message.

| Path               | What                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `src/email.rs`     | `Email { to, subject, text }` and the transport port `EmailSender { send(&Email) }`             |
| `src/console.rs`   | `ConsoleEmailSender`: prints the rendered message to the log (development only)                 |
| `src/memory.rs`    | `MemoryEmailSender`: records messages for tests                                                 |
| `src/templates.rs` | The two messages as plain-text functions, and `accept_link`                                     |
| `src/mailers.rs`   | `OtpMailer` and `InvitationMailer`: render for the delivery payload, send through the transport |
| `src/config.rs`    | `NotifxConfig` and `Provider` (`console` is the only value)                                     |

`app` builds the transport from `NOTIFY_PROVIDER`, wraps it in the two mailers
and hands them to `iam::Deps`. Tests of the HTTP flows use `iam::testing::Outbox`
instead, which implements both ports in memory.

## The console sender

Every message is written as one `warn` event with the target
`notifx::console`:

```
WARN HTTP request: notifx::console:
---- email (console delivery, development only) ----
From: Music Licensing <no-reply@music-licensing.local>
To: newbie@acme.test
Subject: ACME Admin invited you to ACME BROS PICTURES

Hi,

ACME Admin invited you to join ACME BROS PICTURES on Music Licensing.

Accept the invitation:

    http://localhost:5173/accept-invitation#token=K9f...

The invitation expires on 2026-11-08 09:30 UTC. If you did not expect it, ignore this message.
---- end of email ----
```

Codes and tokens are credentials. The sender exists so a developer can read
them without a mailbox; it is not a logging feature. With `LOG_FORMAT=json`
the block is one escaped string. If logs are shipped somewhere (the Datadog
profile), silence the target: `RUST_LOG=info,notifx::console=off`. Nothing
else in the backend logs a code or a token (`otp issued` records the contact
and the purpose only).

## Messages

| Message     | Subject                                               | Body                                                                          |
| ----------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| Login code  | `{code} is your {NOTIFY_FROM_NAME} sign-in code`      | The code on its own line, when it expires, "ignore if you did not request it" |
| Signup code | `{code} is your {NOTIFY_FROM_NAME} verification code` | Same, worded for finishing the account                                        |
| Invitation  | `{inviter} invited you to {tenant}`                   | Who invited whom to which tenant, the acceptance link, the expiry             |

The inviter is the member stored in `invited_by` (also on resend); the tenant
name comes from `tenants`. Both are resolved by `InvitationService` before the
port is called, so adapters never touch repositories.

## The acceptance link (frontend contract)

```
{APP_PUBLIC_URL}/accept-invitation#token=<token>
```

The token is in the URL fragment. Browsers never send the fragment to a
server, so it does not reach access logs or `Referer` headers; the page reads
it with `location.hash`. The acceptance page then:

1. `POST /api/v1/auth/passwordless/signup/invitation {invitation_token}`
   (public) → `{ email, tenant_id, tenant_name, invited_by_name, expires_at }`
   to show "X invited you to Y" and prefill the email. Any token that is not
   usable (unknown, expired, revoked, accepted, suspended tenant or member)
   answers `400 INVITATION_INVALID`, without saying which.
2. `POST …/signup/initiate {email, name, invitation_token}` → a signup code is
   delivered.
3. `POST …/signup/verify {…, tenant_id, code}` → the account is created.
4. Login as usual (`login/initiate`, `login/verify`).

The token goes in request bodies, never in a path or query string, for the
same reason it is in the fragment.

## Configuration

| Variable              | Default                          | Notes                                                                                                               |
| --------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `NOTIFY_PROVIDER`     | `console`                        | The only supported value. Any other value stops startup with "unsupported NOTIFY_PROVIDER 'x' (supported: console)" |
| `NOTIFY_FROM_ADDRESS` | `no-reply@music-licensing.local` | `From` mailbox of every message                                                                                     |
| `NOTIFY_FROM_NAME`    | `Music Licensing`                | Display name of the sender; also the product name inside messages                                                   |
| `APP_PUBLIC_URL`      | `http://localhost:5173`          | Frontend origin used to build links; must start with `http://` or `https://`                                        |

## Adding a real provider

1. Add a variant to `notifx::Provider` and a sender that implements
   `EmailSender`. SMTP: `lettre` 0.11 (`AsyncSmtpTransport<Tokio1Executor>`,
   `AsyncTransport::send`), configured by `SMTP_URL` and the `From` above. An
   HTTP provider (Resend, SendGrid, SES) is the same trait over its API.
2. Match the variant in `app::container` (the `match` is exhaustive, so the
   compiler points at it).
3. For local testing of the SMTP path, add Mailpit to `compose.yml` behind a
   profile (`axllent/mailpit`, SMTP on 1025, web UI on 8025) and point
   `SMTP_URL` at it.
4. Decide what production does with `console`: once a real provider exists,
   refuse `NOTIFY_PROVIDER=console` when `APP_ENV=production`.

Messages are plain text built by functions. HTML bodies or localisation would
change `templates.rs` only; a template engine is not needed for two messages.

## Design notes and sources

### A delivery crate, not a notifier per module

Manifesto solves this with `internal/notifx`: an `EmailSender` interface, an
`EmailMessage` type, a console provider and an SES provider, a template
registry, and `NOTIFX_PROVIDER` (default `console`) plus `NOTIFX_FROM_*` in
config; the IAM notification ports "need adapters; they are not automatically
wired" ([manifesto README](https://github.com/Abraxas-365/manifesto),
[docs/modules.md](https://github.com/Abraxas-365/manifesto/blob/main/docs/modules.md),
[internal/notifx](https://github.com/Abraxas-365/manifesto/tree/main/internal/notifx)).
This crate keeps the transport abstraction, the provider switch and the
sender in config, and drops the template registry and HTML (two plain-text
messages built by tested functions). It also hosts the adapters for the IAM
ports, so the only crate that knows about email is this one. The console
provider prints the whole message rather than a structured line with the
secret in a field: the point of the console path is to see what would have
been sent.

### Secrets in logs

OWASP's Logging Cheat Sheet lists session identifiers, access tokens,
passwords and other secrets among the data that should not be recorded
directly ([OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)).
A one-time code and an invitation token are exactly that. The console sender
is therefore explicit about being a development path, writes under its own
target so it can be turned off where logs are collected, and is the only
place a code or token is ever written.

### The token in the fragment

A token in a query string survives in browser history, in the access logs of
whatever serves the frontend, and in the `Referer` of any third-party
resource the landing page loads; the usual mitigations are a server-side
exchange plus redirect, or keeping the token out of the request entirely
([guptadeepak, magic link security](https://guptadeepak.com/mastering-magic-link-security-a-deep-dive-for-developers/),
[mojoauth, are magic links secure](https://mojoauth.com/blog/are-magic-links-secure-technical-deep-dive)).
For a single-page frontend the fragment is the cheapest of those: nothing
reaches a server until the page posts the token in a body. Single use and
expiry already hold: the token is stored hashed (SHA-256), consumed inside
the acceptance transaction, and expires at `INVITATION_TTL` (7 days by
default; it is an invitation, not a login link; the 10-minute OTP is what
proves the mailbox).

### The path to SMTP

`lettre` 0.11.23 (2026-08-03) offers `AsyncTransport` with SMTP, file and stub
implementations ([lettre::AsyncTransport](https://docs.rs/lettre/latest/lettre/trait.AsyncTransport.html),
[crates.io](https://crates.io/crates/lettre)); `EmailSender` is deliberately
smaller than it (one plain-text message, no attachments) so the SMTP sender
is a thin wrapper. Mailpit is the usual local catcher: `axllent/mailpit`,
SMTP on 1025, web UI on 8025, never exposed beyond the development machine
([Makerkit, Mailpit](https://makerkit.dev/docs/nextjs-prisma/emails/mailpit),
[TUM Artemis, Mailpit setup](https://docs.artemis.tum.de/developer/mailpit-setup)).
