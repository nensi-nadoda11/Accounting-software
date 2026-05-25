import { AxiosError } from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type { CompanyTaxSettings } from "../../types/company";
import type {
  CategoryWiseExpenseReportRow,
  Expense,
  ExpenseAttachment,
  ExpenseCategory,
  ExpenseFormInput,
  ExpensePaymentMode,
  ExpensePriceTaxType,
  ExpenseSummaryTotals,
  GstExpenseReportRow,
  MonthlyExpenseReportRow,
  PaymentModeExpenseReportRow,
  RecurringExpense,
  RecurringExpenseFormInput,
  RecurringExpenseFrequency,
} from "../../types/expense";
import { EXPENSE_PAYMENT_MODE_LABELS, RECURRING_FREQUENCY_LABELS } from "./expenseOptions";

type ApiErrorShape = {
  message?: string;
  errors?: string[];
};

const DECIMAL_REGEX = /^-?\d+(?:\.\d+)?$/;
const GST_DIVISOR_SCALE = 4;

const pow10 = (scale: number): bigint => 10n ** BigInt(scale);

const normalizeInput = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return "0";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Invalid decimal input");
    }

    return value.toString();
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? "0" : trimmed;
};

const divideScaled = (dividend: bigint, divisor: bigint) => {
  if (divisor === 0n) {
    throw new Error("Division by zero");
  }

  const negative = dividend < 0n;
  const absoluteDividend = negative ? dividend * -1n : dividend;
  const quotient = absoluteDividend / divisor;
  const remainder = absoluteDividend % divisor;
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient;

  return negative ? rounded * -1n : rounded;
};

const roundToScale = (value: string | number | null | undefined, scale: number): bigint => {
  const normalized = normalizeInput(value);
  if (!DECIMAL_REGEX.test(normalized)) {
    throw new Error("Invalid decimal input");
  }

  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [wholePart = "0", fractionPart = ""] = unsigned.split(".");
  const paddedFraction = fractionPart.padEnd(scale + 1, "0");
  const retainedFraction = paddedFraction.slice(0, scale);
  const droppedDigit = paddedFraction.charAt(scale);
  let scaled = BigInt(wholePart) * pow10(scale) + BigInt((retainedFraction || "").padEnd(scale, "0") || "0");

  if (droppedDigit >= "5") {
    scaled += 1n;
  }

  return negative ? scaled * -1n : scaled;
};

const fromScaled = (value: bigint, scale: number) => {
  const negative = value < 0n;
  const absolute = negative ? value * -1n : value;
  const base = pow10(scale);
  const wholePart = absolute / base;
  const fractionPart = (absolute % base).toString().padStart(scale, "0");

  if (scale === 0) {
    return `${negative ? "-" : ""}${wholePart.toString()}`;
  }

  return `${negative ? "-" : ""}${wholePart.toString()}.${fractionPart}`;
};

export const normalizeMoney = (value: string | number | null | undefined) => fromScaled(roundToScale(value, 2), 2);

export const applyExpenseFieldErrors = <TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
) => {
  if (!(error instanceof AxiosError) || !error.response) {
    return false;
  }

  const data = error.response.data as ApiErrorShape | undefined;
  let handled = false;

  for (const item of data?.errors ?? []) {
    const separatorIndex = item.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const field = item.slice(0, separatorIndex).trim() as Path<TFieldValues>;
    const message = item.slice(separatorIndex + 1).trim();

    if (!field || !message) {
      continue;
    }

    setError(field, { type: "server", message });
    handled = true;
  }

  const message = data?.message?.trim() ?? "";
  const normalizedMessage = message.toLowerCase();

  if (!handled && message) {
    const assign = (field: string) => {
      setError(field as Path<TFieldValues>, { type: "server", message });
      handled = true;
    };

    if (normalizedMessage.includes("bank account")) {
      assign("bankAccountId");
    } else if (normalizedMessage.includes("expense account") || normalizedMessage.includes("expense ledger")) {
      assign("expenseAccountId");
    } else if (normalizedMessage.includes("category")) {
      assign("categoryId");
    } else if (normalizedMessage.includes("next run date")) {
      assign("nextRunDate");
    } else if (normalizedMessage.includes("start date")) {
      assign("startDate");
    } else if (normalizedMessage.includes("end date")) {
      assign("endDate");
    } else if (normalizedMessage.includes("expense date") || normalizedMessage.includes("period is locked") || normalizedMessage.includes("financial year is locked")) {
      assign("expenseDate");
    } else if (normalizedMessage.includes("reference number")) {
      assign("referenceNumber");
    } else if (normalizedMessage.includes("cheque number")) {
      assign("chequeNumber");
    } else if (normalizedMessage.includes("cheque date")) {
      assign("chequeDate");
    } else if (normalizedMessage.includes("template name")) {
      assign("templateName");
    } else if (normalizedMessage.includes("description")) {
      assign("description");
    }
  }

  return handled;
};

