"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
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

  return <section className="finance-panel full-section" id="analytics">
    <div className="finance-panel-head"><h2><BarChart3 size={20} /> Analytics</h2><label>Period <select className="input analytics-period" value={months} onChange={(event) => setMonths(Number(event.target.value))}><option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select></label></div>
    <p className="finance-muted">Cash flow covers the selected calendar months. Net position reflects current account balances.</p>
    <div className="transaction-summary account-summary">
      <div><span>Income</span><strong>{currency.format(summary.income)}</strong></div>
      <div><span>Expenses</span><strong>{currency.format(summary.expenses)}</strong></div>
      <div><span>Net cash flow</span><strong>{currency.format(summary.net)}</strong></div>
      <div><span>Current net position</span><strong>{currency.format(netPosition(accounts))}</strong></div>
    </div>
    <div className="analytics-grid">
      <div className="analytics-card"><h3>Income and expenses</h3><div className="finance-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={cashFlow(transactions, months, now)}><CartesianGrid vertical={false} stroke="#e5eae7" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} /><YAxis width={55} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(value: number) => `$${value >= 1000 ? `${value / 1000}k` : value}`} /><Tooltip formatter={(value) => currency.format(Number(value))} contentStyle={{ background: "#075E38", border: "1px solid #12834A", borderRadius: "10px", color: "#fff" }} labelStyle={{ color: "#D3EEE0" }} itemStyle={{ color: "#fff" }} /><Bar dataKey="income" name="Income" fill="#075E38" radius={[4, 4, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#b6e5c7" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
      <div className="analytics-card"><h3>Spending by category</h3>{categories.length ? categories.map(([category, amount]) => <div className="analytics-category" key={category}><span>{category}</span><strong>{currency.format(amount)}</strong></div>) : <p className="finance-muted">No expenses in this period.</p>}</div>
    </div>
  </section>;
}
