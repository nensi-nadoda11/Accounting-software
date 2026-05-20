# Accounting Software Flow, Forms, and Testing Guide

## 1. App ka high-level flow

Ye app 8 bade layers me kaam karti hai:

1. `Auth`
   User register/login karta hai, OTP verify hota hai, password flows yahin se handle hote hain.
2. `Company Setup`
   Company profile, tax settings, financial year, bank account, invoice settings, branding, branches, preferences set hote hain.
3. `Masters`
   Customer, supplier, product, category, unit, warehouse, batch, employee, account masters bante hain.
4. `Inventory`
   Opening stock, purchase stock inward, sales stock outward, returns, adjustments yahan reflect hote hain.
5. `Transactions`
   Purchase invoices, sales invoices, expenses, payroll runs, payments create hote hain.
6. `Auto Calculations`
   GST, item tax split, invoice total, due amount, salary proration, allocations, aging bucket auto nikalte hain.
7. `Accounting + GST + Reports`
   Posted transactions accounting events, GST summary, trial balance, P&L, balance sheet, exports ko feed karte hain.
8. `Admin / System`
   Invites, permissions, notifications, backups, audit logs, final settings, UI preferences.

## 2. Real business flow

Recommended real usage flow:

1. `Register/Login`
2. `Settings > Company`
   Company profile, tax, financial year, bank, invoice settings fill karo.
3. `Inventory / Products / Masters`
   Products, units, categories, warehouses, customers, suppliers create karo.
4. `Opening Stock`
   Existing stock enter karo.
5. `Purchases`
   Supplier se maal aata hai, purchase invoice post hoti hai, stock increase hota hai, payable create hota hai.
6. `Sales`
   Customer ko invoice banti hai, stock decrease hota hai, receivable create hota hai.
7. `Payments`
   Customer receipts aur supplier payments allocate hote hain.
8. `Expenses`
   Non-stock kharche post hote hain aur accounting/GST me jaate hain.
9. `Payroll`
   Employee, salary structure, attendance, payroll run, salary payment.
10. `Accounting / GST / Reports`
    Final books aur compliance output check karte ho.

## 3. Important module-to-module logic

- `Purchase posted` -> stock increase + supplier due + GST input + accounting event.
- `Sales posted` -> stock decrease + customer due + GST output + accounting event.
- `Purchase return` -> stock decrease + supplier payable reduce.
- `Sales return` -> stock increase + customer receivable reduce.
- `Payment complete` -> due allocation update + advance/unallocated amount track + accounting event.
- `Expense posted` -> expense ledger + GST input if eligible + accounting event.
- `Payroll generated/paid` -> payroll items + payable + accounting event.

## 4. Core forms and har field ka kaam

Note:

- Main yahan core create/edit forms cover kar raha hoon.
- Search/filter forms mostly `search`, `dateFrom`, `dateTo`, `status`, `page`, `limit` type ke control forms hain; unka kaam sirf list filter karna hai, master/transaction save karna nahi.

### 4.1 Auth forms

#### `Register`

- `fullName` - string - admin user ka naam.
- `email` - email string - login aur notifications ke liye.
- `mobileNumber` - 10 digit string - contact/login alternate.
- `password` - strong password string - account security.
- `confirmPassword` - string - password confirm.
- `companyName` - string - initial company create karne ke liye.
- `gstNumber` - optional GST string - company tax identity.
- `city` - optional string - company location seed.
- `state` - optional string - GST/intra-state logic me useful.
- `termsAccepted` - boolean - consent check.

#### `Login`

- `identifier` - string - email ya mobile.
- `password` - string - login password.
- `rememberMe` - boolean - longer session.

#### `Verify OTP`

- `email` - email string - OTP destination.
- `otp` - 6 digit string - verification code.

#### `Forgot Password`

- `identifier` - string - email/mobile.

#### `Reset Password`

- `email` - email string.
- `otp` - 6 digit string.
- `newPassword` - strong password string.
- `confirmPassword` - string.

#### `Accept Invite`

- `password` - strong password string.
- `confirmPassword` - string.

### 4.2 Company setup forms

#### `Company Profile`

- `name` - string - app me dikhne wala company name.
- `legalName` - optional string - legal entity name.
- `businessType` - optional string - proprietorship/private ltd etc.
- `industryType` - optional string - domain/category.
- `gstNumber` - optional GST string - tax registration.
- `panNumber` - optional PAN string - tax identity.
- `cinNumber` - optional CIN string - company registration id.
- `email` - optional email string - official contact.
- `mobileNumber` - optional 10 digit string - official contact.
- `website` - optional URL string - public business URL.
- `addressLine1` / `addressLine2` - optional strings - postal address.
- `city` / `state` / `pincode` / `country` - string values - location and tax/state rules.
- `timezone` - string - date/time handling.
- `currency` - string - money display.
- `language` - string - UI language base.

#### `Tax Settings`

- `gstEnabled` - boolean - GST module active hai ya nahi.
- `gstType` - enum `regular | composition | unregistered` - company tax regime.
- `compositionScheme` - boolean - composition toggle.
- `taxInclusivePricing` - boolean - default prices inclusive/exclusive style.
- `defaultGstRate` - number string - default GST percent.
- `hsnSacEnabled` - boolean - HSN/SAC usage.
- `eInvoiceEnabled` - boolean - e-invoice support flag.
- `eWayBillEnabled` - boolean - logistics compliance flag.
- `gstFilingFrequency` - enum `monthly | quarterly | annually`.
- `tanNumber` - optional TAN string - TDS/TCS related use.

#### `Financial Year`

