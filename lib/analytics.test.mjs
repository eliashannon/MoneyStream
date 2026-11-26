import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  assetAllocation, bucketStart, buckets, cashFlowSeries, categorySlots, comparisonRanges, currentNetWorth, filterByAccounts,
  netWorthSeries, percentChange, previousRange, resolveRange, spendingByCategory, spendingComparison, toCsv, totals,
} from "./analytics.ts";
import { netPosition } from "./finance.ts";

const tx = (id, type, amount, date, extra = {}) => ({ id, userId: "u", description: id, category: "", type, amount, date, ...extra });
const account = (id, type, balance, extra = {}) => ({ id, userId: "u", name: id, institution: "Bank", createdAt: "", type, balance, ...(type === "credit" ? { statementBalance: 0 } : {}), ...extra });
const now = new Date(2026, 10, 25); // 25 Nov 2026

test("totals count only income and expenses; transfers and card payments are never double counted", () => {
  const items = [
    tx("pay", "income", 3000, "2026-11-01"),
    tx("groceries", "expense", 120.5, "2026-11-02"),
    tx("card purchase", "expense", 80, "2026-11-03"),
    tx("card payment", "payment", 80, "2026-11-20"),
    tx("to savings", "transfer", 500, "2026-11-21"),
  ];
  assert.deepEqual(totals(items), { income: 3000, expenses: 200.5, net: 2799.5, count: 3 });
});

test("cash flow net equals income minus expenses in every bucket, including empty ones", () => {
  const items = [tx("a", "income", 100, "2026-01-15"), tx("b", "expense", 30, "2026-02-01"), tx("c", "transfer", 999, "2026-02-02")];
  const series = cashFlowSeries(items, { start: "2026-01-01", end: "2026-03-31" }, "month");
  assert.deepEqual(series.map(({ income, expenses, net }) => [income, expenses, net]), [[100, 0, 100], [0, 30, -30], [0, 0, 0]]);
  for (const point of series) assert.equal(point.net, point.income - point.expenses);
});

test("buckets aggregate by Monday weeks, quarters and years and clip to the range", () => {
  assert.equal(bucketStart("2026-11-25", "week"), "2026-11-23");
  assert.equal(bucketStart("2026-11-23", "week"), "2026-11-23");
  assert.equal(bucketStart("2026-03-31", "quarter"), "2026-01-01");
  assert.equal(bucketStart("2026-12-31", "year"), "2026-01-01");
  const weekly = buckets({ start: "2026-11-25", end: "2026-12-08" }, "week");
  assert.deepEqual(weekly.map(({ start, end }) => [start, end]), [["2026-11-25", "2026-11-29"], ["2026-11-30", "2026-12-06"], ["2026-12-07", "2026-12-08"]]);
  const quarterly = cashFlowSeries([tx("a", "expense", 10, "2026-02-01"), tx("b", "expense", 5, "2026-04-01")], { start: "2026-01-01", end: "2026-06-30" }, "quarter");
  assert.deepEqual(quarterly.map((p) => [p.label, p.expenses]), [["Q1 '26", 10], ["Q2 '26", 5]]);
  assert.equal(buckets({ start: "2025-06-01", end: "2026-02-01" }, "year").length, 2);
  assert.equal(buckets({ start: "2026-11-01", end: "2026-11-07" }, "day").length, 7);
});

test("date presets resolve to inclusive local ranges and comparable previous periods", () => {
  assert.deepEqual(resolveRange("7d", { now }), { start: "2026-11-19", end: "2026-11-25" });
  assert.deepEqual(resolveRange("6m", { now }), { start: "2026-06-01", end: "2026-11-25" });
  assert.deepEqual(resolveRange("ytd", { now }), { start: "2026-01-01", end: "2026-11-25" });
  assert.deepEqual(resolveRange("all", { now, earliest: "2024-03-02" }), { start: "2024-03-02", end: "2026-11-25" });
  assert.deepEqual(resolveRange("custom", { now, customStart: "2026-05-10", customEnd: "2026-05-01" }), { start: "2026-05-01", end: "2026-05-10" });
  assert.deepEqual(previousRange("30d", resolveRange("30d", { now })), { start: "2026-09-27", end: "2026-10-26" });
  assert.deepEqual(previousRange("6m", resolveRange("6m", { now })), { start: "2025-12-01", end: "2026-05-31" });
  assert.deepEqual(previousRange("ytd", resolveRange("ytd", { now })), { start: "2025-01-01", end: "2025-11-25" });
  assert.equal(previousRange("all", resolveRange("all", { now })), null);
  assert.equal(percentChange(120, 100), 20);
  assert.equal(percentChange(5, 0), null);
});

test("account filters keep only matching transactions and drop unassigned ones", () => {
  const items = [tx("a", "expense", 1, "2026-01-01", { accountId: "x" }), tx("b", "expense", 1, "2026-01-01", { accountId: "y" }), tx("c", "expense", 1, "2026-01-01")];
  assert.equal(filterByAccounts(items, []).length, 3);
  assert.deepEqual(filterByAccounts(items, ["x"]).map((item) => item.id), ["a"]);
});

