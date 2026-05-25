import { db } from "../../db";
import { suppliers } from "../../db/schema";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import { auditLogService } from "../audit-logs/audit-log.service";
import { buildReportFile } from "../reports/reports.export";
import type { ReportExportDataset } from "../reports/reports.types";
import { suppliersRepository } from "./suppliers.repository";
import type {
  BlacklistInput,
  CreateSupplierInput,
  ExportSuppliersQuery,
  LedgerExportQuery,
  LedgerQuery,
  ListSupplierQuery,
  PaymentsQuery,
  PreferredInput,
  PurchasesQuery,
  StatusInput,
  UpdateSupplierInput
} from "./suppliers.validator";
import type { SupplierActor, SupplierExportPayload, SupplierRequestContext } from "./suppliers.types";

type SupplierRecord = typeof suppliers.$inferSelect;

type ResolvedSupplierState = {
  name: string;
  supplierType: "individual" | "business" | "manufacturer" | "distributor" | "wholesaler";
  businessName: string | null;
  contactPerson: string | null;
  mobile: string;
  alternateMobile: string | null;
  email: string | null;
  website: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  tanNumber: string | null;
  taxType: "registered" | "unregistered" | "composition";
  gstState: string | null;
  reverseChargeApplicable: boolean;
  msmeRegistered: boolean;
  billingAddressLine1: string | null;
  billingAddressLine2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPincode: string | null;
  billingCountry: string;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPincode: string | null;
  shippingCountry: string;
  sameAsBilling: boolean;
  openingBalanceAmount: string;
  openingBalanceType: "debit" | "credit" | "none";
  creditLimit: string;
  creditDays: number;
  paymentTerms: string | null;
  defaultGstRate: string;
  defaultDiscount: string;
  bankName: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankBranch: string | null;
  upiId: string | null;
  status: "active" | "inactive" | "blocked";
  isPreferred: boolean;
  notes: string | null;
};

type SupplierStateInput = Omit<
  {
    [Key in keyof ResolvedSupplierState]?: ResolvedSupplierState[Key] | undefined;
  },
  | "openingBalanceAmount"
  | "creditLimit"
  | "defaultGstRate"
  | "defaultDiscount"
  | "status"
  | "billingCountry"
  | "shippingCountry"
> & {
  billingCountry?: string | null | undefined;
  shippingCountry?: string | null | undefined;
  openingBalanceAmount?: number | undefined;
  creditLimit?: number | undefined;
  defaultGstRate?: number | undefined;
  defaultDiscount?: number | undefined;
  status?: "active" | "inactive" | "blocked" | undefined;
};

type OutstandingSummary = {
  openingBalance: string;
  totalPurchases: string;
  totalPurchaseReturns: string;
  totalPaymentsMade: string;
  totalRefundsReceived: string;
  outstandingPayable: string;
  overduePayable: string;
  creditLimit: string;
  creditDays: number;
  dueInvoicesCount: number;
  isCreditLimitExceeded: boolean;
  remainingCreditLimit: string;
};

const MONEY_DECIMAL_REGEX = /^-?\d+(?:\.\d{1,2})?$/;

const pickDefined = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

const parseDecimalToCents = (value: string | number | null | undefined): bigint => {
  if (value === null || value === undefined) {
    return 0n;
  }

  const normalized = typeof value === "number" ? value.toFixed(2) : value.trim();
  if (!MONEY_DECIMAL_REGEX.test(normalized)) {
    throw new AppError("Invalid monetary amount", 400);
  }

  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [wholePart = "0", fractionPart = ""] = unsigned.split(".");
  const cents = BigInt(wholePart) * 100n + BigInt(fractionPart.padEnd(2, "0").slice(0, 2));

  return negative ? -cents : cents;
};

const formatCentsToDecimal = (value: bigint): string => {
  const negative = value < 0n;
  const absolute = negative ? value * -1n : value;
  const wholePart = absolute / 100n;
  const fractionPart = (absolute % 100n).toString().padStart(2, "0");

  return `${negative ? "-" : ""}${wholePart.toString()}.${fractionPart}`;
};

const normalizeDecimalString = (value: string | number | null | undefined): string =>
  formatCentsToDecimal(parseDecimalToCents(value));

class SuppliersService {
  private mapSupplier(supplier: SupplierRecord) {
    return {
      id: supplier.id,
      companyId: supplier.companyId,
      supplierCode: supplier.supplierCode,
      name: supplier.name,
      supplierType: supplier.supplierType,
      businessName: supplier.businessName,
      contactPerson: supplier.contactPerson,
      mobile: supplier.mobile,
      alternateMobile: supplier.alternateMobile,
      email: supplier.email,
      website: supplier.website,
      gstNumber: supplier.gstNumber,
      panNumber: supplier.panNumber,
      tanNumber: supplier.tanNumber,
      taxType: supplier.taxType,
      gstState: supplier.gstState,
      reverseChargeApplicable: supplier.reverseChargeApplicable,
      msmeRegistered: supplier.msmeRegistered,
      billingAddressLine1: supplier.billingAddressLine1,
      billingAddressLine2: supplier.billingAddressLine2,
      billingCity: supplier.billingCity,
      billingState: supplier.billingState,
      billingPincode: supplier.billingPincode,
      billingCountry: supplier.billingCountry,
      shippingAddressLine1: supplier.shippingAddressLine1,
      shippingAddressLine2: supplier.shippingAddressLine2,
      shippingCity: supplier.shippingCity,
      shippingState: supplier.shippingState,
      shippingPincode: supplier.shippingPincode,
      shippingCountry: supplier.shippingCountry,
      sameAsBilling: supplier.sameAsBilling,
      openingBalanceAmount: normalizeDecimalString(supplier.openingBalanceAmount),
      openingBalanceType: supplier.openingBalanceType,
      creditLimit: normalizeDecimalString(supplier.creditLimit),
      creditDays: supplier.creditDays,
      paymentTerms: supplier.paymentTerms,
      defaultGstRate: normalizeDecimalString(supplier.defaultGstRate),
      defaultDiscount: normalizeDecimalString(supplier.defaultDiscount),
      bankName: supplier.bankName,
      accountHolderName: supplier.accountHolderName,
      accountNumber: supplier.accountNumber,
      ifscCode: supplier.ifscCode,
      bankBranch: supplier.bankBranch,
      upiId: supplier.upiId,
      status: supplier.status,
      isBlacklisted: supplier.isBlacklisted,
      isPreferred: supplier.isPreferred,
      notes: supplier.notes,
      createdBy: supplier.createdBy,
      updatedBy: supplier.updatedBy,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      deletedAt: supplier.deletedAt
    };
  }

