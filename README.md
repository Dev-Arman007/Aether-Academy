# Aether Academy

Aether Academy is now structured as a MERN application: React/Vite client, Express API, and MongoDB persistence. It includes account authentication, role checks, fee and grade records, an in-app notification inbox, queued email delivery, and an optional Anthropic assistant.

## Requirements and local setup

- Node.js 20.19 or newer
- A MongoDB server (local or hosted)
- SMTP credentials for outbound email and an Anthropic API key for AI chat (both optional integrations)

1. From the project root, run `npm ci`.
2. Install the API dependencies with `npm ci --prefix server`.
3. Copy `.env.example` to `server/.env`. Set `MONGODB_URI` and replace `JWT_SECRET` with a private random value of at least 32 characters.
4. Start the app from the project root with `npm run dev`. This starts the API on port 8787 and the React development server on port 4173.

For a production-style local run, build the client with `npm run build`, then run `npm start` from the project root and open `http://localhost:8787`. Express serves the built React client and API from one origin.

## Create staff accounts

Student accounts can self-register. Faculty, admin, and parent roles cannot be selected at registration. Create privileged accounts with the one-time provisioning command. In PowerShell, from the project root:

```powershell
$env:PROVISION_NAME = "Aether Administrator"
$env:PROVISION_EMAIL = "admin@your-school.edu"
$env:PROVISION_ROLE = "admin"
$env:PROVISION_PASSWORD = "use-a-private-password-at-least-12-characters"
npm run provision
Remove-Item Env:PROVISION_PASSWORD
```

Use `faculty` or `parent` for `PROVISION_ROLE` as needed. Provisioning refuses to overwrite an existing account.

Teacher accounts use the same email and password sign-in form as student accounts. The school administrator provisions teacher access with `PROVISION_ROLE=faculty`; public registration remains student-only so users cannot grant themselves staff permissions.

## Live update demo

For a local presentation, start the app and run `DEMO_SEED=true npm run demo:seed` (in PowerShell: `$env:DEMO_SEED='true'; npm run demo:seed; Remove-Item Env:DEMO_SEED`). This creates clearly labeled synthetic teacher/student accounts, enrolls the student in a demo class, and adds a sample assignment and today's attendance in the configured MongoDB database. It refuses to run in production and requires the explicit `DEMO_SEED=true` flag. One-time generated credentials are written to the git-ignored `.demo-credentials.txt` file. Open two browser windows, sign in to each account, then update attendance or publish an assignment as the teacher and watch it appear in the student's view.

## Academic records and notifications

Faculty and admins can publish a fee reminder or a grade from **Add records**. The API saves the record and an in-app notification in MongoDB. When SMTP is configured, it also writes an email job to a MongoDB outbox. The worker retries temporary failures with backoff up to five attempts. A notification shows `queued`, `sent`, `failed`, or `not configured`; `sent` means the SMTP server accepted the message, not proof it reached the recipient's inbox. An admin can mark a fee as settled after reconciling payment through the school's finance process; this app does not process payments.

Teachers and admins can create classes with enrolled student rosters, take dated attendance (present, absent, late, excused), and publish assignments with due dates. Students can view their enrolled classes, attendance history, and assignments, then save or update a text submission. Assignment publishing creates a notification for each enrolled student. Faculty access is limited to classes they own; admins can view all classes. Existing student accounts must be enrolled by selecting them in the class form.

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `MAIL_FROM` in `server/.env`. Authenticated server-sent events notify open dashboards when a record or notification changes; a periodic refresh is kept as a fallback. The notification bell lets each user mark their own notices as read.

Core endpoints:

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `PATCH /api/profile`, `GET/PUT/DELETE /api/profile/photo` (authenticated profile settings and photo)
- `GET /api/records`, `POST /api/records/fee`, `POST /api/records/grade`, `PATCH /api/records/:id/settle` (admin)
- `GET /api/students`, `DELETE /api/students/:id` (faculty/admin; permanently removes account, photo, notifications, and enrollment in a transaction while retaining academic history; requires MongoDB Atlas transactions)
- `GET/POST /api/classes`, `PATCH /api/classes/:id/students` (faculty/admin), `GET/POST /api/attendance`
- `GET/POST /api/assignments`, `POST /api/assignments/:id/submit` (student)
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`
- `POST /api/events/academic` for trusted faculty/admin integrations
- `POST /api/chat`, `GET /api/health`

Protected endpoints use `Authorization: Bearer <token>`. Student record reads are scoped to the signed-in student. The assistant loads academic context on the server from that same account, rather than trusting browser-supplied records.

## AI assistant

Set `ANTHROPIC_API_KEY` to enable broad general-purpose chat. The default model is `claude-sonnet-5`; `ANTHROPIC_MODEL` can override it. The assistant can help with general questions, writing, planning, coding, and study topics. For school-specific questions it can only use records currently stored for the authenticated account, and it is instructed to say when data is missing.

## Data and deployment notes

The dashboard no longer displays invented attendance, timetable, grade, or fee figures. New accounts start with empty academic records. Attendance and basic assignment workflows are available; timetable scheduling, file uploads and grading/rubrics, payment processing, parent-to-student account linking, password recovery, and email verification are not implemented. Before serving live student data, configure HTTPS, MongoDB backups, secrets, and a monitored email provider, and establish school-specific retention and operating procedures.

See [DEPLOYMENT.md](DEPLOYMENT.md) for production build commands, required environment variables, health checks, MongoDB Atlas network access, and operational limitations.