- `name` - string - FY label, jaise `FY 2026-27`.
- `startDate` - date string.
- `endDate` - date string.
- `isActive` - boolean - current active FY.

#### `Bank Account`

- `bankName` - string.
- `accountHolderName` - string.
- `accountNumber` - string.
- `ifscCode` - IFSC string.
- `branchName` - optional string.
- `upiId` - optional UPI string.
- `qrImageUrl` - string - payment QR reference.
- `openingBalance` - numeric string - bank opening amount.
- `accountType` - enum `current | savings | cash_credit | overdraft | other`.
- `isDefault` - boolean - default payment account.
- `isActive` - boolean - usable or not.

#### `Invoice Settings`

- `salesInvoicePrefix` - string - sales invoice numbering prefix.
- `purchaseInvoicePrefix` - string - purchase invoice numbering prefix.
- `creditNotePrefix` - string - sales return / credit note prefix.
- `debitNotePrefix` - string - purchase return / debit note prefix.
- `autoNumbering` - boolean - invoice number auto/manual.
- `nextSalesInvoiceNumber` - numeric string - next sequence.
- `nextPurchaseInvoiceNumber` - numeric string - next sequence.
- `numberPadding` - numeric string - zero padding length.
- `termsAndConditions` - optional text - default terms.
- `footerNote` - optional text - print footer.
- `showCompanyLogo` / `showBankDetails` / `showQrCode` / `showSignature` - boolean - print layout controls.
- `roundOffEnabled` - boolean - final grand total rounding.
- `decimalPrecision` - numeric string - decimal digits.
- `taxDisplayFormat` - enum `item_wise | summary | both`.
- `invoiceTemplate` - enum `gst_a4 | pos | thermal`.

#### `Branch`

- `branchName` - string.
- `branchCode` - code string.
- `gstNumber` - optional GST string.
- `email` - optional email.
- `mobileNumber` - optional 10 digit string.
- `addressLine1` / `addressLine2` / `city` / `state` / `pincode` - location strings.
- `managerName` - optional string.
- `isActive` - boolean.

#### `Preferences`

- `dateFormat` - enum.
- `currencyFormat` - enum.
- `numberFormat` - enum `indian | western`.
- `decimalPrecision` - numeric string.
- `timezone` - string.
- `language` - string.
- `autoLogoutMinutes` - numeric string.
- `notificationEmailEnabled` / `notificationSmsEnabled` / `notificationWhatsappEnabled` - boolean.

### 4.3 Customer form

- `name` - string - customer display name.
- `customerType` - enum `individual | business`.
- `businessName` - optional string - firm/company name.
- `contactPerson` - optional string - business contact.
- `mobile` - 10 digit string - primary contact.
- `alternateMobile` - optional 10 digit string.
- `email` - optional email.
- `gstNumber` - optional GST string - registered customer ke liye.
- `panNumber` - optional PAN string.
- `taxType` - enum `registered | unregistered | composition`.
- `billingAddressLine1` / `billingAddressLine2` / `billingCity` / `billingState` / `billingPincode` / `billingCountry` - billing address.
- `shippingAddressLine1` / `shippingAddressLine2` / `shippingCity` / `shippingState` / `shippingPincode` / `shippingCountry` - delivery address.
- `sameAsBilling` - boolean - shipping copy from billing.
- `openingBalanceAmount` - number - opening receivable/payable.
- `openingBalanceType` - enum `debit | credit | none`.
- `creditLimit` - number - maximum allowed due.
- `creditDays` - integer - due date logic.
- `defaultDiscount` - percent number - invoice default discount.
- `status` - enum `active | inactive`.
- `isBlacklisted` - boolean - block from transaction.
- `blacklistReason` - optional text.
- `notes` - optional text.

### 4.4 Supplier form

- `name` - string.
- `supplierType` - enum `individual | business | manufacturer | distributor | wholesaler`.
- `businessName` - optional string.
- `contactPerson` - optional string.
- `mobile` / `alternateMobile` - phone strings.
- `email` - optional email.
- `website` - optional URL.
- `gstNumber` / `panNumber` / `tanNumber` - tax ids.
- `taxType` - enum `registered | unregistered | composition`.
- `gstState` - optional string - interstate purchase logic me useful.
- `reverseChargeApplicable` - boolean.
- `msmeRegistered` - boolean.
- `billing*` and `shipping*` fields - address blocks.
- `sameAsBilling` - boolean.
- `openingBalanceAmount` / `openingBalanceType` - opening payable/advance.
- `creditLimit` - number.
- `creditDays` - integer.
- `paymentTerms` - optional text.
- `defaultGstRate` - percent number.
- `defaultDiscount` - percent number.
- `bankName` / `accountHolderName` / `accountNumber` / `ifscCode` / `bankBranch` / `upiId` - supplier payout details.
- `status` - enum `active | inactive | blocked`.
- `isBlacklisted` / `blacklistReason` - blacklist control.
- `isPreferred` - boolean - preferred vendor tag.
- `notes` - optional text.

### 4.5 Product, category, unit forms

#### `Product`