  private getDefaultState(): ResolvedSupplierState {
    return {
      name: "",
      supplierType: "business",
      businessName: null,
      contactPerson: null,
      mobile: "",
      alternateMobile: null,
      email: null,
      website: null,
      gstNumber: null,
      panNumber: null,
      tanNumber: null,
      taxType: "unregistered",
      gstState: null,
      reverseChargeApplicable: false,
      msmeRegistered: false,
      billingAddressLine1: null,
      billingAddressLine2: null,
      billingCity: null,
      billingState: null,
      billingPincode: null,
      billingCountry: "India",
      shippingAddressLine1: null,
      shippingAddressLine2: null,
      shippingCity: null,
      shippingState: null,
      shippingPincode: null,
      shippingCountry: "India",
      sameAsBilling: true,
      openingBalanceAmount: "0.00",
      openingBalanceType: "none",
      creditLimit: "0.00",
      creditDays: 0,
      paymentTerms: null,
      defaultGstRate: "0.00",
      defaultDiscount: "0.00",
      bankName: null,
      accountHolderName: null,
      accountNumber: null,
      ifscCode: null,
      bankBranch: null,
      upiId: null,
      status: "active",
      isPreferred: false,
      notes: null
    };
  }

  private buildStateFromSupplier(supplier: SupplierRecord): ResolvedSupplierState {
    return {
      name: supplier.name,
      supplierType: supplier.supplierType,
      businessName: supplier.businessName,
      contactPerson: supplier.contactPerson,
      mobile: supplier.mobile,
      alternateMobile: supplier.alternateMobile,
      email: supplier.email,
      website: supplier.website,
      gstNumber: supplier.gstNumber,
      panNumber: supplier.panNumber,
      tanNumber: supplier.tanNumber,
      taxType: supplier.taxType,
      gstState: supplier.gstState,
      reverseChargeApplicable: supplier.reverseChargeApplicable,
      msmeRegistered: supplier.msmeRegistered,
      billingAddressLine1: supplier.billingAddressLine1,
      billingAddressLine2: supplier.billingAddressLine2,
      billingCity: supplier.billingCity,
      billingState: supplier.billingState,
      billingPincode: supplier.billingPincode,
      billingCountry: supplier.billingCountry,
      shippingAddressLine1: supplier.shippingAddressLine1,
      shippingAddressLine2: supplier.shippingAddressLine2,
      shippingCity: supplier.shippingCity,
      shippingState: supplier.shippingState,
      shippingPincode: supplier.shippingPincode,
      shippingCountry: supplier.shippingCountry,
      sameAsBilling: supplier.sameAsBilling,
      openingBalanceAmount: normalizeDecimalString(supplier.openingBalanceAmount),
      openingBalanceType: supplier.openingBalanceType,
      creditLimit: normalizeDecimalString(supplier.creditLimit),
      creditDays: supplier.creditDays,
      paymentTerms: supplier.paymentTerms,
      defaultGstRate: normalizeDecimalString(supplier.defaultGstRate),
      defaultDiscount: normalizeDecimalString(supplier.defaultDiscount),
      bankName: supplier.bankName,
      accountHolderName: supplier.accountHolderName,
      accountNumber: supplier.accountNumber,
      ifscCode: supplier.ifscCode,
      bankBranch: supplier.bankBranch,
      upiId: supplier.upiId,
      status: supplier.status === "deleted" ? "blocked" : supplier.status,
      isPreferred: supplier.isPreferred,
      notes: supplier.notes
    };
  }

