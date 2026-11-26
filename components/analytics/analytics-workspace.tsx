"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, Info, LayoutGrid, Plus, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { currency } from "@/lib/finance";
import {
  addDays, assetAllocation, bucketCount, daysInRange, cashFlowSeries, categoryOf, categorySlots, COMPARISON_LABELS, comparisonRanges, currentNetWorth, describeRange,
  earliestDate, filterByAccounts, formatDate, inRange, INTERVAL_LABELS, MAX_BUCKETS, netWorthSeries, percentChange, previousRange, RANGE_LABELS,
  resolveRange, snapshotNetWorth, snapshotOnOrBefore, spendingByCategory, spendingComparison, suggestedInterval, toCsv, totals,
  type AllocationGroup, type CategorySlice, type ComparisonPreset, type DateRange, type Interval, type RangePreset,
} from "@/lib/analytics";
import { defaultLayout, defaultWidget, loadLayout, pruneAccounts, saveLayout, WIDGET_IDS, WIDGET_INFO, type AnalyticsLayout, type WidgetId, type WidgetSettings } from "@/lib/analytics-layout";
import type { Account, BalanceSnapshot, Transaction } from "@/lib/types";
import { AllocationDonut, CashFlowChart, curveFor, NetWorthChart, SpendingDonut, SpendingRadar } from "./charts";
import { AccountChecklist, AccountPicker, accountSummary, DataTable, Dialog, InfoTip, WidgetBoundary } from "./chart-kit";
import { WidgetCard } from "./widget-card";

type Props = { userId: string; accounts: Account[]; transactions: Transaction[]; snapshots: BalanceSnapshot[]; loading: boolean; snapshotError: string };

type DialogState =
  | { kind: "add" } | { kind: "reset" }
  | { kind: "settings" | "expand" | "remove"; id: WidgetId }
  | { kind: "category"; id: WidgetId; slice: CategorySlice }
  | { kind: "allocation"; group: AllocationGroup };

interface Filters { preset: RangePreset; range: DateRange; accountIds: string[]; label: string }

/** What a widget needs to render: computed once per render from the current filters. */
interface WidgetModel {
  subtitle: ReactNode;
  tools?: ReactNode;
  note?: ReactNode;
  empty?: { title: string; text: string };
  error?: string;
  chart: (height: number) => ReactNode;
  table: { columns: { label: string; numeric?: boolean }[]; rows: (string | number)[][] };
  csv: { headers: string[]; rows: (string | number | null)[][] };
}

const RANGE_PRESETS = Object.keys(RANGE_LABELS) as RangePreset[];
const INTERVALS = Object.keys(INTERVAL_LABELS) as Interval[];
const NET_WORTH_HELP = "Net worth = total assets − total liabilities. Assets are checking, savings, cash, investment and other asset accounts; liabilities are credit card and loan balances. Accounts excluded from net position are left out.";

