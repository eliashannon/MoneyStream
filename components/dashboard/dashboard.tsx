"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeftRight, BarChart3, Bell, ChevronRight, CreditCard, Home, House, Landmark, LogOut, Moon, PiggyBank, Plus, Search, Settings, Shield, Sun, Target, Trees, TrendingUp, Wallet, X } from "lucide-react";
import { AccountModal } from "@/components/accounts/account-modal";
import { RecordModal } from "./record-modal";
import { availableCredit, cashFlow, creditUtilization, currency, netPosition } from "@/lib/finance";
import { exportBackup, replaceFinancialData, storage } from "@/lib/storage";
import { Account, Goal, Session, Transaction } from "@/lib/types";

type Editor = { kind: "goal"; value?: Goal } | { kind: "transaction"; value?: Transaction };
const nav = [
  { id: "overview", label: "Dashboard", icon: Home },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "accounts", label: "Accounts", icon: Landmark },
  { id: "goals", label: "Goals", icon: Target },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];
const labels: Record<Account["type"], string> = { credit: "Credit card", checking: "Checking", savings: "Savings", cash: "Cash", investment: "Investment", loan: "Loan", other: "Other" };

export function Dashboard({ session, dark, toggleTheme, onSignOut }: { session: Session; dark: boolean; toggleTheme: () => void; onSignOut: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountEditor, setAccountEditor] = useState<Account | null | undefined>();
  const [editor, setEditor] = useState<Editor>();
  const [period, setPeriod] = useState(6);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [active, setActive] = useState("overview");
  const [profile, setProfile] = useState(false);
  const [notifications, setNotifications] = useState(false);

  const refresh = useCallback(async () => {
    const [nextAccounts, nextTransactions, nextGoals] = await Promise.all([storage.accounts(session.userId), storage.transactions(session.userId), storage.goals(session.userId)]);
    setAccounts(nextAccounts); setTransactions(nextTransactions); setGoals(nextGoals);
  }, [session.userId]);

  useEffect(() => {
    Promise.all([storage.accounts(session.userId), storage.transactions(session.userId), storage.goals(session.userId)])
      .then(([nextAccounts, nextTransactions, nextGoals]) => { setAccounts(nextAccounts); setTransactions(nextTransactions); setGoals(nextGoals); })
      .catch(() => setError("Could not load local data. Check your browser storage settings."))
      .finally(() => setLoading(false));
  }, [session.userId]);

  async function saveAccount(account: Account) {
    await storage.saveAccount(account);
    await refresh();
    setAccountEditor(undefined);
  }
  async function saveRecord(item: Goal | Transaction) {
    if ("target" in item) await storage.saveGoal(item);
    else await storage.saveTransaction(item);
    await refresh();
    setEditor(undefined);
  }
  async function remove(kind: "account" | "transaction" | "goal", id: string, name: string) {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      if (kind === "account") await storage.deleteAccount(id);
      else if (kind === "goal") await storage.deleteGoal(id);
      else await storage.deleteTransaction(id);
      await refresh();
    } catch { setError(`Could not delete ${name}. Please try again.`); }
  }
  async function download() {
    try {
      const backup = await exportBackup(session.userId);
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "moneystream-backup.json"; anchor.click();
      URL.revokeObjectURL(url);
    } catch { setError("Could not export your local data."); }
  }
  async function upload(file: File | undefined) {
    if (!file || !window.confirm("Importing replaces your current financial data. Continue?")) return;
    try {
      await replaceFinancialData(session.userId, JSON.parse(await file.text()));
      await refresh();
    } catch { setError("Could not import backup. Check that it is a valid MoneyStream backup."); }
  }
  async function erase() {
    if (!window.confirm("Erase all accounts, transactions, goals, and activity for this local user? This cannot be undone.")) return;
    try {
      await replaceFinancialData(session.userId, { version: 1, accounts: [], transactions: [], goals: [] });
      await refresh();
    } catch { setError("Could not erase local data."); }
  }
  async function eraseAll() {
    if (!window.confirm("Erase ALL local profiles, passwords, accounts, transactions, goals, and activity in this browser? The demo profile will also be removed. This cannot be undone.")) return;
    try {
      await storage.clearAll();
      if (dark) toggleTheme();
      localStorage.removeItem("moneystream-theme");
      onSignOut();
    } catch { setError("Could not erase all local data."); }
  }
  const totals = (type: Account["type"]) => accounts.filter((account) => account.type === type).reduce((sum, account) => sum + account.balance, 0);
  const credit = accounts.filter((account) => account.type === "credit");
  const filtered = useMemo(() => transactions.filter((item) => {
    const term = search.trim().toLowerCase();
    return (filter === "all" || item.type === filter) && (!term || `${item.description} ${item.category} ${accounts.find((a) => a.id === item.accountId)?.name ?? ""}`.toLowerCase().includes(term));
  }).sort((a, b) => sort === "amount" ? b.amount - a.amount : sort === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)), [transactions, accounts, search, filter, sort]);
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const chart = cashFlow(transactions, period);
  const current = cashFlow(transactions, 2);
  const change = (current[1].income - current[1].expenses) - (current[0].income - current[0].expenses);
  const month = new Date().toLocaleDateString("en-US", { month: "long" });

  return <div className="app-shell finance-shell">
    <aside className="sidebar">
      <a className="finance-brand" href="#overview"><TrendingUp size={28} /><span><b>Money</b>Stream</span></a>
      <nav className="side-nav finance-nav" aria-label="Main navigation">{nav.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} onClick={() => setActive(id)} className={active === id ? "selected" : ""}><Icon size={19} />{label}</a>)}</nav>
      <div className="sidebar-bottom"><div className="goal-promo"><TrendingUp size={25} /><strong>Reach your goals faster with MoneyStream</strong><button className="button secondary small" onClick={() => setEditor({ kind: "goal" })}>Set a Goal →</button></div><button className="theme-toggle" onClick={toggleTheme}>{dark ? <Sun size={18} /> : <Moon size={18} />}{dark ? "Light mode" : "Dark mode"}</button></div>
    </aside>
    <div className="main-wrap">
      <header className="topbar finance-topbar">
        <form className="header-search" onSubmit={(event) => { event.preventDefault(); setActive("transactions"); document.getElementById("transactions")?.scrollIntoView(); }}><Search size={19} /><label className="sr-only" htmlFor="global-search">Search transactions</label><input id="global-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions..." /></form>
        <div className="topbar-actions"><span className="local-pill">Manual · Local only</span><div className="menu-wrap"><button className="icon-button" aria-label="Notifications" aria-expanded={notifications} onClick={() => setNotifications(!notifications)}><Bell size={20} /></button>{notifications && <div className="dropdown">No new notifications.</div>}</div><div className="menu-wrap"><button className="avatar finance-avatar" aria-label="Profile menu" aria-expanded={profile} onClick={() => setProfile(!profile)}>{session.username.slice(0, 2).toUpperCase()}</button>{profile && <div className="dropdown"><strong>{session.username}</strong><a href="#settings" onClick={() => { setActive("settings"); setProfile(false); }}>Profile &amp; account settings</a><button onClick={onSignOut}><LogOut size={15} /> Sign out</button></div>}</div></div>
      </header>
      <main className="content finance-content">
        <section id="overview">
          <div className="finance-intro"><h1>Welcome back!</h1><p>Here’s your financial overview for {month}.</p><span>Balances are manually maintained. Demo data is not connected to a bank.</span></div>
          {error && <div role="alert" className="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
          {loading ? <p>Loading your local data...</p> : <div className="finance-stats">
            <a className="finance-stat" href="#accounts" onClick={() => setActive("accounts")}><div><span className="finance-icon"><CreditCard size={19} /></span><strong>Credit Cards</strong><ChevronRight size={17} /></div><b>{currency.format(totals("credit"))}</b><small>Statement {currency.format(credit.reduce((sum, account) => sum + account.statementBalance, 0))}{credit.some((account) => availableCredit(account) !== undefined) && <> · Known available {currency.format(credit.reduce((sum, account) => sum + (availableCredit(account) ?? 0), 0))}</>}</small></a>
            <a className="finance-stat" href="#accounts" onClick={() => setActive("accounts")}><div><span className="finance-icon"><Landmark size={19} /></span><strong>Checking</strong><ChevronRight size={17} /></div><b>{currency.format(totals("checking"))}</b><small>Available balance</small></a>
            <a className="finance-stat" href="#accounts" onClick={() => setActive("accounts")}><div><span className="finance-icon"><PiggyBank size={19} /></span><strong>Savings</strong><ChevronRight size={17} /></div><b>{currency.format(totals("savings"))}</b><small>Savings balance</small></a>
            <div className="finance-stat net-stat"><div><span className="finance-icon"><TrendingUp size={19} /></span><strong>Net Position</strong></div><b>{currency.format(netPosition(accounts))}</b><small>Included assets minus liabilities</small></div>
          </div>}
        </section>
        <div className="finance-middle">
          <section className="finance-panel" id="analytics"><div className="finance-panel-head"><h2><BarChart3 size={20} /> Cash Flow</h2><div className="periods">{[1, 3, 6, 12].map((n) => <button key={n} className={period === n ? "active" : ""} aria-pressed={period === n} onClick={() => setPeriod(n)}>{n === 12 ? "1Y" : `${n}M`}</button>)}</div></div><div className="chart-legend"><span><i /> Income</span><span><i /> Expenses</span></div><div className="finance-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e5eae7" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} /><YAxis width={55} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(value: number) => `$${value >= 1000 ? `${value / 1000}k` : value}`} /><Tooltip formatter={(value) => currency.format(Number(value))} cursor={{ fill: "rgba(7, 94, 56, 0.08)" }} contentStyle={{ background: "#075E38", border: "1px solid #12834A", borderRadius: "10px", boxShadow: "0 8px 24px rgba(7, 94, 56, 0.24)", color: "#FFFFFF", padding: "10px 12px" }} labelStyle={{ color: "#D3EEE0", fontWeight: 700, marginBottom: "6px" }} itemStyle={{ color: "#FFFFFF", fontWeight: 700 }} /><Bar dataKey="income" name="Income" fill="#075E38" radius={[4, 4, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#b6e5c7" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div><p className="finance-muted">Transfers and card payments are excluded from cash flow.</p></section>
          <section className="finance-panel" id="goals"><div className="finance-panel-head"><h2><Target size={20} /> Your Goals</h2><button className="text-button" onClick={() => setEditor({ kind: "goal" })}>+ Add goal</button></div><div className="goal-list">{goals.length ? goals.map((goal) => {
            const name = goal.name.toLowerCase();
            const Icon = name.includes("home") ? House : name.includes("emergency") ? Shield : name.includes("retirement") ? Trees : Target;
            return <div className="goal-row" key={goal.id}><span className="finance-icon"><Icon size={19} /></span><div className="goal-details"><div className="goal-line"><strong>{goal.name}</strong><span>{Math.round(goal.current / goal.target * 100)}%</span></div><p>{currency.format(goal.current)} / {currency.format(goal.target)}</p><div className="progress"><span style={{ width: `${Math.min(100, goal.current / goal.target * 100)}%` }} /></div><div className="record-actions"><button onClick={() => setEditor({ kind: "goal", value: goal })}>Edit</button><button onClick={() => remove("goal", goal.id, goal.name)}>Delete</button></div></div></div>;
          }) : <p className="finance-muted">Add a goal to track your progress.</p>}</div></section>
        </div>
        <div className="finance-bottom">
          <section className="finance-panel" id="accounts"><div className="finance-panel-head"><h2><Wallet size={20} /> Your Accounts</h2><button className="text-button" onClick={() => setAccountEditor(null)}>+ Add</button></div>{accounts.length ? accounts.map((account) => <div className="finance-row" key={account.id}><div className="finance-icon">{account.type === "credit" ? <CreditCard size={18} /> : <Landmark size={18} />}</div><div className="row-body"><strong>{account.name}</strong><small>{labels[account.type]} · {account.institution}</small>{account.type === "credit" && <small>Statement {currency.format(account.statementBalance)} · Remaining {currency.format(Math.max(0, account.statementBalance - (account.paymentsTowardStatement ?? 0)))}{account.dueDate ? ` · Due ${account.dueDate}` : ""}{creditUtilization(account) !== undefined ? ` · Utilization ${Math.round(creditUtilization(account)!)}%` : ""}{availableCredit(account) !== undefined ? ` · Available ${currency.format(availableCredit(account)!)}` : ""}</small>}<div className="record-actions"><button onClick={() => setAccountEditor(account)}>Edit / details</button><button onClick={() => remove("account", account.id, account.name)}>Delete</button></div></div><strong>{currency.format(account.balance)}</strong></div>) : <p className="finance-muted">No accounts yet. Add one to get started.</p>}</section>
          <section className="finance-panel"><div className="finance-panel-head"><h2><ArrowLeftRight size={20} /> Recent Transactions</h2><a className="text-button" href="#transactions" onClick={() => setActive("transactions")}>View All →</a></div>{recent.length ? recent.map((item) => <TransactionRow key={item.id} item={item} onEdit={() => setEditor({ kind: "transaction", value: item })} />) : <p className="finance-muted">No transactions yet.</p>}</section>
          <section className="finance-panel insight"><TrendingUp size={24} /><h2>Your cash flow</h2><p>{change >= 0 ? "Net cash flow is up" : "Net cash flow is down"} {currency.format(Math.abs(change))} compared with last month.</p><a className="button primary small" href="#analytics" onClick={() => setActive("analytics")}>View Details →</a></section>
        </div>
        <section className="finance-panel full-section" id="transactions"><div className="finance-panel-head"><h2><ArrowLeftRight size={20} /> Transactions</h2><button className="button primary small" onClick={() => setEditor({ kind: "transaction" })}><Plus size={16} /> Add transaction</button></div><div className="transaction-controls"><label>Type <select className="input" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All</option><option value="income">Income</option><option value="expense">Expense</option><option value="transfer">Transfer</option><option value="payment">Credit card payment</option></select></label><label>Sort <select className="input" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="amount">Amount</option></select></label></div>{filtered.length ? filtered.map((item) => <TransactionRow key={item.id} item={item} onEdit={() => setEditor({ kind: "transaction", value: item })} onDelete={() => remove("transaction", item.id, item.description)} />) : <p className="finance-muted">No matching transactions.</p>}</section>
        <section className="finance-panel full-section" id="settings"><div className="finance-panel-head"><h2><Settings size={20} /> Settings &amp; local data</h2></div><p className="finance-muted">Local profile: {session.username}. This prototype stores data in your browser without encryption. Do not enter bank credentials or sensitive financial information. Backups contain financial data in plain text.</p><div className="settings-actions"><button className="button secondary" onClick={download}>Export backup</button><label className="button secondary">Import backup<input className="sr-only" type="file" accept="application/json,.json" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label><button className="button secondary" onClick={erase}>Erase local financial data</button><button className="button secondary" onClick={eraseAll}>Erase all local data</button><button className="button secondary" onClick={onSignOut}>Sign out</button></div></section>
      </main>
    </div>
    <nav className="mobile-nav finance-mobile-nav" aria-label="Mobile navigation">{nav.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} onClick={() => setActive(id)}><Icon size={18} />{label}</a>)}</nav>
    {accountEditor !== undefined && <AccountModal account={accountEditor ?? undefined} userId={session.userId} onClose={() => setAccountEditor(undefined)} onSave={saveAccount} />}
    {editor && <RecordModal record={editor} userId={session.userId} accounts={accounts} onClose={() => setEditor(undefined)} onSave={saveRecord} />}
  </div>;
}

function TransactionRow({ item, onEdit, onDelete }: { item: Transaction; onEdit: () => void; onDelete?: () => void }) {
  return <div className="finance-row"><div className="finance-icon"><ArrowLeftRight size={17} /></div><div className="row-body"><strong>{item.description}</strong><small>{item.date} · {item.category} · {item.type === "payment" ? "Card payment" : item.type}</small><div className="record-actions"><button onClick={onEdit}>Details / edit</button>{onDelete && <button onClick={onDelete}>Delete</button>}</div></div><strong className={item.type === "income" ? "positive" : ""}>{item.type === "income" ? "+" : item.type === "expense" ? "−" : ""}{currency.format(item.amount)}</strong></div>;
}
