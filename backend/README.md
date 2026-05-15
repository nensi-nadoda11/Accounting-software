# Advanced Accounting Software Backend

Production-oriented backend for Module 1: authentication, roles, invites, permissions, sessions, profile management, audit logs, and Drizzle migrations.

## Stack

- Node.js
- Express.js
- TypeScript
- PostgreSQL
- Drizzle ORM
- Zod
- JWT + refresh-token sessions
- Nodemailer SMTP

## Folder Structure

```text
src/
  config/
  db/
    migrations/
    schema/
  middlewares/
  modules/
    audit-logs/
    auth/
    companies/
    permissions/
    users/
  routes/
  services/
  types/
  utils/
  validators/
  app.ts
  server.ts
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file from `.env.example` and update it with your Supabase/PostgreSQL and SMTP credentials.

3. Generate migrations if you change schema later:

```bash
npm run db:generate
```

4. Apply migrations:

```bash
npm run db:migrate
```

5. Start development server:

```bash
npm run dev
```

6. Build production output:

```bash
npm run build
```

## API Base Path

All routes are mounted under:

```text
/api/v1
```

## Implemented Module 1 APIs

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/verify-otp`
- `POST /api/v1/auth/resend-otp`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/change-password`

### Users / Invites

- `POST /api/v1/users/accept-invite`
- `POST /api/v1/users/invite`
- `POST /api/v1/users/resend-invite`
- `POST /api/v1/users/revoke-invite`
- `GET /api/v1/users`
- `PATCH /api/v1/users/:id/status`
- `PATCH /api/v1/users/:id/role`
- `PATCH /api/v1/users/:id/permissions`

### Profile

- `GET /api/v1/profile`
- `PATCH /api/v1/profile`
- `POST /api/v1/profile/change-password`

## Security

- Helmet enabled
- Restricted CORS using `FRONTEND_URL`
- HttpOnly refresh cookie
- In-memory auth route throttling
- Strong password validation
- OTP/token hashes only stored in DB
- Role + permission based access control
- Company-isolated user operations
- Centralized error handling and safe API responses

## Notes

- Public registration only creates `admin` users.
- Invited roles are `accountant`, `staff`, and `auditor`.
- Admin permissions are derived from the full permission catalog.
- Refresh sessions are stored in the `sessions` table with hashed refresh tokens.
- Cleanup job removes expired OTPs and sessions and marks pending invites as expired.
