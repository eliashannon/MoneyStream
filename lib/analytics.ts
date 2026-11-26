/**
 * Analytics calculations. Pure functions only: no React, no storage, no DOM.
 *
 * Conventions shared with lib/finance.ts:
 * - Transaction amounts are non-negative; `type` carries the direction.
 * - Only "income" and "expense" transactions count toward cash flow. Transfers and
 *   credit card payments ("payment") move money between accounts and are excluded,
 *   so a card purchase is counted once (as the expense) and never again when paid.
 * - Account balances are positive numbers. Credit cards and loans are liabilities;
 *   every other account type is an asset. Accounts with includeInNetWorth === false
 *   are left out of net worth and asset allocation.
 * - Dates are local calendar days as "YYYY-MM-DD" strings, which sort correctly.
 */
import type { Account, BalanceSnapshot, SnapshotAccount, Transaction } from "./types";

export type RangePreset = "7d" | "30d" | "90d" | "6m" | "12m" | "ytd" | "all" | "custom";
export type Interval = "day" | "week" | "month" | "quarter" | "year";
export type ComparisonPreset = "month" | "quarter" | "30d" | "year";
export interface DateRange { start: string; end: string }
export interface LabeledRange extends DateRange { label: string }

export const RANGE_LABELS: Record<RangePreset, string> = {
  "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "6m": "Last 6 months",
  "12m": "Last 12 months", ytd: "Year to date", all: "All time", custom: "Custom range",
};
export const INTERVAL_LABELS: Record<Interval, string> = { day: "Daily", week: "Weekly", month: "Monthly", quarter: "Quarterly", year: "Yearly" };
export const COMPARISON_LABELS: Record<ComparisonPreset, string> = {
  month: "This month vs last month", quarter: "This quarter vs last quarter", "30d": "Last 30 days vs prior 30 days", year: "This year vs same period last year",
};
/** More points than this makes a line unreadable, so denser intervals are disabled. */
export const MAX_BUCKETS = 400;

// ---------- Dates ----------

export function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(value: string, days: number): string {
  const date = parseIso(value);
  date.setDate(date.getDate() + days);
  return iso(date);
}

function addMonths(value: string, months: number): string {
  const date = parseIso(value);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
  return iso(date);
}

export function daysInRange(range: DateRange): number {
  return Math.round((parseIso(range.end).getTime() - parseIso(range.start).getTime()) / 86_400_000) + 1;
}

const isIsoDate = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * Turns a preset into concrete inclusive dates ending today. "Last 6/12 months" are
 * calendar months including the current one, so monthly buckets are never partial
 * at the start. "All time" starts at the earliest known record.
 */
export function resolveRange(preset: RangePreset, options: { now?: Date; customStart?: string; customEnd?: string; earliest?: string } = {}): DateRange {
  const today = iso(options.now ?? new Date());
  const monthStart = today.slice(0, 8) + "01";
  switch (preset) {
    case "7d": return { start: addDays(today, -6), end: today };
    case "30d": return { start: addDays(today, -29), end: today };
    case "90d": return { start: addDays(today, -89), end: today };
    case "6m": return { start: addMonths(monthStart, -5), end: today };
    case "12m": return { start: addMonths(monthStart, -11), end: today };
    case "ytd": return { start: `${today.slice(0, 4)}-01-01`, end: today };
    case "all": return { start: options.earliest && options.earliest < today ? options.earliest : today, end: today };
    case "custom": {
      const start = isIsoDate(options.customStart) ? options.customStart! : options.earliest ?? today;
      const end = isIsoDate(options.customEnd) ? options.customEnd! : today;
      return start <= end ? { start, end } : { start: end, end: start };
    }
  }
}

/** The period of equal length immediately before `range`, or null for "All time". */
export function previousRange(preset: RangePreset, range: DateRange): DateRange | null {
  if (preset === "all") return null;
  if (preset === "ytd") return { start: addMonths(range.start, -12), end: addMonths(range.end, -12) };
  if (preset === "6m" || preset === "12m") {
    const months = preset === "6m" ? 6 : 12;
    return { start: addMonths(range.start, -months), end: addDays(range.start, -1) };
  }
  const days = daysInRange(range);
  return { start: addDays(range.start, -days), end: addDays(range.start, -1) };
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }): string {
  return parseIso(value).toLocaleDateString("en-US", options);
}