export function AnalyticsWorkspace({ userId, accounts, transactions, snapshots, loading, snapshotError }: Props) {
  const [layout, setLayout] = useState<AnalyticsLayout>(() => loadLayout(userId));
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dragging, setDragging] = useState<WidgetId | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => { saveLayout(userId, layout); }, [userId, layout]);

  const knownIds = useMemo(() => new Set(accounts.map((account) => account.id)), [accounts]);
  const earliest = useMemo(() => earliestDate(transactions, snapshots), [transactions, snapshots]);
  const earliestTransaction = useMemo(() => earliestDate(transactions), [transactions]);
  const slots = useMemo(() => categorySlots(transactions), [transactions]);

  function filtersFor(widget?: WidgetSettings): Filters {
    const source = !widget || widget.useGlobalFilters ? layout : widget;
    const range = resolveRange(source.range, { customStart: source.customStart, customEnd: source.customEnd, earliest });
    return { preset: source.range, range, accountIds: pruneAccounts(source.accountIds, knownIds), label: source.range === "custom" ? describeRange(range) : RANGE_LABELS[source.range] };
  }
  const global = filtersFor();
  const customInvalid = layout.range === "custom" && !!layout.customStart && !!layout.customEnd && layout.customStart > layout.customEnd;

  // ---------- Layout changes ----------
  const updateWidget = (id: WidgetId, patch: Partial<WidgetSettings>) => setLayout((current) => ({ ...current, widgets: current.widgets.map((widget) => widget.id === id ? { ...widget, ...patch } : widget) }));
  function move(id: WidgetId, offset: -1 | 1) {
    setLayout((current) => {
      const widgets = [...current.widgets];
      const from = widgets.findIndex((widget) => widget.id === id);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= widgets.length) return current;
      [widgets[from], widgets[to]] = [widgets[to], widgets[from]];
      return { ...current, widgets };
    });
    setAnnouncement(`${WIDGET_INFO[id].title} moved ${offset < 0 ? "earlier" : "later"}.`);
  }
  function dropOn(target: WidgetId, after: boolean) {
    if (!dragging) return;
    const id = dragging;
    setLayout((current) => {
      const moving = current.widgets.find((widget) => widget.id === id);
      if (!moving) return current;
      const rest = current.widgets.filter((widget) => widget.id !== id);
      const index = rest.findIndex((widget) => widget.id === target) + (after ? 1 : 0);
      return { ...current, widgets: [...rest.slice(0, index), moving, ...rest.slice(index)] };
    });
    setAnnouncement(`${WIDGET_INFO[id].title} moved.`);
  }
  function add(id: WidgetId) {
    setLayout((current) => current.widgets.some((widget) => widget.id === id) ? current : { ...current, widgets: [...current.widgets, defaultWidget(id)] });
    setAnnouncement(`${WIDGET_INFO[id].title} added to the dashboard.`);
  }
  function remove(id: WidgetId) {
    setLayout((current) => ({ ...current, widgets: current.widgets.filter((widget) => widget.id !== id) }));
    setAnnouncement(`${WIDGET_INFO[id].title} removed from the dashboard.`);
  }

  // ---------- Overview ----------
  const overviewTx = filterByAccounts(transactions, global.accountIds);
  const current = totals(inRange(overviewTx, global.range));
  const previousPeriod = previousRange(global.preset, global.range);
  const comparable = previousPeriod && earliestTransaction && earliestTransaction <= previousPeriod.start ? totals(inRange(overviewTx, previousPeriod)) : null;
  const versus = comparisonLabel(global.preset, global.range);
  const worth = currentNetWorth(accounts, global.accountIds);
  const startSnapshot = snapshotOnOrBefore(snapshots, addDays(global.range.start, -1));
  const startWorth = startSnapshot ? snapshotNetWorth(startSnapshot, global.accountIds).netWorth : null;

  // ---------- Widgets ----------
  function intervalFor(widget: WidgetSettings, range: DateRange): { interval: Interval; adjusted: boolean } {
    const suggested = suggestedInterval(range);
    if (widget.interval === "auto") return { interval: suggested, adjusted: false };
    return bucketCount(range, widget.interval) > MAX_BUCKETS ? { interval: suggested, adjusted: true } : { interval: widget.interval, adjusted: false };
  }

  function intervalSelect(widget: WidgetSettings, range: DateRange, active: Interval) {
    return <label className="compact-field"><span className="sr-only">Interval for {WIDGET_INFO[widget.id].title}</span>
      <select className="input compact-select" value={widget.interval} onChange={(event) => updateWidget(widget.id, { interval: event.target.value as WidgetSettings["interval"] })}>
        <option value="auto">Auto ({INTERVAL_LABELS[widget.interval === "auto" ? active : suggestedInterval(range)]})</option>
        {INTERVALS.map((interval) => <option key={interval} value={interval} disabled={bucketCount(range, interval) > MAX_BUCKETS}>{INTERVAL_LABELS[interval]}</option>)}
      </select></label>;
  }

  function toggleSeries(widget: WidgetSettings, key: string) {
    updateWidget(widget.id, { hiddenSeries: widget.hiddenSeries.includes(key) ? widget.hiddenSeries.filter((item) => item !== key) : [...widget.hiddenSeries, key] });
  }

  function model(widget: WidgetSettings): WidgetModel {
    const filters = filtersFor(widget);
    const accountLabel = accountSummary(accounts, filters.accountIds);
    const scoped = filterByAccounts(transactions, filters.accountIds);

    if (widget.id === "cashFlow") {
      const { interval, adjusted } = intervalFor(widget, filters.range);
      const data = cashFlowSeries(scoped, filters.range, interval);
      const empty = totals(inRange(scoped, filters.range)).count === 0;
      return {
        subtitle: `${filters.label} · ${accountLabel}`,
        tools: intervalSelect(widget, filters.range, interval),
        note: adjusted ? `${INTERVAL_LABELS[widget.interval as Interval]} has too many points for this range, so ${INTERVAL_LABELS[interval].toLowerCase()} is shown.` : "Transfers and credit card payments are excluded.",
        empty: empty ? { title: "No income or expenses in this period", text: "Add transactions or choose a longer date range." } : undefined,
        chart: (height) => <CashFlowChart data={data} curve={curveFor(interval)} hidden={widget.hiddenSeries} onToggle={(key) => toggleSeries(widget, key)} showLegend={widget.showLegend} height={height} />,
        table: { columns: [{ label: "Period" }, { label: "Income", numeric: true }, { label: "Expenses", numeric: true }, { label: "Net cash flow", numeric: true }], rows: data.map((point) => [point.fullLabel, currency.format(point.income), currency.format(point.expenses), currency.format(point.net)]) },
        csv: { headers: ["Period start", "Period end", "Income", "Expenses", "Net cash flow"], rows: data.map((point) => [point.start, point.end, point.income, point.expenses, point.net]) },
      };
    }

    if (widget.id === "spending") {
      const { slices, total } = spendingByCategory(inRange(scoped, filters.range), slots, { groupSmall: widget.groupSmall });
      return {
        subtitle: `${filters.label} · ${accountLabel}`,
        note: "Expenses only. Transfers, income and card payments are excluded.",
        empty: slices.length ? undefined : { title: "No expenses in this period", text: "Recorded expenses will be grouped by category here." },
        chart: (height) => <SpendingDonut slices={slices} total={total} showLegend={widget.showLegend} height={height} onSelect={(slice) => setDialog({ kind: "category", id: widget.id, slice })} />,
        table: { columns: [{ label: "Category" }, { label: "Amount", numeric: true }, { label: "Share", numeric: true }, { label: "Transactions", numeric: true }], rows: slices.map((slice) => [slice.members.length > 1 ? `Other (${slice.members.join(", ")})` : slice.category, currency.format(slice.amount), `${(slice.share * 100).toFixed(1)}%`, slice.count]) },
        csv: { headers: ["Category", "Includes", "Amount", "Share (%)", "Transactions"], rows: slices.map((slice) => [slice.category, slice.members.join("; "), slice.amount, Math.round(slice.share * 1000) / 10, slice.count]) },
      };
    }

    if (widget.id === "netWorth") {
      const { interval, adjusted } = intervalFor(widget, filters.range);
      const points = netWorthSeries(snapshots, filters.range, interval, filters.accountIds);
      const recorded = points.filter((point) => point.netWorth !== null);
      const historyStart = snapshots[0]?.date;
      const partial = !historyStart || historyStart > filters.range.start;
      return {
        subtitle: <>Assets − liabilities · {filters.label} <InfoTip label="net worth">{NET_WORTH_HELP}</InfoTip></>,
        tools: intervalSelect(widget, filters.range, interval),
        note: adjusted ? `${INTERVAL_LABELS[widget.interval as Interval]} has too many points for this range, so ${INTERVAL_LABELS[interval].toLowerCase()} is shown.`
          : partial ? <>Balance history starts {historyStart ? formatDate(historyStart) : "today"}. MoneyStream records your balances each day you open it, so this chart fills in over time. Earlier balances are not estimated.</> : undefined,
        error: snapshotError || undefined,
        empty: !recorded.length ? { title: "No balance history yet", text: accounts.length ? "Your balances will be recorded the next time accounts load." : "Add an account to start tracking net worth." } : undefined,
        chart: (height) => <NetWorthChart data={points} curve={curveFor(interval)} showBreakdown={widget.showBreakdown} showLegend={widget.showLegend} height={height} />,
        table: { columns: [{ label: "Period" }, { label: "Net worth", numeric: true }, { label: "Assets", numeric: true }, { label: "Liabilities", numeric: true }, { label: "Balances recorded" }], rows: points.map((point) => [point.fullLabel, point.netWorth === null ? "No data" : currency.format(point.netWorth), point.assets === null ? "—" : currency.format(point.assets), point.liabilities === null ? "—" : currency.format(point.liabilities), point.asOf ? formatDate(point.asOf) : "—"]) },
        csv: { headers: ["Period start", "Period end", "Net worth", "Assets", "Liabilities", "Balances recorded on"], rows: points.map((point) => [point.start, point.end, point.netWorth, point.assets, point.liabilities, point.asOf]) },
      };
    }

    if (widget.id === "allocation") {
      const { groups, total, excludedNegative } = assetAllocation(accounts, filters.accountIds);
      return {
        subtitle: `Current balances · ${accountLabel}`,
        note: excludedNegative ? `${excludedNegative} asset account${excludedNegative === 1 ? " has" : "s have"} a negative balance and ${excludedNegative === 1 ? "isn't" : "aren't"} shown. Liabilities are never included.` : "Positive asset balances only. Liabilities are not included.",
        empty: groups.length ? undefined : { title: "No asset balances to show", text: "Accounts with a positive checking, savings, cash, investment or other asset balance appear here." },
        chart: (height) => <AllocationDonut groups={groups} total={total} showLegend={widget.showLegend} height={height} onSelect={(group) => setDialog({ kind: "allocation", group })} />,
        table: { columns: [{ label: "Account type" }, { label: "Balance", numeric: true }, { label: "Share", numeric: true }, { label: "Accounts", numeric: true }], rows: groups.map((group) => [group.label, currency.format(group.amount), `${(group.share * 100).toFixed(1)}%`, group.accounts.length]) },
        csv: { headers: ["Account type", "Account", "Institution", "Balance", "Share of assets (%)"], rows: groups.flatMap((group) => group.accounts.map((account) => [group.label, account.name, account.institution, account.balance, total ? Math.round(account.balance / total * 1000) / 10 : 0])) },
      };
    }

    const ranges = comparisonRanges(widget.comparison);
    const { rows, available } = spendingComparison(scoped, ranges, widget.radarCategories.length ? widget.radarCategories : undefined);
    const anySpending = rows.some((row) => row.current || row.previous);
    return {
      subtitle: `${ranges.current.label} vs ${ranges.previous.label} · ${accountLabel}`,
      tools: <label className="compact-field"><span className="sr-only">Comparison period</span><select className="input compact-select" value={widget.comparison} onChange={(event) => updateWidget(widget.id, { comparison: event.target.value as ComparisonPreset })}>
        {(Object.keys(COMPARISON_LABELS) as ComparisonPreset[]).map((preset) => <option key={preset} value={preset}>{COMPARISON_LABELS[preset]}</option>)}
      </select></label>,
      note: available.length > rows.length && !widget.radarCategories.length ? `Showing the ${rows.length} largest of ${available.length} categories. Choose categories in Configure chart.` : "Differences are shown as amounts, not judged as good or bad.",
      empty: anySpending ? undefined : { title: "No expenses in either period", text: "Choose another comparison period or record some expenses." },
      chart: (height) => <SpendingRadar rows={rows} labels={{ current: ranges.current.label, previous: ranges.previous.label }} hidden={widget.hiddenSeries} onToggle={(key) => toggleSeries(widget, key)} showLegend={widget.showLegend} height={height} />,
      table: { columns: [{ label: "Category" }, { label: ranges.current.label, numeric: true }, { label: ranges.previous.label, numeric: true }, { label: "Difference", numeric: true }], rows: rows.map((row) => [row.category, currency.format(row.current), currency.format(row.previous), `${row.change > 0 ? "+" : ""}${currency.format(row.change)}`]) },
      csv: { headers: ["Category", `${ranges.current.label} (${ranges.current.start} to ${ranges.current.end})`, `${ranges.previous.label} (${ranges.previous.start} to ${ranges.previous.end})`, "Difference"], rows: rows.map((row) => [row.category, row.current, row.previous, row.change]) },
    };
  }

  function download(id: WidgetId, data: WidgetModel["csv"]) {
    const url = URL.createObjectURL(new Blob([toCsv(data.headers, data.rows)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `moneystream-${id}-${new Date().toLocaleDateString("en-CA")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function body(widget: WidgetSettings, data: WidgetModel, height: number) {
    if (data.error) return <div className="widget-message" role="alert"><strong>Balance history couldn&apos;t be loaded.</strong><p>{data.error}</p></div>;
    if (data.empty) return <EmptyState compact icon={LayoutGrid} title={data.empty.title}>{data.empty.text}</EmptyState>;
    return <WidgetBoundary title={WIDGET_INFO[widget.id].title}>{data.chart(height)}</WidgetBoundary>;
  }

  const shown = layout.widgets;
  const available = WIDGET_IDS.filter((id) => !shown.some((widget) => widget.id === id));
  const active = dialog && "id" in dialog ? shown.find((widget) => widget.id === dialog.id) : undefined;

  return <section className="workspace analytics" id="analytics">
    <header className="page-head">
      <div><h1>Analytics</h1><p>Understand your finances through interactive visualizations.</p></div>
      <div className="page-actions">
        <button type="button" className="button secondary small" onClick={() => setDialog({ kind: "reset" })}><RotateCcw size={15} aria-hidden /> Reset dashboard</button>
        <button type="button" className="button primary small" onClick={() => setDialog({ kind: "add" })}><Plus size={16} aria-hidden /> Add Analytics</button>
      </div>
    </header>

    <div className="analytics-filters" role="group" aria-label="Dashboard filters">
      <label className="filter-field"><span>Date range</span>
        <select className="input" value={layout.range} onChange={(event) => setLayout((current) => ({ ...current, range: event.target.value as RangePreset }))}>
          {RANGE_PRESETS.map((preset) => <option key={preset} value={preset}>{RANGE_LABELS[preset]}</option>)}
        </select></label>
      {layout.range === "custom" && <>
        <label className="filter-field"><span>From</span><input className="input" type="date" value={layout.customStart} max={layout.customEnd || undefined} aria-invalid={customInvalid || undefined} onChange={(event) => setLayout((current) => ({ ...current, customStart: event.target.value }))} /></label>
        <label className="filter-field"><span>To</span><input className="input" type="date" value={layout.customEnd} min={layout.customStart || undefined} aria-invalid={customInvalid || undefined} onChange={(event) => setLayout((current) => ({ ...current, customEnd: event.target.value }))} /></label>
      </>}
      <div className="filter-field"><span id="analytics-accounts-label">Accounts</span><AccountPicker accounts={accounts} value={global.accountIds} onChange={(ids) => setLayout((current) => ({ ...current, accountIds: ids }))} /></div>
      <p className="filter-summary" aria-live="polite">{describeRange(global.range)}</p>
    </div>
    {customInvalid && <p className="field-error" role="alert">The start date must not be after the end date. Showing {describeRange(global.range)}.</p>}

    {loading ? <div className="overview-grid" aria-busy="true">{[0, 1, 2, 3].map((n) => <div className="skeleton overview-skeleton" key={n} />)}<p className="sr-only" role="status">Loading analytics...</p></div> : <div className="overview-grid">
      <OverviewCard label="Total income" value={current.income} delta={comparable && changeText(current.income, comparable.income, "percent", "up-good", versus)} empty={!comparable ? noComparison(previousPeriod) : undefined} />
      <OverviewCard label="Total expenses" value={current.expenses} delta={comparable && changeText(current.expenses, comparable.expenses, "percent", "up-bad", versus)} empty={!comparable ? noComparison(previousPeriod) : undefined} />
      <OverviewCard label="Net cash flow" value={current.net} info="Income minus expenses. Transfers and credit card payments are excluded." delta={comparable && changeText(current.net, comparable.net, "amount", "up-good", versus)} empty={!comparable ? noComparison(previousPeriod) : undefined} />
      <OverviewCard featured label="Net worth" value={worth.netWorth} info={NET_WORTH_HELP} sub={`Assets ${currency.format(worth.assets)} · Liabilities ${currency.format(worth.liabilities)}`}
        delta={startWorth !== null && startSnapshot ? changeText(worth.netWorth, startWorth, "amount", "up-good", `since ${formatDate(startSnapshot.date)}`) : null}
        empty={startWorth === null ? `No balance history before ${formatDate(global.range.start)}` : undefined} />
    </div>}

    {loading ? <div className="widget-grid">{shown.map((widget) => <div key={widget.id} className={`skeleton widget-skeleton ${widget.size}`} />)}</div>
      : shown.length ? <div className="widget-grid">
        {shown.map((widget, index) => {
          const data = model(widget);
          return <WidgetCard key={widget.id} settings={widget} title={WIDGET_INFO[widget.id].title} subtitle={data.subtitle} tools={data.tools}
            isFirst={index === 0} isLast={index === shown.length - 1} canDownload={!data.empty && !data.error}
            dragging={dragging} onDragStart={setDragging} onDragEnd={() => setDragging(null)} onDrop={dropOn}
            actions={{ configure: () => setDialog({ kind: "settings", id: widget.id }), expand: () => setDialog({ kind: "expand", id: widget.id }), download: () => download(widget.id, data.csv), remove: () => setDialog({ kind: "remove", id: widget.id }), move: (offset) => move(widget.id, offset), update: (patch) => updateWidget(widget.id, patch) }}>
            {body(widget, data, widget.size === "full" ? 300 : 260)}
            {data.note && !data.empty && !data.error && <p className="widget-note"><Info size={14} aria-hidden /> <span>{data.note}</span></p>}
          </WidgetCard>;
        })}
      </div>
      : <EmptyState icon={LayoutGrid} title="Your analytics workspace is empty" action={<button type="button" className="button primary small" onClick={() => setDialog({ kind: "add" })}><Plus size={16} aria-hidden /> Add Analytics</button>}>Choose the charts you want to see. You can add, remove and rearrange them at any time.</EmptyState>}

    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>

    {dialog?.kind === "add" && <Dialog title="Add analytics" description="Choose the charts to show on your dashboard. Each chart can appear once." size="lg" onClose={() => setDialog(null)} footer={<button type="button" className="button secondary" onClick={() => setDialog(null)}>Done</button>}>
      <ul className="widget-catalog">
        {WIDGET_IDS.map((id) => {
          const added = shown.some((widget) => widget.id === id);
          return <li key={id} className={added ? "added" : ""}>
            <ChartPreview id={id} />
            <div><h3>{WIDGET_INFO[id].title}</h3><p>{WIDGET_INFO[id].description}</p></div>
            {added ? <span className="badge success plain"><Check size={12} aria-hidden /> On dashboard</span>
              : <button type="button" className="button primary small" onClick={() => add(id)}><Plus size={15} aria-hidden /> Add to dashboard</button>}
          </li>;
        })}
      </ul>
      {!available.length && <p className="section-note">All five charts are on your dashboard.</p>}
    </Dialog>}

    {dialog?.kind === "reset" && <Dialog title="Restore the default dashboard?" size="sm" onClose={() => setDialog(null)} footer={<><button type="button" className="button secondary" onClick={() => setDialog(null)}>Cancel</button><button type="button" className="button primary" onClick={() => { setLayout(defaultLayout()); setDialog(null); setAnnouncement("Default dashboard restored."); }}>Restore default</button></>}>
      <p className="muted">All five charts return in their original order and sizes. Chart settings and the dashboard date range and account filter are reset. Your financial data is not changed.</p>
    </Dialog>}

    {dialog?.kind === "remove" && active && <Dialog title={`Remove ${WIDGET_INFO[active.id].title}?`} size="sm" onClose={() => setDialog(null)} footer={<><button type="button" className="button secondary" onClick={() => setDialog(null)}>Cancel</button><button type="button" className="button destructive" onClick={() => { remove(active.id); setDialog(null); }}>Remove chart</button></>}>
      <p className="muted">The chart and its settings are removed from your dashboard. You can add it back from Add Analytics. Your financial data is not changed.</p>
    </Dialog>}

    {dialog?.kind === "settings" && active && <SettingsDialog widget={active} accounts={accounts} earliest={earliest} categories={spendingComparison(transactions, comparisonRanges(active.comparison)).available}
      onClose={() => setDialog(null)} onSave={(patch) => { updateWidget(active.id, patch); setDialog(null); }} />}

    {dialog?.kind === "expand" && active && (() => {
      const data = model(active);
      return <Dialog title={WIDGET_INFO[active.id].title} description={data.subtitle} size="xl" onClose={() => setDialog(null)}
        footer={<><button type="button" className="button secondary" disabled={!!data.empty || !!data.error} onClick={() => download(active.id, data.csv)}>Download data (CSV)</button><button type="button" className="button primary" onClick={() => setDialog(null)}>Close</button></>}>
        {data.tools && <div className="expand-tools">{data.tools}</div>}
        {body(active, data, 420)}
        {data.note && !data.empty && <p className="widget-note"><Info size={14} aria-hidden /> <span>{data.note}</span></p>}
        {!data.empty && !data.error && <DataTable caption="Values shown in the chart" columns={data.table.columns} rows={data.table.rows} />}
      </Dialog>;
    })()}

    {dialog?.kind === "category" && (() => {
      const widget = shown.find((item) => item.id === dialog.id);
      const filters = filtersFor(widget);
      const items = inRange(filterByAccounts(transactions, filters.accountIds), filters.range).filter((item) => item.type === "expense" && dialog.slice.members.includes(categoryOf(item))).sort((a, b) => b.date.localeCompare(a.date));
      const names = new Map(accounts.map((account) => [account.id, account.name]));
      return <Dialog title={dialog.slice.category} size="lg" onClose={() => setDialog(null)} footer={<button type="button" className="button primary" onClick={() => setDialog(null)}>Close</button>}
        description={<>{items.length} expense{items.length === 1 ? "" : "s"} totaling {currency.format(dialog.slice.amount)} · {filters.label}{dialog.slice.members.length > 1 && <> · Includes {dialog.slice.members.join(", ")}</>}</>}>
        <DataTable caption={`Expenses in ${dialog.slice.category}`} columns={[{ label: "Date" }, { label: "Description" }, { label: "Category" }, { label: "Account" }, { label: "Amount", numeric: true }]}
          rows={items.map((item) => [formatDate(item.date), item.description, categoryOf(item), item.accountId ? names.get(item.accountId) ?? "Unavailable" : "None", currency.format(item.amount)])} />
      </Dialog>;
    })()}

    {dialog?.kind === "allocation" && <Dialog title={dialog.group.label} size="md" description={`${dialog.group.accounts.length} account${dialog.group.accounts.length === 1 ? "" : "s"} · ${currency.format(dialog.group.amount)} (${(dialog.group.share * 100).toFixed(1)}% of assets)`} onClose={() => setDialog(null)} footer={<button type="button" className="button primary" onClick={() => setDialog(null)}>Close</button>}>
      <DataTable caption={`Accounts in ${dialog.group.label}`} columns={[{ label: "Account" }, { label: "Institution" }, { label: "Balance", numeric: true }, { label: "Share of type", numeric: true }]}
        rows={dialog.group.accounts.map((account) => [account.name, account.institution, currency.format(account.balance), `${(account.balance / dialog.group.amount * 100).toFixed(1)}%`])} />
    </Dialog>}
  </section>;
}

// ---------- Overview helpers ----------

type Delta = { text: string; direction: "up" | "down" | "flat"; tone: "good" | "bad" | "neutral" };

function changeText(current: number, previous: number, mode: "percent" | "amount", polarity: "up-good" | "up-bad", versus: string): Delta {
  const diff = current - previous;
  const direction = Math.abs(diff) < 0.005 ? "flat" : diff > 0 ? "up" : "down";
  const tone = direction === "flat" ? "neutral" : (direction === "up") === (polarity === "up-good") ? "good" : "bad";
  if (direction === "flat") return { text: `No change ${versus}`, direction, tone };
  if (mode === "percent") {
    const pct = percentChange(current, previous);
    if (pct === null) return { text: `${diff > 0 ? "+" : "−"}${currency.format(Math.abs(diff))} ${versus}`, direction, tone };
    return { text: `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}% ${versus}`, direction, tone };
  }
  return { text: `${diff > 0 ? "+" : "−"}${currency.format(Math.abs(diff))} ${versus}`, direction, tone };
}

function comparisonLabel(preset: RangePreset, range: DateRange): string {
  switch (preset) {
    case "ytd": return "vs same period last year";
    case "6m": return "vs prior 6 months";
    case "12m": return "vs prior 12 months";
    case "7d": return "vs prior 7 days";
    case "30d": return "vs prior 30 days";
    case "90d": return "vs prior 90 days";
    default: return `vs prior ${daysInRange(range)} days`;
  }
}

function noComparison(previous: DateRange | null): string {
  return previous ? "Not enough history to compare" : "No comparison for all time";
}

function OverviewCard({ label, value, delta, empty, info, sub, featured }: { label: string; value: number; delta?: Delta | null; empty?: string; info?: string; sub?: string; featured?: boolean }) {
  const Icon = delta?.direction === "up" ? ArrowUpRight : delta?.direction === "down" ? ArrowDownRight : ArrowRight;
  return <div className={`overview-card${featured ? " featured" : ""}`}>
    <div className="overview-label"><span>{label}</span>{info && <InfoTip label={label.toLowerCase()}>{info}</InfoTip>}</div>
    <strong className={value < 0 ? "is-negative" : undefined}>{currency.format(value)}</strong>
    {sub && <small className="overview-sub">{sub}</small>}
    {delta ? <small className={`overview-delta ${delta.tone}`}><Icon size={14} aria-hidden />{delta.text}</small> : empty ? <small className="overview-delta neutral">{empty}</small> : null}
  </div>;
}

// ---------- Add-analytics previews ----------

function ChartPreview({ id }: { id: WidgetId }) {
  const common = { width: 64, height: 44, viewBox: "0 0 64 44", "aria-hidden": true, className: "chart-preview" } as const;
  if (id === "cashFlow") return <svg {...common}><path d="M4 32 L16 22 L28 26 L40 12 L60 16" fill="none" stroke="var(--viz-income)" strokeWidth="2.5" strokeLinecap="round" /><path d="M4 36 L16 30 L28 32 L40 28 L60 30" fill="none" stroke="var(--viz-expenses)" strokeWidth="2.5" strokeLinecap="round" /><path d="M4 40 L16 38 L28 39 L40 31 L60 33" fill="none" stroke="var(--viz-net)" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" /></svg>;
  if (id === "netWorth") return <svg {...common}><path d="M4 34 L18 30 L30 31 L44 20 L60 12 L60 42 L4 42 Z" fill="var(--viz-income)" opacity=".16" /><path d="M4 34 L18 30 L30 31 L44 20 L60 12" fill="none" stroke="var(--viz-income)" strokeWidth="2.5" strokeLinecap="round" /></svg>;
  if (id === "radar") return <svg {...common}><polygon points="32,4 56,18 48,40 16,40 8,18" fill="none" stroke="var(--border-strong)" /><polygon points="32,10 50,19 44,34 20,36 14,20" fill="var(--viz-current)" opacity=".2" stroke="var(--viz-current)" strokeWidth="2" /><polygon points="32,16 46,21 40,32 24,32 18,22" fill="none" stroke="var(--viz-previous)" strokeWidth="2" strokeDasharray="3 2" /></svg>;
  const colors = id === "spending" ? ["var(--viz-cat-1)", "var(--viz-cat-2)", "var(--viz-cat-3)", "var(--viz-other)"] : ["var(--viz-cat-1)", "var(--viz-cat-2)", "var(--viz-cat-4)"];
  const shares = id === "spending" ? [0.42, 0.26, 0.18, 0.14] : [0.3, 0.55, 0.15];
  let angle = -Math.PI / 2;
  return <svg {...common}>{shares.map((share, index) => {
    const start = angle; angle += share * Math.PI * 2;
    const r = 17, cx = 32, cy = 22;
    const large = share > 0.5 ? 1 : 0;
    return <path key={index} d={`M ${cx + r * Math.cos(start)} ${cy + r * Math.sin(start)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(angle)} ${cy + r * Math.sin(angle)}`} fill="none" stroke={colors[index]} strokeWidth="7" />;
  })}</svg>;
}

// ---------- Settings dialog ----------

function SettingsDialog({ widget, accounts, earliest, categories, onClose, onSave }: { widget: WidgetSettings; accounts: Account[]; earliest?: string; categories: string[]; onClose: () => void; onSave: (patch: Partial<WidgetSettings>) => void }) {
  const [draft, setDraft] = useState(widget);
  const set = (patch: Partial<WidgetSettings>) => setDraft((current) => ({ ...current, ...patch }));
  const usesRange = widget.id !== "allocation" && widget.id !== "radar";
  const usesInterval = widget.id === "cashFlow" || widget.id === "netWorth";
  const range = resolveRange(draft.range, { customStart: draft.customStart, customEnd: draft.customEnd, earliest });
  const invalid = draft.range === "custom" && !!draft.customStart && !!draft.customEnd && draft.customStart > draft.customEnd;
  const radarChoices = [...new Set([...categories, ...draft.radarCategories])];

  return <Dialog title={`Configure ${WIDGET_INFO[widget.id].title}`} description="Changes apply to this chart only." size="md" onClose={onClose}
    footer={<><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="button" className="button primary" disabled={invalid} onClick={() => onSave(draft)}>Save changes</button></>}>
    <div className="settings-form">
      <fieldset className="segmented-field"><legend>Width</legend>
        {(["full", "half"] as const).map((size) => <label key={size}><input type="radio" name="widget-size" checked={draft.size === size} onChange={() => set({ size })} /> {size === "full" ? "Full width" : "Half width"}</label>)}
      </fieldset>
      <label className="check-row"><input type="checkbox" checked={draft.showLegend} onChange={(event) => set({ showLegend: event.target.checked })} /> Show legend</label>

      {usesInterval && <label className="field"><span className="field-label">Interval</span><select className="input" value={draft.interval} onChange={(event) => set({ interval: event.target.value as WidgetSettings["interval"] })}>
        <option value="auto">Automatic</option>
        {INTERVALS.map((interval) => <option key={interval} value={interval} disabled={bucketCount(range, interval) > MAX_BUCKETS}>{INTERVAL_LABELS[interval]}</option>)}
      </select></label>}
      {widget.id === "spending" && <label className="check-row"><input type="checkbox" checked={draft.groupSmall} onChange={(event) => set({ groupSmall: event.target.checked })} /> Group categories under 3% into Other</label>}
      {widget.id === "netWorth" && <label className="check-row"><input type="checkbox" checked={draft.showBreakdown} onChange={(event) => set({ showBreakdown: event.target.checked })} /> Show assets and liabilities separately</label>}
      {widget.id === "radar" && <>
        <label className="field"><span className="field-label">Compare</span><select className="input" value={draft.comparison} onChange={(event) => set({ comparison: event.target.value as ComparisonPreset })}>
          {(Object.keys(COMPARISON_LABELS) as ComparisonPreset[]).map((preset) => <option key={preset} value={preset}>{COMPARISON_LABELS[preset]}</option>)}
        </select></label>
        <fieldset className="check-list"><legend>Categories <span>{draft.radarCategories.length ? `${draft.radarCategories.length} selected` : "8 largest shown"}</span></legend>
          <label className="check-row"><input type="checkbox" checked={!draft.radarCategories.length} onChange={() => set({ radarCategories: [] })} /> Largest categories automatically</label>
          {radarChoices.map((category) => <label className="check-row" key={category}><input type="checkbox" checked={draft.radarCategories.includes(category)} onChange={() => set({ radarCategories: draft.radarCategories.includes(category) ? draft.radarCategories.filter((item) => item !== category) : [...draft.radarCategories, category] })} /> {category}</label>)}
          {!radarChoices.length && <p className="section-note">No expense categories in these periods yet.</p>}
        </fieldset>
      </>}

      <label className="check-row"><input type="checkbox" checked={draft.useGlobalFilters} onChange={(event) => set({ useGlobalFilters: event.target.checked })} /> Use the dashboard {usesRange ? "date range and account filter" : "account filter"}</label>
      {!draft.useGlobalFilters && <div className="settings-own">
        {usesRange && <label className="field"><span className="field-label">Date range</span><select className="input" value={draft.range} onChange={(event) => set({ range: event.target.value as RangePreset })}>
          {RANGE_PRESETS.map((preset) => <option key={preset} value={preset}>{RANGE_LABELS[preset]}</option>)}
        </select></label>}
        {usesRange && draft.range === "custom" && <div className="form-grid compact">
          <label className="field"><span className="field-label">From</span><input className="input" type="date" value={draft.customStart} aria-invalid={invalid || undefined} onChange={(event) => set({ customStart: event.target.value })} /></label>
          <label className="field"><span className="field-label">To</span><input className="input" type="date" value={draft.customEnd} aria-invalid={invalid || undefined} onChange={(event) => set({ customEnd: event.target.value })} /></label>
        </div>}
        {invalid && <p className="field-error" role="alert">The start date must not be after the end date.</p>}
        <AccountChecklist accounts={accounts} value={pruneAccounts(draft.accountIds, new Set(accounts.map((account) => account.id)))} onChange={(ids) => set({ accountIds: ids })} />
      </div>}
      {widget.id === "radar" && <p className="section-note">This chart uses its own comparison periods instead of a date range.</p>}
      {widget.id === "allocation" && <p className="section-note">Asset allocation always uses current balances, so it has no date range.</p>}
    </div>
  </Dialog>;
}
