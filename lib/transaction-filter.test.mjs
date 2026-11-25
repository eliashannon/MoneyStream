import { strict as assert } from "node:assert";
import { test } from "node:test";
import { filterTransactions, presetDates, transactionSummary } from "./transaction-filter.ts";

const accounts = [{ id: "c", name: "Checking", type: "checking" }, { id: "s", name: "Savings", type: "savings" }];
const base = { userId: "u", category: "Food", description: "Market" };
const transactions = [
  { ...base, id: "1", type: "expense", amount: 20, date: "2026-02-01", accountId: "c" },
  { ...base, id: "2", type: "income", amount: 100, date: "2026-02-02", accountId: "c", category: "Pay" },
  { ...base, id: "3", type: "transfer", amount: 50, date: "2026-02-03", accountId: "s" },
  { ...base, id: "4", type: "payment", amount: 30, date: "2026-02-04" },
];
const filters = { search: "", accountId: "", accountType: "", type: "", category: "", status: "", recurring: "", startDate: "", endDate: "", minAmount: "", maxAmount: "", sort: "newest" };

test("combines account, date, category, amount, and search filters", () => {
  const result = filterTransactions(transactions, accounts, { ...filters, accountType: "checking", category: "Food", startDate: "2026-02-01", endDate: "2026-02-01", minAmount: "20", maxAmount: "20", search: "CHECKING" });
  assert.deepEqual(result.map((item) => item.id), ["1"]);
  assert.deepEqual(filterTransactions(transactions, accounts, { ...filters, accountId: "s", type: "income" }), []);
});

test("sorts without mutating records and excludes transfers and payments from cash flow", () => {
  assert.deepEqual(filterTransactions(transactions, accounts, { ...filters, sort: "amount-high" }).map((item) => item.id), ["2", "3", "4", "1"]);
  assert.deepEqual(transactions.map((item) => item.id), ["1", "2", "3", "4"]);
  assert.deepEqual(transactionSummary(transactions), { income: 100, expenses: 20, net: 80, count: 4 });
});

test("filters recorded statuses and recurring transactions without inventing legacy status", () => {
  const items = [{ ...transactions[0], status: "pending", recurring: true }, ...transactions.slice(1)];
  assert.deepEqual(filterTransactions(items, accounts, { ...filters, status: "pending", recurring: "yes" }).map((item) => item.id), ["1"]);
  assert.deepEqual(filterTransactions(items, accounts, { ...filters, status: "unknown", recurring: "no" }).map((item) => item.id), ["4", "3", "2"]);
});

test("date presets use inclusive local calendar days across year boundaries", () => {
  const now = new Date(2026, 0, 3, 23);
  assert.deepEqual(presetDates("7days", now), { startDate: "2025-12-28", endDate: "2026-01-03" });
  assert.deepEqual(presetDates("yearToDate", now), { startDate: "2026-01-01", endDate: "2026-01-03" });
  assert.deepEqual(presetDates("all", now), { startDate: "", endDate: "" });
});
