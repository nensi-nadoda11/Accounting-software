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
    accountName: "Cash",
    accountType: "asset",
    accountSubtype: "cash",
    normalBalance: "debit",
    description: "Primary cash account"
  },
  {
    systemKey: "bank",
    accountCode: "AST-BANK",
    accountName: "Bank",
    accountType: "asset",
    accountSubtype: "bank",
    normalBalance: "debit",
    description: "Primary bank control account"
  },
  {
    systemKey: "accounts_receivable",
    accountCode: "AST-AR",
    accountName: "Accounts Receivable",
    accountType: "asset",
    accountSubtype: "receivable",
    normalBalance: "debit",
    description: "Trade receivables control account"
  },
  {
    systemKey: "inventory",
    accountCode: "AST-INV",
    accountName: "Inventory",
    accountType: "asset",
    accountSubtype: "inventory",
    normalBalance: "debit",
    description: "Inventory asset account"
  },
  {
    systemKey: "input_gst",
    accountCode: "AST-IGSTIN",
    accountName: "Input GST",
    accountType: "asset",
    accountSubtype: "tax_credit",
    normalBalance: "debit",
    description: "Input GST receivable"
  },
  {
    systemKey: "advance_to_supplier",
    accountCode: "AST-ADVSP",
    accountName: "Advance To Supplier",
    accountType: "asset",
    accountSubtype: "advance",
    normalBalance: "debit",
    description: "Supplier advances paid"
  },
  {
    systemKey: "accounts_payable",
    accountCode: "LIA-AP",
    accountName: "Accounts Payable",
    accountType: "liability",
    accountSubtype: "payable",
    normalBalance: "credit",
    description: "Trade payables control account"
  },
  {
    systemKey: "salary_payable",
    accountCode: "LIA-SALPAY",
    accountName: "Salary Payable",
    accountType: "liability",
    accountSubtype: "salary_payable",
    normalBalance: "credit",
    description: "Outstanding salary payable to employees"
  },
  {
    systemKey: "output_gst",
    accountCode: "LIA-GSTOUT",
    accountName: "Output GST",
    accountType: "liability",
    accountSubtype: "tax_payable",
    normalBalance: "credit",
    description: "Output GST payable"
  },
  {
    systemKey: "loans",
    accountCode: "LIA-LOAN",
    accountName: "Loans",
    accountType: "liability",
    accountSubtype: "loan",
    normalBalance: "credit",
    description: "Borrowings and loan balances"
  },
  {
    systemKey: "advance_from_customer",
    accountCode: "LIA-ADVCU",
    accountName: "Advance From Customer",
    accountType: "liability",
    accountSubtype: "advance",
    normalBalance: "credit",
    description: "Customer advances received"
  },
  {
    systemKey: "sales",
    accountCode: "INC-SALES",
    accountName: "Sales",
    accountType: "income",
    accountSubtype: "goods_sales",
    normalBalance: "credit",
    description: "Goods sales revenue"
  },
  {
    systemKey: "service_income",
    accountCode: "INC-SVC",
    accountName: "Service Income",
    accountType: "income",
    accountSubtype: "service_income",
    normalBalance: "credit",
    description: "Service revenue"
  },
  {
    systemKey: "discount_received",
    accountCode: "INC-DISCREC",
    accountName: "Discount Received",
    accountType: "income",
    accountSubtype: "discount",
    normalBalance: "credit",
    description: "Purchase or vendor discounts received"
  },
  {
    systemKey: "purchases",
    accountCode: "EXP-PUR",
    accountName: "Purchases",
    accountType: "expense",
    accountSubtype: "purchases",
    normalBalance: "debit",
    description: "Direct purchase expense account"
  },
  {
    systemKey: "salary_expense",
    accountCode: "EXP-SAL",
    accountName: "Salary Expense",
    accountType: "expense",
    accountSubtype: "salary",
    normalBalance: "debit",
    description: "Salary and wages expense"
  },
  {
    systemKey: "rent_expense",
    accountCode: "EXP-RENT",
    accountName: "Rent Expense",
    accountType: "expense",
    accountSubtype: "rent",
    normalBalance: "debit",
    description: "Rent expense"
  },
  {
    systemKey: "electricity_expense",
    accountCode: "EXP-ELEC",
    accountName: "Electricity Expense",
    accountType: "expense",
    accountSubtype: "utility",
    normalBalance: "debit",
    description: "Electricity and utility expense"
  },
  {
    systemKey: "transport_expense",
    accountCode: "EXP-TRANS",
    accountName: "Transport Expense",
    accountType: "expense",
    accountSubtype: "transport",
    normalBalance: "debit",
    description: "Transport and logistics expense"
  },
  {
    systemKey: "discount_given",
    accountCode: "EXP-DISCGVN",
    accountName: "Discount Given",
    accountType: "expense",
    accountSubtype: "discount",
    normalBalance: "debit",
    description: "Customer discounts given"
  },
  {
    systemKey: "round_off_expense",
    accountCode: "EXP-RNDOFF",
    accountName: "Round Off",
    accountType: "expense",
    accountSubtype: "round_off",
    normalBalance: "debit",
    description: "Rounding adjustments"
  },
  {
    systemKey: "cogs",
    accountCode: "EXP-COGS",
    accountName: "Cost Of Goods Sold",
    accountType: "expense",
    accountSubtype: "cogs",
    normalBalance: "debit",
    description: "Cost of goods sold"
  },
  {
    systemKey: "capital",
    accountCode: "EQT-CAP",
    accountName: "Capital",
    accountType: "equity",
    accountSubtype: "capital",
    normalBalance: "credit",
    description: "Owner capital"
  },
  {
    systemKey: "drawings",
    accountCode: "EQT-DRW",
    accountName: "Drawings",
    accountType: "equity",
    accountSubtype: "drawings",
    normalBalance: "debit",
    description: "Owner drawings"
  },
  {
    systemKey: "retained_earnings",
    accountCode: "EQT-RE",
    accountName: "Retained Earnings",
    accountType: "equity",
    accountSubtype: "retained_earnings",
    normalBalance: "credit",
    description: "Retained earnings and opening difference account"
  }
];
