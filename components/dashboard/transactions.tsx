"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, ChevronDown, ChevronLeft, ChevronRight, Download, Plus, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
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
  const dateError = Boolean(filters.startDate && filters.endDate && filters.startDate > filters.endDate);
  const amountError = filters.minAmount !== "" && filters.maxAmount !== "" && Number(filters.minAmount) > Number(filters.maxAmount);

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

  function clearFilters() { setFilters(initialFilters); setDatePreset("all"); setSearch(""); setPage(1); }
  const moreFilters = (["accountType", "category", "status", "recurring", "minAmount", "maxAmount"] as const).filter((key) => filters[key] !== "").length + (datePreset === "custom" ? (["startDate", "endDate"] as const).filter((key) => filters[key] !== "").length : 0);
  const anyFilter = search.trim() !== "" || moreFilters > 0 || filters.accountId !== "" || filters.type !== "" || datePreset !== "all";

  return <section className="workspace" id="transactions">
    <header className="page-head">
      <div><h1>Transactions</h1><p>Account balances are maintained manually. Transfers and card payments are excluded from cash flow.</p></div>
      <div className="page-actions"><button className="button secondary small" onClick={exportCsv} disabled={!filtered.length}><Download size={16} aria-hidden /> Export filtered CSV</button><label className="button secondary small">{importing ? <><span className="button-spinner" aria-hidden="true" /> Importing...</> : <><Upload size={16} aria-hidden /> Import MoneyStream CSV</>}<input className="sr-only" type="file" accept=".csv,text/csv" disabled={importing} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importCsv(file); }} /></label><button className="button primary small" onClick={onAdd}><Plus size={16} aria-hidden /> Add transaction</button></div>
    </header>
    {csvError && <div role="alert" className="alert">{csvError}</div>}
    {csvMessage && <p role="status" className="status-message">{csvMessage}</p>}
    <div className="metric-grid" role="group" aria-label="Summary of filtered transactions">
      <div className="metric"><span>Income</span><strong className="positive">{currency.format(summary.income)}</strong></div>
      <div className="metric"><span>Expenses</span><strong>{currency.format(summary.expenses)}</strong></div>
      <div className="metric"><span>Net cash flow</span><strong>{currency.format(summary.net)}</strong></div>
      <div className="metric"><span>Transactions</span><strong>{summary.count}</strong></div>
    </div>
    <section className="finance-panel" aria-labelledby="transaction-history-title">
      <div className="finance-panel-head"><h2 id="transaction-history-title"><ArrowLeftRight size={20} aria-hidden /> Transaction history</h2></div>
      <div className="transaction-filters">
        <label>Search<input className="input" type="search" value={search} placeholder="Search transactions" onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        <label>Account<select className="input" value={filters.accountId} onChange={(event) => update("accountId", event.target.value)}><option value="">All accounts</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
        <label>Type<select className="input" value={filters.type} onChange={(event) => update("type", event.target.value)}><option value="">All types</option><option value="income">Income</option><option value="expense">Expenses</option><option value="transfer">Transfers</option><option value="payment">Credit card payments</option></select></label>
        <label>Date range<select className="input" value={datePreset} onChange={(event) => { const preset = event.target.value as DatePreset; setDatePreset(preset); setFilters((previous) => ({ ...previous, ...presetDates(preset) })); setPage(1); }}><option value="all">All time</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option><option value="90days">Last 90 days</option><option value="yearToDate">Year to date</option><option value="12months">Last 12 months</option>{datePreset === "custom" && <option value="custom">Custom</option>}</select></label>
        <label>Sort by<select className="input" value={filters.sort} onChange={(event) => update("sort", event.target.value as TransactionFilters["sort"])}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="amount-high">Amount: high to low</option><option value="amount-low">Amount: low to high</option><option value="description">Description</option><option value="category">Category</option></select></label>
      </div>
      <details className="filter-more">
        <summary><SlidersHorizontal size={16} aria-hidden /> More filters{moreFilters > 0 && <span className="filter-count" aria-label={`${moreFilters} active`}>{moreFilters}</span>}<ChevronDown size={16} aria-hidden /></summary>
        <div className="transaction-filters">
          <label>Account type<select className="input" value={filters.accountType} onChange={(event) => update("accountType", event.target.value)}><option value="">All account types</option><option value="checking">Checking</option><option value="savings">Savings</option><option value="credit">Credit cards</option></select></label>
          <label>Category<select className="input" value={filters.category} onChange={(event) => update("category", event.target.value)}><option value="">All categories</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
          <label>Status<select className="input" value={filters.status} onChange={(event) => update("status", event.target.value)}><option value="">All statuses</option><option value="posted">Posted</option><option value="pending">Pending</option><option value="unknown">Not recorded</option></select></label>
          <label>Recurring<select className="input" value={filters.recurring} onChange={(event) => update("recurring", event.target.value)}><option value="">All transactions</option><option value="yes">Recurring</option><option value="no">Not marked recurring</option></select></label>
          <label>From<input className="input" type="date" value={filters.startDate} aria-invalid={dateError || undefined} onChange={(event) => { setDatePreset("custom"); update("startDate", event.target.value); }} /></label>
          <label>To<input className="input" type="date" value={filters.endDate} aria-invalid={dateError || undefined} onChange={(event) => { setDatePreset("custom"); update("endDate", event.target.value); }} /></label>
          <label>Minimum amount<input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={filters.minAmount} aria-invalid={amountError || undefined} onChange={(event) => update("minAmount", event.target.value)} /></label>
          <label>Maximum amount<input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={filters.maxAmount} aria-invalid={amountError || undefined} onChange={(event) => update("maxAmount", event.target.value)} /></label>
        </div>
      </details>
      {(dateError || amountError) && <div className="validation-list">
        {dateError && <p role="alert" className="field-error">The start date must not be after the end date.</p>}
        {amountError && <p role="alert" className="field-error">The minimum amount must not exceed the maximum amount.</p>}
      </div>}
      <div className="filter-footer"><p aria-live="polite">Showing {filtered.length} of {transactions.length} transactions</p><button className="button secondary small" onClick={clearFilters} disabled={!anyFilter}><X size={15} aria-hidden /> Clear filters</button></div>
      {filtered.length ? <>
        <div className="transaction-table-wrap"><table className="transaction-table"><caption className="sr-only">Transactions, page {currentPage} of {pageCount}</caption><thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Account</th><th scope="col">Category</th><th scope="col">Type</th><th scope="col" className="num">Amount</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>
          {filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item) => <tr key={item.id}><td data-label="Date">{item.date}</td><td data-label="Description"><span>{item.description}</span>{item.recurring && <span className="badge plain transaction-recurring">Recurring</span>}</td><td data-label="Account">{item.accountId ? accountsById.get(item.accountId)?.name ?? "Unavailable" : "None"}</td><td data-label="Category">{item.category}</td><td data-label="Type">{item.type === "payment" ? "Card payment" : item.type}</td><td data-label="Amount" className={`num ${item.type === "income" ? "positive" : item.type === "expense" ? "negative" : ""}`}>{item.type === "income" ? "+" : item.type === "expense" ? "−" : ""}{currency.format(item.amount)}</td><td data-label="Status"><span className={`badge ${item.status === "posted" ? "success" : item.status === "pending" ? "warning" : ""}`}>{item.status === "posted" ? "Posted" : item.status === "pending" ? "Pending" : "Not recorded"}</span></td><td data-label="Actions"><div className="record-actions"><button onClick={() => onEdit(item)} aria-label={`Details / edit, ${item.description}`}>Details / edit</button><button className="danger-link" onClick={() => onDelete(item)} aria-label={`Delete ${item.description}`}>Delete</button></div></td></tr>)}
        </tbody></table></div>
        <div className="transaction-pagination"><span>Page {currentPage} of {pageCount} · {filtered.length} transactions</span><label>Rows per page <select className="input" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><div className="pager"><button className="button secondary small" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} aria-hidden /> Previous</button><button className="button secondary small" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next <ChevronRight size={16} aria-hidden /></button></div></div>
      </> : transactions.length
        ? <EmptyState icon={Search} title="No matching transactions." action={<button className="button secondary small" onClick={clearFilters}>Clear filters</button>}>Try a different search or remove some filters.</EmptyState>
        : <EmptyState icon={ArrowLeftRight} title="No transactions yet" action={<button className="button primary small" onClick={onAdd}><Plus size={16} aria-hidden /> Add transaction</button>}>Add a transaction or import a MoneyStream CSV to get started.</EmptyState>}
    </section>
  </section>;
}