- `productType` - enum `goods | service` - stock track hoga ya nahi.
- `name` - string.
- `sku` - optional uppercase string - internal code.
- `barcode` - optional string - scanner lookup.
- `categoryId` - UUID string - grouping/reporting.
- `unitId` - UUID string - qty unit.
- `brand` - optional string.
- `description` - optional text.
- `hsnSacCode` - optional numeric string - GST compliance.
- `taxType` - enum `taxable | exempt | nil_rated | non_gst`.
- `gstRate` - number - GST percent.
- `cessRate` - number - cess percent.
- `priceTaxType` - enum `inclusive | exclusive`.
- `purchasePrice` - number - default buy rate.
- `salePrice` - number - default sell rate.
- `mrp` - number - maximum retail price.
- `wholesalePrice` - number.
- `minimumSalePrice` - number - price floor.
- `defaultDiscount` - percent number.
- `stockTrackingEnabled` - boolean.
- `openingStockQuantity` - number.
- `openingStockRate` - number.
- `minimumStockLevel` - number.
- `reorderLevel` - number.
- `maximumStockLevel` - number.
- `batchTrackingEnabled` - boolean.
- `expiryTrackingEnabled` - boolean.
- `serialTrackingEnabled` - boolean.
- `negativeStockAllowed` - boolean.
- `status` - enum `active | inactive`.

#### `Product Category`

- `name` - string.
- `parentId` - nullable UUID - nested category.
- `description` - optional text.
- `status` - enum `active | inactive`.

#### `Product Unit`

- `name` - string.
- `symbol` - uppercase string.
- `decimalAllowed` - boolean.
- `baseUnitId` - nullable UUID - derived unit.
- `conversionRate` - positive number - base conversion.
- `status` - enum `active | inactive`.

### 4.6 Inventory forms

#### `Warehouse`

- `warehouseCode` - code string.
- `name` - string.
- `addressLine1` / `addressLine2` / `city` / `state` / `pincode` - location.
- `contactPerson` - optional string.
- `mobile` - optional 10 digit string.
- `isDefault` - boolean.
- `status` - enum `active | inactive`.

#### `Batch`

- `productId` - UUID.
- `warehouseId` - UUID.
- `batchNumber` - string.
- `manufacturingDate` - date string.
- `expiryDate` - date string.
- `purchaseRate` - number.
- `status` - enum `active | expired | blocked`.

#### `Opening Stock`

- `productId` - UUID.
- `warehouseId` - UUID.
- `batchId` - optional UUID.
- `batchNumber` - string.
- `manufacturingDate` - date string.
- `expiryDate` - date string.
- `quantity` - number.
- `rate` - number.
- `movementDate` - date string.
- `remarks` - optional text.

#### `Stock Adjustment`

- `productId` - UUID.
- `warehouseId` - UUID.
- `batchId` - optional UUID.
- `batchNumber` - string.
- `manufacturingDate` - date string.
- `expiryDate` - date string.
- `adjustmentType` - enum `increase | decrease | damaged | lost | expired_writeoff | found | opening_correction | manual_correction`.
- `quantity` - number.
- `rate` - number.
- `reason` - required text.
- `adjustmentDate` - date string.
- `remarks` - optional text.

### 4.7 Purchase forms

#### `Purchase Invoice Header`

- `supplierId` - UUID.
- `supplierInvoiceNumber` - optional string - vendor bill no.
- `invoiceDate` - date string.
- `dueDate` - optional date string.
- `warehouseId` - optional UUID - default warehouse.
- `purchaseStatus` - enum `draft | posted`.
- `invoiceDiscountTotal` - number.
- `additionalCharges` - number.
- `freightCharges` - number.
- `paidAmount` - number.
- `paymentMode` - nullable enum `cash | bank | upi | card | cheque`.
- `paymentReference` - optional string.
- `bankAccountId` - nullable UUID.
- `notes` - optional text.
- `termsConditions` - optional text.
- `attachmentUrl` - optional string.

#### `Purchase Invoice Item row`

- `productId` - UUID.
- `warehouseId` - optional UUID.
- `batchId` - optional UUID.
- `batchNumber` - optional string.
- `quantity` - number.
- `freeQuantity` - number.
- `purchaseRate` - number.
- `priceTaxType` - enum `inclusive | exclusive`.
- `discountPercent` - number.
- `discountAmount` - number.
- `gstRate` - number.
- `cessRate` - number.
- `manufacturingDate` - optional date.
- `expiryDate` - optional date.
- `remarks` - optional text.

Important:

- `freeQuantity` bill value me count nahi hoti, but stock me add hoti hai.
- Goods ke liye warehouse mandatory hai.
- Batch-tracked goods ke liye batch required hai.

#### `Purchase Payment`

- `paymentDate` - date string.
- `amount` - number.
- `paymentMode` - enum.
- `bankAccountId` - nullable UUID.
- `referenceNumber` - optional string.
- `notes` - optional text.

#### `Purchase Return`

- `purchaseInvoiceId` - UUID.
- `returnDate` - date string.
- `warehouseId` - optional UUID.
- `notes` - required reason text.
- `items[].purchaseInvoiceItemId` - UUID.
- `items[].quantity` - return quantity.
- `items[].remarks` - optional text.

### 4.8 Sales forms

#### `Sales Invoice Header`

- `invoiceType` - enum `gst_invoice | pos`.
- `invoiceStatus` - enum `draft | posted`.
- `invoiceDate` - date string.
- `dueDate` - optional date string.
- `customerId` - nullable UUID.
- `isWalkIn` - boolean.
- `walkInName` - optional string.
- `walkInMobile` - optional 10 digit string.
- `placeOfSupply` - optional string - GST state logic.
- `warehouseId` - UUID.
- `priceTaxType` - enum `inclusive | exclusive`.
- `invoiceDiscountTotal` - number.
- `deliveryCharges` - number.
- `packingCharges` - number.
- `otherCharges` - number.
- `paidAmount` - number.
- `paymentMode` - nullable enum.
- `paymentReference` - optional string.
- `bankAccountId` - nullable UUID.
- `notes` - optional text.
- `termsConditions` - optional text.

#### `Sales Invoice Item row`

