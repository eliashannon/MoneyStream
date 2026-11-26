"use client";

import { Component, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown, Info, X } from "lucide-react";
import type { Account } from "@/lib/types";

// ---------- Colors ----------
// Series and category colors are CSS variables (see "Analytics" in globals.css) so
// light and dark themes each use their own validated steps.

export const SERIES = {
  income: "var(--viz-income)",
  expenses: "var(--viz-expenses)",
  net: "var(--viz-net)",
  current: "var(--viz-current)",
  previous: "var(--viz-previous)",
} as const;

export const OTHER_COLOR = "var(--viz-other)";
export const categoryColor = (slot: number | null) => (slot === null ? OTHER_COLOR : `var(--viz-cat-${slot + 1})`);
export const ALLOCATION_COLORS: Record<string, string> = {
  checking: "var(--viz-cat-1)", savings: "var(--viz-cat-2)", cash: "var(--viz-cat-3)", investment: "var(--viz-cat-4)", other: "var(--viz-cat-5)",
};

// ---------- Motion ----------

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(callback: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/** False when the viewer asked for reduced motion; charts then skip their entry animation. */
export function useChartAnimation(): boolean {
  return !useSyncExternalStore(subscribeMotion, () => window.matchMedia(motionQuery).matches, () => true);
}

// ---------- Tooltip ----------

export interface TooltipRow { label: string; value: string; color?: string; dashed?: boolean }

export function TooltipBox({ title, rows, note }: { title: string; rows: TooltipRow[]; note?: string }) {
  return <div className="viz-tooltip">
    <p className="viz-tooltip-title">{title}</p>
    <dl>{rows.map((row) => <div key={row.label}><dt>{row.color && <i className={row.dashed ? "dashed" : ""} style={{ background: row.color }} />}{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
    {note && <p className="viz-tooltip-note">{note}</p>}
  </div>;
}

// ---------- Legend ----------

export interface LegendItem { key: string; label: string; color: string; dashed?: boolean; detail?: string }

/** Legend entries are toggle buttons, so series can be hidden by mouse, touch or keyboard. */
export function LegendToggles({ items, hidden, onToggle }: { items: LegendItem[]; hidden: string[]; onToggle: (key: string) => void }) {
  return <div className="viz-legend" role="group" aria-label="Show or hide series">
    {items.map((item) => {
      const off = hidden.includes(item.key);
      const last = !off && items.filter((entry) => !hidden.includes(entry.key)).length === 1;
      return <button key={item.key} type="button" className="viz-legend-item" aria-pressed={!off} disabled={last} title={last ? "At least one series stays visible" : undefined} onClick={() => onToggle(item.key)}>
        <i className={item.dashed ? "dashed" : ""} style={{ background: item.color }} aria-hidden="true" />
        <span>{item.label}</span>
        {item.detail && <b>{item.detail}</b>}
      </button>;
    })}
  </div>;
}

// ---------- Info tip ----------

/** A small "i" button that reveals a short explanation; works with keyboard and touch. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => { if (event instanceof KeyboardEvent ? event.key === "Escape" : !wrap.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return <span className="info-tip" ref={wrap}>
    <button type="button" className="info-tip-button" aria-label={`About ${label}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><Info size={14} aria-hidden /></button>
    <span id={id} role="tooltip" className="info-tip-panel" hidden={!open}>{children}</span>
  </span>;
}

// ---------- Dialog ----------

export function Dialog({ title, description, onClose, children, footer, size = "md" }: {
  title: string; description?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return <dialog ref={ref} className={`modal modal-${size}`} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-head"><div><h2 id={titleId}>{title}</h2>{description && <p className="muted">{description}</p>}</div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
    <div className="modal-body">{children}</div>
    {footer && <div className="modal-actions">{footer}</div>}
  </dialog>;
}

// ---------- Accounts ----------

export function accountSummary(accounts: Account[], selected: string[]): string {
  if (!selected.length) return "All accounts";
  if (selected.length === 1) return accounts.find((account) => account.id === selected[0])?.name ?? "1 account";
  return `${selected.length} accounts`;
}

/** Checkbox list of accounts. An empty selection means all accounts. */
export function AccountChecklist({ accounts, value, onChange, legend = "Accounts" }: { accounts: Account[]; value: string[]; onChange: (ids: string[]) => void; legend?: string }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  return <fieldset className="check-list">
    <legend>{legend}</legend>
    <label className="check-row"><input type="checkbox" checked={!value.length} onChange={() => onChange([])} /> All accounts</label>
    {accounts.map((account) => <label className="check-row" key={account.id}><input type="checkbox" checked={value.includes(account.id)} onChange={() => toggle(account.id)} /> {account.name} <span>{account.institution}</span></label>)}
  </fieldset>;
}

/** Compact dropdown that holds an AccountChecklist. */
export function AccountPicker({ accounts, value, onChange }: { accounts: Account[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => { if (event instanceof KeyboardEvent ? event.key === "Escape" : !wrap.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return <div className="picker" ref={wrap}>
    <button type="button" className="input picker-button" aria-label={`Accounts: ${accountSummary(accounts, value)}`} aria-expanded={open} aria-controls={id} aria-haspopup="true" onClick={() => setOpen(!open)}>
      <span>{accountSummary(accounts, value)}</span><ChevronDown size={14} aria-hidden />
    </button>
    {open && <div className="picker-panel" id={id}><AccountChecklist accounts={accounts} value={value} onChange={onChange} legend="Show accounts" /></div>}
  </div>;
}

// ---------- Data table ----------

export function DataTable({ caption, columns, rows }: { caption: string; columns: { label: string; numeric?: boolean }[]; rows: (string | number)[][] }) {
  return <div className="data-table-wrap"><table className="data-table">
    <caption>{caption}</caption>
    <thead><tr>{columns.map((column) => <th key={column.label} scope="col" className={column.numeric ? "num" : undefined}>{column.label}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => cellIndex === 0 ? <th scope="row" key={cellIndex}>{cell}</th> : <td key={cellIndex} className={columns[cellIndex]?.numeric ? "num" : undefined}>{cell}</td>)}</tr>)}</tbody>
  </table></div>;
}

// ---------- Error boundary ----------

/** Keeps one broken chart from taking down the whole analytics page. */
export class WidgetBoundary extends Component<{ children: ReactNode; title: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="widget-message" role="alert"><strong>{this.props.title} couldn&apos;t be displayed.</strong><p>Something went wrong while drawing this chart. Your data is unchanged.</p><button type="button" className="button secondary small" onClick={() => this.setState({ failed: false })}>Try again</button></div>;
  }
}
