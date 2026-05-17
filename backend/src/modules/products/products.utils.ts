import type {
  ProductPricePreview,
  ProductPriceTaxType,
  ProductTaxType
} from "./products.types";

const DECIMAL_REGEX = /^-?\d+(?:\.\d+)?$/;

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
  if (trimmed.length === 0) {
    return "0";
  }

  return trimmed;
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

export const decimalToScaledBigInt = (
  value: string | number | null | undefined,
  scale: number
): bigint => {
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
  let scaled =
    BigInt(wholePart) * pow10(scale) +
    BigInt((retainedFraction || "").padEnd(scale, "0") || "0");

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

  if (scale === 0) {
    return `${negative ? "-" : ""}${wholePart.toString()}`;
  }

  return `${negative ? "-" : ""}${wholePart.toString()}.${fractionPart}`;
};

export const normalizeMoney = (value: string | number | null | undefined): string =>
  scaledBigIntToDecimal(decimalToScaledBigInt(value, 2), 2);

export const normalizeQuantity = (value: string | number | null | undefined): string =>
  scaledBigIntToDecimal(decimalToScaledBigInt(value, 3), 3);

export const normalizeRate = (value: string | number | null | undefined, scale = 2): string =>
  scaledBigIntToDecimal(decimalToScaledBigInt(value, scale), scale);

export const compareDecimals = (
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  scale: number
) => {
  const leftValue = decimalToScaledBigInt(left, scale);
  const rightValue = decimalToScaledBigInt(right, scale);

  if (leftValue === rightValue) {
    return 0;
  }

  return leftValue > rightValue ? 1 : -1;
};

export const multiplyScaled = (
  left: string | number | null | undefined,
  leftScale: number,
  right: string | number | null | undefined,
  rightScale: number,
  resultScale: number
): string => {
  const leftValue = decimalToScaledBigInt(left, leftScale);
  const rightValue = decimalToScaledBigInt(right, rightScale);
  const numerator = leftValue * rightValue;
  const divisorScale = leftScale + rightScale - resultScale;
  const divisor = pow10(divisorScale);

  return scaledBigIntToDecimal(roundHalfUp(numerator, divisor), resultScale);
};

const getTaxableRates = (taxType: ProductTaxType, gstRate: string, cessRate: string) => {
  if (taxType !== "taxable") {
    return {
      gstRateValue: 0n,
      cessRateValue: 0n
    };
  }

  return {
    gstRateValue: decimalToScaledBigInt(gstRate, 2),
    cessRateValue: decimalToScaledBigInt(cessRate, 2)
  };
};

export const calculateTaxExclusive = (
  price: string,
  gstRate: string,
  cessRate: string,
  taxType: ProductTaxType = "taxable"
) => {
  const baseAmount = decimalToScaledBigInt(price, 2);
  const { gstRateValue, cessRateValue } = getTaxableRates(taxType, gstRate, cessRate);
  const gstAmount = roundHalfUp(baseAmount * gstRateValue, 10000n);
  const cessAmount = roundHalfUp(baseAmount * cessRateValue, 10000n);
  const finalAmount = baseAmount + gstAmount + cessAmount;

  return {
    baseSalePrice: scaledBigIntToDecimal(baseAmount, 2),
    gstAmount: scaledBigIntToDecimal(gstAmount, 2),
    cessAmount: scaledBigIntToDecimal(cessAmount, 2),
    finalSalePrice: scaledBigIntToDecimal(finalAmount, 2)
  };
};

export const calculateTaxInclusive = (
  price: string,
  gstRate: string,
  cessRate: string,
  taxType: ProductTaxType = "taxable"
) => {
  const finalAmount = decimalToScaledBigInt(price, 2);
  const { gstRateValue, cessRateValue } = getTaxableRates(taxType, gstRate, cessRate);
  const totalRate = gstRateValue + cessRateValue;

  if (totalRate === 0n) {
    return {
      baseSalePrice: scaledBigIntToDecimal(finalAmount, 2),
      gstAmount: "0.00",
      cessAmount: "0.00",
      finalSalePrice: scaledBigIntToDecimal(finalAmount, 2)
    };
  }

  const baseAmount = roundHalfUp(finalAmount * 10000n, 10000n + totalRate);
  const totalTaxAmount = finalAmount - baseAmount;
  const gstAmount = roundHalfUp(totalTaxAmount * gstRateValue, totalRate);
  const cessAmount = totalTaxAmount - gstAmount;

  return {
    baseSalePrice: scaledBigIntToDecimal(baseAmount, 2),
    gstAmount: scaledBigIntToDecimal(gstAmount, 2),
    cessAmount: scaledBigIntToDecimal(cessAmount, 2),
    finalSalePrice: scaledBigIntToDecimal(finalAmount, 2)
  };
};

export const calculateMargin = (salePrice: string, purchasePrice: string) => {
  const saleAmount = decimalToScaledBigInt(salePrice, 2);
  const purchaseAmount = decimalToScaledBigInt(purchasePrice, 2);
  const marginAmount = saleAmount - purchaseAmount;
  const marginPercentage =
    saleAmount <= 0n ? 0n : roundHalfUp(marginAmount * 10000n, saleAmount);

  return {
    marginAmount: scaledBigIntToDecimal(marginAmount, 2),
    marginPercentage: scaledBigIntToDecimal(marginPercentage, 2)
  };
};

export const calculateMarkup = (purchasePrice: string, salePrice: string) => {
  const purchaseAmount = decimalToScaledBigInt(purchasePrice, 2);
  const saleAmount = decimalToScaledBigInt(salePrice, 2);
  const markupAmount = saleAmount - purchaseAmount;
  const markupPercentage =
    purchaseAmount <= 0n ? 0n : roundHalfUp(markupAmount * 10000n, purchaseAmount);

  return scaledBigIntToDecimal(markupPercentage, 2);
};

export const buildPricePreview = (input: {
  salePrice: string;
  purchasePrice: string;
  gstRate: string;
  cessRate: string;
  taxType: ProductTaxType;
  priceTaxType: ProductPriceTaxType;
}): ProductPricePreview => {
  const taxPreview =
    input.priceTaxType === "inclusive"
      ? calculateTaxInclusive(input.salePrice, input.gstRate, input.cessRate, input.taxType)
      : calculateTaxExclusive(input.salePrice, input.gstRate, input.cessRate, input.taxType);
  const margin = calculateMargin(taxPreview.baseSalePrice, input.purchasePrice);
  const markupPercentage = calculateMarkup(input.purchasePrice, taxPreview.baseSalePrice);

  return {
    ...taxPreview,
    marginAmount: margin.marginAmount,
    marginPercentage: margin.marginPercentage,
    markupPercentage
  };
};

export const buildCsvBuffer = (headers: string[], rows: string[][]) => {
  const csvEscape = (value: string | null | undefined) => {
    const safeValue = value ?? "";
    if (/[",\n]/.test(safeValue)) {
      return `"${safeValue.replace(/"/g, "\"\"")}"`;
    }

    return safeValue;
  };

  const lines = [
    headers.map((header) => csvEscape(header)).join(","),
    ...rows.map((row) => row.map((entry) => csvEscape(entry)).join(","))
  ];

  return Buffer.from(`\uFEFF${lines.join("\n")}`, "utf-8");
};
