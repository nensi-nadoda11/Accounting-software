# Advanced Accounting Software Backend

Production-oriented backend for Module 1, Module 2, Module 4, Module 5, Module 6, Module 7, and Module 8: authentication, roles, invites, permissions, sessions, profile management, audit logs, company setup, Drizzle migrations, customer management APIs, supplier/vendor management APIs, product/service management APIs, inventory/stock management APIs, and purchase management APIs.

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
    inventory/
    purchases/
    products/
    permissions/
    suppliers/
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

## Implemented Module 5 APIs

All supplier routes require authentication, company access, and permission-based access control.

- `GET /api/v1/suppliers`
- `POST /api/v1/suppliers`
- `GET /api/v1/suppliers/:id`
- `PATCH /api/v1/suppliers/:id`
- `DELETE /api/v1/suppliers/:id`
- `PATCH /api/v1/suppliers/:id/status`
- `PATCH /api/v1/suppliers/:id/blacklist`
- `PATCH /api/v1/suppliers/:id/preferred`
- `GET /api/v1/suppliers/:id/ledger`
- `GET /api/v1/suppliers/:id/purchases`
- `GET /api/v1/suppliers/:id/payments`
- `GET /api/v1/suppliers/:id/outstanding`
- `GET /api/v1/suppliers/export`
- `GET /api/v1/suppliers/:id/ledger/export`

## Implemented Module 6 APIs

All product routes require authentication, company access, and permission-based access control.

- `GET /api/v1/products`
- `POST /api/v1/products`
- `GET /api/v1/products/lookup`
- `GET /api/v1/products/export`
- `GET /api/v1/products/:id`
- `PATCH /api/v1/products/:id`
- `DELETE /api/v1/products/:id`
- `GET /api/v1/products/:id/price-history`
- `GET /api/v1/products/:id/stock-summary`
- `POST /api/v1/products/:id/generate-barcode`
- `GET /api/v1/products/categories`
- `POST /api/v1/products/categories`
- `PATCH /api/v1/products/categories/:id`
- `DELETE /api/v1/products/categories/:id`
- `GET /api/v1/products/units`
- `POST /api/v1/products/units`
- `PATCH /api/v1/products/units/:id`
- `DELETE /api/v1/products/units/:id`

## Implemented Module 7 APIs

All inventory routes require authentication, company access, and permission-based access control.

- `GET /api/v1/inventory/warehouses`
- `POST /api/v1/inventory/warehouses`
- `PATCH /api/v1/inventory/warehouses/:id`
- `DELETE /api/v1/inventory/warehouses/:id`
- `POST /api/v1/inventory/warehouses/:id/default`
- `GET /api/v1/inventory/stock`
- `GET /api/v1/inventory/stock/:productId`
- `GET /api/v1/inventory/stock/summary`
- `GET /api/v1/inventory/stock/export`
- `GET /api/v1/inventory/batches`
- `POST /api/v1/inventory/batches`
- `PATCH /api/v1/inventory/batches/:id`
- `POST /api/v1/inventory/opening-stock`
- `POST /api/v1/inventory/adjustments`
- `GET /api/v1/inventory/adjustments`
- `GET /api/v1/inventory/movements`
- `GET /api/v1/inventory/movements/export`
- `GET /api/v1/inventory/alerts`
- `PATCH /api/v1/inventory/alerts/:id/read`
- `POST /api/v1/inventory/alerts/recalculate`
- `GET /api/v1/inventory/valuation`
- `GET /api/v1/inventory/valuation/export`

## Implemented Module 8 APIs

All purchase routes require authentication, company access, and permission-based access control.

- `GET /api/v1/purchases`
- `POST /api/v1/purchases`
- `GET /api/v1/purchases/export`
- `GET /api/v1/purchases/:id`
- `PATCH /api/v1/purchases/:id`
- `DELETE /api/v1/purchases/:id`
- `POST /api/v1/purchases/:id/post`
- `POST /api/v1/purchases/:id/cancel`
- `GET /api/v1/purchases/:id/payments`
- `POST /api/v1/purchases/:id/payments`
- `GET /api/v1/purchases/:id/pdf`
- `GET /api/v1/purchases/returns`
- `POST /api/v1/purchases/returns`
- `GET /api/v1/purchases/returns/export`
- `GET /api/v1/purchases/returns/:id`
- `GET /api/v1/purchases/returns/:id/pdf`

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
- Supplier exports are available as CSV now; the service interface is structured so XLSX/PDF can be added later without changing routes.
- Supplier purchase history, payment history, outstanding totals, and ledger views now read from the purchase invoices, purchase returns, and purchase payments tables.
- Product exports are available as CSV now; the interface is structured so XLSX/PDF can be added later without changing routes.
- Product stock summary returns safe opening-stock-based data until inventory transaction tables are added.
- Inventory exports and valuation exports are available as CSV now; the route contracts are structured so XLSX/PDF can be added later without changing the APIs.
- Inventory alert expiry windows use `INVENTORY_EXPIRY_ALERT_DAYS` and default to 30 days.
- Purchase exports are available as CSV now. The `/pdf` routes currently return CSV fallback files until a PDF renderer is introduced.
- The backend applies Drizzle migrations automatically on startup, including the Module 2 company setup schema.