  private resolveState(input: SupplierStateInput, baseState: ResolvedSupplierState): ResolvedSupplierState {
    const nextState = {
      ...baseState,
      ...pickDefined({
        name: input.name,
        supplierType: input.supplierType,
        businessName: input.businessName,
        contactPerson: input.contactPerson,
        mobile: input.mobile,
        alternateMobile: input.alternateMobile,
        email: input.email,
        website: input.website,
        gstNumber: input.gstNumber,
        panNumber: input.panNumber,
        tanNumber: input.tanNumber,
        taxType: input.taxType,
        gstState: input.gstState,
        reverseChargeApplicable: input.reverseChargeApplicable,
        msmeRegistered: input.msmeRegistered,
        billingAddressLine1: input.billingAddressLine1,
        billingAddressLine2: input.billingAddressLine2,
        billingCity: input.billingCity,
        billingState: input.billingState,
        billingPincode: input.billingPincode,
        billingCountry: input.billingCountry ?? undefined,
        shippingAddressLine1: input.shippingAddressLine1,
        shippingAddressLine2: input.shippingAddressLine2,
        shippingCity: input.shippingCity,
        shippingState: input.shippingState,
        shippingPincode: input.shippingPincode,
        shippingCountry: input.shippingCountry ?? undefined,
        sameAsBilling: input.sameAsBilling,
        openingBalanceAmount:
          input.openingBalanceAmount !== undefined
            ? normalizeDecimalString(input.openingBalanceAmount)
            : undefined,
        openingBalanceType: input.openingBalanceType,
        creditLimit: input.creditLimit !== undefined ? normalizeDecimalString(input.creditLimit) : undefined,
        creditDays: input.creditDays,
        paymentTerms: input.paymentTerms,
        defaultGstRate:
          input.defaultGstRate !== undefined ? normalizeDecimalString(input.defaultGstRate) : undefined,
        defaultDiscount:
          input.defaultDiscount !== undefined ? normalizeDecimalString(input.defaultDiscount) : undefined,
        bankName: input.bankName,
        accountHolderName: input.accountHolderName,
        accountNumber: input.accountNumber,
        ifscCode: input.ifscCode,
        bankBranch: input.bankBranch,
        upiId: input.upiId,
        status: input.status,
        isPreferred: input.isPreferred,
        notes: input.notes
      })
    } as ResolvedSupplierState;

    if (nextState.sameAsBilling) {
      nextState.shippingAddressLine1 = nextState.billingAddressLine1;
      nextState.shippingAddressLine2 = nextState.billingAddressLine2;
      nextState.shippingCity = nextState.billingCity;
      nextState.shippingState = nextState.billingState;
      nextState.shippingPincode = nextState.billingPincode;
      nextState.shippingCountry = nextState.billingCountry;
    }

    return nextState;
  }

  private assertState(state: ResolvedSupplierState) {
    if (state.name.trim().length < 2) {
      throw new AppError("Supplier name must be at least 2 characters long", 400);
    }

    if (state.alternateMobile && state.alternateMobile === state.mobile) {
      throw new AppError("Alternate mobile cannot be the same as mobile", 400);
    }

    if (state.gstNumber && state.panNumber && state.gstNumber.slice(2, 12) !== state.panNumber) {
      throw new AppError("PAN must match the PAN section of GST number", 400);
    }

    const openingBalanceAmount = parseDecimalToCents(state.openingBalanceAmount);
    if (openingBalanceAmount > 0n && state.openingBalanceType === "none") {
      throw new AppError("Opening balance type must be debit or credit when amount is greater than 0", 400);
    }

    if (openingBalanceAmount === 0n && state.openingBalanceType !== "none") {
      throw new AppError("Opening balance type must be none when amount is 0", 400);
    }

    const billingHasAddress = [
      state.billingAddressLine1,
      state.billingAddressLine2,
      state.billingCity,
      state.billingState,
      state.billingCountry
    ].some((entry) => Boolean(entry));

    if (billingHasAddress && !state.billingPincode) {
      throw new AppError("Billing pincode is required when billing address is provided", 400);
    }

    const shippingHasAddress = [
      state.shippingAddressLine1,
      state.shippingAddressLine2,
      state.shippingCity,
      state.shippingState,
      state.shippingCountry
    ].some((entry) => Boolean(entry));

    if (!state.sameAsBilling && shippingHasAddress && !state.shippingPincode) {
      throw new AppError("Shipping pincode is required when shipping address is provided", 400);
    }
  }

  private async assertUniqueFields(
    companyId: string,
    state: Pick<ResolvedSupplierState, "mobile" | "email">,
    excludeId?: string,
    executor?: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) {
    const [mobileOwner, emailOwner] = await Promise.all([
      suppliersRepository.findByMobile(companyId, state.mobile, excludeId, executor),
      state.email ? suppliersRepository.findByEmail(companyId, state.email, excludeId, executor) : Promise.resolve(null)
    ]);

    if (mobileOwner) {
      throw new AppError("A supplier with this mobile number already exists", 409);
    }

    if (emailOwner) {
      throw new AppError("A supplier with this email already exists", 409);
    }
  }

  private async getSupplierOrThrow(companyId: string, supplierId: string, includeDeleted = false) {
    const supplier = await suppliersRepository.findById(companyId, supplierId, includeDeleted);
    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }

