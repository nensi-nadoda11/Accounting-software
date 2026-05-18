import { db } from "../../db";
import { customers } from "../../db/schema";
import { auditLogService } from "../audit-logs/audit-log.service";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import type {
  BlacklistInput,
  CreateCustomerInput,
  ExportCustomersQuery,
  LedgerExportQuery,
  LedgerQuery,
  ListCustomerQuery,
  PaymentsQuery,
  StatusInput,
  UpdateCustomerInput
} from "./customers.validator";
import { customersRepository } from "./customers.repository";
import type { CustomerActor, CustomerExportPayload, CustomerRequestContext } from "./customers.types";

type CustomerRecord = typeof customers.$inferSelect;

type ResolvedCustomerState = {
  name: string;
  customerType: "individual" | "business";
  businessName: string | null;
  contactPerson: string | null;
  mobile: string;
  alternateMobile: string | null;
  email: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  taxType: "registered" | "unregistered" | "composition";
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
  defaultDiscount: string;
  status: "active" | "inactive" | "deleted";
  notes: string | null;
};

type CustomerStateInput = Omit<
  {
    [Key in keyof ResolvedCustomerState]?: ResolvedCustomerState[Key] | undefined;
  },
  "openingBalanceAmount" | "creditLimit" | "defaultDiscount" | "status" | "billingCountry" | "shippingCountry"
> & {
  billingCountry?: string | null | undefined;
  shippingCountry?: string | null | undefined;
  openingBalanceAmount?: number | undefined;
  creditLimit?: number | undefined;
  defaultDiscount?: number | undefined;
  status?: "active" | "inactive" | undefined;
};

type OutstandingSummary = {
  openingBalance: string;
  totalSales: string;
  totalReturns: string;
  totalPayments: string;
  outstandingAmount: string;
  overdueAmount: string;
  creditLimit: string;
  creditUsedPercentage: string;
  remainingCreditLimit: string;
  isCreditLimitExceeded: boolean;
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

const formatPercentageFromUsage = (usedReceivable: bigint, creditLimit: bigint): string => {
  if (creditLimit <= 0n) {
    return usedReceivable > 0n ? "100.00" : "0.00";
  }

  const scaled = ((usedReceivable * 10000n) + creditLimit / 2n) / creditLimit;
  return formatCentsToDecimal(scaled);
};

const csvEscape = (value: string | null | undefined) => {
  const safeValue = value ?? "";
  if (/[",\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, "\"\"")}"`;
  }

  return safeValue;
};

class CustomersService {
  private mapCustomer(customer: CustomerRecord) {
    return {
      id: customer.id,
      companyId: customer.companyId,
      customerCode: customer.customerCode,
      name: customer.name,
      customerType: customer.customerType,
      businessName: customer.businessName,
      contactPerson: customer.contactPerson,
      mobile: customer.mobile,
      alternateMobile: customer.alternateMobile,
      email: customer.email,
      gstNumber: customer.gstNumber,
      panNumber: customer.panNumber,
      taxType: customer.taxType,
      billingAddressLine1: customer.billingAddressLine1,
      billingAddressLine2: customer.billingAddressLine2,
      billingCity: customer.billingCity,
      billingState: customer.billingState,
      billingPincode: customer.billingPincode,
      billingCountry: customer.billingCountry,
      shippingAddressLine1: customer.shippingAddressLine1,
      shippingAddressLine2: customer.shippingAddressLine2,
      shippingCity: customer.shippingCity,
      shippingState: customer.shippingState,
      shippingPincode: customer.shippingPincode,
      shippingCountry: customer.shippingCountry,
      sameAsBilling: customer.sameAsBilling,
      openingBalanceAmount: normalizeDecimalString(customer.openingBalanceAmount),
      openingBalanceType: customer.openingBalanceType,
      creditLimit: normalizeDecimalString(customer.creditLimit),
      creditDays: customer.creditDays,
      defaultDiscount: normalizeDecimalString(customer.defaultDiscount),
      status: customer.status,
      isBlacklisted: customer.isBlacklisted,
      notes: customer.notes,
      createdBy: customer.createdBy,
      updatedBy: customer.updatedBy,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      deletedAt: customer.deletedAt
    };
  }

  private getDefaultState(): ResolvedCustomerState {
    return {
      name: "",
      customerType: "individual",
      businessName: null,
      contactPerson: null,
      mobile: "",
      alternateMobile: null,
      email: null,
      gstNumber: null,
      panNumber: null,
      taxType: "unregistered",
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
      sameAsBilling: false,
      openingBalanceAmount: "0.00",
      openingBalanceType: "none",
      creditLimit: "0.00",
      creditDays: 0,
      defaultDiscount: "0.00",
      status: "active",
      notes: null
    };
  }

