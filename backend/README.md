# Advanced Accounting Software Backend

Production-oriented backend for Module 1, Module 2, and Module 4: authentication, roles, invites, permissions, sessions, profile management, audit logs, company setup, Drizzle migrations, and customer management APIs.

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
    company/
    companies/
    customers/
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

## Implemented Module 2 APIs

All company setup routes require authentication, company access, and `settings.manage` permission (admins already have it).

- `GET /api/v1/company/profile`
- `PATCH /api/v1/company/profile`
- `GET /api/v1/company/tax-settings`
- `PATCH /api/v1/company/tax-settings`
- `GET /api/v1/company/financial-years`
- `POST /api/v1/company/financial-years`
- `PATCH /api/v1/company/financial-years/:id`
- `POST /api/v1/company/financial-years/:id/activate`
- `POST /api/v1/company/financial-years/:id/lock`
- `GET /api/v1/company/bank-accounts`
- `POST /api/v1/company/bank-accounts`
- `PATCH /api/v1/company/bank-accounts/:id`
- `DELETE /api/v1/company/bank-accounts/:id`
- `POST /api/v1/company/bank-accounts/:id/default`
- `GET /api/v1/company/invoice-settings`
- `PATCH /api/v1/company/invoice-settings`
- `GET /api/v1/company/invoice-settings/preview-number`
- `GET /api/v1/company/branding`
- `POST /api/v1/company/branding/upload`
- `DELETE /api/v1/company/branding/:type`
- `GET /api/v1/company/branches`
- `POST /api/v1/company/branches`
- `PATCH /api/v1/company/branches/:id`
- `DELETE /api/v1/company/branches/:id`
- `GET /api/v1/company/preferences`
- `PATCH /api/v1/company/preferences`
- `GET /api/v1/company/setup-status`
- `POST /api/v1/company/complete-setup`

## Implemented Module 4 APIs

All customer routes require authentication, company access, and permission-based access control.

- `GET /api/v1/customers`
- `POST /api/v1/customers`
- `GET /api/v1/customers/:id`
- `PATCH /api/v1/customers/:id`
- `DELETE /api/v1/customers/:id`
- `PATCH /api/v1/customers/:id/status`
- `PATCH /api/v1/customers/:id/blacklist`
- `GET /api/v1/customers/:id/ledger`
- `GET /api/v1/customers/:id/payments`
- `GET /api/v1/customers/:id/outstanding`
- `GET /api/v1/customers/export`
- `GET /api/v1/customers/:id/ledger/export`

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
- Branding uploads use multipart form-data with `file` and `type` (`logo`, `invoiceLogo`, `signature`, `stamp`, `favicon`).
- Uploaded files are served from `PUBLIC_UPLOAD_BASE_URL`, backed by `UPLOAD_DIR`.
- Customer exports are available as CSV now; the service interface is structured so XLSX/PDF can be added later without changing routes.
- The backend applies Drizzle migrations automatically on startup, including the Module 2 company setup schema.
