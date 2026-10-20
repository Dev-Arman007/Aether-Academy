# Production deployment

The app is designed to run as one Node.js web service: Express serves the built React app and the `/api` endpoints from the same origin. Use Node.js 20.19 or newer.

## Build and start

From the repository root, configure the host with:

```sh
npm ci --include=dev && npm ci --prefix server --omit=dev && npm run build
npm start
```

The host must install both lockfiles. The API package lives under `server/`; installing only the root package leaves the production API dependencies missing. Do not run the Vite development server in production.

Set the health-check path to `/api/health`. It returns HTTP 200 when MongoDB is connected and HTTP 503 while the app is waiting for the database. The web process can start while the database is unavailable and will retry the connection with increasing delays.

## Configure secrets and services

Set these values in the hosting provider's encrypted environment-variable settings. Do not commit `.env` files or paste secrets into deployment logs.

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | Yes | Atlas connection string for a dedicated application database user. Grant only the needed database access. |
| `JWT_SECRET` | Yes | Private random value with at least 32 characters. Generate a unique value for each environment. |
| `CLIENT_ORIGIN` | Yes | Comma-separated exact origins, including `https://`, with no paths or trailing slash. Example: `https://portal.example.edu`. |
| `PORT` | Usually supplied by host | The API uses the port provided by the platform, or 8787 locally. |
| `ANTHROPIC_API_KEY` | Optional | Enables Aether AI. Provider usage may incur charges. |
| `RESEND_API_KEY`, `MAIL_FROM` | Optional | Enables email notifications over HTTPS. Verify the sender domain with Resend and use an allowed sender address. Keep the API key private. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `MAIL_FROM` | Optional fallback | Enables SMTP email where outbound SMTP ports are allowed. Keep the SMTP password private. Render Free blocks outbound ports 25, 465, and 587; use Resend there. |

For a Render Free web service, add `RESEND_API_KEY` and `MAIL_FROM` under **Dashboard → your web service → Environment**, then save and redeploy. `MAIL_FROM` must be a sender address on a domain verified with Resend (for example, `Aether Academy <notifications@your-verified-domain.edu>`). Do not configure SMTP as the Render Free delivery path. On startup, the service logs which provider it selected; `/api/health` reports the non-secret email `configured` flag and provider name. After publishing a grade or fee, `queued` means the MongoDB outbox has the job, while `failed` means the Render service logs contain the provider error. Existing notifications marked `not configured` were never queued; create a new notification after email is configured to exercise delivery.

For MongoDB Atlas, allow the hosting service's outbound IP addresses in the Atlas network access list. Avoid `0.0.0.0/0` for a production database. Keep Atlas backups and test restoring them before storing real school records.

## Before inviting students

- Require HTTPS at the public site and confirm the correct production origin is in `CLIENT_ORIGIN`.
- Create the first administrator with the `npm run provision` command and secure shell environment variables. Do not use demo accounts or `npm run demo:seed` in production.
- Public student registration currently has no email verification or school invitation check. Add one or restrict account creation before opening sign-up to the public.
- Parent accounts and student linking, password recovery, email verification, payments, and file submissions are not implemented.
- Define retention rules for the preserved academic history when an account is deleted. Account deletion uses a MongoDB transaction, supported by Atlas replica-set deployments.
- Set up uptime/error monitoring, MongoDB storage/connection alerts, email delivery monitoring, and a tested backup/restore process. A health endpoint alone does not provide operational monitoring.

## Scaling notes

The app uses authenticated server-sent events for live refreshes. With multiple API instances, a change is broadcast only to clients connected to the instance that handled that change; the browser's 30-second refresh remains a fallback. Use a shared pub/sub service before scaling horizontally if near-instant cross-instance updates are required. The email outbox is stored in MongoDB so queued jobs survive process restarts.