- `productId` - UUID.
- `warehouseId` - nullable UUID.
- `batchId` - nullable UUID.
- `quantity` - number.
- `saleRate` - number.
- `mrp` - number.
- `priceTaxType` - enum.
- `discountPercent` - number.
- `discountAmount` - number.
- `gstRate` - number.
- `cessRate` - number.
- `remarks` - optional text.

Important:

- `minimumSalePrice` se niche rate nahi ja sakta.
- `batchStatus = expired` hua to sale block ho jati hai.
- Walk-in sale me `customerId` optional hai but `walkInName` required hai.

#### `Sales Payment`

- `paymentDate` - date string.
- `amount` - number.
- `paymentMode` - enum.
- `bankAccountId` - nullable UUID.
- `referenceNumber` - optional string.
- `notes` - optional text.

#### `Sales Return`

- `salesInvoiceId` - UUID.
- `returnDate` - date string.
- `warehouseId` - nullable UUID.
- `reason` - required string.
- `notes` - optional text.
- `items[].salesInvoiceItemId` - UUID.
- `items[].quantity` - return qty.
- `items[].remarks` - optional text.

#### `Send Invoice`

- `recipient` - email ya mobile string.
- `message` - optional text.

### 4.9 Payments module forms

#### `Payment Entry`

- `paymentType` - enum `customer_receive | supplier_pay`.
- `partyType` - enum `customer | supplier`.
- `partyId` - string.
- `paymentDate` - date string.
- `amount` - number.
- `paymentMode` - enum `cash | bank | upi | card | cheque | neft | rtgs | imps | other`.
- `bankAccountId` - nullable UUID.
- `referenceNumber` - optional string.
- `notes` - optional text.
- `status` - enum `draft | completed`.
- `isAdvance` - boolean - direct advance track karne ke liye.
- `chequeNumber` / `chequeDate` / `chequeBankName` / `chequeStatus` - cheque workflow.
- `allocations[]` - due invoices ya advance adjustments.

#### `Payment Allocation row`

- `allocationType` - enum `sales_invoice | purchase_invoice | advance_adjustment`.
- `referenceId` - nullable string.
- `referenceNumber` - nullable string.
- `allocatedAmount` - number.
- `allocationDate` - nullable date string.

#### `Cancel Payment`

- `reason` - required text.

#### `Send Receipt`

- `email` - nullable email.
- `subject` - optional string.
- `message` - optional text.

#### `Cheque Status Update`

- `chequeStatus` - enum `received | issued | deposited | cleared | bounced | cancelled`.
- `statusDate` - optional date.
- `remarks` - optional text.
- `reason` - optional text.

#### `Reminder`

- `partyType` - customer/supplier.
- `partyId` - string.
- `referenceType` - `sales_invoice | purchase_invoice | advance | manual`.
- `referenceId` - nullable string.
- `referenceNumber` - nullable string.
- `dueDate` - date string.
- `amountDue` - number.
- `channel` - `in_app | email | whatsapp`.
- `message` - optional text.

#### `Reminder Status`

- `status` - enum `pending | sent | failed | cancelled`.
- `errorMessage` - optional text.

### 4.10 Expense forms

#### `Expense`

- `expenseDate` - date string.
- `categoryId` - UUID.
- `expenseAccountId` - nullable UUID - specific expense ledger.
- `payeeName` - optional string.
- `vendorGstNumber` - optional GST string.
- `vendorPanNumber` - optional PAN string.
- `hsnSacCode` - optional numeric string.
- `description` - required text.
- `amount` - number.
- `gstApplicable` - boolean.
- `gstRate` - number.
- `priceTaxType` - enum `inclusive | exclusive`.
- `paymentMode` - enum.
- `bankAccountId` - nullable UUID.
- `referenceNumber` - optional string.
- `chequeNumber` / `chequeDate` / `chequeStatus` - cheque info.
- `notes` - optional text.
- `status` - enum `draft | posted`.

#### `Expense Cancel`

- `cancellationReason` - required text.

#### `Expense Category`

- `name` - string.
- `parentId` - nullable UUID.
- `defaultAccountId` - nullable UUID.
- `color` - nullable hex string.
- `icon` - nullable string.
- `description` - nullable text.
- `status` - enum `active | inactive`.

#### `Recurring Expense`

- `templateName` - string.
- `categoryId` - UUID.
- `expenseAccountId` - nullable UUID.
- `payeeName` - nullable string.
- `description` - string.
- `amount` - number.
- `gstApplicable` - boolean.
- `gstRate` - number.
- `priceTaxType` - enum.
- `paymentMode` - enum.
- `bankAccountId` - nullable UUID.
- `frequency` - enum `daily | weekly | monthly | quarterly | yearly`.
- `startDate` - date string.
- `endDate` - nullable date.
- `nextRunDate` - date string.
- `autoCreateEnabled` - boolean.
- `createAsStatus` - enum `draft | posted`.
- `reminderDaysBefore` - integer.
- `status` - enum `active | paused | completed | cancelled`.

### 4.11 Accounting forms

#### `Account`

- `accountCode` - code string.
- `accountName` - string.
- `accountType` - enum from chart of accounts.
- `accountSubtype` - nullable string.
- `parentId` - nullable account id.
- `openingBalance` - number.
- `openingBalanceType` - `debit | credit | none`.
- `status` - `active | inactive`.
- `description` - nullable text.

#### `Opening Balance`

- `accountId` - string.
- `financialYearId` - nullable string.
- `openingDate` - date string.
- `debit` - number.
- `credit` - number.
- `description` - optional text.

#### `Journal`