    return supplier;
  }

  private buildOutstandingSummary(
    supplier: Pick<SupplierRecord, "openingBalanceAmount" | "openingBalanceType" | "creditLimit" | "creditDays">,
    totals: {
      totalPurchases: string;
      totalPurchaseReturns: string;
      totalPaymentsMade: string;
      totalRefundsReceived: string;
      debitAdjustments: string;
      creditAdjustments: string;
      overduePayable: string;
      dueInvoicesCount: number;
    }
  ): OutstandingSummary {
    const openingAmount = parseDecimalToCents(supplier.openingBalanceAmount);
    const signedOpeningBalance =
      supplier.openingBalanceType === "credit"
        ? openingAmount
        : supplier.openingBalanceType === "debit"
          ? openingAmount * -1n
          : 0n;
    const totalPurchases = parseDecimalToCents(totals.totalPurchases);
    const totalPurchaseReturns = parseDecimalToCents(totals.totalPurchaseReturns);
    const totalPaymentsMade = parseDecimalToCents(totals.totalPaymentsMade);
    const totalRefundsReceived = parseDecimalToCents(totals.totalRefundsReceived);
    const debitAdjustments = parseDecimalToCents(totals.debitAdjustments);
    const creditAdjustments = parseDecimalToCents(totals.creditAdjustments);
    const overduePayable = parseDecimalToCents(totals.overduePayable);
    const outstandingPayable =
      signedOpeningBalance +
      totalPurchases -
      totalPurchaseReturns -
      totalPaymentsMade +
      totalRefundsReceived +
      creditAdjustments -
      debitAdjustments;
    const creditLimit = parseDecimalToCents(supplier.creditLimit);
    const usedPayable = outstandingPayable > 0n ? outstandingPayable : 0n;
    const remainingCreditLimit = creditLimit - usedPayable;

    return {
      openingBalance: formatCentsToDecimal(signedOpeningBalance),
      totalPurchases: formatCentsToDecimal(totalPurchases),
      totalPurchaseReturns: formatCentsToDecimal(totalPurchaseReturns),
      totalPaymentsMade: formatCentsToDecimal(totalPaymentsMade),
      totalRefundsReceived: formatCentsToDecimal(totalRefundsReceived),
      outstandingPayable: formatCentsToDecimal(outstandingPayable),
      overduePayable: formatCentsToDecimal(overduePayable),
      creditLimit: formatCentsToDecimal(creditLimit),
      creditDays: supplier.creditDays,
      dueInvoicesCount: totals.dueInvoicesCount,
      isCreditLimitExceeded: usedPayable > creditLimit,
      remainingCreditLimit: formatCentsToDecimal(remainingCreditLimit)
    };
  }

  private buildNextSupplierCode(previousCode: string | null): string {
    const lastSequence = previousCode ? Number(previousCode.replace("SUP-", "")) : 0;
    const nextSequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;
    return `SUP-${String(nextSequence).padStart(6, "0")}`;
  }

  private isSupplierCodeConflict(error: unknown): boolean {
    const databaseError = error as { code?: string; constraint?: string };
    return (
      databaseError?.code === "23505" &&
      databaseError.constraint === "suppliers_company_supplier_code_unique_idx"
    );
  }

  private async buildLedgerRows(
    supplier: SupplierRecord,
    query: {
      dateFrom?: Date | undefined;
      dateTo?: Date | undefined;
      transactionType?: string | undefined;
    }
  ) {
    const ledgerTransactions = await suppliersRepository.listLedgerTransactions(supplier.companyId, supplier.id, query);
    const openingBalanceAmount = parseDecimalToCents(supplier.openingBalanceAmount);
    let runningBalance =
      supplier.openingBalanceType === "credit"
        ? openingBalanceAmount
        : supplier.openingBalanceType === "debit"
          ? openingBalanceAmount * -1n
          : 0n;

    const openingRow = {
      date: supplier.createdAt,
      createdAt: supplier.createdAt,
      transactionType: "opening_balance",
      referenceNo: supplier.supplierCode,
      description: "Opening balance",
      debit:
        supplier.openingBalanceType === "debit" ? formatCentsToDecimal(openingBalanceAmount) : "0.00",
      credit:
        supplier.openingBalanceType === "credit" ? formatCentsToDecimal(openingBalanceAmount) : "0.00",
      balance: formatCentsToDecimal(runningBalance),
      paymentMode: null as string | null,
      remarks: supplier.notes
    };

    const computedRows = ledgerTransactions.rows.map((row) => {
      runningBalance += parseDecimalToCents(row.credit) - parseDecimalToCents(row.debit);

      return {
        ...row,
        balance: formatCentsToDecimal(runningBalance)
      };
    });

    return [openingRow, ...computedRows];
  }

  public async listSuppliers(actor: Pick<SupplierActor, "companyId">, query: ListSupplierQuery) {
    const pagination = getPagination(query.page, query.limit);
    const params: {
      companyId: string;
      page: number;
      limit: number;
      search?: string | null;
      status?: "active" | "inactive" | "blocked" | "deleted";
      supplierType?: "individual" | "business" | "manufacturer" | "distributor" | "wholesaler";
      taxType?: "registered" | "unregistered" | "composition";
      hasOutstanding?: boolean;
      isBlacklisted?: boolean;
      isPreferred?: boolean;
      sortBy: "name" | "createdAt" | "outstandingPayable" | "supplierCode";
      sortOrder: "asc" | "desc";
    } = {
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder
    };

    if (query.search !== undefined && query.search !== null) {
      params.search = query.search;
    }

    if (query.status !== undefined) {
      params.status = query.status;
    }

    if (query.supplierType !== undefined) {
      params.supplierType = query.supplierType;
    }

    if (query.taxType !== undefined) {
      params.taxType = query.taxType;
    }

    if (query.hasOutstanding !== undefined) {
      params.hasOutstanding = query.hasOutstanding;
    }

    if (query.isBlacklisted !== undefined) {
      params.isBlacklisted = query.isBlacklisted;
    }

    if (query.isPreferred !== undefined) {
      params.isPreferred = query.isPreferred;
    }

    const result = await suppliersRepository.listSuppliers(params);

    return {
      items: result.rows.map((supplier) => ({
        id: supplier.id,
        supplierCode: supplier.supplierCode,
        name: supplier.name,
        supplierType: supplier.supplierType,
        businessName: supplier.businessName,
        mobile: supplier.mobile,
        email: supplier.email,
        gstNumber: supplier.gstNumber,
        taxType: supplier.taxType,
        status: supplier.status,
        isBlacklisted: supplier.isBlacklisted,
        isPreferred: supplier.isPreferred,
        creditDays: supplier.creditDays,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,
        outstandingSummary: this.buildOutstandingSummary(supplier, {
          totalPurchases: "0.00",
          totalPurchaseReturns: "0.00",
          totalPaymentsMade: "0.00",
          totalRefundsReceived: "0.00",
          debitAdjustments: "0.00",
          creditAdjustments: "0.00",
          overduePayable: "0.00",
          dueInvoicesCount: 0
        })
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createSupplier(actor: SupplierActor, input: CreateSupplierInput, context: SupplierRequestContext) {
    const baseState = this.getDefaultState();
    const state = this.resolveState(input, baseState);
    this.assertState(state);

    let createdSupplier: SupplierRecord | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        createdSupplier = await db.transaction(async (transaction) => {
          await this.assertUniqueFields(actor.companyId, state, undefined, transaction);
          await suppliersRepository.acquireSupplierCodeLock(actor.companyId, transaction);
          const supplierCode = this.buildNextSupplierCode(
            await suppliersRepository.findLatestSupplierCode(actor.companyId, transaction)
          );

          const created = await suppliersRepository.createSupplier(
            {
              companyId: actor.companyId,
              supplierCode,
              name: state.name,
              supplierType: state.supplierType,
              businessName: state.businessName,
              contactPerson: state.contactPerson,
              mobile: state.mobile,
              alternateMobile: state.alternateMobile,
              email: state.email,
              website: state.website,
              gstNumber: state.gstNumber,
              panNumber: state.panNumber,
              tanNumber: state.tanNumber,
              taxType: state.taxType,
              gstState: state.gstState,
              reverseChargeApplicable: state.reverseChargeApplicable,
              msmeRegistered: state.msmeRegistered,
              billingAddressLine1: state.billingAddressLine1,
              billingAddressLine2: state.billingAddressLine2,
              billingCity: state.billingCity,
              billingState: state.billingState,
              billingPincode: state.billingPincode,
              billingCountry: state.billingCountry,
              shippingAddressLine1: state.shippingAddressLine1,
              shippingAddressLine2: state.shippingAddressLine2,
              shippingCity: state.shippingCity,
              shippingState: state.shippingState,
              shippingPincode: state.shippingPincode,
              shippingCountry: state.shippingCountry,
              sameAsBilling: state.sameAsBilling,
              openingBalanceAmount: state.openingBalanceAmount,
              openingBalanceType: state.openingBalanceType,
              creditLimit: state.creditLimit,
              creditDays: state.creditDays,
              paymentTerms: state.paymentTerms,
              defaultGstRate: state.defaultGstRate,
              defaultDiscount: state.defaultDiscount,
              bankName: state.bankName,
              accountHolderName: state.accountHolderName,
              accountNumber: state.accountNumber,
              ifscCode: state.ifscCode,
              bankBranch: state.bankBranch,
              upiId: state.upiId,
              status: state.status,
              isBlacklisted: false,
              isPreferred: state.isPreferred,
              notes: state.notes,
              createdBy: actor.id,
              updatedBy: actor.id
            },
            transaction
          );

          if (!created) {
            throw new AppError("Failed to create supplier", 500);
          }

          return created;
        });

        break;
      } catch (error) {
        if (attempt < 2 && this.isSupplierCodeConflict(error)) {
          continue;
        }

        throw error;
      }
    }

    if (!createdSupplier) {
      throw new AppError("Failed to create supplier", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "supplier_created",
      entityType: "supplier",
      entityId: createdSupplier.id,
      metadata: {
        supplierCode: createdSupplier.supplierCode,
        name: createdSupplier.name
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      supplier: this.mapSupplier(createdSupplier),
      outstandingSummary: this.buildOutstandingSummary(createdSupplier, {
        totalPurchases: "0.00",
        totalPurchaseReturns: "0.00",
        totalPaymentsMade: "0.00",
        totalRefundsReceived: "0.00",
        debitAdjustments: "0.00",
        creditAdjustments: "0.00",
        overduePayable: "0.00",
        dueInvoicesCount: 0
      })
    };
  }

  public async getSupplier(actor: Pick<SupplierActor, "companyId">, supplierId: string) {
    const supplier = await this.getSupplierOrThrow(actor.companyId, supplierId);
    const totals = await suppliersRepository.getSupplierTransactionTotals(actor.companyId, supplierId);

    return {
      supplier: this.mapSupplier(supplier),
      outstandingSummary: this.buildOutstandingSummary(supplier, totals)
    };
  }

  public async updateSupplier(
    actor: SupplierActor,
    supplierId: string,
    input: UpdateSupplierInput,
    context: SupplierRequestContext
  ) {
    const existingSupplier = await this.getSupplierOrThrow(actor.companyId, supplierId, true);
    if (existingSupplier.deletedAt || existingSupplier.status === "deleted") {
      throw new AppError("Deleted suppliers cannot be updated", 400);
    }

    const previousState = this.buildStateFromSupplier(existingSupplier);
    const nextState = this.resolveState(input, previousState);
    this.assertState(nextState);

    const updatedSupplier = await db.transaction(async (transaction) => {
      if (nextState.mobile !== previousState.mobile || nextState.email !== previousState.email) {
        await this.assertUniqueFields(actor.companyId, nextState, supplierId, transaction);
      }

      const updated = await suppliersRepository.updateSupplier(
        actor.companyId,
        supplierId,
        {
          name: nextState.name,
          supplierType: nextState.supplierType,
          businessName: nextState.businessName,
          contactPerson: nextState.contactPerson,
          mobile: nextState.mobile,
          alternateMobile: nextState.alternateMobile,
          email: nextState.email,
          website: nextState.website,
          gstNumber: nextState.gstNumber,
          panNumber: nextState.panNumber,
          tanNumber: nextState.tanNumber,
          taxType: nextState.taxType,
          gstState: nextState.gstState,
          reverseChargeApplicable: nextState.reverseChargeApplicable,
          msmeRegistered: nextState.msmeRegistered,
          billingAddressLine1: nextState.billingAddressLine1,
          billingAddressLine2: nextState.billingAddressLine2,
          billingCity: nextState.billingCity,
          billingState: nextState.billingState,
          billingPincode: nextState.billingPincode,
          billingCountry: nextState.billingCountry,
          shippingAddressLine1: nextState.shippingAddressLine1,
          shippingAddressLine2: nextState.shippingAddressLine2,
          shippingCity: nextState.shippingCity,
          shippingState: nextState.shippingState,
          shippingPincode: nextState.shippingPincode,
          shippingCountry: nextState.shippingCountry,
          sameAsBilling: nextState.sameAsBilling,
          openingBalanceAmount: nextState.openingBalanceAmount,
          openingBalanceType: nextState.openingBalanceType,
          creditLimit: nextState.creditLimit,
          creditDays: nextState.creditDays,
          paymentTerms: nextState.paymentTerms,
          defaultGstRate: nextState.defaultGstRate,
          defaultDiscount: nextState.defaultDiscount,
          bankName: nextState.bankName,
          accountHolderName: nextState.accountHolderName,
          accountNumber: nextState.accountNumber,
          ifscCode: nextState.ifscCode,
          bankBranch: nextState.bankBranch,
          upiId: nextState.upiId,
          notes: nextState.notes,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update supplier", 500);
      }

      return updated;
    });

    const changedFields = Object.keys(input);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "supplier_updated",
      entityType: "supplier",
      entityId: updatedSupplier.id,
      metadata: {
        fields: changedFields
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    const bankFieldsChanged =
      previousState.bankName !== nextState.bankName ||
      previousState.accountHolderName !== nextState.accountHolderName ||
      previousState.accountNumber !== nextState.accountNumber ||
      previousState.ifscCode !== nextState.ifscCode ||
      previousState.bankBranch !== nextState.bankBranch ||
      previousState.upiId !== nextState.upiId;

    if (bankFieldsChanged) {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "supplier_bank_detail_changed",
        entityType: "supplier",
        entityId: updatedSupplier.id,
        metadata: {
          previous: {
            bankName: previousState.bankName,
            accountHolderName: previousState.accountHolderName,
            accountNumber: previousState.accountNumber,
            ifscCode: previousState.ifscCode,
            bankBranch: previousState.bankBranch,
            upiId: previousState.upiId
          },
          current: {
            bankName: nextState.bankName,
            accountHolderName: nextState.accountHolderName,
            accountNumber: nextState.accountNumber,
            ifscCode: nextState.ifscCode,
            bankBranch: nextState.bankBranch,
            upiId: nextState.upiId
          }
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
    }

    const creditTermsChanged =
      previousState.creditLimit !== nextState.creditLimit ||
      previousState.creditDays !== nextState.creditDays ||
      previousState.paymentTerms !== nextState.paymentTerms ||
      previousState.defaultGstRate !== nextState.defaultGstRate ||
      previousState.defaultDiscount !== nextState.defaultDiscount;

    if (creditTermsChanged) {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "supplier_credit_terms_changed",
        entityType: "supplier",
        entityId: updatedSupplier.id,
        metadata: {
          previous: {
            creditLimit: previousState.creditLimit,
            creditDays: previousState.creditDays,
            paymentTerms: previousState.paymentTerms,
            defaultGstRate: previousState.defaultGstRate,
            defaultDiscount: previousState.defaultDiscount
          },
          current: {
            creditLimit: nextState.creditLimit,
            creditDays: nextState.creditDays,
            paymentTerms: nextState.paymentTerms,
            defaultGstRate: nextState.defaultGstRate,
            defaultDiscount: nextState.defaultDiscount
          }
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
    }

    if (
      previousState.openingBalanceAmount !== nextState.openingBalanceAmount ||
      previousState.openingBalanceType !== nextState.openingBalanceType
    ) {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "supplier_opening_balance_changed",
        entityType: "supplier",
        entityId: updatedSupplier.id,
        metadata: {
          previousOpeningBalanceAmount: previousState.openingBalanceAmount,
          previousOpeningBalanceType: previousState.openingBalanceType,
          openingBalanceAmount: nextState.openingBalanceAmount,
          openingBalanceType: nextState.openingBalanceType
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
    }

    const totals = await suppliersRepository.getSupplierTransactionTotals(actor.companyId, supplierId);
    return {
      supplier: this.mapSupplier(updatedSupplier),
      outstandingSummary: this.buildOutstandingSummary(updatedSupplier, totals)
    };
  }

  public async deleteSupplier(actor: SupplierActor, supplierId: string, context: SupplierRequestContext) {
    const existingSupplier = await this.getSupplierOrThrow(actor.companyId, supplierId, true);
    if (existingSupplier.deletedAt || existingSupplier.status === "deleted") {
      throw new AppError("Supplier is already deleted", 400);
    }

    const hasLinkedTransactions = await suppliersRepository.hasLinkedTransactions(actor.companyId, supplierId);
    const deletedSupplier = await db.transaction(async (transaction) => {
      const deleted = await suppliersRepository.softDeleteSupplier(actor.companyId, supplierId, actor.id, transaction);

      if (!deleted) {
        throw new AppError("Failed to delete supplier", 500);
      }

      return deleted;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "supplier_deleted",
      entityType: "supplier",
      entityId: deletedSupplier.id,
      metadata: {
        supplierCode: deletedSupplier.supplierCode,
        hadLinkedTransactions: hasLinkedTransactions
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async updateStatus(
    actor: SupplierActor,
    supplierId: string,
    input: StatusInput,
    context: SupplierRequestContext
  ) {
    const existingSupplier = await this.getSupplierOrThrow(actor.companyId, supplierId, true);
    if (existingSupplier.deletedAt || existingSupplier.status === "deleted") {
      throw new AppError("Deleted suppliers cannot be reactivated from this endpoint", 400);
    }

    const updatedSupplier = await suppliersRepository.updateSupplier(actor.companyId, supplierId, {
      status: input.status,
      updatedBy: actor.id
    });

    if (!updatedSupplier) {
      throw new AppError("Failed to update supplier status", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "supplier_status_changed",
      entityType: "supplier",
      entityId: updatedSupplier.id,
      metadata: {
        previousStatus: existingSupplier.status,
        status: input.status
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      supplier: this.mapSupplier(updatedSupplier)
    };
  }

  public async updateBlacklist(
    actor: SupplierActor,
    supplierId: string,
    input: BlacklistInput,
    context: SupplierRequestContext
  ) {
    const existingSupplier = await this.getSupplierOrThrow(actor.companyId, supplierId, true);
    if (existingSupplier.deletedAt || existingSupplier.status === "deleted") {
      throw new AppError("Deleted suppliers cannot be blacklisted", 400);
    }

    const updatedSupplier = await suppliersRepository.updateSupplier(actor.companyId, supplierId, {
      isBlacklisted: input.isBlacklisted,
      updatedBy: actor.id
    });

    if (!updatedSupplier) {
      throw new AppError("Failed to update supplier blacklist status", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "supplier_blacklist_changed",
      entityType: "supplier",
      entityId: updatedSupplier.id,
      metadata: {
        previousIsBlacklisted: existingSupplier.isBlacklisted,
        isBlacklisted: input.isBlacklisted,
        reason: input.reason ?? null
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      supplier: this.mapSupplier(updatedSupplier)
    };
  }

  public async updatePreferred(
    actor: SupplierActor,
    supplierId: string,
    input: PreferredInput,
    context: SupplierRequestContext
  ) {
    const existingSupplier = await this.getSupplierOrThrow(actor.companyId, supplierId, true);
    if (existingSupplier.deletedAt || existingSupplier.status === "deleted") {
      throw new AppError("Deleted suppliers cannot be marked preferred", 400);
    }

    const updatedSupplier = await suppliersRepository.updateSupplier(actor.companyId, supplierId, {
      isPreferred: input.isPreferred,
      updatedBy: actor.id
    });

    if (!updatedSupplier) {
      throw new AppError("Failed to update supplier preferred status", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "supplier_preferred_changed",
      entityType: "supplier",
      entityId: updatedSupplier.id,
      metadata: {
        previousIsPreferred: existingSupplier.isPreferred,
        isPreferred: input.isPreferred
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      supplier: this.mapSupplier(updatedSupplier)
    };
  }

  public async getOutstanding(actor: Pick<SupplierActor, "companyId">, supplierId: string) {
    const supplier = await this.getSupplierOrThrow(actor.companyId, supplierId);
    const totals = await suppliersRepository.getSupplierTransactionTotals(actor.companyId, supplierId);
    return this.buildOutstandingSummary(supplier, totals);
  }

  public async getLedger(
    actor: SupplierActor,
    supplierId: string,
    query: LedgerQuery,
    context: SupplierRequestContext
  ) {
    const supplier = await this.getSupplierOrThrow(actor.companyId, supplierId);
    const pagination = getPagination(query.page, query.limit);
    const allRows = await this.buildLedgerRows(supplier, query);
    const items = allRows.slice(pagination.offset, pagination.offset + pagination.limit);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "supplier_ledger_viewed",
      entityType: "supplier",
      entityId: supplier.id,
      metadata: {
        dateFrom: query.dateFrom?.toISOString() ?? null,
        dateTo: query.dateTo?.toISOString() ?? null,
        transactionType: query.transactionType ?? null,
        page: pagination.page,
        limit: pagination.limit
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      items,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: allRows.length,
        totalPages: Math.ceil(allRows.length / pagination.limit) || 1
      }
    };
  }

  public async getPurchases(
    actor: SupplierActor,
    supplierId: string,
    query: PurchasesQuery,
    context: SupplierRequestContext
  ) {
    const supplier = await this.getSupplierOrThrow(actor.companyId, supplierId);
    const pagination = getPagination(query.page, query.limit);
    const purchaseHistory = await suppliersRepository.listPurchaseHistory(actor.companyId, supplierId, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      status: query.status
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "supplier_purchase_history_viewed",
      entityType: "supplier",
      entityId: supplier.id,
      metadata: {
        dateFrom: query.dateFrom?.toISOString() ?? null,
        dateTo: query.dateTo?.toISOString() ?? null,
        status: query.status ?? null,
        page: pagination.page,
        limit: pagination.limit
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      items: purchaseHistory.rows,
      totals: {
        totalPurchases: purchaseHistory.totalPurchases,
        totalPurchaseReturns: purchaseHistory.totalPurchaseReturns
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: purchaseHistory.total,
        totalPages: Math.ceil(purchaseHistory.total / pagination.limit) || 1
      }
    };
  }

  public async getPayments(actor: Pick<SupplierActor, "companyId">, supplierId: string, query: PaymentsQuery) {
    await this.getSupplierOrThrow(actor.companyId, supplierId);
    const pagination = getPagination(query.page, query.limit);
    const paymentHistory = await suppliersRepository.listPaymentHistory(actor.companyId, supplierId, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo
    });

    return {
      items: paymentHistory.rows,
      totals: {
        totalPaymentsMade: paymentHistory.totalAmount
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: paymentHistory.total,
        totalPages: Math.ceil(paymentHistory.total / pagination.limit) || 1
      }
    };
  }

  public async exportSuppliers(
    actor: SupplierActor,
    query: ExportSuppliersQuery,
    context: SupplierRequestContext
  ): Promise<SupplierExportPayload> {
    const params: {
      companyId: string;
      search?: string | null;
      status?: "active" | "inactive" | "blocked" | "deleted";
      supplierType?: "individual" | "business" | "manufacturer" | "distributor" | "wholesaler";
      taxType?: "registered" | "unregistered" | "composition";
      hasOutstanding?: boolean;
      isBlacklisted?: boolean;
      isPreferred?: boolean;
      sortBy: "name" | "createdAt" | "outstandingPayable" | "supplierCode";
      sortOrder: "asc" | "desc";
    } = {
      companyId: actor.companyId,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder
    };

    if (query.search !== undefined && query.search !== null) {
      params.search = query.search;
    }

    if (query.status !== undefined) {
      params.status = query.status;
    }

    if (query.supplierType !== undefined) {
      params.supplierType = query.supplierType;
    }

    if (query.taxType !== undefined) {
      params.taxType = query.taxType;
    }

    if (query.hasOutstanding !== undefined) {
      params.hasOutstanding = query.hasOutstanding;
    }

    if (query.isBlacklisted !== undefined) {
      params.isBlacklisted = query.isBlacklisted;
    }

    if (query.isPreferred !== undefined) {
      params.isPreferred = query.isPreferred;
    }

    const rows = await suppliersRepository.listSuppliersForExport(params);

    const dataset: ReportExportDataset = {
      title: "Suppliers",
      columns: [
        { key: "supplierCode", label: "Supplier Code" },
        { key: "name", label: "Name" },
        { key: "supplierType", label: "Supplier Type" },
        { key: "businessName", label: "Business Name" },
        { key: "mobile", label: "Mobile" },
        { key: "email", label: "Email" },
        { key: "gstNumber", label: "GST Number" },
        { key: "taxType", label: "Tax Type" },
        { key: "status", label: "Status" },
        { key: "isBlacklisted", label: "Blacklisted" },
        { key: "isPreferred", label: "Preferred" },
        { key: "creditLimit", label: "Credit Limit", type: "number" },
        { key: "outstandingPayable", label: "Outstanding Payable", type: "number" },
        { key: "createdAt", label: "Created At" }
      ],
      rows: rows.map((supplier) => {
        const summary = this.buildOutstandingSummary(supplier, {
          totalPurchases: "0.00",
          totalPurchaseReturns: "0.00",
          totalPaymentsMade: "0.00",
          totalRefundsReceived: "0.00",
          debitAdjustments: "0.00",
          creditAdjustments: "0.00",
          overduePayable: "0.00",
          dueInvoicesCount: 0
        });

        return {
          supplierCode: supplier.supplierCode,
          name: supplier.name,
          supplierType: supplier.supplierType,
          businessName: supplier.businessName ?? "",
          mobile: supplier.mobile,
          email: supplier.email ?? "",
          gstNumber: supplier.gstNumber ?? "",
          taxType: supplier.taxType,
          status: supplier.status,
          isBlacklisted: supplier.isBlacklisted ? "Yes" : "No",
          isPreferred: supplier.isPreferred ? "Yes" : "No",
          creditLimit: normalizeDecimalString(supplier.creditLimit),
          outstandingPayable: summary.outstandingPayable,
          createdAt: supplier.createdAt.toISOString()
        };
      })
    };
    const file = buildReportFile(dataset, query.format, `suppliers-${new Date().toISOString().slice(0, 10)}`);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "supplier_exported",
      entityType: "supplier",
      metadata: {
        format: query.format,
        rowCount: rows.length,
        filters: {
          status: query.status ?? null,
          supplierType: query.supplierType ?? null,
          taxType: query.taxType ?? null,
          hasOutstanding: query.hasOutstanding ?? null,
          isBlacklisted: query.isBlacklisted ?? null,
          isPreferred: query.isPreferred ?? null,
          search: query.search ?? null
        }
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }

  public async exportLedger(
    actor: SupplierActor,
    supplierId: string,
    query: LedgerExportQuery,
    context: SupplierRequestContext
  ): Promise<SupplierExportPayload> {
    const supplier = await this.getSupplierOrThrow(actor.companyId, supplierId);
    const ledgerRows = await this.buildLedgerRows(supplier, query);

    const dataset: ReportExportDataset = {
      title: `Supplier Ledger - ${supplier.name}`,
      columns: [
        { key: "date", label: "Date" },
        { key: "transactionType", label: "Transaction Type" },
        { key: "referenceNo", label: "Reference No" },
        { key: "description", label: "Description" },
        { key: "debit", label: "Debit", type: "number" },
        { key: "credit", label: "Credit", type: "number" },
        { key: "balance", label: "Balance", type: "number" },
        { key: "paymentMode", label: "Payment Mode" },
        { key: "remarks", label: "Remarks" }
      ],
      rows: ledgerRows.map((item) => ({
        date: item.date.toISOString(),
        transactionType: item.transactionType,
        referenceNo: item.referenceNo ?? "",
        description: item.description,
        debit: item.debit,
        credit: item.credit,
        balance: item.balance,
        paymentMode: item.paymentMode ?? "",
        remarks: item.remarks ?? ""
      }))
    };
    const file = buildReportFile(
      dataset,
      query.format,
      `supplier-ledger-${supplier.supplierCode}-${new Date().toISOString().slice(0, 10)}`
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "supplier_ledger_exported",
      entityType: "supplier",
      entityId: supplier.id,
      metadata: {
        format: query.format,
        dateFrom: query.dateFrom?.toISOString() ?? null,
        dateTo: query.dateTo?.toISOString() ?? null,
        transactionType: query.transactionType ?? null
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }
}

export const suppliersService = new SuppliersService();
