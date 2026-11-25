"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Plus } from "lucide-react";
import { currency } from "@/lib/finance";
import { filterTransactions, presetDates, transactionSummary, type DatePreset, type TransactionFilters } from "@/lib/transaction-filter";
import { exportTransactionsCsv, importTransactionsCsv } from "@/lib/transaction-csv";
import type { Account, Transaction } from "@/lib/types";

const initialFilters: Omit<TransactionFilters, "search"> = {
  accountId: "", accountType: "", type: "", category: "", status: "", recurring: "", startDate: "", endDate: "", minAmount: "", maxAmount: "", sort: "newest",
};

export function Transactions({ transactions, accounts, userId, search, setSearch, onAdd, onEdit, onDelete, onImport }: {
  transactions: Transaction[];
  accounts: Account[];
  userId: string;
  search: string;
  setSearch: (value: string) => void;
  onAdd: () => void;
  onEdit: (item: Transaction) => void;
  onDelete: (item: Transaction) => void;
  onImport: (items: Transaction[]) => Promise<void>;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [datePreset, setDatePreset] = useState<DatePreset | "custom">("all");
  const [csvMessage, setCsvMessage] = useState("");
  const [csvError, setCsvError] = useState("");
  const [importing, setImporting] = useState(false);
  const filtered = useMemo(() => filterTransactions(transactions, accounts, { ...filters, search }), [transactions, accounts, filters, search]);
  const summary = transactionSummary(filtered);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const categories = [...new Set(transactions.map((item) => item.category).filter(Boolean))].sort();
  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  function update<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  }

  function exportCsv() {
    try {
      const url = URL.createObjectURL(new Blob([exportTransactionsCsv(filtered)], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "moneystream-transactions.csv"; anchor.click();
      URL.revokeObjectURL(url);
      setCsvError(""); setCsvMessage(`Exported ${filtered.length} transactions.`);
    } catch { setCsvMessage(""); setCsvError("Could not export transactions."); }
  }

  async function importCsv(file: File) {
    setCsvMessage(""); setCsvError(""); setImporting(true);
    try {
      const items = importTransactionsCsv(await file.text(), userId, accounts, transactions);
      if (!window.confirm(`Import ${items.length} transactions? Account balances will not change.`)) return;
      await onImport(items);
      setCsvMessage(`Imported ${items.length} transactions.`);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : "Could not import transactions.");
    } finally { setImporting(false); }
  }

  return <section className="finance-panel full-section" id="transactions">
    <div className="finance-panel-head"><h2><ArrowLeftRight size={20} /> Transactions</h2><button className="button primary small" onClick={onAdd}><Plus size={16} /> Add transaction</button></div>
    <p className="finance-muted">Account balances are maintained manually. Transfers and card payments are excluded from cash flow.</p>
    <div className="settings-actions"><button className="button secondary small" onClick={exportCsv} disabled={!filtered.length}>Export filtered CSV</button><label className="button secondary small">{importing ? <><span className="button-spinner" aria-hidden="true" /> Importing...</> : "Import MoneyStream CSV"}<input className="sr-only" type="file" accept=".csv,text/csv" disabled={importing} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importCsv(file); }} /></label></div>
    {csvError && <p role="alert" className="field-error">{csvError}</p>}
    {csvMessage && <p role="status" className="finance-muted">{csvMessage}</p>}
    <div className="transaction-filters">
      <label>Search<input className="input" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
      <label>Account<select className="input" value={filters.accountId} onChange={(event) => update("accountId", event.target.value)}><option value="">All accounts</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
      <label>Account type<select className="input" value={filters.accountType} onChange={(event) => update("accountType", event.target.value)}><option value="">All account types</option><option value="checking">Checking</option><option value="savings">Savings</option><option value="credit">Credit cards</option></select></label>
      <label>Type<select className="input" value={filters.type} onChange={(event) => update("type", event.target.value)}><option value="">All types</option><option value="income">Income</option><option value="expense">Expenses</option><option value="transfer">Transfers</option><option value="payment">Credit card payments</option></select></label>
      <label>Category<select className="input" value={filters.category} onChange={(event) => update("category", event.target.value)}><option value="">All categories</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
      <label>Status<select className="input" value={filters.status} onChange={(event) => update("status", event.target.value)}><option value="">All statuses</option><option value="posted">Posted</option><option value="pending">Pending</option><option value="unknown">Not recorded</option></select></label>
      <label>Recurring<select className="input" value={filters.recurring} onChange={(event) => update("recurring", event.target.value)}><option value="">All transactions</option><option value="yes">Recurring</option><option value="no">Not marked recurring</option></select></label>
      <label>Date range<select className="input" value={datePreset} onChange={(event) => { const preset = event.target.value as DatePreset; setDatePreset(preset); setFilters((previous) => ({ ...previous, ...presetDates(preset) })); setPage(1); }}><option value="all">All time</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option><option value="90days">Last 90 days</option><option value="yearToDate">Year to date</option><option value="12months">Last 12 months</option>{datePreset === "custom" && <option value="custom">Custom</option>}</select></label>
      <label>From<input className="input" type="date" value={filters.startDate} onChange={(event) => { setDatePreset("custom"); update("startDate", event.target.value); }} /></label>
      <label>To<input className="input" type="date" value={filters.endDate} onChange={(event) => { setDatePreset("custom"); update("endDate", event.target.value); }} /></label>
      <label>Minimum amount<input className="input" type="number" min="0" step="0.01" value={filters.minAmount} onChange={(event) => update("minAmount", event.target.value)} /></label>
      <label>Maximum amount<input className="input" type="number" min="0" step="0.01" value={filters.maxAmount} onChange={(event) => update("maxAmount", event.target.value)} /></label>
      <label>Sort by<select className="input" value={filters.sort} onChange={(event) => update("sort", event.target.value as TransactionFilters["sort"])}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="amount-high">Amount: high to low</option><option value="amount-low">Amount: low to high</option><option value="description">Description</option><option value="category">Category</option></select></label>
      <button className="button secondary small" onClick={() => { setFilters(initialFilters); setDatePreset("all"); setSearch(""); setPage(1); }}>Clear filters</button>
    </div>
    {filters.startDate && filters.endDate && filters.startDate > filters.endDate && <p role="alert" className="field-error">The start date must not be after the end date.</p>}
    {filters.minAmount !== "" && filters.maxAmount !== "" && Number(filters.minAmount) > Number(filters.maxAmount) && <p role="alert" className="field-error">The minimum amount must not exceed the maximum amount.</p>}
    <div className="transaction-summary">
      <div><span>Income</span><strong>{currency.format(summary.income)}</strong></div>
      <div><span>Expenses</span><strong>{currency.format(summary.expenses)}</strong></div>
      <div><span>Net cash flow</span><strong>{currency.format(summary.net)}</strong></div>
      <div><span>Transactions</span><strong>{summary.count}</strong></div>
    </div>
    {filtered.length ? <>
      <div className="transaction-table-wrap"><table className="transaction-table"><thead><tr><th>Date</th><th>Description</th><th>Account</th><th>Category</th><th>Type</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item) => <tr key={item.id}><td data-label="Date">{item.date}</td><td data-label="Description">{item.description}{item.recurring && <small className="transaction-recurring">Recurring</small>}</td><td data-label="Account">{item.accountId ? accountsById.get(item.accountId)?.name ?? "Unavailable" : "None"}</td><td data-label="Category">{item.category}</td><td data-label="Type">{item.type === "payment" ? "Card payment" : item.type}</td><td data-label="Amount">{currency.format(item.amount)}</td><td data-label="Status">{item.status ?? "Not recorded"}</td><td data-label="Actions"><div className="record-actions"><button onClick={() => onEdit(item)}>Details / edit</button><button onClick={() => onDelete(item)}>Delete</button></div></td></tr>)}
      </tbody></table></div>
      <div className="transaction-pagination"><span>Page {currentPage} of {pageCount} · {filtered.length} transactions</span><label>Rows per page <select className="input" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><div><button className="button secondary small" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button> <button className="button secondary small" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
    </> : <p className="finance-muted">No matching transactions.</p>}
  </section>;
}
