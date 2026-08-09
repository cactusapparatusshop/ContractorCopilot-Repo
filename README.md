# ContractorCopilot

ContractorCopilot is an AI-first estimating SaaS for specialty contractors. It turns jobsite details into reviewable line items, branded proposals, customer approvals, and deposit collection.

## What is included

- Contractor dashboard, jobs, CRM, proposals, billing, account-specific settings, and platform-admin previews
- Job intake with client, trade, site notes, materials, material cost, labor hours/rate, measurements, jobsite-photo/audio selection, and AI estimate drafting
- PostgreSQL/Prisma tenant schema for companies, memberships, customers, jobs, assets, estimates, proposals, payments, subscriptions, and audit logs
- Email/password authentication with verified email, secure password recovery, signed HTTP-only sessions, and optional authenticator-app 2FA, plus a safe local demo mode
- OpenAI Responses API integration with structured estimate output and deterministic pricing
- Branded, server-generated PDF proposals
- Public customer portal protected by an opaque proposal token, with approval audit data and token-bound PDF download
- Three free proposal creations per company, then a 14-day Pro trial and $49.99/month paywall via Stripe Billing Checkout/Billing Portal
- Stripe webhook and scheduled proposal-expiry endpoint

## Preview locally

The app works immediately in demo mode—no database, Stripe key, or OpenAI key is needed to explore the workflow.

```bash
pnpm install
pnpm db:generate
pnpm dev
```

Open `http://localhost:3000` and use **Explore the live demo** on the sign-in screen. Useful preview routes:

- `/dashboard` — contractor overview
- `/jobs/new` — estimate intake and AI draft flow
- `/estimates` — proposal workspace (created proposals use their own private IDs)
- `/p/demo-proposal` — customer approval and deposit portal
- `/billing` — subscription/paywall preview
- `/admin` — platform operations preview

Run a local smoke test against a running app:

```bash
pnpm verify:local
```

It checks the important pages plus AI drafting, job creation, acceptance, Stripe fallbacks, PDF output, proposal expiry, and cross-origin protection.

## Configure production

Copy `.env.example` to `.env.local` (or configure the same values in your host). For Supabase, use the pooled runtime connection for `DATABASE_URL` and a direct connection or session-pooler connection that permits schema changes for `DIRECT_URL`.

Apply the committed migration before the first production deployment, and on every later release that includes a new migration:

```bash
pnpm db:generate
pnpm db:deploy
```

`pnpm db:deploy` runs only the committed migrations and is safe to repeat. It is the production command; do **not** use `prisma migrate dev` against Supabase or any other live database.

`pnpm db:seed` deliberately creates the Northstar demo company and the `marcus@northstarfencing.com` test user. Use it only for a local or disposable preview database, never for the live product database. Create the first live contractor account through the registration flow instead.

Required production settings:

| Area | Environment variables |
| --- | --- |
| App | `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` or `NEXTAUTH_SECRET`, `APP_URL`, `CRON_SECRET`, `DEMO_MODE=false` |
| Email & account security | `RESEND_API_KEY`, a verified `RESEND_FROM_EMAIL`, and `TOTP_ENCRYPTION_KEY` (a unique 32-byte base64url or hexadecimal secret) |
| AI | `OPENAI_API_KEY`, optionally `OPENAI_ESTIMATE_MODEL` |
| SaaS billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY` (a USD recurring $49.99/month Stripe Price) |
| Deposit collection | Contractor `stripeConnectAccountId` and `stripeConnectOnboardingComplete` must be set after Connect onboarding; optionally `STRIPE_CONNECT_APPLICATION_FEE_BPS` |

For production, deploy the Next.js app to Vercel, use managed Postgres (Neon/Supabase/RDS), point Stripe webhooks to `/api/stripe/webhook`, and set the Vercel cron secret. `vercel.json` invokes `/api/cron/expire-proposals` every morning.

## Payments and access control

There are two intentionally separate payment paths:

1. **ContractorCopilot subscription** — Every company starts with three proposal creations. A proposal consumes one credit only when its PDF is first generated; later downloads of that same proposal do not consume another credit. After the third creation, the PDF endpoint returns `402 FREE_DOCUMENT_LIMIT_REACHED` until the company has an active Pro subscription. First-time Pro Checkout starts a card-backed 14-day trial; the UI states the first charge date and $49.99/month renewal before it redirects to Stripe. Stripe webhooks sync the subscription state server-side.
2. **Customer deposits** — a customer approves a proposal, then Stripe Checkout transfers the deposit to that contractor’s onboarded Stripe Connect account. The app refuses a deposit for a draft/unaccepted proposal or a contractor without a completed Connect setup.

## Account security

New live accounts verify their email before they can sign in. The sign-in screen can resend a verification email, and the recovery flow emails a single-use password-reset link. Both email actions require a configured Resend API key and a verified sender domain or address.

Each user can turn on time-based one-time password (TOTP) two-factor authentication in **Settings → Account security**. The setup key uses the standard `otpauth://` format, so Google Authenticator, Microsoft Authenticator, Authy, 1Password, and similar apps are supported. Users receive one-time recovery codes at setup; the app stores only their hashes.

## Project structure

```text
app/
  (marketing)/            Home page
  (auth)/                 Sign in and registration
  (app)/                  Authenticated contractor workspace
  p/[token]/              Customer proposal portal
  api/                    AI, auth, jobs, billing, proposals, portal, Stripe, cron
components/               App shell, proposal, auth, and estimate UI
lib/                      Auth, tenancy/db, AI, pricing, PDF, Stripe, entitlements
prisma/
  schema.prisma           PostgreSQL data model
  seed.ts                 Local starter account and proposal
scripts/
  verify-local.mjs        End-to-end local smoke check
```

## Implementation notes

- Demo mode is deliberately isolated from live data and must be disabled in production.
- The AI returns a reviewable draft—pricing is calculated in deterministic server code and no AI call can send a proposal or choose a payment destination.
- Proposal PDFs are generated from structured data, not arbitrary HTML.
- `GET /api/billing/usage` returns the current plan, free document usage, and the canonical Pro price (`4999` cents) for authenticated product UI.
- Every real business record is tenant-owned through `companyId`; authenticated API routes validate membership server-side.
- Jobsite file selection is wired into intake metadata. For live binary upload/transcription, attach your chosen private storage provider (S3/R2/Supabase Storage) and transcription service before enabling file uploads for customers.