export const addDecimals = (
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  scale: number,
) => fromScaled(roundToScale(left, scale) + roundToScale(right, scale), scale);

export const compareDecimals = (
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  scale: number,
) => {
  const leftValue = roundToScale(left, scale);
  const rightValue = roundToScale(right, scale);
  if (leftValue === rightValue) {
    return 0;
  }

  return leftValue > rightValue ? 1 : -1;
};

const splitHalf = (value: string) => {
  const scaled = roundToScale(value, 2);
  const half = divideScaled(scaled, 2n);
  const otherHalf = scaled - half;

  return {
    first: fromScaled(half, 2),
    second: fromScaled(otherHalf, 2),
  };
};

export const calculateExpensePreview = ({
  amount,
  gstApplicable,
  gstRate,
  priceTaxType,
  intraState,
}: {
  amount: string | number;
  gstApplicable: boolean;
  gstRate: string | number;
  priceTaxType: ExpensePriceTaxType;
  intraState: boolean;
}) => {
  const normalizedAmount = normalizeMoney(amount);
  const normalizedRate = normalizeMoney(gstRate);

  if (!gstApplicable || compareDecimals(normalizedRate, "0", 2) <= 0) {
    return {
      amount: normalizedAmount,
      gstApplicable: false,
      gstRate: "0.00",
      taxableAmount: normalizedAmount,
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstAmount: "0.00",
      gstAmount: "0.00",
      totalAmount: normalizedAmount,
    };
  }

  const amountScaled = roundToScale(normalizedAmount, 2);
  const rateScaled = roundToScale(normalizedRate, GST_DIVISOR_SCALE);

  const { taxableAmount, gstAmount, totalAmount } =
    priceTaxType === "inclusive"
      ? (() => {
          const divisor = pow10(GST_DIVISOR_SCALE) + rateScaled;
          const baseScaled = divideScaled(amountScaled * pow10(GST_DIVISOR_SCALE), divisor);

          return {
            taxableAmount: fromScaled(baseScaled, 2),
            gstAmount: fromScaled(amountScaled - baseScaled, 2),
            totalAmount: normalizedAmount,
          };
        })()
      : (() => {
          const computedGst = divideScaled(amountScaled * rateScaled, 10n ** BigInt(GST_DIVISOR_SCALE + 2));
          const nextTaxableAmount = normalizedAmount;
          const nextGstAmount = fromScaled(computedGst, 2);

          return {
            taxableAmount: nextTaxableAmount,
            gstAmount: nextGstAmount,
            totalAmount: addDecimals(nextTaxableAmount, nextGstAmount, 2),
          };
        })();

  const split =
    compareDecimals(gstAmount, "0", 2) <= 0
      ? { cgstAmount: "0.00", sgstAmount: "0.00", igstAmount: "0.00" }
      : intraState
        ? (() => {
            const half = splitHalf(gstAmount);
            return { cgstAmount: half.first, sgstAmount: half.second, igstAmount: "0.00" };
          })()
        : { cgstAmount: "0.00", sgstAmount: "0.00", igstAmount: normalizeMoney(gstAmount) };

  return {
    amount: normalizedAmount,
    gstApplicable: true,
    gstRate: normalizedRate,
    taxableAmount,
    cgstAmount: split.cgstAmount,
    sgstAmount: split.sgstAmount,
    igstAmount: split.igstAmount,
    gstAmount,
    totalAmount,
  };
};