- `financialYearId` - nullable string.
- `journalNumber` - nullable string.
- `entryDate` - date string.
- `voucherType` - enum.
- `referenceType` - nullable string.
- `referenceId` - nullable string.
- `referenceNumber` - nullable string.
- `description` - string.
- `lines[].accountId` - string.
- `lines[].description` - nullable string.
- `lines[].debit` - number.
- `lines[].credit` - number.

#### `Journal cancel/reverse reason`

- `reason` - required text.
- `reversalDate` - nullable date.

#### `Period Lock`

- `financialYearId` - nullable string.
- `periodStart` - date string.
- `periodEnd` - date string.
- `lockType` - enum.
- `reason` - optional text.

### 4.12 GST forms

#### `GST Adjustment`

- `adjustmentDate` - date string.
- `adjustmentType` - enum `itc_reversal | itc_claim | output_tax_adjustment | late_fee | interest | rounding | other`.
- `taxComponent` - enum `cgst | sgst | igst | cess`.
- `amount` - number.
- `reason` - text.
- `referenceNumber` - optional string.
- `notes` - optional text.

#### `GST Adjustment Cancel`

- `cancellationReason` - text.

#### `ITC Status`

- `eligibilityStatus` - enum `eligible | blocked | reversed | pending`.
- `claimStatus` - enum `unclaimed | claimed | partially_claimed`.
- `claimedAmount` - number.
- `notes` - optional text.

### 4.13 Payroll forms

#### `Employee`

- `fullName` - string.
- `mobile` - 10 digit string.
- `email` - optional email.
- `department` - optional string.
- `designation` - optional string.
- `joiningDate` - date string.
- `employmentType` - enum.
- `salaryType` - enum `monthly | daily | hourly`.
- `panNumber` - optional PAN string.
- `aadhaarLast4` - optional 4 digit string.
- `addressLine1` / `addressLine2` / `city` / `state` / `pincode` - address.
- `emergencyContactName` / `emergencyContactMobile` - emergency details.
- `bankName` / `accountHolderName` / `accountNumber` / `ifscCode` / `upiId` - payout details.
- `status` - enum.

#### `Salary Structure`

- `basicSalary` - number.
- `hra` - number.
- `conveyanceAllowance` - number.
- `medicalAllowance` - number.
- `otherAllowance` - number.
- `pfDeduction` - number.
- `esicDeduction` - number.
- `professionalTax` - number.
- `tdsDeduction` - number.
- `otherDeduction` - number.
- `effectiveFrom` - date.
- `effectiveTo` - optional date.
- `isActive` - boolean.

#### `Attendance`

- `employeeId` - string.
- `payrollMonth` - `YYYY-MM`.
- `workingDays` - number.
- `presentDays` - number.
- `absentDays` - number.
- `paidLeaveDays` - number.
- `unpaidLeaveDays` - number.
- `halfDays` - number.
- `overtimeHours` - number.
- `remarks` - optional text.

#### `Bulk Attendance`

- `payrollMonth` - month string.
- `department` - filter value.
- Row fields: `workingDays`, `presentDays`, `paidLeaveDays`, `unpaidLeaveDays`, `halfDays`, `overtimeHours`.

#### `Payroll Run`

- `payrollMonth` - month string.
- `periodStart` - optional date.
- `periodEnd` - optional date.
- `notes` - optional text.

#### `Bonus / Deduction`

- `entries[].type` - enum bonus/deduction type.
- `entries[].name` - string.
- `entries[].amount` - number.
- `entries[].taxable` - boolean.
- `entries[].notes` - optional text.

#### `Salary Payment`

- `amount` - number.
- `paymentDate` - date string.
- `paymentMode` - enum.
- `bankAccountId` - optional string.
- `referenceNumber` - optional string.
- `notes` - optional text.

#### `Bulk Salary Payment`

- `paymentDate` - date.
- `paymentMode` - enum.
- `bankAccountId` - optional string.
- `referenceNumber` - optional string.
- `notes` - optional text.
- `payrollItemIds` - string array.

#### `Salary Slip Email`

- `email` - optional email.
- `subject` - optional string.
- `message` - optional text.

### 4.14 Settings and admin forms

#### `Invite User`

- `fullName` - string.
- `email` - email.
- `mobileNumber` - optional mobile.
- `role` - enum `accountant | staff | auditor`.
- `permissions` - permission array.

#### `Profile`

- `fullName` - string.
- `mobileNumber` - optional mobile.

#### `Security Change Password`

- `currentPassword` - string.
- `newPassword` - strong password.
- `confirmPassword` - string.

#### `Invoice Template`

- `templateKey` - optional key string.
- `templateName` - string.
- `invoiceType` - enum `sales | purchase | pos | return`.
- `layoutConfig.showLogo/showSignature/showBankDetails/showQrCode` - booleans.
- `layoutConfig.termsFooter` / `footerNote` - text.
- `isDefault` - boolean.
- `isActive` - boolean.

#### `Payment Mode`

- `modeKey` - enum.
- `modeName` - string.
- `isEnabled` - boolean.
- `isDefault` - boolean.
- `requiresReference` - boolean.
- `requiresBankAccount` - boolean.
- `chequeWorkflowEnabled` - boolean.

#### `Final Tax Settings`

- `gstEnabled` - boolean.
- `defaultGstRate` - enum rate.
- `taxInclusiveDefault` - boolean.
- `roundOffEnabled` - boolean.
- `hsnSacRequired` - boolean.
- `gstFilingFrequency` - enum.
- `compositionScheme` - boolean.

#### `Theme / UI Preferences`

- `accentColor` - hex string.
- `compactMode` - boolean.
- `tableDensity` - enum.
- `dateFormat` - enum.
- `currencyFormat` - enum.
- `numberFormat` - enum.