  private buildStateFromCustomer(customer: CustomerRecord): ResolvedCustomerState {
    return {
      name: customer.name,
      customerType: customer.customerType,
      businessName: customer.businessName,
      contactPerson: customer.contactPerson,
      mobile: customer.mobile,
      alternateMobile: customer.alternateMobile,
      email: customer.email,
      gstNumber: customer.gstNumber,
      panNumber: customer.panNumber,
      taxType: customer.taxType,
      billingAddressLine1: customer.billingAddressLine1,
      billingAddressLine2: customer.billingAddressLine2,
      billingCity: customer.billingCity,
      billingState: customer.billingState,
      billingPincode: customer.billingPincode,
      billingCountry: customer.billingCountry,
      shippingAddressLine1: customer.shippingAddressLine1,
      shippingAddressLine2: customer.shippingAddressLine2,
      shippingCity: customer.shippingCity,
      shippingState: customer.shippingState,
      shippingPincode: customer.shippingPincode,
      shippingCountry: customer.shippingCountry,
      sameAsBilling: customer.sameAsBilling,
      openingBalanceAmount: normalizeDecimalString(customer.openingBalanceAmount),
      openingBalanceType: customer.openingBalanceType,
      creditLimit: normalizeDecimalString(customer.creditLimit),
      creditDays: customer.creditDays,
      defaultDiscount: normalizeDecimalString(customer.defaultDiscount),
      status: customer.status,
      notes: customer.notes
    };
  }