export function describeRange(range: DateRange): string {
  return range.start === range.end ? formatDate(range.start) : `${formatDate(range.start)} – ${formatDate(range.end)}`;
}

// ---------- Filtering ----------

/** An empty account list means "all accounts". Unassigned transactions only appear for "all". */
export function filterByAccounts<T extends { accountId?: string }>(items: T[], accountIds: string[]): T[] {
  if (!accountIds.length) return items;
  const wanted = new Set(accountIds);
  return items.filter((item) => item.accountId !== undefined && wanted.has(item.accountId));
}

export function inRange<T extends { date: string }>(items: T[], range: DateRange): T[] {
  return items.filter((item) => item.date >= range.start && item.date <= range.end);
}

export function earliestDate(transactions: Transaction[], snapshots: BalanceSnapshot[] = []): string | undefined {
  let earliest: string | undefined;
  for (const item of transactions) if (!earliest || item.date < earliest) earliest = item.date;
  if (snapshots.length && (!earliest || snapshots[0].date < earliest)) earliest = snapshots[0].date;
  return earliest;
}

// ---------- Cash flow ----------

export interface Totals { income: number; expenses: number; net: number; count: number }

export function totals(transactions: Transaction[]): Totals {
  let income = 0, expenses = 0, count = 0;
  for (const item of transactions) {
    if (item.type === "income") { income += item.amount; count += 1; }
    else if (item.type === "expense") { expenses += item.amount; count += 1; }
  }
  return { income: round(income), expenses: round(expenses), net: round(income - expenses), count };
}

/** Percentage change, or null when there is nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / Math.abs(previous) * 100;
}

export function bucketStart(date: string, interval: Interval): string {
  switch (interval) {
    case "day": return date;
    case "week": {
      const day = parseIso(date);
      const offset = (day.getDay() + 6) % 7; // Monday-based weeks
      return addDays(date, -offset);
    }
    case "month": return `${date.slice(0, 7)}-01`;
    case "quarter": {
      const month = Number(date.slice(5, 7));
      return `${date.slice(0, 4)}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
    }
    case "year": return `${date.slice(0, 4)}-01-01`;
  }
}

function nextBucket(start: string, interval: Interval): string {
  switch (interval) {
    case "day": return addDays(start, 1);
    case "week": return addDays(start, 7);
    case "month": return addMonths(start, 1);
    case "quarter": return addMonths(start, 3);
    case "year": return addMonths(start, 12);
  }
}

export interface Bucket { key: string; start: string; end: string; label: string; fullLabel: string }

export function bucketCount(range: DateRange, interval: Interval): number {
  const days = daysInRange(range);
  const months = (Number(range.end.slice(0, 4)) - Number(range.start.slice(0, 4))) * 12 + Number(range.end.slice(5, 7)) - Number(range.start.slice(5, 7)) + 1;
  switch (interval) {
    case "day": return days;
    case "week": return Math.ceil((days + 6) / 7);
    case "month": return months;
    case "quarter": return Math.ceil(months / 3) + 1;
    case "year": return Number(range.end.slice(0, 4)) - Number(range.start.slice(0, 4)) + 1;
  }
}

/** Picks a sensible default interval for the length of a range. */
export function suggestedInterval(range: DateRange): Interval {
  const days = daysInRange(range);
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  if (days <= 3 * 366) return "month";
  return "quarter";
}

export function buckets(range: DateRange, interval: Interval): Bucket[] {
  const multiYear = range.start.slice(0, 4) !== range.end.slice(0, 4);
  const result: Bucket[] = [];
  for (let key = bucketStart(range.start, interval); key <= range.end && result.length <= MAX_BUCKETS * 4; key = nextBucket(key, interval)) {
    const start = key < range.start ? range.start : key;
    const lastDay = addDays(nextBucket(key, interval), -1);
    const end = lastDay > range.end ? range.end : lastDay;
    result.push({ key, start, end, ...bucketLabels(key, interval, multiYear) });
  }
  return result;
}