#### `Final Profile Settings`

- `fullName` - string.
- `mobileNumber` - optional string.
- `currentPassword` / `newPassword` / `confirmPassword` - password change block.

## 5. Calculation rules jo testing me yaad rakhni hain

- Sales/purchase item `subtotal = quantity x rate`.
- Item level discount pehle apply hota hai.
- Invoice level discount baad me `taxable amount` ke proportion me split hota hai.
- `exclusive` price type me GST amount subtotal ke upar add hota hai.
- `inclusive` price type me taxable amount reverse-calculate hota hai.
- Intra-state -> GST split `CGST + SGST`.
- Inter-state -> GST pura `IGST`.
- `roundOffEnabled` true ho to final total nearest rupee round hota hai.
- Purchase `freeQuantity` stock badhata hai but bill subtotal nahi badhata.
- Sales return me round-off apply hota hai.
- Purchase return me current code `roundOffAmount = 0.00` rakhta hai.
- Payment allocation due amount ko reduce karti hai.
- Payroll monthly salary payable days ke proportion me prorate hoti hai.

## 6. Ready-made testing records with expected result

Assumed setup:

- Current company GST: `27ABCDE1234F1Z5`
- Company state: `Maharashtra`
- Financial year: `2026-04-01` to `2027-03-31`
- Round off: `Enabled`
- Default warehouse: `MAIN`
- Default bank: `HDFC Bank / 123456789012`

### 6.1 Master records

#### Warehouse

- `warehouseCode`: `MAIN`
- `name`: `Main Warehouse`
- `city`: `Pune`
- `state`: `Maharashtra`
- `isDefault`: `true`
- `status`: `active`

#### Bank

- `bankName`: `HDFC Bank`
- `accountHolderName`: `ABC Traders Pvt Ltd`
- `accountNumber`: `123456789012`
- `ifscCode`: `HDFC0001234`
- `openingBalance`: `50000`
- `accountType`: `current`
- `isDefault`: `true`
- `isActive`: `true`

#### Customer 1

- `name`: `Retail Mart Pune`
- `customerType`: `business`
- `mobile`: `9876543210`
- `email`: `billing@retailmart.in`
- `gstNumber`: `27ABCDE1234F1Z8`
- `taxType`: `registered`
- `billingState`: `Maharashtra`
- `shippingState`: `Maharashtra`
- `creditDays`: `15`
- `defaultDiscount`: `0`
- `status`: `active`

#### Customer 2

- `name`: `Bengaluru Home Shop`
- `customerType`: `business`
- `mobile`: `9123456789`
- `email`: `accounts@bhs.in`
- `gstNumber`: `29ABCDE1234F1Z2`
- `taxType`: `registered`
- `billingState`: `Karnataka`
- `shippingState`: `Karnataka`
- `creditDays`: `3`
- `status`: `active`

#### Supplier 1

- `name`: `Local Electricals Supply`
- `supplierType`: `distributor`
- `mobile`: `9988776655`
- `email`: `sales@localelectricals.in`
- `gstNumber`: `27ABCDE1234F1Z1`
- `taxType`: `registered`
- `gstState`: `Maharashtra`
- `paymentTerms`: `15 days credit`
- `status`: `active`

#### Product 1

- `name`: `LED Bulb 9W`
- `productType`: `goods`
- `sku`: `BULB-9W`
- `category`: `Lighting`
- `unit`: `PCS`
- `hsnSacCode`: `9405`
- `taxType`: `taxable`
- `gstRate`: `18`
- `cessRate`: `0`
- `priceTaxType`: `exclusive`
- `purchasePrice`: `80`
- `salePrice`: `120`
- `mrp`: `140`
- `minimumSalePrice`: `100`
- `stockTrackingEnabled`: `true`
- `batchTrackingEnabled`: `true`
- `expiryTrackingEnabled`: `false`
- `status`: `active`

#### Product 2

- `name`: `Copper Cable 1m`
- `productType`: `goods`
- `sku`: `CABLE-1M`
- `category`: `Electrical`
- `unit`: `PCS`
- `hsnSacCode`: `8544`
- `taxType`: `taxable`
- `gstRate`: `12`
- `cessRate`: `0`
- `priceTaxType`: `inclusive`
- `purchasePrice`: `56`
- `salePrice`: `56`
- `mrp`: `60`
- `minimumSalePrice`: `50`
- `stockTrackingEnabled`: `true`
- `batchTrackingEnabled`: `false`
- `status`: `active`

### 6.2 Opening stock test

Record:

- Product `LED Bulb 9W`
- Warehouse `MAIN`
- Batch `BULBAPR01`
- Quantity `100`
- Rate `70`
- Date `2026-04-01`

Expected:

- Opening stock quantity = `100`
- Opening stock value = `7000.00`

### 6.3 Purchase invoice test

Header:

- Supplier: `Local Electricals Supply`
- Invoice date: `2026-04-05`
- Due date: `2026-04-20`
- Warehouse: `MAIN`
- Invoice discount total: `50`
- Additional charges: `100`
- Freight charges: `50`
- Paid amount: `2000`
- Payment mode: `bank`

Item 1:

- Product: `LED Bulb 9W`
- Quantity: `50`
- Free quantity: `5`
- Purchase rate: `80`
- Price tax type: `exclusive`
- Discount %: `10`
- Discount amount: `20`
- GST: `18`

Item 2:

- Product: `Copper Cable 1m`
- Quantity: `20`
- Free quantity: `0`
- Purchase rate: `56`
- Price tax type: `inclusive`
- Discount %: `0`
- Discount amount: `0`
- GST: `12`