  private resolveState(
    input: CustomerStateInput,
    baseState: ResolvedCustomerState
  ): ResolvedCustomerState {
    const nextState = {
      ...baseState,
      ...pickDefined({
        name: input.name,
        customerType: input.customerType,
        businessName: input.businessName,
        contactPerson: input.contactPerson,
        mobile: input.mobile,
        alternateMobile: input.alternateMobile,
        email: input.email,
        gstNumber: input.gstNumber,
        panNumber: input.panNumber,
        taxType: input.taxType,
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
        defaultDiscount:
          input.defaultDiscount !== undefined ? normalizeDecimalString(input.defaultDiscount) : undefined,
        status: input.status,
        notes: input.notes
      })
    } as ResolvedCustomerState;

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

  private assertState(state: ResolvedCustomerState) {
    if (state.name.trim().length < 2) {
      throw new AppError("Customer name must be at least 2 characters long", 400);
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

    if (shippingHasAddress && !state.shippingPincode) {
      throw new AppError("Shipping pincode is required when shipping address is provided", 400);
    }
  }

  private async assertUniqueFields(
    companyId: string,
    state: Pick<ResolvedCustomerState, "mobile" | "email">,
    excludeId?: string,
    executor?: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) {
    const [mobileOwner, emailOwner] = await Promise.all([
      customersRepository.findByMobile(companyId, state.mobile, excludeId, executor),
      state.email ? customersRepository.findByEmail(companyId, state.email, excludeId, executor) : Promise.resolve(null)
    ]);

    if (mobileOwner) {
      throw new AppError("A customer with this mobile number already exists", 409);
    }

    if (emailOwner) {
      throw new AppError("A customer with this email already exists", 409);
    }
  }

  private async getCustomerOrThrow(companyId: string, customerId: string, includeDeleted = false) {
    const customer = await customersRepository.findById(companyId, customerId, includeDeleted);
    if (!customer) {
      throw new AppError("Customer not found", 404);
    }

    return customer;
  }

  private buildOutstandingSummary(
    customer: Pick<CustomerRecord, "openingBalanceAmount" | "openingBalanceType" | "creditLimit" | "creditDays">,
    totals: {
      totalSales: string;
      totalReturns: string;
      totalPayments: string;
      debitAdjustments: string;
      creditAdjustments: string;
      overdueAmount: string;
    }
  ): OutstandingSummary {
    const openingAmount = parseDecimalToCents(customer.openingBalanceAmount);
    const signedOpeningBalance =
      customer.openingBalanceType === "debit"
        ? openingAmount
        : customer.openingBalanceType === "credit"
          ? openingAmount * -1n
          : 0n;
    const totalSales = parseDecimalToCents(totals.totalSales);
    const totalReturns = parseDecimalToCents(totals.totalReturns);
    const totalPayments = parseDecimalToCents(totals.totalPayments);
    const debitAdjustments = parseDecimalToCents(totals.debitAdjustments);
    const creditAdjustments = parseDecimalToCents(totals.creditAdjustments);
    const overdueAmount = parseDecimalToCents(totals.overdueAmount);
    const outstandingAmount =
      signedOpeningBalance + totalSales - totalReturns - totalPayments + debitAdjustments - creditAdjustments;
    const creditLimit = parseDecimalToCents(customer.creditLimit);
    const usedReceivable = outstandingAmount > 0n ? outstandingAmount : 0n;
    const remainingCreditLimit = creditLimit - usedReceivable;

    return {
      openingBalance: formatCentsToDecimal(signedOpeningBalance),
      totalSales: formatCentsToDecimal(totalSales),
      totalReturns: formatCentsToDecimal(totalReturns),
      totalPayments: formatCentsToDecimal(totalPayments),
      outstandingAmount: formatCentsToDecimal(outstandingAmount),
      overdueAmount: formatCentsToDecimal(overdueAmount),
      creditLimit: formatCentsToDecimal(creditLimit),
      creditUsedPercentage: formatPercentageFromUsage(usedReceivable, creditLimit),
      remainingCreditLimit: formatCentsToDecimal(remainingCreditLimit),
      isCreditLimitExceeded: usedReceivable > creditLimit
    };
  }

  private buildCsvFile(fileName: string, headers: string[], rows: string[][]): CustomerExportPayload {
    const lines = [
      headers.map((header) => csvEscape(header)).join(","),
      ...rows.map((row) => row.map((entry) => csvEscape(entry)).join(","))
    ];

    return {
      fileName,
      contentType: "text/csv; charset=utf-8",
      content: Buffer.from(`\uFEFF${lines.join("\n")}`, "utf-8")
    };
  }

  private ensureCsvFormat(format: "csv" | "xlsx" | "pdf") {
    if (format !== "csv") {
      throw new AppError("Only CSV export is available right now", 400);
    }
  }

  private buildNextCustomerCode(previousCode: string | null): string {
    const lastSequence = previousCode ? Number(previousCode.replace("CUST-", "")) : 0;
    const nextSequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;
    return `CUST-${String(nextSequence).padStart(6, "0")}`;
  }

  private isCustomerCodeConflict(error: unknown): boolean {
    const databaseError = error as { code?: string; constraint?: string };
    return (
      databaseError?.code === "23505" &&
      databaseError.constraint === "customers_company_customer_code_unique_idx"
    );
  }

  private async buildLedgerRows(
    customer: CustomerRecord,
    query: {
      dateFrom?: Date | undefined;
      dateTo?: Date | undefined;
      transactionType?: string | undefined;
    }
  ) {
    const ledgerTransactions = await customersRepository.listLedgerTransactions(customer.companyId, customer.id, query);
    const openingBalanceAmount = parseDecimalToCents(customer.openingBalanceAmount);
    let runningBalance =
      customer.openingBalanceType === "debit"
        ? openingBalanceAmount
        : customer.openingBalanceType === "credit"
          ? openingBalanceAmount * -1n
          : 0n;

    const openingRow = {
      date: customer.createdAt,
      transactionType: "opening_balance",
      referenceNo: customer.customerCode,
      description: "Opening balance",
      debit:
        customer.openingBalanceType === "debit" ? formatCentsToDecimal(openingBalanceAmount) : "0.00",
      credit:
        customer.openingBalanceType === "credit" ? formatCentsToDecimal(openingBalanceAmount) : "0.00",
      balance: formatCentsToDecimal(runningBalance),
      paymentMode: null as string | null,
      remarks: customer.notes
    };

    const computedRows = ledgerTransactions.rows.map((row) => {
      runningBalance += parseDecimalToCents(row.debit) - parseDecimalToCents(row.credit);

      return {
        ...row,
        balance: formatCentsToDecimal(runningBalance)
      };
    });

    return [openingRow, ...computedRows];
  }

  public async listCustomers(actor: Pick<CustomerActor, "companyId">, query: ListCustomerQuery) {
    const pagination = getPagination(query.page, query.limit);
    const params: {
      companyId: string;
      page: number;
      limit: number;
      search?: string | null;
      status?: "active" | "inactive" | "deleted";
      customerType?: "individual" | "business";
      taxType?: "registered" | "unregistered" | "composition";
      hasOutstanding?: boolean;
      isBlacklisted?: boolean;
      sortBy: "name" | "createdAt" | "outstandingAmount" | "customerCode";
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

    if (query.customerType !== undefined) {
      params.customerType = query.customerType;
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

    const result = await customersRepository.listCustomers(params);

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        customerCode: row.customerCode,
        name: row.name,
        customerType: row.customerType,
        businessName: row.businessName,
        mobile: row.mobile,
        email: row.email,
        gstNumber: row.gstNumber,
        taxType: row.taxType,
        status: row.status,
        isBlacklisted: row.isBlacklisted,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        outstandingSummary: {
          openingBalance:
            row.openingBalanceType === "debit"
              ? normalizeDecimalString(row.openingBalanceAmount)
              : row.openingBalanceType === "credit"
                ? normalizeDecimalString(`-${normalizeDecimalString(row.openingBalanceAmount)}`)
                : "0.00",
          totalSales: "0.00",
          totalReturns: "0.00",
          totalPayments: "0.00",
          outstandingAmount: normalizeDecimalString(row.outstandingAmount),
          overdueAmount: "0.00",
          creditLimit: normalizeDecimalString(row.creditLimit),
          creditUsedPercentage: "0.00",
          remainingCreditLimit: "0.00",
          isCreditLimitExceeded: false
        }
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createCustomer(actor: CustomerActor, input: CreateCustomerInput, context: CustomerRequestContext) {
    const baseState = this.getDefaultState();
    const state = this.resolveState(input, baseState);
    this.assertState(state);

    let createdCustomer: CustomerRecord | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        createdCustomer = await db.transaction(async (transaction) => {
          await this.assertUniqueFields(actor.companyId, state, undefined, transaction);
          await customersRepository.acquireCustomerCodeLock(actor.companyId, transaction);
          const customerCode = this.buildNextCustomerCode(
            await customersRepository.findLatestCustomerCode(actor.companyId, transaction)
          );

          const created = await customersRepository.createCustomer(
            {
              companyId: actor.companyId,
              customerCode,
              name: state.name,
              customerType: state.customerType,
              businessName: state.businessName,
              contactPerson: state.contactPerson,
              mobile: state.mobile,
              alternateMobile: state.alternateMobile,
              email: state.email,
              gstNumber: state.gstNumber,
              panNumber: state.panNumber,
              taxType: state.taxType,
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
              defaultDiscount: state.defaultDiscount,
              status: state.status,
              isBlacklisted: false,
              notes: state.notes,
              createdBy: actor.id,
              updatedBy: actor.id
            },
            transaction
          );

          if (!created) {
            throw new AppError("Failed to create customer", 500);
          }

          return created;
        });

        break;
      } catch (error) {
        if (attempt < 2 && this.isCustomerCodeConflict(error)) {
          continue;
        }

        throw error;
      }
    }

    if (!createdCustomer) {
      throw new AppError("Failed to create customer", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "customer_created",
      entityType: "customer",
      entityId: createdCustomer.id,
      metadata: {
        customerCode: createdCustomer.customerCode,
        name: createdCustomer.name
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      customer: this.mapCustomer(createdCustomer),
      outstandingSummary: this.buildOutstandingSummary(createdCustomer, {
        totalSales: "0.00",
        totalReturns: "0.00",
        totalPayments: "0.00",
        debitAdjustments: "0.00",
        creditAdjustments: "0.00",
        overdueAmount: "0.00"
      })
    };
  }

  public async getCustomer(actor: Pick<CustomerActor, "companyId">, customerId: string) {
    const customer = await this.getCustomerOrThrow(actor.companyId, customerId);
    const totals = await customersRepository.getCustomerTransactionTotals(actor.companyId, customerId);

    return {
      customer: this.mapCustomer(customer),
      outstandingSummary: this.buildOutstandingSummary(customer, totals)
    };
  }

  public async updateCustomer(
    actor: CustomerActor,
    customerId: string,
    input: UpdateCustomerInput,
    context: CustomerRequestContext
  ) {
    const existingCustomer = await this.getCustomerOrThrow(actor.companyId, customerId, true);
    if (existingCustomer.deletedAt || existingCustomer.status === "deleted") {
      throw new AppError("Deleted customers cannot be updated", 400);
    }

    const previousState = this.buildStateFromCustomer(existingCustomer);
    const nextState = this.resolveState(input, previousState);
    this.assertState(nextState);

    const updatedCustomer = await db.transaction(async (transaction) => {
      if (nextState.mobile !== previousState.mobile || nextState.email !== previousState.email) {
        await this.assertUniqueFields(actor.companyId, nextState, customerId, transaction);
      }

      const updated = await customersRepository.updateCustomer(
        actor.companyId,
        customerId,
        {
          name: nextState.name,
          customerType: nextState.customerType,
          businessName: nextState.businessName,
          contactPerson: nextState.contactPerson,
          mobile: nextState.mobile,
          alternateMobile: nextState.alternateMobile,
          email: nextState.email,
          gstNumber: nextState.gstNumber,
          panNumber: nextState.panNumber,
          taxType: nextState.taxType,
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
          defaultDiscount: nextState.defaultDiscount,
          notes: nextState.notes,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update customer", 500);
      }

      return updated;
    });

    const changedFields = Object.keys(input);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "customer_updated",
      entityType: "customer",
      entityId: updatedCustomer.id,
      metadata: {
        fields: changedFields
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    if (previousState.creditLimit !== nextState.creditLimit) {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "customer_credit_limit_changed",
        entityType: "customer",
        entityId: updatedCustomer.id,
        metadata: {
          previousCreditLimit: previousState.creditLimit,
          creditLimit: nextState.creditLimit
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
        action: "customer_opening_balance_changed",
        entityType: "customer",
        entityId: updatedCustomer.id,
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

    const totals = await customersRepository.getCustomerTransactionTotals(actor.companyId, customerId);
    return {
      customer: this.mapCustomer(updatedCustomer),
      outstandingSummary: this.buildOutstandingSummary(updatedCustomer, totals)
    };
  }

  public async deleteCustomer(actor: CustomerActor, customerId: string, context: CustomerRequestContext) {
    const existingCustomer = await this.getCustomerOrThrow(actor.companyId, customerId, true);
    if (existingCustomer.deletedAt || existingCustomer.status === "deleted") {
      throw new AppError("Customer is already deleted", 400);
    }

    const hasLinkedTransactions = await customersRepository.hasLinkedTransactions(actor.companyId, customerId);
    const deletedCustomer = await db.transaction(async (transaction) => {
      const deleted = await customersRepository.softDeleteCustomer(
        actor.companyId,
        customerId,
        actor.id,
        transaction
      );

      if (!deleted) {
        throw new AppError("Failed to delete customer", 500);
      }

      return deleted;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "customer_deleted",
      entityType: "customer",
      entityId: deletedCustomer.id,
      metadata: {
        customerCode: deletedCustomer.customerCode,
        hadLinkedTransactions: hasLinkedTransactions
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async updateStatus(
    actor: CustomerActor,
    customerId: string,
    input: StatusInput,
    context: CustomerRequestContext
  ) {
    const existingCustomer = await this.getCustomerOrThrow(actor.companyId, customerId, true);
    if (existingCustomer.deletedAt || existingCustomer.status === "deleted") {
      throw new AppError("Deleted customers cannot be reactivated from this endpoint", 400);
    }

    const updatedCustomer = await customersRepository.updateCustomer(actor.companyId, customerId, {
      status: input.status,
      updatedBy: actor.id
    });

    if (!updatedCustomer) {
      throw new AppError("Failed to update customer status", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "customer_status_changed",
      entityType: "customer",
      entityId: updatedCustomer.id,
      metadata: {
        previousStatus: existingCustomer.status,
        status: input.status
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      customer: this.mapCustomer(updatedCustomer)
    };
  }

  public async updateBlacklist(
    actor: CustomerActor,
    customerId: string,
    input: BlacklistInput,
    context: CustomerRequestContext
  ) {
    const existingCustomer = await this.getCustomerOrThrow(actor.companyId, customerId, true);
    if (existingCustomer.deletedAt || existingCustomer.status === "deleted") {
      throw new AppError("Deleted customers cannot be blacklisted", 400);
    }

    const updatedCustomer = await customersRepository.updateCustomer(actor.companyId, customerId, {
      isBlacklisted: input.isBlacklisted,
      updatedBy: actor.id
    });

    if (!updatedCustomer) {
      throw new AppError("Failed to update customer blacklist status", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "customer_blacklist_changed",
      entityType: "customer",
      entityId: updatedCustomer.id,
      metadata: {
        previousIsBlacklisted: existingCustomer.isBlacklisted,
        isBlacklisted: input.isBlacklisted,
        reason: input.reason ?? null
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      customer: this.mapCustomer(updatedCustomer)
    };
  }

  public async getOutstanding(actor: Pick<CustomerActor, "companyId">, customerId: string) {
    const customer = await this.getCustomerOrThrow(actor.companyId, customerId);
    const totals = await customersRepository.getCustomerTransactionTotals(actor.companyId, customerId);
    return this.buildOutstandingSummary(customer, totals);
  }

  public async getLedger(
    actor: CustomerActor,
    customerId: string,
    query: LedgerQuery,
    context: CustomerRequestContext
  ) {
    const customer = await this.getCustomerOrThrow(actor.companyId, customerId);
    const pagination = getPagination(query.page, query.limit);
    const allRows = await this.buildLedgerRows(customer, query);
    const items = allRows.slice(pagination.offset, pagination.offset + pagination.limit);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "customer_ledger_viewed",
      entityType: "customer",
      entityId: customer.id,
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

  public async getPayments(actor: Pick<CustomerActor, "companyId">, customerId: string, query: PaymentsQuery) {
    await this.getCustomerOrThrow(actor.companyId, customerId);
    const pagination = getPagination(query.page, query.limit);
    const paymentHistory = await customersRepository.listPaymentHistory(actor.companyId, customerId, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo
    });

    return {
      items: paymentHistory.rows,
      totals: {
        totalPayments: paymentHistory.totalAmount
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: paymentHistory.total,
        totalPages: Math.ceil(paymentHistory.total / pagination.limit) || 1
      }
    };
  }

  public async exportCustomers(
    actor: CustomerActor,
    query: ExportCustomersQuery,
    context: CustomerRequestContext
  ): Promise<CustomerExportPayload> {
    this.ensureCsvFormat(query.format);

    const params: {
      companyId: string;
      search?: string | null;
      status?: "active" | "inactive" | "deleted";
      customerType?: "individual" | "business";
      taxType?: "registered" | "unregistered" | "composition";
      hasOutstanding?: boolean;
      isBlacklisted?: boolean;
      sortBy: "name" | "createdAt" | "outstandingAmount" | "customerCode";
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

    if (query.customerType !== undefined) {
      params.customerType = query.customerType;
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

    const rows = await customersRepository.listCustomersForExport(params);

    const csv = this.buildCsvFile(
      `customers-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Customer Code",
        "Name",
        "Customer Type",
        "Business Name",
        "Mobile",
        "Email",
        "GST Number",
        "Tax Type",
        "Status",
        "Blacklisted",
        "Credit Limit",
        "Outstanding Amount",
        "Created At"
      ],
      rows.map((customer) => {
        return [
          customer.customerCode,
          customer.name,
          customer.customerType,
          customer.businessName ?? "",
          customer.mobile,
          customer.email ?? "",
          customer.gstNumber ?? "",
          customer.taxType,
          customer.status,
          customer.isBlacklisted ? "yes" : "no",
          normalizeDecimalString(customer.creditLimit),
          normalizeDecimalString(customer.outstandingAmount),
          customer.createdAt.toISOString()
        ];
      })
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "customer_exported",
      entityType: "customer",
      metadata: {
        format: query.format,
        rowCount: rows.length,
        filters: {
          status: query.status ?? null,
          customerType: query.customerType ?? null,
          taxType: query.taxType ?? null,
          hasOutstanding: query.hasOutstanding ?? null,
          isBlacklisted: query.isBlacklisted ?? null,
          search: query.search ?? null
        }
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return csv;
  }

  public async exportLedger(
    actor: CustomerActor,
    customerId: string,
    query: LedgerExportQuery,
    context: CustomerRequestContext
  ): Promise<CustomerExportPayload> {
    this.ensureCsvFormat(query.format);
    const customer = await this.getCustomerOrThrow(actor.companyId, customerId);
    const ledgerRows = await this.buildLedgerRows(customer, query);

    const csv = this.buildCsvFile(
      `customer-ledger-${customer.customerCode}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date", "Transaction Type", "Reference No", "Description", "Debit", "Credit", "Balance", "Payment Mode", "Remarks"],
      ledgerRows.map((item) => [
        item.date.toISOString(),
        item.transactionType,
        item.referenceNo ?? "",
        item.description,
        item.debit,
        item.credit,
        item.balance,
        item.paymentMode ?? "",
        item.remarks ?? ""
      ])
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "customer_ledger_exported",
      entityType: "customer",
      entityId: customer.id,
      metadata: {
        format: query.format,
        dateFrom: query.dateFrom?.toISOString() ?? null,
        dateTo: query.dateTo?.toISOString() ?? null,
        transactionType: query.transactionType ?? null
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return csv;
  }
}

export const customersService = new CustomersService();
