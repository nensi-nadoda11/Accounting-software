# Accounting Software

Full-stack accounting and operations platform for billing, purchases, inventory, reports, payroll, GST, settings, and security administration.

## Tech Stack

- Frontend: React 19, TypeScript, Vite, React Hook Form, Zod, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL with Drizzle ORM and Drizzle migrations

## Project Structure

- `frontend/` - Vite + React application
- `backend/` - Express API, business modules, migrations, tests

## Backend Setup

1. Install dependencies:

```bash
cd backend
npm install
```

2. Create local env file from the example:

```bash
copy .env.example .env
```

3. Update the local `.env` with your database, JWT, SMTP, and other runtime values.

4. Start the backend:

```bash
npm run dev
```

## Frontend Setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Create local env file from the example:

```bash
copy .env.example .env.local
```

3. Set the backend origin in the frontend env file:

```env
VITE_API_BASE_URL=http://localhost:4000
```

4. Start the frontend:

```bash
npm run dev
```

## Environment Variables

Backend variables live in `backend/.env` and are documented in [backend/.env.example](/E:/Accounting_software/backend/.env.example).

Frontend variables must be non-sensitive and use `VITE_` prefixes only. Keep frontend env values limited to public configuration such as the API base URL.

## Database Migrations

Run these from `backend/`:

```bash
npm run db:generate
npm run db:migrate
```

The backend startup flow also runs migrations during server boot.

## Development Commands

Backend:

```bash
cd backend
npm run dev
npm test
npm run build
```

Frontend:

```bash
cd frontend
npm run dev
npm test
npm run lint
npm run build
```

## Build Commands

Backend:

```bash
cd backend
npm run build
```

Frontend:

```bash
cd frontend
npm run build
```

## Deployment Notes

- Set production secrets only through the deployment environment or secret manager.
- Configure `FRONTEND_URL`, database connectivity, JWT secrets, SMTP settings, and upload paths per environment.
- Production PostgreSQL should use hosted Postgres environment variables, not hardcoded connection strings in source.
- Ensure upload storage, outbound email access, and database networking are configured before go-live.

## SECURITY_NOTE

- Never commit `.env` files or real credentials to git.
- Never place secrets, tokens, private URLs, passwords, or API keys in frontend source code.
- Frontend configuration must stay non-sensitive and use `VITE_*` environment variables only.
- Rotate or revoke any credential immediately if it was ever exposed in source control, screenshots, logs, or frontend bundles.
- If a real key was committed in the past outside the current working tree, revoke it from the provider dashboard and replace it in local/production env storage.

## Troubleshooting

- If the backend cannot connect to PostgreSQL, verify `DATABASE_URL`, DNS, firewall, VPN, and provider allowlists.
- If authentication fails, confirm JWT secrets, cookie settings, and backend/frontend origins match the active environment.
- If uploads fail, verify the configured upload directories exist and the process can write to them.
- If the frontend cannot reach the API, verify `VITE_API_BASE_URL` and backend CORS configuration.