test("spending breakdown uses expenses only, labels blanks as Uncategorized and folds into Other", () => {
  const items = [
    tx("rent", "expense", 1000, "2026-11-01", { category: "Housing" }),
    tx("food", "expense", 300, "2026-11-02", { category: "Groceries" }),
    tx("gum", "expense", 10, "2026-11-03", { category: "Snacks" }),
    tx("misc", "expense", 50, "2026-11-04", { category: "  " }),
    tx("salary", "income", 5000, "2026-11-05", { category: "Housing" }),
    tx("move", "transfer", 700, "2026-11-06", { category: "Housing" }),
  ];
  const slots = categorySlots(items);
  const { slices, total } = spendingByCategory(items, slots, { groupSmall: true });
  assert.equal(total, 1360);
  assert.deepEqual(slices.map((s) => [s.category, s.amount]), [["Housing", 1000], ["Groceries", 300], ["Uncategorized", 50], ["Other", 10]]);
  assert.deepEqual(slices.at(-1).members, ["Snacks"]);
  assert.equal(Math.round(slices.reduce((sum, s) => sum + s.share, 0) * 1000), 1000);
  // Without grouping, Snacks keeps its own slice.
  assert.ok(spendingByCategory(items, slots).slices.some((s) => s.category === "Snacks"));
});

test("category colors follow the category, not its rank in the filtered view", () => {
  const items = [tx("a", "expense", 500, "2026-01-01", { category: "Rent" }), tx("b", "expense", 50, "2026-11-01", { category: "Food" })];
  const slots = categorySlots(items);
  const november = spendingByCategory(items.filter((item) => item.date >= "2026-11-01"), slots);
  assert.equal(november.slices[0].category, "Food");
  assert.equal(november.slices[0].slot, slots.get("Food"));
  assert.equal(slots.get("Rent"), 0);
});

test("net worth subtracts liabilities, respects exclusions and matches netPosition", () => {
  const accounts = [account("chk", "checking", 1000), account("od", "checking", -50), account("card", "credit", 400), account("loan", "loan", 5000), account("hidden", "savings", 999, { includeInNetWorth: false })];
  const parts = currentNetWorth(accounts);
  assert.deepEqual(parts, { assets: 950, liabilities: 5400, netWorth: -4450 });
  assert.equal(parts.netWorth, netPosition(accounts));
  assert.deepEqual(currentNetWorth(accounts, ["chk", "card"]), { assets: 1000, liabilities: 400, netWorth: 600 });
});

test("net worth history comes only from snapshots and is never back-filled", () => {
  const snap = (date, balance) => ({ id: date, userId: "u", date, accounts: [{ accountId: "chk", name: "chk", type: "checking", balance, includeInNetWorth: true }, { accountId: "card", name: "card", type: "credit", balance: 100, includeInNetWorth: true }] });
  const series = netWorthSeries([snap("2026-11-10", 500), snap("2026-11-20", 800)], { start: "2026-11-08", end: "2026-11-22" }, "week");
  assert.deepEqual(series.map((p) => [p.start, p.netWorth, p.asOf]), [["2026-11-08", null, null], ["2026-11-09", 400, "2026-11-10"], ["2026-11-16", 700, "2026-11-20"]]);
});

test("asset allocation includes only positive asset balances, once each", () => {
  const accounts = [account("chk", "checking", 1000), account("sav", "savings", 3000), account("od", "checking", -20), account("card", "credit", 900), account("loan", "loan", 100), account("inv", "investment", 1000), account("hidden", "cash", 50, { includeInNetWorth: false })];
  const { groups, total, excludedNegative } = assetAllocation(accounts);
  assert.equal(total, 5000);
  assert.equal(excludedNegative, 1);
  assert.deepEqual(groups.map((g) => [g.type, g.amount, g.share]), [["checking", 1000, 0.2], ["savings", 3000, 0.6], ["investment", 1000, 0.2]]);
  assert.deepEqual(assetAllocation(accounts, ["sav"]).groups.map((g) => g.type), ["savings"]);
});

test("spending comparison defaults to this month to date vs all of last month", () => {
  const ranges = comparisonRanges("month", now);
  assert.deepEqual([ranges.current.start, ranges.current.end, ranges.previous.start, ranges.previous.end], ["2026-11-01", "2026-11-25", "2026-10-01", "2026-10-31"]);
  const items = [tx("a", "expense", 40, "2026-11-03", { category: "Food" }), tx("b", "expense", 60, "2026-10-03", { category: "Food" }), tx("c", "expense", 10, "2026-10-09", { category: "Fun" }), tx("d", "income", 900, "2026-11-01", { category: "Food" })];
  const { rows, available } = spendingComparison(items, ranges);
  assert.deepEqual(available, ["Food", "Fun"]);
  assert.deepEqual(rows, [{ category: "Food", current: 40, previous: 60, change: -20 }, { category: "Fun", current: 0, previous: 10, change: -10 }]);
  assert.deepEqual(comparisonRanges("year", now).previous, { start: "2025-01-01", end: "2025-11-25", label: "Same period 2025" });
});

test("CSV export protects formulas in text but keeps negative numbers", () => {
  assert.equal(toCsv(["Name", "Amount"], [["=SUM(A1)", -5], ["a,b", null]]), "Name,Amount\r\n'=SUM(A1),-5\r\n\"a,b\",");
});
