import type { Account, CreditCardAccount, Transaction } from "./types";

export const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function availableCredit(account: CreditCardAccount): number | undefined {
  return account.availableCredit ?? (account.creditLimit === undefined ? undefined : Math.max(0, account.creditLimit - account.balance));
}

export function creditUtilization(account: CreditCardAccount): number | undefined {
  const limit = account.creditLimit ?? (account.availableCredit === undefined ? undefined : account.balance + account.availableCredit);
  return limit && limit > 0 ? account.balance / limit * 100 : undefined;
}

export function netPosition(accounts: Account[]): number {
  return accounts.filter((account) => account.includeInNetWorth !== false).reduce(
    (total, account) => total + (account.type === "credit" || account.type === "loan" ? -account.balance : account.balance), 0,
  );
}

export function cashFlow(transactions: Transaction[], months: number, now = new Date()) {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - months + index + 1, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const items = transactions.filter((item) => item.date.startsWith(key));
    return {
      name: date.toLocaleDateString("en-US", { month: "short", ...(months > 6 ? { year: "2-digit" } : {}) }),
      income: items.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0),
      expenses: items.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0),
    };
  });
}
