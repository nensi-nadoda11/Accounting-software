import { AxiosError } from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { formatPreferredDate, formatPreferredDateTime } from "../../lib/date-format";
import type {
  Product,
  ProductCategory,
  ProductCreatePayload,
  ProductFormInput,
  ProductPricePreview,
  ProductType,
  ProductUnit,
  ProductUpdatePayload,
  TaxType,
} from "../../types/product";

type ApiErrorShape = {
  message?: string;
  errors?: string[];
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const DECIMAL_REGEX = /^-?\d+(?:\.\d+)?$/;

const pow10 = (scale: number): bigint => 10n ** BigInt(scale);

const normalizeInput = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return "0";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Invalid decimal input");
    }

    return value.toString();
  }

  const trimmed = value.trim();
  return trimmed || "0";
};

const roundHalfUp = (dividend: bigint, divisor: bigint) => {
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

export const decimalToScaledBigInt = (value: string | number | null | undefined, scale: number): bigint => {
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

export const scaledBigIntToDecimal = (value: bigint, scale: number): string => {
  const negative = value < 0n;
  const absolute = negative ? value * -1n : value;
  const base = pow10(scale);
  const wholePart = absolute / base;
  const fractionPart = (absolute % base).toString().padStart(scale, "0");

  return scale === 0
    ? `${negative ? "-" : ""}${wholePart.toString()}`
    : `${negative ? "-" : ""}${wholePart.toString()}.${fractionPart}`;
};

export const normalizeMoney = (value: string | number | null | undefined): string =>
  scaledBigIntToDecimal(decimalToScaledBigInt(value, 2), 2);

export const normalizeQuantity = (value: string | number | null | undefined): string =>
  scaledBigIntToDecimal(decimalToScaledBigInt(value, 3), 3);

export const normalizeRate = (value: string | number | null | undefined, scale = 2): string =>
  scaledBigIntToDecimal(decimalToScaledBigInt(value, scale), scale);

export const multiplyScaled = (
  left: string | number | null | undefined,
  leftScale: number,
  right: string | number | null | undefined,
  rightScale: number,
  resultScale: number,
) => {
  const leftValue = decimalToScaledBigInt(left, leftScale);
  const rightValue = decimalToScaledBigInt(right, rightScale);
  const numerator = leftValue * rightValue;
  const divisor = pow10(leftScale + rightScale - resultScale);

  return scaledBigIntToDecimal(roundHalfUp(numerator, divisor), resultScale);
};

const getTaxableRates = (taxType: TaxType, gstRate: string, cessRate: string) => {
  if (taxType !== "taxable") {
    return { gstRateValue: 0n, cessRateValue: 0n };
  }

  return {
    gstRateValue: decimalToScaledBigInt(gstRate, 2),
    cessRateValue: decimalToScaledBigInt(cessRate, 2),
  };
};

export const calculateTaxExclusive = (price: string, gstRate: string, cessRate: string, taxType: TaxType) => {
  const baseAmount = decimalToScaledBigInt(price, 2);
  const { gstRateValue, cessRateValue } = getTaxableRates(taxType, gstRate, cessRate);
  const gstAmount = roundHalfUp(baseAmount * gstRateValue, 10000n);
  const cessAmount = roundHalfUp(baseAmount * cessRateValue, 10000n);

  return {
    baseSalePrice: scaledBigIntToDecimal(baseAmount, 2),
    gstAmount: scaledBigIntToDecimal(gstAmount, 2),
    cessAmount: scaledBigIntToDecimal(cessAmount, 2),
    finalSalePrice: scaledBigIntToDecimal(baseAmount + gstAmount + cessAmount, 2),
  };
};

export const calculateTaxInclusive = (price: string, gstRate: string, cessRate: string, taxType: TaxType) => {
  const finalAmount = decimalToScaledBigInt(price, 2);
  const { gstRateValue, cessRateValue } = getTaxableRates(taxType, gstRate, cessRate);
  const totalRate = gstRateValue + cessRateValue;

  if (totalRate === 0n) {
    return {
      baseSalePrice: scaledBigIntToDecimal(finalAmount, 2),
      gstAmount: "0.00",
      cessAmount: "0.00",
      finalSalePrice: scaledBigIntToDecimal(finalAmount, 2),
    };
  }

  const gstAmount = roundHalfUp(finalAmount * gstRateValue, 10000n + totalRate);
  const cessAmount = roundHalfUp(finalAmount * cessRateValue, 10000n + totalRate);
  const baseAmount = finalAmount - gstAmount - cessAmount;

  return {
    baseSalePrice: scaledBigIntToDecimal(baseAmount, 2),
    gstAmount: scaledBigIntToDecimal(gstAmount, 2),
    cessAmount: scaledBigIntToDecimal(cessAmount, 2),
    finalSalePrice: scaledBigIntToDecimal(finalAmount, 2),
  };
};

export const calculatePricePreview = (input: {
  salePrice: string | number;
  purchasePrice: string | number;
  gstRate: string | number;
  cessRate: string | number;
  taxType: TaxType;
  priceTaxType: "inclusive" | "exclusive";
}): ProductPricePreview => {
  const taxPreview =
    input.priceTaxType === "inclusive"
      ? calculateTaxInclusive(
          normalizeMoney(input.salePrice),
          normalizeRate(input.gstRate),
          normalizeRate(input.cessRate),
          input.taxType,
        )
      : calculateTaxExclusive(
          normalizeMoney(input.salePrice),
          normalizeRate(input.gstRate),
          normalizeRate(input.cessRate),
          input.taxType,
        );
  const saleAmount = decimalToScaledBigInt(taxPreview.baseSalePrice, 2);
  const purchaseAmount = decimalToScaledBigInt(input.purchasePrice, 2);
  const marginAmount = saleAmount - purchaseAmount;
  const marginPercentage = saleAmount <= 0n ? 0n : roundHalfUp(marginAmount * 10000n, saleAmount);
  const markupPercentage = purchaseAmount <= 0n ? 0n : roundHalfUp(marginAmount * 10000n, purchaseAmount);

  return {
    ...taxPreview,
    marginAmount: scaledBigIntToDecimal(marginAmount, 2),
    marginPercentage: scaledBigIntToDecimal(marginPercentage, 2),
    markupPercentage: scaledBigIntToDecimal(markupPercentage, 2),
  };
};

export const formatInr = (value: string | number | null | undefined) => currencyFormatter.format(Number(value ?? 0));

export const formatPercent = (value: string | number | null | undefined) =>
  `${percentFormatter.format(Number(value ?? 0))}%`;

export const formatDate = (value: string | Date | null | undefined, formatString = "dd MMM yyyy") => {
  return formatPreferredDate(value, formatString);
};

export const formatDateTime = (value: string | Date | null | undefined) => formatPreferredDateTime(value);

export const toInputString = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

export const trimToEmpty = (value: string | null | undefined) => value ?? "";

export const saveDownloadedFile = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const buildProductFormDefaults = (product?: Product | null): ProductFormInput => ({
  productType: product?.productType ?? "goods",
  name: product?.name ?? "",
  sku: product?.sku ?? null,
  barcode: product?.barcode ?? null,
  categoryId: product?.category.id ?? "",
  unitId: product?.unit.id ?? null,
  brand: product?.brand ?? null,
  description: product?.description ?? null,
  hsnSacCode: product?.hsnSacCode ?? null,
  taxType: product?.taxType ?? "taxable",
  gstRate: Number(product?.gstRate ?? 0),
  cessRate: Number(product?.cessRate ?? 0),
  priceTaxType: product?.priceTaxType ?? "exclusive",
  purchasePrice: Number(product?.purchasePrice ?? 0),
  salePrice: Number(product?.salePrice ?? 0),
  mrp: Number(product?.mrp ?? 0),
  wholesalePrice: Number(product?.wholesalePrice ?? 0),
  minimumSalePrice: Number(product?.minimumSalePrice ?? 0),
  defaultDiscount: Number(product?.defaultDiscount ?? 0),
  stockTrackingEnabled: product?.stockTrackingEnabled ?? false,
  openingStockQuantity: Number(product?.openingStockQuantity ?? 0),
  openingStockRate: Number(product?.openingStockRate ?? 0),
  minimumStockLevel: Number(product?.minimumStockLevel ?? 0),
  reorderLevel: Number(product?.reorderLevel ?? 0),
  maximumStockLevel: Number(product?.maximumStockLevel ?? 0),
  batchTrackingEnabled: product?.batchTrackingEnabled ?? false,
  expiryTrackingEnabled: product?.expiryTrackingEnabled ?? false,
  serialTrackingEnabled: product?.serialTrackingEnabled ?? false,
  negativeStockAllowed: product?.negativeStockAllowed ?? false,
  status: product?.status === "inactive" ? "inactive" : "active",
});

export const createProductPayload = (values: ProductFormInput): ProductCreatePayload => values;

export const createProductUpdatePayload = (values: ProductFormInput): ProductUpdatePayload => values;

const normalizeServerField = (field: string) => (field.startsWith("body.") ? field.slice(5) : field);

export const applyFriendlyFieldErrors = <TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
) => {
  if (!(error instanceof AxiosError) || !error.response) {
    return false;
  }

  const data = error.response.data as ApiErrorShape | undefined;
  const handled = new Set<string>();

  for (const item of data?.errors ?? []) {
    const separatorIndex = item.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const field = normalizeServerField(item.slice(0, separatorIndex).trim()) as Path<TFieldValues>;
    const message = item.slice(separatorIndex + 1).trim();

    if (!field || !message) {
      continue;
    }

    handled.add(field);
    setError(field, { type: "server", message });
  }

  const message = data?.message?.toLowerCase() ?? "";
  if (!handled.size) {
    if (message.includes("sku")) {
      setError("sku" as Path<TFieldValues>, { type: "server", message: data?.message ?? "SKU is invalid" });
      handled.add("sku");
    }

    if (message.includes("barcode")) {
      setError("barcode" as Path<TFieldValues>, { type: "server", message: data?.message ?? "Barcode is invalid" });
      handled.add("barcode");
    }

    if (message.includes("category")) {
      setError("categoryId" as Path<TFieldValues>, { type: "server", message: data?.message ?? "Category is invalid" });
      handled.add("categoryId");
    }

    if (message.includes("unit")) {
      setError("unitId" as Path<TFieldValues>, { type: "server", message: data?.message ?? "Unit is invalid" });
      handled.add("unitId");
    }

    if (message.includes("hsn") || message.includes("sac")) {
      setError("hsnSacCode" as Path<TFieldValues>, {
        type: "server",
        message: data?.message ?? "HSN/SAC code is invalid",
      });
      handled.add("hsnSacCode");
    }
  }

  return handled.size > 0;
};

export const getProductStatusTone = (status: Product["status"]) => {
  if (status === "active") {
    return "success" as const;
  }

  if (status === "inactive") {
    return "warning" as const;
  }

  return "danger" as const;
};

export const getTaxTypeTone = (taxType: Product["taxType"]) => {
  if (taxType === "taxable") {
    return "success" as const;
  }

  if (taxType === "exempt") {
    return "warning" as const;
  }

  return "neutral" as const;
};

export const buildSkuSuggestion = (name: string, productType: ProductType, brand?: string | null) => {
  const source = `${productType === "goods" ? "PRD" : "SRV"} ${brand ?? ""} ${name}`
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return source || (productType === "goods" ? "PRD" : "SRV");
};

export const findCategoryName = (categories: ProductCategory[], categoryId: string | null | undefined) =>
  categories.find((item) => item.id === categoryId)?.name ?? "-";

export const findUnitName = (units: ProductUnit[], unitId: string | null | undefined) =>
  units.find((item) => item.id === unitId)?.name ?? "-";

export const getOpeningStockValue = (quantity: string | number | null | undefined, rate: string | number | null | undefined) =>
  multiplyScaled(quantity, 3, rate, 2, 2);