function bucketLabels(key: string, interval: Interval, multiYear: boolean): { label: string; fullLabel: string } {
  const year = key.slice(0, 4);
  const shortYear = `'${year.slice(2)}`;
  switch (interval) {
    case "day": return { label: formatDate(key, { month: "short", day: "numeric" }) + (multiYear ? ` ${shortYear}` : ""), fullLabel: formatDate(key, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) };
    case "week": return { label: formatDate(key, { month: "short", day: "numeric" }) + (multiYear ? ` ${shortYear}` : ""), fullLabel: `Week of ${formatDate(key)}` };
    case "month": return { label: formatDate(key, { month: "short" }) + (multiYear ? ` ${shortYear}` : ""), fullLabel: formatDate(key, { month: "long", year: "numeric" }) };
    case "quarter": {
      const quarter = Math.floor((Number(key.slice(5, 7)) - 1) / 3) + 1;
      return { label: `Q${quarter} ${shortYear}`, fullLabel: `Q${quarter} ${year}` };
    }
    case "year": return { label: year, fullLabel: year };
  }
}

export interface CashFlowPoint extends Bucket { income: number; expenses: number; net: number }

/** Income, expenses and net (income − expenses) per bucket. Empty buckets are zero, not missing. */
export function cashFlowSeries(transactions: Transaction[], range: DateRange, interval: Interval): CashFlowPoint[] {
  const sums = new Map<string, { income: number; expenses: number }>();
  for (const item of inRange(transactions, range)) {
    if (item.type !== "income" && item.type !== "expense") continue;
    const key = bucketStart(item.date, interval);
    const entry = sums.get(key) ?? { income: 0, expenses: 0 };
    if (item.type === "income") entry.income += item.amount; else entry.expenses += item.amount;
    sums.set(key, entry);
  }
  return buckets(range, interval).map((bucket) => {
    const entry = sums.get(bucket.key) ?? { income: 0, expenses: 0 };
    return { ...bucket, income: round(entry.income), expenses: round(entry.expenses), net: round(entry.income - entry.expenses) };
  });
}

// ---------- Spending by category ----------

export const UNCATEGORIZED = "Uncategorized";
export const OTHER = "Other";
/** Named categorical slots available before folding into "Other" (8 colors, one reserved for Other). */
export const CATEGORY_SLOTS = 7;

export function categoryOf(item: Transaction): string {
  return item.category.trim() || UNCATEGORIZED;
}

/**
 * Stable color order for categories: ranked by all-time expense total, so a
 * category keeps its color when filters change. Returns category -> slot index.
 */
export function categorySlots(transactions: Transaction[]): Map<string, number> {
  const totalsByCategory = new Map<string, number>();
  for (const item of transactions) if (item.type === "expense") totalsByCategory.set(categoryOf(item), (totalsByCategory.get(categoryOf(item)) ?? 0) + item.amount);
  totalsByCategory.delete(OTHER);
  return new Map([...totalsByCategory].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, CATEGORY_SLOTS).map(([category], index) => [category, index]));
}

export interface CategorySlice { category: string; amount: number; share: number; count: number; slot: number | null; members: string[] }

/**
 * Expense totals by category, largest first. Categories without a color slot, an
 * explicit "Other" category and (when groupSmall) categories under `threshold` of
 * the total are folded into a final "Other" slice that lists its members.
 */
export function spendingByCategory(transactions: Transaction[], slots: Map<string, number>, options: { groupSmall?: boolean; threshold?: number } = {}): { slices: CategorySlice[]; total: number } {
  const threshold = options.threshold ?? 0.03;
  const byCategory = new Map<string, { amount: number; count: number }>();
  for (const item of transactions) {
    if (item.type !== "expense") continue;
    const entry = byCategory.get(categoryOf(item)) ?? { amount: 0, count: 0 };
    entry.amount += item.amount; entry.count += 1;
    byCategory.set(categoryOf(item), entry);
  }
  const total = [...byCategory.values()].reduce((sum, entry) => sum + entry.amount, 0);
  const named: CategorySlice[] = [];
  const other: CategorySlice = { category: OTHER, amount: 0, share: 0, count: 0, slot: null, members: [] };
  for (const [category, entry] of byCategory) {
    const slot = slots.get(category);
    const share = total ? entry.amount / total : 0;
    if (slot === undefined || (options.groupSmall && share < threshold)) {
      other.amount += entry.amount; other.count += entry.count; other.members.push(category);
    } else named.push({ category, amount: round(entry.amount), share, count: entry.count, slot, members: [category] });
  }
  named.sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
  if (other.count) named.push({ ...other, amount: round(other.amount), share: total ? other.amount / total : 0, members: other.members.sort() });
  return { slices: named, total: round(total) };
}

