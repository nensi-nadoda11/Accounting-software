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
  return trimmed.length === 0 ? "0" : trimmed;
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

export const normalizeQuantity = (value: string | number | null | undefined): string =>
  scaledBigIntToDecimal(decimalToScaledBigInt(value, 3), 3);

export const normalizeMoney = (value: string | number | null | undefined): string =>
  scaledBigIntToDecimal(decimalToScaledBigInt(value, 2), 2);

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

export const addDecimals = (
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  scale: number
): string =>
  scaledBigIntToDecimal(decimalToScaledBigInt(left, scale) + decimalToScaledBigInt(right, scale), scale);

export const subtractDecimals = (
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  scale: number
): string =>
  scaledBigIntToDecimal(decimalToScaledBigInt(left, scale) - decimalToScaledBigInt(right, scale), scale);

export const multiplyQtyRate = (
  quantity: string | number | null | undefined,
  rate: string | number | null | undefined
): string => {
  const quantityValue = decimalToScaledBigInt(quantity, 3);
  const rateValue = decimalToScaledBigInt(rate, 2);
  return scaledBigIntToDecimal(roundHalfUp(quantityValue * rateValue, 1000n), 2);
};

export const calculateWeightedAverageCost = (
  oldQty: string | number | null | undefined,
  oldAvgCost: string | number | null | undefined,
  inQty: string | number | null | undefined,
  inRate: string | number | null | undefined
): string => {
  const oldQtyValue = decimalToScaledBigInt(oldQty, 3);
  const inQtyValue = decimalToScaledBigInt(inQty, 3);
  const totalQtyValue = oldQtyValue + inQtyValue;

  if (totalQtyValue <= 0n) {
    return "0.00";
  }

  const oldCostValue = decimalToScaledBigInt(oldAvgCost, 2);
  const inRateValue = decimalToScaledBigInt(inRate, 2);
  const numerator = oldQtyValue * oldCostValue + inQtyValue * inRateValue;

  return scaledBigIntToDecimal(roundHalfUp(numerator, totalQtyValue), 2);
};

export const calculateStockValue = (
  quantity: string | number | null | undefined,
  averageCost: string | number | null | undefined
): string => multiplyQtyRate(quantity, averageCost);

export const divideMoneyByQuantity = (
  totalValue: string | number | null | undefined,
  quantity: string | number | null | undefined
): string => {
  const totalValueScaled = decimalToScaledBigInt(totalValue, 2);
  const quantityScaled = decimalToScaledBigInt(quantity, 3);

  if (quantityScaled === 0n) {
    return "0.00";
  }

  return scaledBigIntToDecimal(roundHalfUp(totalValueScaled * 1000n, quantityScaled), 2);
};

export const isPositiveDecimal = (value: string | number | null | undefined, scale: number) =>
  compareDecimals(value, "0", scale) > 0;

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

export const toDateOnly = (value: Date | string) =>
  typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