export const resolveIntraState = (companyGstNumber: string | null | undefined, companyState: string | null | undefined, vendorGstNumber: string | null | undefined) => {
  const normalizeCompanyState = () => {
    const normalizedGst = companyGstNumber?.trim().toUpperCase();
    if (normalizedGst && normalizedGst.length >= 2) {
      return normalizedGst.slice(0, 2);
    }

    const normalizedState = companyState?.trim().toUpperCase();
    return normalizedState || null;
  };

  const normalizeVendorState = () => {
    const normalized = vendorGstNumber?.trim().toUpperCase();
    if (!normalized || normalized.length < 2) {
      return null;
    }

    return normalized.slice(0, 2);
  };

  const companyCode = normalizeCompanyState();
  const vendorCode = normalizeVendorState();

  if (!companyCode || !vendorCode) {
    return true;
  }

  return companyCode === vendorCode;
};

export const getTodayInput = () => new Date().toISOString().slice(0, 10);

export const getMonthStartInput = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
};

export const buildExpenseFormDefaults = (
  expense?: Expense | null,
  taxSettings?: CompanyTaxSettings | null,
): ExpenseFormInput => ({
  expenseDate: expense?.expenseDate?.slice(0, 10) ?? getTodayInput(),
  categoryId: expense?.categoryId ?? "",
  expenseAccountId: expense?.expenseAccountId ?? null,
  payeeName: expense?.payeeName ?? null,
  vendorGstNumber: expense?.vendorGstNumber ?? null,
  vendorPanNumber: expense?.vendorPanNumber ?? null,
  hsnSacCode: expense?.hsnSacCode ?? null,
  description: expense?.description ?? "",
  amount: Number(expense?.amount ?? 0),
  gstApplicable: expense?.gstApplicable ?? Boolean(taxSettings?.gstEnabled),
  gstRate: Number(expense?.gstRate ?? taxSettings?.defaultGstRate ?? 0) as ExpenseFormInput["gstRate"],
  priceTaxType: expense?.priceTaxType ?? (taxSettings?.taxInclusivePricing ? "inclusive" : "exclusive"),
  paymentMode: expense?.paymentMode ?? "cash",
  bankAccountId: expense?.bankAccountId ?? null,
  referenceNumber: expense?.referenceNumber ?? null,
  chequeNumber: expense?.chequeNumber ?? null,
  chequeDate: expense?.chequeDate?.slice(0, 10) ?? null,
  chequeStatus: expense?.chequeStatus ?? null,
  notes: expense?.notes ?? null,
  status: expense?.status === "posted" ? "posted" : "draft",
});

export const buildRecurringFormDefaults = (
  recurring?: RecurringExpense | null,
  taxSettings?: CompanyTaxSettings | null,
): RecurringExpenseFormInput => {
  const today = getTodayInput();

  return {
    templateName: recurring?.templateName ?? "",
    categoryId: recurring?.categoryId ?? "",
    expenseAccountId: recurring?.expenseAccountId ?? null,
    payeeName: recurring?.payeeName ?? null,
    description: recurring?.description ?? "",
    amount: Number(recurring?.amount ?? 0),
    gstApplicable: recurring?.gstApplicable ?? Boolean(taxSettings?.gstEnabled),
    gstRate: Number(recurring?.gstRate ?? taxSettings?.defaultGstRate ?? 0) as RecurringExpenseFormInput["gstRate"],
    priceTaxType: recurring?.priceTaxType ?? (taxSettings?.taxInclusivePricing ? "inclusive" : "exclusive"),
    paymentMode: recurring?.paymentMode ?? "cash",
    bankAccountId: recurring?.bankAccountId ?? null,
    frequency: recurring?.frequency ?? "monthly",
    startDate: recurring?.startDate?.slice(0, 10) ?? today,
    endDate: recurring?.endDate?.slice(0, 10) ?? null,
    nextRunDate: recurring?.nextRunDate?.slice(0, 10) ?? today,
    autoCreateEnabled: recurring?.autoCreateEnabled ?? true,
    createAsStatus: recurring?.createAsStatus ?? "draft",
    reminderDaysBefore: recurring?.reminderDaysBefore ?? 0,
    status: recurring?.status ?? "active",
  };
};

