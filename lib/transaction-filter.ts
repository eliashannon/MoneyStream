import type { Account, Transaction } from "./types";

export type TransactionFilters = {
  search: string;
  accountId: string;
  accountType: string;
  type: string;
  category: string;
  status: string;
  recurring: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  sort: "newest" | "oldest" | "amount-high" | "amount-low" | "description" | "category";
};

export type DatePreset = "all" | "7days" | "30days" | "90days" | "yearToDate" | "12months";

export function presetDates(preset: DatePreset, now = new Date()): { startDate: string; endDate: string } {
  if (preset === "all") return { startDate: "", endDate: "" };
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  if (preset === "yearToDate") start.setMonth(0, 1);
  else if (preset === "12months") start.setFullYear(start.getFullYear() - 1);
  else start.setDate(start.getDate() - (preset === "7days" ? 6 : preset === "30days" ? 29 : 89));
  const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { startDate: format(start), endDate: format(end) };
}

export function filterTransactions(transactions: Transaction[], accounts: Account[], filters: TransactionFilters): Transaction[] {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const search = filters.search.trim().toLocaleLowerCase();
  const min = filters.minAmount === "" ? undefined : Number(filters.minAmount);
  const max = filters.maxAmount === "" ? undefined : Number(filters.maxAmount);

  return transactions.filter((item) => {
    const account = item.accountId ? accountById.get(item.accountId) : undefined;
    return (!search || `${item.description} ${item.category} ${account?.name ?? ""}`.toLocaleLowerCase().includes(search))
      && (!filters.accountId || item.accountId === filters.accountId)
      && (!filters.accountType || account?.type === filters.accountType)
      && (!filters.type || item.type === filters.type)
      && (!filters.category || item.category === filters.category)
      && (!filters.status || (filters.status === "unknown" ? !item.status : item.status === filters.status))
      && (!filters.recurring || (filters.recurring === "yes" ? item.recurring === true : item.recurring !== true))
      && (!filters.startDate || item.date >= filters.startDate)
      && (!filters.endDate || item.date <= filters.endDate)
      && (min === undefined || item.amount >= min)
      && (max === undefined || item.amount <= max);
  }).sort((a, b) => {
    switch (filters.sort) {
      case "oldest": return a.date.localeCompare(b.date);
      case "amount-high": return b.amount - a.amount;
      case "amount-low": return a.amount - b.amount;
      case "description": return a.description.localeCompare(b.description);
      case "category": return a.category.localeCompare(b.category);
      default: return b.date.localeCompare(a.date);
    }
  });
}

export function transactionSummary(transactions: Transaction[]) {
  const income = transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  return { income, expenses, net: income - expenses, count: transactions.length };
}
