import type { AccountNormalBalance, AccountType, SystemAccountKey } from "./accounting.types";

export type DefaultAccountSeed = {
  systemKey: SystemAccountKey;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountSubtype: string | null;
  normalBalance: AccountNormalBalance;
  description: string;
};

export const DEFAULT_SYSTEM_ACCOUNTS: DefaultAccountSeed[] = [
  {
    systemKey: "cash",
    accountCode: "AST-CASH",
    accountName: "Cash Account",
    accountType: "asset",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default cash account used for accounting entries."
  },
  {
    systemKey: "bank",
    accountCode: "AST-BANK",
    accountName: "Bank Account",
    accountType: "asset",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default bank account used for accounting entries."
  },
  {
    systemKey: "accounts_receivable",
    accountCode: "AST-AR",
    accountName: "Accounts Receivable",
    accountType: "asset",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default receivable account for customer balances."
  },
  {
    systemKey: "inventory",
    accountCode: "AST-INV",
    accountName: "Inventory",
    accountType: "asset",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default inventory account for stock valuation."
  },
  {
    systemKey: "input_gst",
    accountCode: "AST-IGSTIN",
    accountName: "Input GST",
    accountType: "asset",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default input GST account."
  },
  {
    systemKey: "advance_to_supplier",
    accountCode: "AST-ADV-SUP",
    accountName: "Advance to Supplier",
    accountType: "asset",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default account for supplier advances."
  },
  {
    systemKey: "accounts_payable",
    accountCode: "LIA-AP",
    accountName: "Accounts Payable",
    accountType: "liability",
    accountSubtype: null,
    normalBalance: "credit",
    description: "Default payable account for supplier balances."
  },
  {
    systemKey: "salary_payable",
    accountCode: "LIA-SALPAY",
    accountName: "Salary Payable",
    accountType: "liability",
    accountSubtype: null,
    normalBalance: "credit",
    description: "Default salary payable account."
  },
  {
    systemKey: "output_gst",
    accountCode: "LIA-GSTOUT",
    accountName: "Output GST Payable",
    accountType: "liability",
    accountSubtype: null,
    normalBalance: "credit",
    description: "Default output GST payable account."
  },
  {
    systemKey: "loans",
    accountCode: "LIA-LOAN",
    accountName: "Loans Payable",
    accountType: "liability",
    accountSubtype: null,
    normalBalance: "credit",
    description: "Default loans and borrowings account."
  },
  {
    systemKey: "advance_from_customer",
    accountCode: "LIA-ADV-CUS",
    accountName: "Advance from Customer",
    accountType: "liability",
    accountSubtype: null,
    normalBalance: "credit",
    description: "Default account for customer advances."
  },
  {
    systemKey: "sales",
    accountCode: "INC-SALES",
    accountName: "Sales Account",
    accountType: "income",
    accountSubtype: null,
    normalBalance: "credit",
    description: "Default sales income account."
  },
  {
    systemKey: "service_income",
    accountCode: "INC-SVC",
    accountName: "Service Income",
    accountType: "income",
    accountSubtype: null,
    normalBalance: "credit",
    description: "Default service income account."
  },
  {
    systemKey: "discount_received",
    accountCode: "INC-DISC",
    accountName: "Discount Received",
    accountType: "income",
    accountSubtype: null,
    normalBalance: "credit",
    description: "Default discount received account."
  },
  {
    systemKey: "purchases",
    accountCode: "EXP-PUR",
    accountName: "Purchase Account",
    accountType: "expense",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default purchase expense account."
  },
  {
    systemKey: "salary_expense",
    accountCode: "EXP-SAL",
    accountName: "Salary Expense",
    accountType: "expense",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default salary expense account."
  },
  {
    systemKey: "rent_expense",
    accountCode: "EXP-RENT",
    accountName: "Rent Expense",
    accountType: "expense",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default rent expense account."
  },
  {
    systemKey: "electricity_expense",
    accountCode: "EXP-ELEC",
    accountName: "Electricity Expense",
    accountType: "expense",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default electricity expense account."
  },
  {
    systemKey: "transport_expense",
    accountCode: "EXP-TRANS",
    accountName: "Transport Expense",
    accountType: "expense",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default transport expense account."
  },
  {
    systemKey: "discount_given",
    accountCode: "EXP-DISC",
    accountName: "Discount Allowed",
    accountType: "expense",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default discount allowed account."
  },
  {
    systemKey: "round_off_expense",
    accountCode: "EXP-ROFF",
    accountName: "Round Off Expense",
    accountType: "expense",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default round off expense account."
  },
  {
    systemKey: "cogs",
    accountCode: "EXP-COGS",
    accountName: "Cost of Goods Sold",
    accountType: "expense",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default cost of goods sold account."
  },
  {
    systemKey: "capital",
    accountCode: "EQ-CAP",
    accountName: "Capital Account",
    accountType: "equity",
    accountSubtype: null,
    normalBalance: "credit",
    description: "Default owner capital account."
  },
  {
    systemKey: "drawings",
    accountCode: "EQ-DRAW",
    accountName: "Drawings Account",
    accountType: "equity",
    accountSubtype: null,
    normalBalance: "debit",
    description: "Default drawings account."
  },
  {
    systemKey: "retained_earnings",
    accountCode: "EQ-OPEN",
    accountName: "Opening Balance Equity",
    accountType: "equity",
    accountSubtype: null,
    normalBalance: "credit",
    description: "Default equity offset account used for opening balances."
  }
];
