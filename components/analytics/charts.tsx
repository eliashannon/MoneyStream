"use client";

import { useId, useState } from "react";
import { Area, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { ChartTooltip } from "@/components/dashboard/chart-tooltip";
import { currency } from "@/lib/finance";
import { compactCurrency, formatDate, type AllocationGroup, type CashFlowPoint, type CategorySlice, type ComparisonRow, type NetWorthPoint } from "@/lib/analytics";
import { ALLOCATION_COLORS, categoryColor, LegendToggles, SERIES, TooltipBox, useChartAnimation, type LegendItem } from "./chart-kit";

type TooltipArgs = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> };
const rowOf = <T,>(args: TooltipArgs) => (args.active ? args.payload?.[0]?.payload as T | undefined : undefined);
const percent = (share: number) => `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;

/** Smoothing suits aggregated periods; sparse daily or weekly points read more honestly as straight segments. */
export type Curve = "monotone" | "linear";
export const curveFor = (interval: string): Curve => (interval === "day" || interval === "week" ? "linear" : "monotone");

const axisTick = { fontSize: 12, fill: "var(--chart-label)" };
const animation = (animate: boolean) => ({ isAnimationActive: animate, animationDuration: 450, animationEasing: "ease-out" as const });

// ---------- 1. Cash flow ----------

export function CashFlowChart({ data, hidden, onToggle, showLegend, height, curve }: { data: CashFlowPoint[]; hidden: string[]; onToggle: (key: string) => void; showLegend: boolean; height: number; curve: Curve }) {
  const animate = useChartAnimation();
  const sum = (key: "income" | "expenses" | "net") => data.reduce((total, point) => total + point[key], 0);
  const legend: LegendItem[] = [
    { key: "income", label: "Income", color: SERIES.income, detail: currency.format(sum("income")) },
    { key: "expenses", label: "Expenses", color: SERIES.expenses, detail: currency.format(sum("expenses")) },
    { key: "net", label: "Net cash flow", color: SERIES.net, dashed: true, detail: currency.format(sum("net")) },
  ];
  const negative = data.some((point) => point.net < 0) && !hidden.includes("net");
  return <>
    {showLegend && <LegendToggles items={legend} hidden={hidden} onToggle={onToggle} />}
    <div className="viz-plot" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} minTickGap={18} interval="preserveStartEnd" />
          <YAxis width={60} tickLine={false} axisLine={false} tick={axisTick} tickFormatter={compactCurrency} />
          {negative && <ReferenceLine y={0} stroke="var(--border-strong)" />}
          <ChartTooltip cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} content={(args: TooltipArgs) => {
            const row = rowOf<CashFlowPoint>(args);
            if (!row) return null;
            return <TooltipBox title={row.fullLabel} rows={[
              { label: "Income", value: currency.format(row.income), color: SERIES.income },
              { label: "Expenses", value: currency.format(row.expenses), color: SERIES.expenses },
              { label: "Net cash flow", value: currency.format(row.net), color: SERIES.net, dashed: true },
            ].filter((item, index) => !hidden.includes(["income", "expenses", "net"][index]))} />;
          }} />
          <Line type={curve} dataKey="income" name="Income" stroke={SERIES.income} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} hide={hidden.includes("income")} {...animation(animate)} />
          <Line type={curve} dataKey="expenses" name="Expenses" stroke={SERIES.expenses} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} hide={hidden.includes("expenses")} {...animation(animate)} />
          <Line type={curve} dataKey="net" name="Net cash flow" stroke={SERIES.net} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} hide={hidden.includes("net")} {...animation(animate)} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </>;
}

// ---------- Shared donut ----------

interface DonutSlice { key: string; label: string; amount: number; share: number; color: string; detail?: string }

function Donut({ slices, total, centerLabel, onSelect, showLegend, height, tooltipNote, selectHint }: {
  slices: DonutSlice[]; total: number; centerLabel: string; onSelect: (key: string) => void; showLegend: boolean; height: number;
  tooltipNote: (key: string) => string | undefined; selectHint: string;
}) {
  const animate = useChartAnimation();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? slices : slices.slice(0, 6);
  return <div className={`donut-layout${showLegend ? "" : " no-legend"}`}>
    <div className="donut-plot" style={{ height: Math.min(height, 260) }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <ChartTooltip content={(args: TooltipArgs) => {
            const row = rowOf<DonutSlice>(args);
            if (!row) return null;
            return <TooltipBox title={row.label} rows={[{ label: "Amount", value: currency.format(row.amount), color: row.color }, { label: "Share", value: percent(row.share) }, ...(row.detail ? [{ label: "Includes", value: row.detail }] : [])]} note={tooltipNote(row.key) ?? selectHint} />;
          }} />
          <Pie data={slices} dataKey="amount" nameKey="label" innerRadius="64%" outerRadius="92%" stroke="var(--surface)" strokeWidth={slices.length > 1 ? 2 : 0} paddingAngle={slices.length > 1 ? 1 : 0}
            onClick={(_, index) => onSelect(slices[index].key)} className="donut-pie" {...animation(animate)}>
            {slices.map((slice) => <Cell key={slice.key} fill={slice.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center" aria-hidden="true"><span>{centerLabel}</span><strong>{compactCurrency(total)}</strong></div>
    </div>
    {showLegend && <div className="donut-legend">
      <ul>
        {visible.map((slice) => <li key={slice.key}><button type="button" onClick={() => onSelect(slice.key)} aria-label={`${slice.label}: ${currency.format(slice.amount)}, ${percent(slice.share)}. ${selectHint}`}>
          <i style={{ background: slice.color }} aria-hidden="true" />
          <span className="donut-legend-name">{slice.label}</span>
          <span className="donut-legend-value">{currency.format(slice.amount)}</span>
          <span className="donut-legend-share">{percent(slice.share)}</span>
          <span className="donut-legend-bar" aria-hidden="true"><span style={{ width: `${slice.share * 100}%`, background: slice.color }} /></span>
        </button></li>)}
      </ul>
      {slices.length > 6 && <button type="button" className="text-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? "Show fewer" : `Show all ${slices.length}`}</button>}
    </div>}
  </div>;
}

// ---------- 2. Spending breakdown ----------

export function SpendingDonut({ slices, total, onSelect, showLegend, height }: { slices: CategorySlice[]; total: number; onSelect: (slice: CategorySlice) => void; showLegend: boolean; height: number }) {
  return <Donut total={total} centerLabel="Total spent" showLegend={showLegend} height={height} selectHint="Select to see transactions."
    slices={slices.map((slice) => ({ key: slice.category, label: slice.category, amount: slice.amount, share: slice.share, color: categoryColor(slice.slot), detail: slice.members.length > 1 ? slice.members.join(", ") : undefined }))}
    tooltipNote={(key) => { const slice = slices.find((item) => item.category === key); return slice ? `${slice.count} transaction${slice.count === 1 ? "" : "s"}. Select to see them.` : undefined; }}
    onSelect={(key) => { const slice = slices.find((item) => item.category === key); if (slice) onSelect(slice); }} />;
}

// ---------- 3. Net worth ----------

export function NetWorthChart({ data, showBreakdown, showLegend, height, curve }: { data: NetWorthPoint[]; showBreakdown: boolean; showLegend: boolean; height: number; curve: Curve }) {
  const animate = useChartAnimation();
  const gradient = useId().replace(/:/g, "");
  const recorded = data.filter((point) => point.netWorth !== null);
  const negative = recorded.some((point) => (point.netWorth ?? 0) < 0);
  const single = recorded.length === 1;
  // A flat or single-value series would give identical tick labels, so pad the axis around it.
  const values = recorded.flatMap((point) => showBreakdown ? [point.netWorth!, point.assets!, point.liabilities!] : [point.netWorth!]);
  const low = Math.min(...values, ...(negative ? [0] : [])), high = Math.max(...values);
  const pad = Math.max(Math.abs(high) * 0.1, 100);
  const domain: [number, number] | ["auto", "auto"] = values.length && high - low < pad ? [Math.floor((low - pad) / 100) * 100, Math.ceil((high + pad) / 100) * 100] : ["auto", "auto"];
  const items: LegendItem[] = [{ key: "netWorth", label: "Net worth", color: SERIES.income }, ...(showBreakdown ? [{ key: "assets", label: "Assets", color: SERIES.net }, { key: "liabilities", label: "Liabilities", color: SERIES.expenses, dashed: true }] : [])];
  return <>
    {showLegend && showBreakdown && <div className="viz-legend static">{items.map((item) => <span key={item.key} className="viz-legend-item"><i className={item.dashed ? "dashed" : ""} style={{ background: item.color }} aria-hidden="true" /><span>{item.label}</span></span>)}</div>}
    <div className="viz-plot" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SERIES.income} stopOpacity={0.22} /><stop offset="100%" stopColor={SERIES.income} stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} minTickGap={18} interval="preserveStartEnd" />
          <YAxis width={60} tickLine={false} axisLine={false} tick={axisTick} tickFormatter={compactCurrency} domain={domain} />
          {negative && <ReferenceLine y={0} stroke="var(--border-strong)" />}
          <ChartTooltip cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} content={(args: TooltipArgs) => {
            const row = rowOf<NetWorthPoint>(args);
            if (!row) return null;
            if (row.netWorth === null) return <TooltipBox title={row.fullLabel} rows={[]} note="No balance history recorded yet for this period." />;
            return <TooltipBox title={row.fullLabel} rows={[
              { label: "Net worth", value: currency.format(row.netWorth), color: SERIES.income },
              ...(showBreakdown ? [{ label: "Assets", value: currency.format(row.assets ?? 0), color: SERIES.net }, { label: "Liabilities", value: currency.format(row.liabilities ?? 0), color: SERIES.expenses, dashed: true }] : []),
            ]} note={row.asOf ? `Balances recorded ${formatDate(row.asOf)}` : undefined} />;
          }} />
          <Area type={curve} dataKey="netWorth" name="Net worth" stroke={SERIES.income} strokeWidth={2} fill={`url(#${gradient})`} baseValue={negative ? 0 : "dataMin"} connectNulls={false} dot={single ? { r: 5, fill: SERIES.income, strokeWidth: 0 } : false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} {...animation(animate)} />
          {showBreakdown && <Line type={curve} dataKey="assets" name="Assets" stroke={SERIES.net} strokeWidth={2} dot={single ? { r: 4 } : false} connectNulls={false} {...animation(animate)} />}
          {showBreakdown && <Line type={curve} dataKey="liabilities" name="Liabilities" stroke={SERIES.expenses} strokeWidth={2} strokeDasharray="6 4" dot={single ? { r: 4 } : false} connectNulls={false} {...animation(animate)} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  </>;
}

// ---------- 4. Asset allocation ----------

export function AllocationDonut({ groups, total, onSelect, showLegend, height }: { groups: AllocationGroup[]; total: number; onSelect: (group: AllocationGroup) => void; showLegend: boolean; height: number }) {
  return <Donut total={total} centerLabel="Total assets" showLegend={showLegend} height={height} selectHint="Select to see the accounts."
    slices={groups.map((group) => ({ key: group.type, label: group.label, amount: group.amount, share: group.share, color: ALLOCATION_COLORS[group.type], detail: `${group.accounts.length} account${group.accounts.length === 1 ? "" : "s"}` }))}
    tooltipNote={() => "Select to see the accounts."}
    onSelect={(key) => { const group = groups.find((item) => item.type === key); if (group) onSelect(group); }} />;
}

// ---------- 5. Spending comparison ----------

export function SpendingRadar({ rows, labels, hidden, onToggle, showLegend, height }: { rows: ComparisonRow[]; labels: { current: string; previous: string }; hidden: string[]; onToggle: (key: string) => void; showLegend: boolean; height: number }) {
  const animate = useChartAnimation();
  const legend: LegendItem[] = [
    { key: "current", label: labels.current, color: SERIES.current, detail: currency.format(rows.reduce((sum, row) => sum + row.current, 0)) },
    { key: "previous", label: labels.previous, color: SERIES.previous, dashed: true, detail: currency.format(rows.reduce((sum, row) => sum + row.previous, 0)) },
  ];
  const shortName = (value: string) => (value.length > 14 ? `${value.slice(0, 13)}…` : value);
  const plottable = rows.length >= 3;
  // When one category dwarfs the rest, a linear radius squeezes everything else into
  // the center. A square-root radius keeps small categories readable; the note says so.
  const values = rows.flatMap((row) => [row.current, row.previous]).filter((value) => value > 0).sort((a, b) => a - b);
  const median = values.length ? values[Math.floor(values.length / 2)] : 0;
  const sqrtScale = median > 0 && values[values.length - 1] / median > 4;
  const spokeOffset = rows.length ? 90 - 180 / rows.length : 90;
  return <>
    {showLegend && plottable && <LegendToggles items={legend} hidden={hidden} onToggle={onToggle} />}
    {!plottable && <p className="widget-note">A radar needs at least three categories, so the comparison is listed below.</p>}
    {plottable && sqrtScale && <p className="viz-scale-note">Square-root scale, so smaller categories stay visible next to large ones.</p>}
    {plottable && <div className="viz-plot" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={rows} outerRadius="72%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid stroke="var(--chart-grid)" />
          <PolarAngleAxis dataKey="category" tick={{ ...axisTick, fill: "var(--text)" }} tickFormatter={shortName} />
          <PolarRadiusAxis angle={spokeOffset} scale={sqrtScale ? "sqrt" : "linear"} domain={[0, "auto"]} tick={{ fontSize: 11, fill: "var(--chart-label)" }} tickFormatter={compactCurrency} axisLine={false} tickCount={4} />
          <ChartTooltip content={(args: TooltipArgs) => {
            const row = rowOf<ComparisonRow>(args);
            if (!row) return null;
            return <TooltipBox title={row.category} rows={[
              { label: labels.current, value: currency.format(row.current), color: SERIES.current },
              { label: labels.previous, value: currency.format(row.previous), color: SERIES.previous, dashed: true },
              { label: "Difference", value: `${row.change > 0 ? "+" : ""}${currency.format(row.change)}` },
            ]} />;
          }} />
          <Radar name={labels.previous} dataKey="previous" stroke={SERIES.previous} strokeWidth={2} strokeDasharray="6 4" fill={SERIES.previous} fillOpacity={0.08} dot={{ r: 3 }} hide={hidden.includes("previous")} {...animation(animate)} />
          <Radar name={labels.current} dataKey="current" stroke={SERIES.current} strokeWidth={2} fill={SERIES.current} fillOpacity={0.16} dot={{ r: 3 }} hide={hidden.includes("current")} {...animation(animate)} />
        </RadarChart>
      </ResponsiveContainer>
    </div>}
    <ul className="change-list" aria-label="Change by category">
      {[...rows].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).map((row) => {
        const Icon = row.change > 0 ? ArrowUpRight : row.change < 0 ? ArrowDownRight : ArrowRight;
        return <li key={row.category}><span>{row.category}</span><span className="change-value"><Icon size={14} aria-hidden />{row.change === 0 ? "No change" : `${row.change > 0 ? "+" : "−"}${currency.format(Math.abs(row.change))}`}</span></li>;
      })}
    </ul>
  </>;
}