// ---------- Net worth and assets ----------

export const isLiability = (type: Account["type"]) => type === "credit" || type === "loan";

export interface NetWorthParts { assets: number; liabilities: number; netWorth: number }

type Balance = Pick<SnapshotAccount, "type" | "balance" | "includeInNetWorth"> & { id: string };

function netWorthOf(items: Balance[], accountIds: string[]): NetWorthParts {
  const wanted = accountIds.length ? new Set(accountIds) : null;
  let assets = 0, liabilities = 0;
  for (const item of items) {
    if (!item.includeInNetWorth || (wanted && !wanted.has(item.id))) continue;
    if (isLiability(item.type)) liabilities += item.balance; else assets += item.balance;
  }
  return { assets: round(assets), liabilities: round(liabilities), netWorth: round(assets - liabilities) };
}

/** Net worth from live account balances. Matches netPosition() in lib/finance.ts. */
export function currentNetWorth(accounts: Account[], accountIds: string[] = []): NetWorthParts {
  return netWorthOf(accounts.map((account) => ({ id: account.id, type: account.type, balance: account.balance, includeInNetWorth: account.includeInNetWorth !== false })), accountIds);
}

export function snapshotNetWorth(snapshot: BalanceSnapshot, accountIds: string[] = []): NetWorthParts {
  return netWorthOf(snapshot.accounts.map((account) => ({ ...account, id: account.accountId })), accountIds);
}

/** The latest snapshot recorded on or before `date` (snapshots must be sorted by date). */
export function snapshotOnOrBefore(snapshots: BalanceSnapshot[], date: string): BalanceSnapshot | undefined {
  let found: BalanceSnapshot | undefined;
  for (const snapshot of snapshots) {
    if (snapshot.date > date) break;
    found = snapshot;
  }
  return found;
}

export interface NetWorthPoint extends Bucket { netWorth: number | null; assets: number | null; liabilities: number | null; asOf: string | null }

/**
 * Net worth at the end of each bucket, from recorded balance snapshots. Balances
 * only change when edited, so the latest recording on or before a date is the
 * balance on that date. Buckets before the first recording have no value (null):
 * history is never back-filled from today's balances.
 */
export function netWorthSeries(snapshots: BalanceSnapshot[], range: DateRange, interval: Interval, accountIds: string[] = []): NetWorthPoint[] {
  return buckets(range, interval).map((bucket) => {
    const snapshot = snapshotOnOrBefore(snapshots, bucket.end);
    if (!snapshot) return { ...bucket, netWorth: null, assets: null, liabilities: null, asOf: null };
    return { ...bucket, ...snapshotNetWorth(snapshot, accountIds), asOf: snapshot.date };
  });
}

export const ASSET_GROUPS = [
  { type: "checking", label: "Checking" },
  { type: "savings", label: "Savings" },
  { type: "cash", label: "Cash" },
  { type: "investment", label: "Investments" },
  { type: "other", label: "Other assets" },
] as const;
export type AssetType = (typeof ASSET_GROUPS)[number]["type"];

export interface AllocationGroup { type: AssetType; label: string; amount: number; share: number; accounts: { id: string; name: string; institution: string; balance: number }[] }

/**
 * Positive asset balances grouped by account type. Liabilities, negative or zero
 * balances and accounts excluded from net position are left out; each account is
 * counted once.
 */
