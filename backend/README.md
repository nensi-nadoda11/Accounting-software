# Advanced Accounting Software Backend

Production-oriented backend for Module 1, Module 2, Module 4, Module 5, Module 6, Module 7, Module 8, Module 9, Module 10, Module 11, and Module 12: authentication, roles, invites, permissions, sessions, profile management, audit logs, company setup, Drizzle migrations, customer management APIs, supplier/vendor management APIs, product/service management APIs, inventory/stock management APIs, purchase management APIs, sales/invoice billing APIs, payments APIs, accounting-core APIs, and expense management APIs.

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
    accounting/
    expenses/
    payments/
    sales/
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

## Implemented Module 9 APIs

All sales routes require authentication, company access, and permission-based access control.

- `GET /api/v1/sales`
- `POST /api/v1/sales`
- `POST /api/v1/sales/pos`
- `GET /api/v1/sales/barcode-lookup`
- `GET /api/v1/sales/export`
- `GET /api/v1/sales/:id`
- `PATCH /api/v1/sales/:id`
- `DELETE /api/v1/sales/:id`
- `POST /api/v1/sales/:id/post`
- `POST /api/v1/sales/:id/cancel`
- `GET /api/v1/sales/:id/payments`
- `POST /api/v1/sales/:id/payments`
- `GET /api/v1/sales/:id/pdf`
- `POST /api/v1/sales/:id/send-email`
- `POST /api/v1/sales/:id/send-whatsapp`
- `GET /api/v1/sales/returns`
- `POST /api/v1/sales/returns`
- `GET /api/v1/sales/returns/export`
- `GET /api/v1/sales/returns/:id`

## Implemented Module 10 APIs

- `GET /api/v1/payments`
- `POST /api/v1/payments`
- `GET /api/v1/payments/export`
- `GET /api/v1/payments/:id`
- `PATCH /api/v1/payments/:id`
- `POST /api/v1/payments/:id/complete`
- `POST /api/v1/payments/:id/cancel`
- `GET /api/v1/payments/:id/allocations`
- `POST /api/v1/payments/:id/allocations`
- `PATCH /api/v1/payments/:id/allocations`
- `GET /api/v1/payments/:id/receipt`
- `GET /api/v1/payments/:id/receipt/pdf`
- `POST /api/v1/payments/:id/send-receipt`
- `GET /api/v1/payments/reminders`
- `POST /api/v1/payments/reminders/send`
- `PATCH /api/v1/payments/reminders/:id/status`
- `GET /api/v1/payments/customer-dues`
- `GET /api/v1/payments/supplier-dues`

## Implemented Module 11 APIs

- `GET /api/v1/accounting/accounts`
- `POST /api/v1/accounting/accounts`
- `PATCH /api/v1/accounting/accounts/:id`
- `DELETE /api/v1/accounting/accounts/:id`
- `POST /api/v1/accounting/accounts/defaults`
- `GET /api/v1/accounting/opening-balances`
- `POST /api/v1/accounting/opening-balances`
- `PATCH /api/v1/accounting/opening-balances/:id`
- `POST /api/v1/accounting/opening-balances/lock`
- `GET /api/v1/accounting/journals`
- `POST /api/v1/accounting/journals`
- `GET /api/v1/accounting/journals/:id`
- `PATCH /api/v1/accounting/journals/:id`
- `POST /api/v1/accounting/journals/:id/post`
- `POST /api/v1/accounting/journals/:id/cancel`
- `POST /api/v1/accounting/journals/:id/reverse`
- `GET /api/v1/accounting/ledger/:accountId`
- `GET /api/v1/accounting/ledger/:accountId/export`
- `GET /api/v1/accounting/ledger/customer/:customerId`
- `GET /api/v1/accounting/ledger/supplier/:supplierId`
- `GET /api/v1/accounting/cash-book`
- `GET /api/v1/accounting/bank-book`
- `GET /api/v1/accounting/trial-balance`
- `GET /api/v1/accounting/trial-balance/export`
- `GET /api/v1/accounting/profit-loss`
- `GET /api/v1/accounting/profit-loss/export`
- `GET /api/v1/accounting/balance-sheet`
- `GET /api/v1/accounting/balance-sheet/export`
- `GET /api/v1/accounting/events`
- `POST /api/v1/accounting/events/:id/post`
- `POST /api/v1/accounting/events/post-pending`
- `GET /api/v1/accounting/period-locks`
- `POST /api/v1/accounting/period-locks`
- `DELETE /api/v1/accounting/period-locks/:id`

## Implemented Module 12 APIs

- `GET /api/v1/expenses`
- `POST /api/v1/expenses`
- `GET /api/v1/expenses/export`
- `GET /api/v1/expenses/:id`
- `PATCH /api/v1/expenses/:id`
- `DELETE /api/v1/expenses/:id`
- `POST /api/v1/expenses/:id/post`
- `POST /api/v1/expenses/:id/cancel`
- `POST /api/v1/expenses/:id/attachments`
- `DELETE /api/v1/expenses/:id/attachments/:attachmentId`
- `GET /api/v1/expenses/categories`
- `POST /api/v1/expenses/categories`
- `PATCH /api/v1/expenses/categories/:id`
- `DELETE /api/v1/expenses/categories/:id`
- `GET /api/v1/expenses/recurring`
- `POST /api/v1/expenses/recurring`
- `PATCH /api/v1/expenses/recurring/:id`
- `POST /api/v1/expenses/recurring/:id/run`
- `POST /api/v1/expenses/recurring/run-due`
- `GET /api/v1/expenses/reports/category-wise`
- `GET /api/v1/expenses/reports/monthly`
- `GET /api/v1/expenses/reports/payment-mode`
- `GET /api/v1/expenses/reports/gst`

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
- Expense receipt uploads use `EXPENSE_UPLOAD_DIR`, `EXPENSE_MAX_UPLOAD_MB`, and `EXPENSE_MAX_ATTACHMENTS`.
- Purchase exports are available as CSV now. The `/pdf` routes currently return CSV fallback files until a PDF renderer is introduced.
- Sales exports are available as CSV now. The sales PDF endpoint currently returns structured invoice data until a PDF renderer is introduced.
- Payments and accounting exports are available as CSV now; the API contracts are structured so XLSX/PDF can be added later without changing the routes.
- Module 11 accounting reports are generated strictly from posted journal entry lines, with posted journals remaining immutable and corrections flowing through reversal entries.
- Module 12 expense posting creates and posts accounting events inside the same transaction so posted expenses immediately affect journals and P&L safely.
- Customer outstanding, ledger, and payment history now include sales invoices, sales returns, and sales payments.
- The backend applies Drizzle migrations automatically on startup, including the Module 2 company setup schema.
