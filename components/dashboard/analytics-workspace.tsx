"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { BarChart3, Tag } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ChartTooltip } from "./chart-tooltip";
import { cashFlow, currency, netPosition } from "@/lib/finance";
import { transactionSummary } from "@/lib/transaction-filter";
import type { Account, Transaction } from "@/lib/types";

export function AnalyticsWorkspace({ accounts, transactions }: { accounts: Account[]; transactions: Transaction[] }) {
  const [months, setMonths] = useState(6);
  const now = new Date();
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const start = `${firstMonth.getFullYear()}-${String(firstMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const selected = transactions.filter((item) => item.date >= start && item.date < end);
  const summary = transactionSummary(selected);
  const spending = new Map<string, number>();
  for (const item of selected) if (item.type === "expense") spending.set(item.category || "Uncategorized", (spending.get(item.category || "Uncategorized") ?? 0) + item.amount);
  const categories = [...spending].sort((a, b) => b[1] - a[1]);
  const chart = cashFlow(transactions, months, now);

  return <section className="workspace" id="analytics">
    <header className="page-head">
      <div><h1>Analytics</h1><p>Cash flow covers the selected calendar months. Net position reflects current account balances.</p></div>
      <div className="page-actions"><label htmlFor="analytics-period">Period</label><select id="analytics-period" className="input analytics-period" value={months} onChange={(event) => setMonths(Number(event.target.value))}><option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select></div>
    </header>
    <div className="metric-grid">
      <div className="metric"><span>Income</span><strong className="positive">{currency.format(summary.income)}</strong></div>
      <div className="metric"><span>Expenses</span><strong>{currency.format(summary.expenses)}</strong></div>
      <div className="metric"><span>Net cash flow</span><strong>{currency.format(summary.net)}</strong></div>
      <div className="metric featured"><span>Current net position</span><strong>{currency.format(netPosition(accounts))}</strong></div>
    </div>
    <p className="sr-only">Cash flow by month: {chart.map((point) => `${point.name}: income ${currency.format(point.income)}, expenses ${currency.format(point.expenses)}.`).join(" ")}</p>
    <div className="analytics-grid">
      <section className="finance-panel analytics-card" aria-labelledby="analytics-chart-title"><div className="finance-panel-head"><h2 id="analytics-chart-title"><BarChart3 size={20} aria-hidden /> Income and expenses</h2><div className="chart-legend" aria-hidden="true"><span><i /> Income</span><span><i /> Expenses</span></div></div><div className="finance-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--chart-label)" }} /><YAxis width={55} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--chart-label)" }} tickFormatter={(value: number) => `$${value >= 1000 ? `${value / 1000}k` : value}`} /><ChartTooltip formatter={(value) => currency.format(Number(value))} /><Bar dataKey="income" name="Income" fill="var(--chart-income)" radius={[4, 4, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="var(--chart-expenses)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
      <section className="finance-panel analytics-card" aria-labelledby="analytics-category-title"><div className="finance-panel-head"><h2 id="analytics-category-title"><Tag size={20} aria-hidden /> Spending by category</h2></div>{categories.length ? categories.map(([category, amount]) => <div className="analytics-category" key={category}><div><span>{category}</span><strong>{currency.format(amount)}</strong></div><div className="progress" aria-hidden="true"><span style={{ width: `${summary.expenses ? Math.min(100, amount / summary.expenses * 100) : 0}%` }} /></div></div>) : <EmptyState compact icon={Tag} title="No expenses in this period.">Expenses you record will be grouped by category here.</EmptyState>}</section>
    </div>
  </section>;
}