Expected purchase totals:

- `subtotal`: `5120.00`
- `itemDiscountTotal`: `420.00`
- `invoiceDiscountTotal`: `50.00`
- `taxableAmount`: `4530.00`
- `cgstTotal`: `318.69`
- `sgstTotal`: `318.68`
- `igstTotal`: `118.69`
- `gstTotal`: `756.06`
- `additionalCharges`: `100.00`
- `freightCharges`: `50.00`
- `roundOffAmount`: `-0.06`
- `grandTotal`: `5436.00`
- `paidAmount`: `2000.00`
- `dueAmount`: `3436.00`
- `paymentStatus`: `partial`

Expected stock impact:

- Bulb stock increase = `50 + 5 = 55`
- Cable stock increase = `20`

Running stock after this purchase:

- Bulb = `155`
- Cable = `20`

### 6.4 Sales invoice test 1, intra-state

Header:

- Customer: `Retail Mart Pune`
- Invoice date: `2026-04-10`
- Due date: `2026-04-25`
- Warehouse: `MAIN`
- Invoice discount total: `40`
- Delivery charges: `30`
- Packing charges: `20`
- Other charges: `10`
- Paid amount: `1500`
- Payment mode: `cash`

Item 1:

- Product: `LED Bulb 9W`
- Quantity: `30`
- Sale rate: `120`
- Price tax type: `exclusive`
- Discount %: `5`
- Discount amount: `10`
- GST: `18`

Item 2:

- Product: `Copper Cable 1m`
- Quantity: `10`
- Sale rate: `56`
- Price tax type: `inclusive`
- Discount %: `0`
- Discount amount: `0`
- GST: `12`

Expected sales totals:

- `subtotal`: `4160.00`
- `itemDiscountTotal`: `190.00`
- `invoiceDiscountTotal`: `40.00`
- `taxableAmount`: `3870.00`
- `cgstTotal`: `333.46`
- `sgstTotal`: `333.45`
- `igstTotal`: `0.00`
- `gstTotal`: `666.91`
- `deliveryCharges`: `30.00`
- `packingCharges`: `20.00`
- `otherCharges`: `10.00`
- `roundOffAmount`: `0.09`
- `grandTotal`: `4597.00`
- `paidAmount`: `1500.00`
- `dueAmount`: `3097.00`
- `paymentStatus`: `partial`

Expected stock impact:

- Bulb stock decrease = `30`
- Cable stock decrease = `10`

Running stock:

- Bulb = `125`
- Cable = `10`

### 6.5 Sales invoice test 2, inter-state

Header:

- Customer: `Bengaluru Home Shop`
- Invoice date: `2026-04-15`
- Due date: `2026-04-18`
- Warehouse: `MAIN`
- Paid amount: `0`

Item:

- Product: `LED Bulb 9W`
- Quantity: `5`
- Sale rate: `120`
- Price tax type: `exclusive`
- Discount %: `0`
- Discount amount: `0`
- GST: `18`

Expected totals:

- `subtotal`: `600.00`
- `taxableAmount`: `600.00`
- `cgstTotal`: `0.00`
- `sgstTotal`: `0.00`
- `igstTotal`: `108.00`
- `gstTotal`: `108.00`
- `grandTotal`: `708.00`
- `dueAmount`: `708.00`
- `paymentStatus` as of `2026-05-20`: `overdue`

Expected stock impact:

- Bulb stock decrease = `5`

Running stock:

- Bulb = `120`

### 6.6 Customer receipt and allocation test

Create payment:

- `paymentType`: `customer_receive`
- `partyType`: `customer`
- `party`: `Retail Mart Pune`
- `paymentDate`: `2026-04-25`
- `amount`: `3500`
- `paymentMode`: `bank`
- `referenceNumber`: `UTR-250425-001`

Allocations:

- Invoice 1 allocate `2542`
- Invoice 2 allocate `708`

Expected:

- Total allocated = `3250.00`
- Unallocated amount = `250.00`
- Payment status = `partially_allocated`
- Invoice 1 due after allocation = `555.00`
- Invoice 2 due after allocation = `0.00`
- Remaining `250.00` advance/unallocated rahega

Aging as of `2026-05-20`:

- Invoice 1 due date `2026-04-25` -> bucket `1-30`
- Invoice 2 fully allocated -> no pending bucket amount
- Aging bucket summary:
  - `current`: `0.00`
  - `1-30`: `555.00`
  - `31-60`: `0.00`
  - `61-90`: `0.00`
  - `91-180`: `0.00`
  - `181+`: `0.00`

### 6.7 Sales return test

Return against Sales Invoice 1:

- Return date: `2026-04-20`
- Product line: `LED Bulb 9W`
- Return quantity: `2`
- Reason: `2 bulbs damaged on delivery`

Expected based on current prorate logic:

- `taxableAmount`: `225.01`
- `gstAmount`: `40.50`
- `lineTotal before round`: `265.51`
- `roundOffAmount`: `0.49`
- `grandTotal`: `266.00`

Expected stock impact:

- Bulb stock increase `+2`

Running stock:

- Bulb = `122`

### 6.8 Purchase return test

Return against Purchase Invoice line 1:

- Return date: `2026-04-22`
- Product line: `LED Bulb 9W`
- Return quantity: `5`
- Notes: `Wrong pieces received`

Expected based on current logic:

- Purchase return quantity is checked against `quantity + freeQuantity`
- Source total qty for pricing = `55`
- `taxableAmount`: `321.90`
- `gstAmount`: `57.94`
- `grandTotal`: `379.84`
- `roundOffAmount`: `0.00`

