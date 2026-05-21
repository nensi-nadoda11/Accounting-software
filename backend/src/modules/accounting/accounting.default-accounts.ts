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

export const DEFAULT_SYSTEM_ACCOUNTS: DefaultAccountSeed[] = [];
