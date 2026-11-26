/**
 * The analytics dashboard's layout and per-widget settings, persisted per user in
 * browser storage alongside the theme preference (see lib/client-state.tsx).
 */
import { z } from "zod";
import type { ComparisonPreset, Interval, RangePreset } from "./analytics";

export const WIDGET_IDS = ["cashFlow", "spending", "netWorth", "allocation", "radar"] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];
export type WidgetSize = "full" | "half";

export interface WidgetSettings {
  id: WidgetId;
  size: WidgetSize;
  showLegend: boolean;
  /** When true the widget follows the dashboard's date range and account filter. */
  useGlobalFilters: boolean;
  range: RangePreset;
  customStart: string;
  customEnd: string;
  accountIds: string[];
  interval: Interval | "auto";
  hiddenSeries: string[];
  groupSmall: boolean;
  showBreakdown: boolean;
  comparison: ComparisonPreset;
  radarCategories: string[];
}

export interface AnalyticsLayout {
  version: 1;
  range: RangePreset;
  customStart: string;
  customEnd: string;
  accountIds: string[];
  widgets: WidgetSettings[];
}

export const WIDGET_INFO: Record<WidgetId, { title: string; description: string; defaultSize: WidgetSize }> = {
  cashFlow: { title: "Cash Flow", description: "Income, expenses and net cash flow over time.", defaultSize: "full" },
  spending: { title: "Spending Breakdown", description: "How your expenses split across categories.", defaultSize: "half" },
  netWorth: { title: "Net Worth Growth", description: "Assets minus liabilities, from your recorded balance history.", defaultSize: "half" },
  allocation: { title: "Asset Allocation", description: "How your assets are spread across account types.", defaultSize: "half" },
  radar: { title: "Spending Comparison", description: "Category spending in one period against another.", defaultSize: "half" },
};

export function defaultWidget(id: WidgetId): WidgetSettings {
  return {
    id, size: WIDGET_INFO[id].defaultSize, showLegend: true, useGlobalFilters: true,
    range: "6m", customStart: "", customEnd: "", accountIds: [], interval: "auto", hiddenSeries: [],
    groupSmall: true, showBreakdown: false, comparison: "month", radarCategories: [],
  };
}

export function defaultLayout(): AnalyticsLayout {
  return { version: 1, range: "6m", customStart: "", customEnd: "", accountIds: [], widgets: WIDGET_IDS.map(defaultWidget) };
}

const range = z.enum(["7d", "30d", "90d", "6m", "12m", "ytd", "all", "custom"]);
const widgetSchema = z.object({
  id: z.enum(WIDGET_IDS),
  size: z.enum(["full", "half"]),
  showLegend: z.boolean(),
  useGlobalFilters: z.boolean(),
  range,
  customStart: z.string(),
  customEnd: z.string(),
  accountIds: z.array(z.string()),
  interval: z.enum(["auto", "day", "week", "month", "quarter", "year"]),
  hiddenSeries: z.array(z.string()),
  groupSmall: z.boolean(),
  showBreakdown: z.boolean(),
  comparison: z.enum(["month", "quarter", "30d", "year"]),
  radarCategories: z.array(z.string()),
});
const layoutSchema = z.object({
  version: z.literal(1), range, customStart: z.string(), customEnd: z.string(), accountIds: z.array(z.string()),
  widgets: z.array(widgetSchema),
});

const key = (userId: string) => `moneystream-analytics:${userId}`;

/** Reads the saved layout, falling back to the default when missing or invalid. */
export function loadLayout(userId: string): AnalyticsLayout {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return defaultLayout();
    // Fill any settings added after the layout was saved, then validate.
    const parsed = JSON.parse(raw) as Partial<AnalyticsLayout>;
    const merged = { ...defaultLayout(), ...parsed, widgets: (parsed.widgets ?? []).map((widget) => ({ ...defaultWidget(widget.id as WidgetId), ...widget })) };
    const layout = layoutSchema.parse(merged);
    const seen = new Set<WidgetId>();
    layout.widgets = layout.widgets.filter((widget) => !seen.has(widget.id) && seen.add(widget.id));
    return layout;
  } catch {
    return defaultLayout();
  }
}

export function saveLayout(userId: string, layout: AnalyticsLayout): void {
  try { localStorage.setItem(key(userId), JSON.stringify(layout)); } catch { /* storage full or blocked: keep working in memory */ }
}

/** Removes saved analytics layouts for every local profile (used by "Erase all local data"). */
export function clearSavedLayouts(): void {
  for (const name of Object.keys(localStorage)) if (name.startsWith("moneystream-analytics:")) localStorage.removeItem(name);
}

/** Drops account IDs that no longer exist so deleted accounts don't silently empty a chart. */
export function pruneAccounts(ids: string[], known: Set<string>): string[] {
  return ids.filter((id) => known.has(id));
}