const trimToNull = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export const createExpensePayload = (values: ExpenseFormInput, status: "draft" | "posted"): ExpenseFormInput => ({
  expenseDate: values.expenseDate,
  categoryId: values.categoryId,
  expenseAccountId: values.expenseAccountId || null,
  payeeName: trimToNull(values.payeeName),
  vendorGstNumber: trimToNull(values.vendorGstNumber)?.toUpperCase() ?? null,
  vendorPanNumber: trimToNull(values.vendorPanNumber)?.toUpperCase() ?? null,
  hsnSacCode: trimToNull(values.hsnSacCode),
  description: values.description.trim(),
  amount: values.amount,
  gstApplicable: values.gstApplicable,
  gstRate: values.gstApplicable ? values.gstRate : 0,
  priceTaxType: values.priceTaxType,
  paymentMode: values.paymentMode,
  bankAccountId: values.bankAccountId || null,
  referenceNumber: trimToNull(values.referenceNumber),
  chequeNumber: trimToNull(values.chequeNumber),
  chequeDate: values.chequeDate || null,
  chequeStatus: values.paymentMode === "cheque" ? values.chequeStatus ?? "issued" : null,
  notes: trimToNull(values.notes),
  status,
});

export const createRecurringPayload = (values: RecurringExpenseFormInput): RecurringExpenseFormInput => ({
  templateName: values.templateName.trim(),
  categoryId: values.categoryId,
  expenseAccountId: values.expenseAccountId || null,
  payeeName: trimToNull(values.payeeName),
  description: values.description.trim(),
  amount: values.amount,
  gstApplicable: values.gstApplicable,
  gstRate: values.gstApplicable ? values.gstRate : 0,
  priceTaxType: values.priceTaxType,
  paymentMode: values.paymentMode,
  bankAccountId: values.bankAccountId || null,
  frequency: values.frequency,
  startDate: values.startDate,
  endDate: values.endDate || null,
  nextRunDate: values.nextRunDate,
  autoCreateEnabled: values.autoCreateEnabled,
  createAsStatus: values.createAsStatus,
  reminderDaysBefore: values.reminderDaysBefore,
  status: values.status,
});