export function assetAllocation(accounts: Account[], accountIds: string[] = []): { groups: AllocationGroup[]; total: number; excludedNegative: number } {
  const wanted = accountIds.length ? new Set(accountIds) : null;
  const groups = ASSET_GROUPS.map(({ type, label }) => ({ type, label, amount: 0, share: 0, accounts: [] as AllocationGroup["accounts"] }));
  let excludedNegative = 0;
  for (const account of accounts) {
    if (isLiability(account.type) || account.includeInNetWorth === false || (wanted && !wanted.has(account.id))) continue;
    if (account.balance <= 0) { if (account.balance < 0) excludedNegative += 1; continue; }
    const group = groups.find((item) => item.type === account.type)!;
    group.amount += account.balance;
    group.accounts.push({ id: account.id, name: account.name, institution: account.institution, balance: account.balance });
  }
  const total = groups.reduce((sum, group) => sum + group.amount, 0);
  return {
    groups: groups.filter((group) => group.amount > 0).map((group) => ({ ...group, amount: round(group.amount), share: total ? group.amount / total : 0, accounts: group.accounts.sort((a, b) => b.balance - a.balance) })),
    total: round(total),
    excludedNegative,
  };
}

// ---------- Spending comparison (radar) ----------

export function comparisonRanges(preset: ComparisonPreset, now = new Date()): { current: LabeledRange; previous: LabeledRange } {
  const today = iso(now);
  if (preset === "30d") {
    const current = { start: addDays(today, -29), end: today };
    return { current: { ...current, label: "Last 30 days" }, previous: { start: addDays(today, -59), end: addDays(today, -30), label: "Prior 30 days" } };
  }
  if (preset === "year") {
    const start = `${today.slice(0, 4)}-01-01`;
    const lastYear = String(Number(today.slice(0, 4)) - 1);
    return { current: { start, end: today, label: `${today.slice(0, 4)} to date` }, previous: { start: addMonths(start, -12), end: addMonths(today, -12), label: `Same period ${lastYear}` } };
  }
  if (preset === "quarter") {
    const start = bucketStart(today, "quarter");
    const previousStart = addMonths(start, -3);
    const q = (value: string) => `Q${Math.floor((Number(value.slice(5, 7)) - 1) / 3) + 1} ${value.slice(0, 4)}`;
    return { current: { start, end: today, label: `${q(start)} (to date)` }, previous: { start: previousStart, end: addDays(start, -1), label: q(previousStart) } };
  }
  const start = `${today.slice(0, 7)}-01`;
  const previousStart = addMonths(start, -1);
  return {
    current: { start, end: today, label: `${formatDate(start, { month: "long" })} (to date)` },
    previous: { start: previousStart, end: addDays(start, -1), label: formatDate(previousStart, { month: "long", year: previousStart.slice(0, 4) === start.slice(0, 4) ? undefined : "numeric" }) },
  };
}

export interface ComparisonRow { category: string; current: number; previous: number; change: number }

/** Expense totals per category in two periods. `categories` defaults to the 8 largest combined. */
export function spendingComparison(transactions: Transaction[], ranges: { current: DateRange; previous: DateRange }, categories?: string[]): { rows: ComparisonRow[]; available: string[] } {
  const sum = (range: DateRange) => {
    const map = new Map<string, number>();
    for (const item of inRange(transactions, range)) if (item.type === "expense") map.set(categoryOf(item), (map.get(categoryOf(item)) ?? 0) + item.amount);
    return map;
  };
  const current = sum(ranges.current);
  const previous = sum(ranges.previous);
  const combined = new Map<string, number>();
  for (const [category, amount] of [...current, ...previous]) combined.set(category, (combined.get(category) ?? 0) + amount);
  const available = [...combined].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([category]) => category);
  // A chosen category with no spending in either period is kept and shown as zero.
  const chosen = categories?.length ? categories : available.slice(0, 8);
  return {
    available,
    rows: chosen.map((category) => {
      const a = round(current.get(category) ?? 0), b = round(previous.get(category) ?? 0);
      return { category, current: a, previous: b, change: round(a - b) };
    }),
  };
}

// ---------- Formatting and export ----------

export function compactCurrency(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}$${trim(abs / 1_000)}k`;
  return `${sign}$${trim(abs)}`;
}

function trim(value: number) {
  return value >= 100 ? Math.round(value).toString() : String(Math.round(value * 10) / 10);
}

/** CSV with spreadsheet-formula protection on text cells. Numbers are written as-is. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const cell = (value: string | number | null) => {
    if (value === null) return "";
    if (typeof value === "number") return String(value);
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
