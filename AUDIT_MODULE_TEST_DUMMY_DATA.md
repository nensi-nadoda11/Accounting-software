# Audit Modules Test Dummy Data

Use this file when testing the last 3 audit modules:

- Stock Check
- Cash Verification
- Site Audit

Recommended company/test context:

- Company: `sanvi food`
- Warehouse: `narol main warehouse`
- Auditor: `mohit sharma`
- Test Date: Today

If these exact records are not available, create records with the same values below.

## 1. Stock Check Test Record

Create a stock check first.

Header:

- Check Date: Today
- Warehouse: `narol main warehouse`
- Remarks: `Monthly physical stock audit test`

Items:

| Product | Batch | System Qty | Physical Qty | Expected Result | Reason |
| --- | --- | ---: | ---: | --- | --- |
| Sugar 1kg | Any / blank | Use system value | System Qty - 1 | Short | `Sugar stock mismatch` |

Flow:

1. Save stock check as draft.
2. Complete stock check.
3. Approve stock check.
4. Note the generated number, for example `SC-000001`.

Expected:

- Status becomes `Approved`.
- Summary shows at least 1 mismatch.
- Short item count should increase.
- Inventory adjustment should be posted only after approve.

Negative checks:

- Approve draft stock check should be blocked.
- Edit approved stock check should be blocked.
- Empty stock check approval should be blocked.

## 2. Cash Verification Test Record

Create cash verification after checking current cash ledger.

Header:

- Verification Date: Today
- Actual Cash: `4000`
- Remarks: `Cash counted during site audit`

Expected cash:

- System will calculate automatically from cash ledger as of selected verification date.
- Do not manually calculate expected cash.

Flow:

1. Open Cash Verification.
2. Click Create.
3. Select today date.
4. Confirm Expected Cash is loaded.
5. Enter Actual Cash `4000`.
6. Save.
7. Complete cash verification.
8. Approve cash verification.
9. Note the generated number, for example `CV-000001`.

Expected:

- Difference = `Actual Cash - Expected Cash`.
- If difference is negative, status should be `Short Cash`.
- If difference is positive, status should be `Excess Cash`.
- If difference is zero, status should be `Matched`.
- Past date should calculate expected cash as of that date, not current date.

Negative checks:

- Future verification date should be blocked.
- Negative actual cash should be blocked.
- Approve draft cash verification should be blocked.
- Edit approved cash verification should be blocked.

## 3. Site Audit Test Record

Create site audit after Stock Check and Cash Verification are approved.

Header:

- Audit Date: Today
- Warehouse: `narol main warehouse`
- Auditor: `mohit sharma`
- Linked Stock Check: approved stock check, for example `SC-000001`
- Linked Cash Verification: approved cash verification, for example `CV-000001`
- Final Result: `Issues Found`
- Overall Remarks: `Site audit completed with stock and cash mismatch review`

Checklist:

| Checklist Item | Checked | Remarks |
| --- | --- | --- |
| Stock Verified | Yes | `Stock check linked and reviewed` |
| Cash Verified | Yes | `Cash verification linked and reviewed` |
| Purchase Records Verified | Yes | `Purchase records verified for sample period` |
| Sales Records Verified | Optional | `Sales records reviewed` |
| Expense Records Verified | Optional | `Expense records reviewed` |

Finding:

| Field | Value |
| --- | --- |
| Finding Title | `Sugar stock mismatch` |
| Description | `Physical stock is short compared to system stock.` |
| Severity | `Medium` |
| Status | `Open` |
| Related Module | `stock_check` |
| Related Reference ID | Use linked stock check ID if available |

Flow:

1. Open Audit -> Site Audit.
2. Click Create.
3. Fill header data.
4. Link approved Stock Check.
5. Link approved Cash Verification.
6. Tick checklist items.
7. Add finding.
8. Save draft.
9. Open detail and verify linked summaries.
10. Complete audit.
11. Approve audit.
12. Export PDF/CSV.

Expected:

- Site audit should save successfully.
- Detail should show linked stock check summary.
- Detail should show linked cash verification summary.
- Finding should be visible.
- Complete should work after at least one checklist item is checked.
- Approve should work only after completed status.
- Export should download file.

Negative checks:

- Future audit date should be blocked.
- Complete without checklist should be blocked.
- Approve cancelled audit should be blocked.
- Edit approved audit should be blocked.
- User without approve permission should not see/use approve.

## Quick Test Sequence

Use this exact sequence for reliable testing:

1. Create and approve `Stock Check`.
2. Create and approve `Cash Verification`.
3. Create `Site Audit`.
4. Link the approved stock check and cash verification.
5. Add one medium finding.
6. Complete the site audit.
7. Approve the site audit.
8. Export the site audit.

## Expected Record Names

Your generated numbers may differ, but the flow should look like this:

| Module | Example Number | Final Status |
| --- | --- | --- |
| Stock Check | `SC-000001` | `Approved` |
| Cash Verification | `CV-000001` | `Approved` |
| Site Audit | `SA-000001` | `Approved` |

## Important Calculation Notes

- Stock Check difference = `Physical Qty - System Qty`.
- Cash Verification difference = `Actual Cash - Expected Cash`.
- Cash expected balance is calculated from ledger entries up to selected verification date.
- Site Audit does not recalculate stock or cash. It only shows linked record summaries.