export const formatBytes = (value: number) => {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export const isPreviewableImage = (attachment: ExpenseAttachment) => attachment.mimeType.startsWith("image/");
export const isPreviewablePdf = (attachment: ExpenseAttachment) => attachment.mimeType === "application/pdf";

export const downloadLocalCsv = (fileName: string, headers: string[], rows: string[][]) => {
  const escapeValue = (value: string | null | undefined) => {
    const safeValue = value ?? "";
    if (/[",\n]/.test(safeValue)) {
      return `"${safeValue.replace(/"/g, "\"\"")}"`;
    }

    return safeValue;
  };

  const csv = [`\uFEFF${headers.map((item) => escapeValue(item)).join(",")}`, ...rows.map((row) => row.map((cell) => escapeValue(cell)).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const pdfEscape = (value: string) =>
  value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

export const downloadLocalPdfTable = (fileName: string, title: string, headers: string[], rows: string[][]) => {
  const maxColumnWidth = Math.max(12, Math.floor(140 / Math.max(headers.length, 1)));
  const lines = [
    title,
    "",
    headers.map((header) => header.padEnd(maxColumnWidth).slice(0, maxColumnWidth)).join(" "),
    headers.map(() => "-".repeat(maxColumnWidth)).join(" "),
    ...rows.map((row) =>
      row
        .map((cell) => (cell ?? "").padEnd(maxColumnWidth).slice(0, maxColumnWidth))
        .join(" "),
    ),
  ];

  const pageHeight = 792;
  const pageWidth = 612;
  const fontSize = 9;
  const lineHeight = 14;
  const linesPerPage = 48;
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(lines.length / linesPerPage)) },
    (_, index) => lines.slice(index * linesPerPage, (index + 1) * linesPerPage),
  );

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageRefs = pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Count ${pages.length} /Kids [${pageRefs}] >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (const pageLines of pages) {
    const pageObjectId = objects.length + 1;
    const contentObjectId = pageObjectId + 1;
    const contentLines = ["BT", `/F1 ${fontSize} Tf`];
    let y = pageHeight - 48;

    for (const line of pageLines) {
      contentLines.push(`1 0 0 1 36 ${y} Tm (${pdfEscape(line)}) Tj`);
      y -= lineHeight;
    }

    contentLines.push("ET");
    const stream = contentLines.join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([body], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const sumExpenseTotals = (
  items: Array<
    | CategoryWiseExpenseReportRow
    | MonthlyExpenseReportRow
    | PaymentModeExpenseReportRow
    | GstExpenseReportRow
  >,
) => {
  return items.reduce(
    (totals, item) => {
      if ("taxableAmount" in item) {
        totals.taxableAmount = addDecimals(totals.taxableAmount, item.taxableAmount, 2);
      }

      if ("gstAmount" in item) {
        totals.gstAmount = addDecimals(totals.gstAmount, item.gstAmount, 2);
      }

      totals.totalAmount = addDecimals(
        totals.totalAmount,
        "totalAmount" in item ? item.totalAmount : "0.00",
        2,
      );

      totals.count += item.expenseCount;
      return totals;
    },
    {
      count: 0,
      taxableAmount: "0.00",
      gstAmount: "0.00",
      totalAmount: "0.00",
    },
  );
};

export const buildPrintWindow = (expense: Expense) => {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) {
    return;
  }

  const bankLine = expense.bankAccount
    ? `${expense.bankAccount.bankName} • ${expense.bankAccount.accountNumber}`
    : "-";

  popup.document.write(`
    <html>
      <head>
        <title>${expense.expenseNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
          h1 { font-size: 22px; margin-bottom: 8px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
          .card { border: 1px solid #dbe4e6; border-radius: 12px; padding: 12px; }
          .label { font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
          .value { font-size: 14px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; font-size: 13px; }
          th { color: #475569; text-transform: uppercase; font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>${expense.expenseNumber}</h1>
        <div class="grid">
          <div class="card"><div class="label">Date</div><div class="value">${expense.expenseDate.slice(0, 10)}</div></div>
          <div class="card"><div class="label">Status</div><div class="value">${expense.status}</div></div>
          <div class="card"><div class="label">Payee</div><div class="value">${expense.payeeName ?? "-"}</div></div>
          <div class="card"><div class="label">Category</div><div class="value">${expense.category.name}</div></div>
          <div class="card"><div class="label">Payment Mode</div><div class="value">${EXPENSE_PAYMENT_MODE_LABELS[expense.paymentMode]}</div></div>
          <div class="card"><div class="label">Bank / Reference</div><div class="value">${bankLine}${expense.referenceNumber ? ` • ${expense.referenceNumber}` : ""}</div></div>
        </div>
        <div class="card">
          <div class="label">Description</div>
          <div class="value">${expense.description}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Base Amount</th>
              <th>Taxable</th>
              <th>CGST</th>
              <th>SGST</th>
              <th>IGST</th>
              <th>GST</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${expense.amount}</td>
              <td>${expense.taxableAmount}</td>
              <td>${expense.cgstAmount}</td>
              <td>${expense.sgstAmount}</td>
              <td>${expense.igstAmount}</td>
              <td>${expense.gstAmount}</td>
              <td>${expense.totalAmount}</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
};

export const createEmptySummary = (): ExpenseSummaryTotals => ({
  amount: "0.00",
  taxableAmount: "0.00",
  gstAmount: "0.00",
  totalAmount: "0.00",
});

export const getCategoryName = (categories: ExpenseCategory[], categoryId: string | null | undefined) =>
  categories.find((item) => item.id === categoryId)?.name ?? "-";

export const getPaymentModeLabel = (paymentMode: ExpensePaymentMode) => EXPENSE_PAYMENT_MODE_LABELS[paymentMode];

export const getRecurringFrequencyLabel = (frequency: RecurringExpenseFrequency) => RECURRING_FREQUENCY_LABELS[frequency];
