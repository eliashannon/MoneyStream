"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronDown, CreditCard, Landmark, LayoutGrid, LogOut, Moon, MoreHorizontal, Plus, Search, ShieldCheck, Sparkles, Sun, Wallet, X } from "lucide-react";
import { AccountModal } from "@/components/accounts/account-modal";
import { storage } from "@/lib/storage";
import { Account, ActivityEvent, Session } from "@/lib/types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const labels = { credit: "Credit card", checking: "Checking", savings: "Savings" };
const filters = ["All", "Credit Cards", "Checking", "Savings"] as const;
type Filter = (typeof filters)[number];

export function Dashboard({ session, dark, toggleTheme, onSignOut }: { session: Session; dark: boolean; toggleTheme: () => void; onSignOut: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [editing, setEditing] = useState<Account | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    const [nextAccounts, nextActivity] = await Promise.all([storage.accounts(session.userId), storage.activity(session.userId)]);
    setAccounts(nextAccounts); setActivity(nextActivity);
  }, [session.userId]);

  useEffect(() => {
    Promise.all([storage.accounts(session.userId), storage.activity(session.userId)])
      .then(([nextAccounts, nextActivity]) => { setAccounts(nextAccounts); setActivity(nextActivity); })
      .catch(() => setError("Could not load your local data. Check your browser storage settings."))
      .finally(() => setLoading(false));
  }, [session.userId]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function record(action: string, detail: string) {
    await storage.saveActivity({ id: crypto.randomUUID(), userId: session.userId, action, detail, createdAt: new Date().toISOString() });
  }
  async function saveAccount(account: Account) {
    await storage.saveAccount(account);
    try { await record(editing ? "Account edited" : "Account added", account.name); } catch { setError("Account saved, but the activity entry could not be recorded."); }
    await refresh();
    setEditing(undefined);
    setToast(editing ? "Account updated" : "Account added");
  }
  async function deleteAccount(account: Account) {
    if (!window.confirm(`Delete ${account.name}? This cannot be undone.`)) return;
    try {
      await storage.deleteAccount(account.id);
      try { await record("Account deleted", account.name); } catch { setError("Account deleted, but the activity entry could not be recorded."); }
      await refresh(); setToast("Account deleted");
    } catch { setError("Could not delete the account. Please try again."); }
  }

  const cash = accounts.filter((a) => a.type !== "credit").reduce((sum, a) => sum + a.balance, 0);
  const debt = accounts.filter((a) => a.type === "credit").reduce((sum, a) => sum + a.balance, 0);
  const visible = useMemo(() => accounts.filter((a) => {
    const matchesType = filter === "All" || (filter === "Credit Cards" ? a.type === "credit" : a.type === filter.toLowerCase());
    const term = search.trim().toLowerCase();
    return matchesType && (!term || `${a.name} ${a.institution}`.toLowerCase().includes(term));
  }).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "balance" ? b.balance - a.balance : b.createdAt.localeCompare(a.createdAt)), [accounts, filter, search, sort]);
  const chartData = [{ name: "Cash", value: cash }, { name: "Debt", value: debt }, { name: "Net", value: Math.max(cash - debt, 0) }];

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand sidebar-brand" href="#"><span className="brand-mark">m</span><span>money<span className="brand-light">stream</span></span></a>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation"><a href="#overview" className="selected"><LayoutGrid size={18} /> Overview</a><a href="#accounts"><Wallet size={18} /> Accounts</a><a href="#activity"><BarChart3 size={18} /> Activity</a></nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><div className="note-icon"><Sparkles size={16} /></div><strong>A little more clarity.</strong><p>A simpler way to keep your money in view.</p></div><div className="side-profile"><span className="avatar">{session.username.charAt(0).toUpperCase()}</span><div><strong>{session.username}</strong><small>Local workspace</small></div><button className="icon-button" onClick={onSignOut} aria-label="Sign out"><LogOut size={17} /></button></div></div>
    </aside>
    <div className="main-wrap">
      <header className="topbar"><div className="topbar-title"><span>Workspace</span><span className="slash">/</span><strong>Overview</strong></div><div className="topbar-actions"><span className="local-pill"><span /> Local only</span><button className="icon-button" onClick={toggleTheme} aria-label={`Switch to ${dark ? "light" : "dark"} mode`}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button><button className="mobile-signout icon-button" onClick={onSignOut} aria-label="Sign out"><LogOut size={18} /></button><span className="avatar top-avatar">{session.username.charAt(0).toUpperCase()}</span></div></header>
      <main className="content" id="overview">
        <div className="greeting"><div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR FINANCIAL OVERVIEW</div><h1>Good to see you, <span>{session.username}.</span></h1><p>Here’s the big picture, all in one place.</p></div><button className="button primary add-top" onClick={() => setEditing(null)}><Plus size={18} /> Add account</button></div>
        {error && <div role="alert" className="alert dashboard-alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
        {loading ? <div className="stats-grid">{[1, 2, 3, 4].map((n) => <div className="skeleton stat-skeleton" key={n} />)}</div> : <motion.div className="stats-grid" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Stat label="Net position" value={currency.format(cash - debt)} icon={<BarChart3 size={18} />} caption="Cash minus credit balances" variant="featured" />
          <Stat label="Total cash" value={currency.format(cash)} icon={<ArrowDownLeft size={18} />} caption="Checking + savings" variant="green" />
          <Stat label="Credit card debt" value={currency.format(debt)} icon={<ArrowUpRight size={18} />} caption="Total current balances" variant="purple" />
          <Stat label="Accounts" value={String(accounts.length).padStart(2, "0")} icon={<Wallet size={18} />} caption="All in one place" variant="blue" />
        </motion.div>}
        <div className="dashboard-grid">
          <section className="accounts-section" id="accounts">
            <div className="section-heading"><div><div className="form-kicker">THE DETAILS</div><h2>Your accounts <span>{accounts.length}</span></h2><p>A little organization goes a long way.</p></div><button className="button secondary small" onClick={() => setEditing(null)}><Plus size={16} /> Add new</button></div>
            <div className="account-toolbar"><div className="filter-tabs" role="group" aria-label="Filter accounts">{filters.map((item) => <button key={item} className={filter === item ? "active" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="toolbar-controls"><label className="search"><Search size={16} /><span className="sr-only">Search accounts</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts" /></label><label className="sort"><span className="sr-only">Sort accounts</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest</option><option value="name">Name</option><option value="balance">Balance</option></select><ChevronDown size={14} /></label></div></div>
            {!loading && visible.length === 0 ? <div className="empty-state"><div className="empty-icon"><Wallet size={23} /></div><h3>{accounts.length ? "No accounts found" : "A fresh start for your finances"}</h3><p>{accounts.length ? "Try a different search or filter." : "Add your first account to bring your financial picture together."}</p>{!accounts.length && <button className="button primary small" onClick={() => setEditing(null)}><Plus size={16} /> Add an account</button>}</div> :
              <div className="account-list">{visible.map((account) => <AccountCard key={account.id} account={account} onEdit={() => setEditing(account)} onDelete={() => deleteAccount(account)} />)}</div>}
          </section>
          <aside className="insights-column">
            <section className="panel snapshot"><div className="panel-title"><div><div className="form-kicker">AT A GLANCE</div><h2>Money snapshot</h2></div><span className="panel-icon"><BarChart3 size={17} /></span></div><p>A simple view of where things stand.</p><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#50bda5" stopOpacity={0.3} /><stop offset="100%" stopColor="#50bda5" stopOpacity={0} /></linearGradient></defs><Tooltip formatter={(value) => currency.format(Number(value))} contentStyle={{ borderRadius: 12, border: "1px solid #e3ebe9", color: "#152b35" }} /><Area type="monotone" dataKey="value" stroke="#38a990" strokeWidth={3} fill="url(#chartFill)" /></AreaChart></ResponsiveContainer></div><div className="snapshot-row"><span><i className="legend cash" /> Total cash</span><strong>{currency.format(cash)}</strong></div><div className="snapshot-row"><span><i className="legend debt" /> Credit balances</span><strong>{currency.format(debt)}</strong></div><div className="snapshot-foot">A snapshot based on your manually entered balances.</div></section>
            <section className="panel activity" id="activity"><div className="panel-title"><div><div className="form-kicker">YOUR WORKSPACE</div><h2>Recent activity</h2></div><span className="panel-icon"><MoreHorizontal size={19} /></span></div><p>The latest from your local workspace.</p><div className="activity-list">{activity.length ? activity.slice(0, 5).map((event) => <div className="activity-item" key={event.id}><span className="activity-icon"><Check size={14} /></span><div><strong>{event.action}</strong><small>{event.detail}</small></div><time>{new Date(event.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></div>) : <div className="activity-empty">Your activity will appear here as you go.</div>}</div></section>
            <div className="privacy-note"><ShieldCheck size={18} /><span><strong>Just for you.</strong> Your data stays in this browser.</span></div>
          </aside>
        </div>
        <footer className="app-footer">A little more clarity, every day. <span>MoneyStream · Local prototype</span></footer>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation"><a href="#overview"><LayoutGrid size={19} />Overview</a><a href="#accounts"><Wallet size={19} />Accounts</a><button onClick={() => setEditing(null)}><Plus size={19} />Add</button><a href="#activity"><BarChart3 size={19} />Activity</a></nav>
    {editing !== undefined && <AccountModal account={editing ?? undefined} userId={session.userId} onClose={() => setEditing(undefined)} onSave={saveAccount} />}
    {toast && <div className="toast" role="status"><Check size={17} /> {toast}</div>}
  </div>;
}

function Stat({ label, value, icon, caption, variant }: { label: string; value: string; icon: React.ReactNode; caption: string; variant: string }) {
  return <div className={`stat-card ${variant}`}><div className="stat-top"><span>{label}</span><div className="stat-icon">{icon}</div></div><strong>{value}</strong><small>{caption}</small></div>;
}

function AccountCard({ account, onEdit, onDelete }: { account: Account; onEdit: () => void; onDelete: () => void }) {
  const utilization = account.type === "credit" && account.availableCredit !== undefined && account.balance + account.availableCredit > 0 ? Math.round(account.balance / (account.balance + account.availableCredit) * 100) : null;
  return <article className="account-card"><div className={`account-icon ${account.type === "credit" ? account.color || "indigo" : account.type}`}>{account.type === "credit" ? <CreditCard size={21} /> : <Landmark size={21} />}</div><div className="account-info"><div className="account-title"><h3>{account.name}</h3><span className={`badge ${account.type}`}>{labels[account.type]}</span></div><p>{account.institution}</p>{account.type === "credit" && <div className="account-meta"><span>Statement <strong>{currency.format(account.statementBalance)}</strong></span>{account.dueDate && <span>Due <strong>{new Date(`${account.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</strong></span>}{utilization !== null && <span>Utilization <strong>{utilization}%</strong></span>}</div>}</div><div className="account-balance"><small>{account.type === "credit" ? "FULL BALANCE" : "CURRENT BALANCE"}</small><strong>{currency.format(account.balance)}</strong><div className="account-actions"><button onClick={onEdit}>Edit</button><span>·</span><button onClick={onDelete}>Delete</button><ArrowRight size={14} /></div></div></article>;
}