Expected stock impact:

- Bulb stock decrease `-5`

Running stock:

- Bulb = `117`

### 6.9 Expense test, recommended safe case

Use `exclusive` GST for clean verification:

- Expense date: `2026-04-12`
- Category: `Office Expense`
- Description: `Office printer repair`
- Amount: `1000`
- GST applicable: `true`
- GST rate: `18`
- Price tax type: `exclusive`
- Payment mode: `bank`

Expected:

- `taxableAmount`: `1000.00`
- `cgstAmount`: `90.00`
- `sgstAmount`: `90.00`
- `igstAmount`: `0.00`
- `gstAmount`: `180.00`
- `totalAmount`: `1180.00`

### 6.10 Expense inclusive GST warning

Important finding:

- Current code me `expense inclusive GST` formula wrong behave kar rahi hai.
- Example:
  - Amount `1180`
  - GST `18%`
  - Price tax type `inclusive`

Business-correct expected result hona chahiye:

- `taxableAmount`: `1000.00`
- `gstAmount`: `180.00`
- `cgstAmount`: `90.00`
- `sgstAmount`: `90.00`

Lekin current code output aa raha hai:

- `taxableAmount`: `62.11`
- `gstAmount`: `1117.89`
- `cgstAmount`: `558.95`
- `sgstAmount`: `558.94`

Isliye expense module me inclusive GST case ko special bug-test ke roop me test karo.

### 6.11 Payroll test

Employee setup:

- Name: `Rahul Sharma`
- Joining date: `2026-04-01`
- Salary type: `monthly`

Salary structure:

- Basic: `30000`
- HRA: `12000`
- Conveyance: `2000`
- Medical: `1000`
- Other allowance: `3000`
- PF: `1800`
- ESIC: `500`
- Professional tax: `200`
- TDS: `1500`
- Other deduction: `1000`

Expected structure totals:

- `grossSalary`: `48000.00`
- `totalDeductions`: `5000.00`
- `netSalary`: `43000.00`

Attendance for `2026-04`:

- Working days: `30`
- Present: `24`
- Paid leave: `2`
- Unpaid leave: `1`
- Absent: `2`
- Half days: `1`
- Overtime hours: `8`

Expected payroll calculation:

- `payableDays`: `26.50`
- `basicSalary`: `26499.00`
- `hra`: `10599.60`
- `allowancesTotal`: `5299.80`
- `deductionsTotal`: `4416.50`
- `grossSalary`: `42398.40`
- `netSalary`: `37981.90`
- `perUnitNetSalary`: `1266.06`

If extra payroll entries:

- Bonus `2000`
- Extra deduction `500`

Expected final:

- `grossWithBonus`: `44398.40`
- `deductionsWithExtra`: `4916.50`
- `netWithBonus`: `39481.90`

If paid amount `20000`:

- Payroll payment status = `partial`

### 6.12 Simple accounting test

Manual journal:

- Date: `2026-04-30`
- Description: `Office rent paid`
- Line 1: `Rent Expense` debit `1000`
- Line 2: `Cash` credit `1000`

Expected:

- Total debit = `1000.00`
- Total credit = `1000.00`
- Journal balanced = `true`

### 6.13 GST summary test from above records

Using:

- Sales GST total = `666.91 + 108.00 = 774.91`
- Sales return GST = `177.12` if you return proportional multiple items in your test set, otherwise use exact return GST from the saved return
- Purchase GST = `756.06`
- Eligible expense GST = `180.00` for safe exclusive expense case

Safe expected example with exclusive expense and no extra adjustments:

- `outputGst = salesGst - salesReturnGst`
- `inputGst = purchaseGst + expenseGst - purchaseReturnGst`

You should compare this module after your actual saved returns, because GST summary depends on posted records only.

## 7. Special code behaviors you should know while testing

- `Goods` products bina warehouse ke save nahi honge.
- `Service` products warehouse ya stock values use nahi kar sakte.
- `Batch tracking enabled` hai to batch required hoga.
- `Expiry tracking enabled` hai to expiry date required hogi.
- `Alternate mobile` same as primary mobile allowed nahi hai.
- `Opening balance amount > 0` ho to balance type `debit/credit` mandatory hai.
- `Sales minimum price` se niche rate validation fail karega.
- `Payment mode bank/upi/card/cheque/neft/rtgs/imps` ho to bank account mandatory ho sakta hai.
- `Electronic payment modes` me reference no required hota hai.
- `Cheque` mode me cheque details mandatory hoti hain.
- `Attendance totals` working days se zyada nahi ho sakte.

## 8. Best testing order

1. Company + financial year + bank + tax settings
2. Warehouse + products + customers + suppliers
3. Opening stock
4. Purchase invoice
5. Sales invoice intra-state
6. Sales invoice inter-state
7. Sales return
8. Purchase return
9. Payment allocation
10. Expense
11. Payroll
12. Accounting and GST reports

## 9. Most useful places in code

- Frontend routing: `frontend/src/router/AppRouter.tsx`
- Navigation: `frontend/src/constants/navigation.ts`
- Sales calculation: `backend/src/modules/sales/sales.calculation.ts`
- Purchase calculation: `backend/src/modules/purchases/purchases.calculation.ts`
- Payment calculation: `backend/src/modules/payments/payments.calculation.ts`
- Expense calculation: `backend/src/modules/expenses/expenses.calculation.ts`
- Payroll calculation: `backend/src/modules/payroll/payroll.calculation.ts`
- Accounting calculation: `backend/src/modules/accounting/accounting.calculation.ts`
- GST calculation: `backend/src/modules/gst/gst.calculation.ts`

