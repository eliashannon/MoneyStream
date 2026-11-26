"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ArrowLeftRight, ArrowRight, BarChart3, Bell, ChevronRight, CircleUserRound, CreditCard, Download, Eye, EyeOff, Home, House, Landmark, LogOut, Moon, PiggyBank, Plus, Search, Settings, Shield, Sun, Target, Trash2, Trees, TrendingUp, Upload, Wallet, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { AccountModal } from "@/components/accounts/account-modal";
import { AccountsWorkspace } from "@/components/accounts/accounts-workspace";
import { BrandLogo } from "@/components/brand-logo";
import { RecordModal } from "./record-modal";
import { Transactions } from "./transactions";
import { GoalsWorkspace } from "./goals-workspace";
import { AnalyticsWorkspace } from "./analytics-workspace";
import { ChartTooltip } from "./chart-tooltip";
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
const mobileNav = [
  { id: "overview", label: "Dashboard", icon: Home },
  { id: "accounts", label: "Accounts", icon: Landmark },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "goals", label: "Goals", icon: Target },
  { id: "settings", label: "Profile", icon: CircleUserRound },
];
const labels: Record<Account["type"], string> = { credit: "Credit card", checking: "Checking", savings: "Savings", cash: "Cash", investment: "Investment", loan: "Loan", other: "Other" };

function subscribeToHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

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
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash, () => "");
  const active = nav.some((item) => `#${item.id}` === hash) ? hash.slice(1) : "overview";
  const activeIndex = nav.findIndex((item) => item.id === active);
  const [profile, setProfile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [workflowRuns, setWorkflowRuns] = useState<{ completed: number; latest: string; status: string } | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const menus = useRef<HTMLDivElement>(null);

  // Close header menus on Escape or a click outside them.
  useEffect(() => {
    if (!profile && !notifications) return;
    function close() { setProfile(false); setNotifications(false); }
    function onPointer(event: PointerEvent) { if (!menus.current?.contains(event.target as Node)) close(); }
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") close(); }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [profile, notifications]);

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

  useEffect(() => {
    let active = true;

    async function loadWorkflowRuns() {
      try {
        const response = await fetch("https://api.github.com/repos/eliashannon/MoneyStream/actions/runs?status=completed&per_page=1", {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!response.ok) throw new Error("Could not load workflow runs");
        const data = await response.json();
        const latest = data.workflow_runs?.[0];
        if (active) {
          setWorkflowRuns({
            completed: data.total_count ?? 0,
            latest: latest?.name ?? "No workflow runs",
            status: latest?.conclusion ?? "unknown",
          });
        }
      } catch {
        if (active) setWorkflowRuns(null);
      } finally {
        if (active) setWorkflowLoading(false);
      }
    }

    void loadWorkflowRuns();
    const interval = window.setInterval(() => void loadWorkflowRuns(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

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
    const message = kind === "account"
      ? `Delete ${name}? Associated transactions will be kept but will no longer be linked to this account. This cannot be undone.`
      : `Delete ${name}? This cannot be undone.`;
    if (!window.confirm(message)) return;
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
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const chart = cashFlow(transactions, period);
  const current = cashFlow(transactions, 2);
  const change = (current[1].income - current[1].expenses) - (current[0].income - current[0].expenses);
  const month = new Date().toLocaleDateString("en-US", { month: "long" });

  return <div className="app-shell finance-shell">
    <aside className="sidebar">
      <a className="finance-brand" href="#overview"><BrandLogo /></a>
      <nav className="side-nav finance-nav" aria-label="Main navigation">
        <span className="finance-nav-indicator" aria-hidden="true" style={{ transform: `translateY(${activeIndex * 52}px)` }} />
        {nav.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} aria-current={active === id ? "page" : undefined} className={active === id ? "selected" : ""}><Icon size={19} aria-hidden />{label}</a>)}
      </nav>
      <div className="sidebar-bottom"><div className="goal-promo"><TrendingUp size={26} aria-hidden /><strong>Reach your goals faster with MoneyStream</strong><button className="button secondary small" onClick={() => setEditor({ kind: "goal" })}>Set a Goal <ArrowRight size={15} aria-hidden /></button></div><button className="theme-toggle" onClick={toggleTheme}>{dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}{dark ? "Light mode" : "Dark mode"}</button></div>
    </aside>
    <div className="main-wrap">
      <header className="topbar finance-topbar">
        <a className="finance-brand mobile-brand" href="#overview"><BrandLogo /></a>
        <form className="header-search" role="search" onSubmit={(event) => { event.preventDefault(); window.location.hash = "transactions"; }}><Search size={18} aria-hidden /><label className="sr-only" htmlFor="global-search">Search transactions</label><input id="global-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions..." /></form>
        <div className="topbar-actions" ref={menus}><a className="icon-button mobile-search" href="#transactions" aria-label="Search transactions"><Search size={20} /></a><span className="local-pill">Manual · Local only</span><div className="menu-wrap"><button className="icon-button" aria-label="Notifications" aria-expanded={notifications} aria-haspopup="true" onClick={() => { setNotifications(!notifications); setProfile(false); }}><Bell size={20} /></button>{notifications && <div className="dropdown"><p>No new notifications.</p></div>}</div><div className="menu-wrap"><button className="avatar finance-avatar" aria-label="Profile menu" aria-expanded={profile} aria-haspopup="true" onClick={() => { setProfile(!profile); setNotifications(false); }}>{session.username.slice(0, 2).toUpperCase()}</button>{profile && <div className="dropdown"><strong>{session.username}</strong><a href="#settings" onClick={() => setProfile(false)}><Settings size={15} aria-hidden /> Profile &amp; account settings</a><button onClick={onSignOut}><LogOut size={15} aria-hidden /> Sign out</button></div>}</div></div>
      </header>
      <main className="content finance-content">
        {error && <div role="alert" className="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
        <div className="dashboard-view" hidden={active !== "overview"}>
        <section id="overview">
          <div className="finance-intro"><h1>Welcome back!</h1><p>Here’s your financial overview for {month}.</p><span>Balances are manually maintained. Demo data is not connected to a bank.</span></div>
          {loading ? <div className="finance-stats" aria-busy="true"><p className="sr-only" role="status">Loading your local data...</p>{[0, 1, 2, 3].map((n) => <div className="skeleton stat-skeleton" key={n} />)}</div> : <div className="finance-stats">
            <a className="finance-stat" href="#accounts"><div><span className="finance-icon" aria-hidden="true"><CreditCard size={19} /></span><strong>Credit Cards</strong><ChevronRight size={17} aria-hidden /></div><b>{currency.format(totals("credit"))}</b><small>Statement {currency.format(credit.reduce((sum, account) => sum + account.statementBalance, 0))}{credit.some((account) => availableCredit(account) !== undefined) && <> · Known available {currency.format(credit.reduce((sum, account) => sum + (availableCredit(account) ?? 0), 0))}</>}</small></a>
            <a className="finance-stat" href="#accounts"><div><span className="finance-icon" aria-hidden="true"><Landmark size={19} /></span><strong>Checking</strong><ChevronRight size={17} aria-hidden /></div><b>{currency.format(totals("checking"))}</b><small>Available balance</small></a>
            <a className="finance-stat" href="#accounts"><div><span className="finance-icon" aria-hidden="true"><PiggyBank size={19} /></span><strong>Savings</strong><ChevronRight size={17} aria-hidden /></div><b>{currency.format(totals("savings"))}</b><small>Savings balance</small></a>
            <div className="finance-stat net-stat"><div><span className="finance-icon" aria-hidden="true"><TrendingUp size={19} /></span><strong>Net Position</strong><button className="net-visibility" type="button" aria-label={balanceVisible ? "Hide net position" : "Show net position"} aria-pressed={!balanceVisible} onClick={() => setBalanceVisible(!balanceVisible)}>{balanceVisible ? <Eye size={20} /> : <EyeOff size={20} />}</button></div><b>{balanceVisible ? currency.format(netPosition(accounts)) : "••••••"}</b><small>Included assets minus liabilities</small></div>
          </div>}
        </section>
        <div className="finance-middle">
          <p className="sr-only">Cash flow by month: {chart.map((point) => `${point.name}: income ${currency.format(point.income)}, expenses ${currency.format(point.expenses)}.`).join(" ")}</p>
          <section className="finance-panel"><div className="finance-panel-head"><h2><BarChart3 size={20} aria-hidden /> Cash Flow</h2><div className="periods" role="group" aria-label="Cash flow period">{[1, 3, 6, 12].map((n) => <button key={n} className={period === n ? "active" : ""} aria-pressed={period === n} onClick={() => setPeriod(n)}>{n === 12 ? "1Y" : `${n}M`}</button>)}</div></div><div className="chart-legend"><span><i /> Income</span><span><i /> Expenses</span></div><div className="finance-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--chart-label)" }} /><YAxis width={55} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--chart-label)" }} tickFormatter={(value: number) => `$${value >= 1000 ? `${value / 1000}k` : value}`} /><ChartTooltip formatter={(value) => currency.format(Number(value))} /><Bar dataKey="income" name="Income" fill="var(--chart-income)" radius={[4, 4, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="var(--chart-expenses)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div><p className="finance-muted">Transfers and card payments are excluded from cash flow.</p></section>
          <section className="finance-panel dashboard-goals"><div className="finance-panel-head"><h2><Target size={20} aria-hidden /> Your Goals</h2><div className="account-heading-actions"><a className="text-button" href="#goals">View all <ArrowRight size={14} aria-hidden /></a><button className="text-button" onClick={() => setEditor({ kind: "goal" })}><Plus size={15} aria-hidden /> Add goal</button></div></div><div className="goal-list">{goals.length ? goals.map((goal) => {
            const name = goal.name.toLowerCase();
            const Icon = name.includes("home") ? House : name.includes("emergency") ? Shield : name.includes("retirement") ? Trees : Target;
            const pct = Math.round(goal.current / goal.target * 100);
            return <div className="goal-row" key={goal.id}><span className="finance-icon" aria-hidden="true"><Icon size={19} /></span><div className="goal-details"><div className="goal-line"><strong>{goal.name}</strong><span>{pct}%</span></div><p><b>{currency.format(goal.current)}</b> / {currency.format(goal.target)}</p><div className="progress" aria-hidden="true"><span style={{ width: `${Math.min(100, goal.current / goal.target * 100)}%` }} /></div><div className="record-actions"><button onClick={() => setEditor({ kind: "goal", value: goal })} aria-label={`Edit ${goal.name}`}>Edit</button><button className="danger-link" onClick={() => remove("goal", goal.id, goal.name)} aria-label={`Delete ${goal.name}`}>Delete</button></div></div></div>;
          }) : <EmptyState compact icon={Target} title="No goals yet" action={<button className="button secondary small" onClick={() => setEditor({ kind: "goal" })}><Plus size={15} aria-hidden /> Add goal</button>}>Add a goal to track your progress.</EmptyState>}</div></section>
        </div>
        <div className="finance-bottom">
          <section className="finance-panel"><div className="finance-panel-head"><h2><Wallet size={20} aria-hidden /> Your Accounts</h2><div className="account-heading-actions"><a className="text-button mobile-view-accounts" href="#accounts">View all</a><button className="text-button" onClick={() => setAccountEditor(null)}><Plus size={15} aria-hidden /> Add</button></div></div>{accounts.length ? accounts.map((account) => <div className="finance-row" key={account.id}><div className="finance-icon" aria-hidden="true">{account.type === "credit" ? <CreditCard size={18} /> : account.type === "savings" ? <PiggyBank size={18} /> : <Landmark size={18} />}</div><div className="row-body"><strong>{account.name}</strong><small>{labels[account.type]} · {account.institution}</small>{account.type === "credit" && <small>Statement {currency.format(account.statementBalance)} · Remaining {currency.format(Math.max(0, account.statementBalance - (account.paymentsTowardStatement ?? 0)))}{account.dueDate ? ` · Due ${account.dueDate}` : ""}{creditUtilization(account) !== undefined ? ` · Utilization ${Math.round(creditUtilization(account)!)}%` : ""}{availableCredit(account) !== undefined ? ` · Available ${currency.format(availableCredit(account)!)}` : ""}</small>}<div className="record-actions"><button onClick={() => setAccountEditor(account)} aria-label={`Edit / details, ${account.name}`}>Edit / details</button><button className="danger-link" onClick={() => remove("account", account.id, account.name)} aria-label={`Delete ${account.name}`}>Delete</button></div></div><strong>{currency.format(account.balance)}</strong></div>) : <EmptyState compact icon={Wallet} title="No accounts yet" action={<button className="button secondary small" onClick={() => setAccountEditor(null)}><Plus size={15} aria-hidden /> Add account</button>}>Add one to get started.</EmptyState>}</section>
          <section className="finance-panel"><div className="finance-panel-head"><h2><ArrowLeftRight size={20} aria-hidden /> Recent Transactions</h2><a className="text-button" href="#transactions">View all <ArrowRight size={14} aria-hidden /></a></div>{recent.length ? recent.map((item) => <TransactionRow key={item.id} item={item} onEdit={() => setEditor({ kind: "transaction", value: item })} />) : <EmptyState compact icon={ArrowLeftRight} title="No transactions yet" action={<button className="button secondary small" onClick={() => setEditor({ kind: "transaction" })}><Plus size={15} aria-hidden /> Add transaction</button>} />}</section>
          <section className="finance-panel insight"><TrendingUp size={22} aria-hidden /><h2>Your cash flow</h2><p>{change >= 0 ? "Net cash flow is up" : "Net cash flow is down"} {currency.format(Math.abs(change))} compared with last month.</p><a className="button primary small" href="#analytics">View Details <ArrowRight size={15} aria-hidden /></a></section>
        </div>
        </div>
        <div hidden={active !== "transactions"}><Transactions transactions={transactions} accounts={accounts} userId={session.userId} search={search} setSearch={setSearch} onAdd={() => setEditor({ kind: "transaction" })} onEdit={(item) => setEditor({ kind: "transaction", value: item })} onDelete={(item) => void remove("transaction", item.id, item.description)} onImport={async (items) => { await storage.addTransactions(items); try { await refresh(); } catch { setError("Transactions were imported, but the display could not be refreshed. Reload the page to see them."); } }} /></div>
        <div hidden={active !== "accounts"}><AccountsWorkspace accounts={accounts} onAdd={() => setAccountEditor(null)} onEdit={setAccountEditor} onDelete={(account) => void remove("account", account.id, account.name)} /></div>
        <div hidden={active !== "goals"}><GoalsWorkspace goals={goals} onAdd={() => setEditor({ kind: "goal" })} onEdit={(goal) => setEditor({ kind: "goal", value: goal })} onDelete={(goal) => void remove("goal", goal.id, goal.name)} /></div>
        <div hidden={active !== "analytics"}><AnalyticsWorkspace accounts={accounts} transactions={transactions} /></div>
        <div hidden={active !== "settings"}>
        <section className="workspace" id="settings">
          <header className="page-head"><div><h1>Settings</h1><p>Local profile: <strong>{session.username}</strong>. Settings and records are stored in this browser.</p></div></header>
          <div className="settings-grid">
          <section className="settings-group" aria-labelledby="settings-appearance">
            <h2 id="settings-appearance">Appearance</h2>
            <p className="finance-muted">Theme changes apply immediately across MoneyStream.</p>
            <div className="settings-actions" role="group" aria-label="Theme"><button className="button secondary small" aria-pressed={!dark} onClick={() => { if (dark) toggleTheme(); }}><Sun size={16} aria-hidden /> Light</button><button className="button secondary small" aria-pressed={dark} onClick={() => { if (!dark) toggleTheme(); }}><Moon size={16} aria-hidden /> Dark</button></div>
          </section>
          <section className="settings-group" aria-labelledby="settings-session">
            <h2 id="settings-session">Session</h2>
            <p className="finance-muted">Sign out of this local profile. Your records stay in this browser.</p>
            <div className="settings-actions"><button className="button secondary small" onClick={onSignOut}><LogOut size={16} aria-hidden /> Sign out</button></div>
          </section>
          <section className="settings-group wide-row" aria-labelledby="settings-data">
            <h2 id="settings-data">Data and privacy</h2>
            <p className="finance-muted">This prototype stores data in your browser without encryption. Do not enter bank credentials or sensitive financial information. Backups contain financial data in plain text. Import replaces this profile&apos;s accounts, transactions and goals.</p>
            <div className="settings-actions"><button className="button secondary" onClick={download}><Download size={16} aria-hidden /> Export backup</button><label className="button secondary"><Upload size={16} aria-hidden /> Import backup<input className="sr-only" type="file" accept="application/json,.json" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
          </section>
          <section className="settings-group danger-zone wide-row" aria-labelledby="settings-danger">
            <h2 id="settings-danger">Erase data</h2>
            <p className="finance-muted">These actions permanently remove data from this browser and cannot be undone. You will be asked to confirm first.</p>
            <div className="settings-actions"><button className="button destructive" onClick={erase}><Trash2 size={16} aria-hidden /> Erase local financial data</button><button className="button destructive" onClick={eraseAll}><Trash2 size={16} aria-hidden /> Erase all local data</button></div>
          </section>
          </div>
          <div className="workflow-tracker" role="status" aria-live="polite"><div className="workflow-tracker-title"><span className="workflow-tracker-icon"><BarChart3 size={19} /></span><div><strong>Workflow activity</strong><small>GitHub Actions · read-only</small></div></div><div className="workflow-tracker-count"><strong>{workflowLoading ? "—" : workflowRuns?.completed ?? "Unavailable"}</strong><span>completed runs</span></div><div className="workflow-tracker-latest"><span className={`workflow-status-dot ${workflowRuns?.status ?? ""}`} /><div><small>Latest result</small><strong>{workflowLoading ? "Checking GitHub…" : workflowRuns ? `${workflowRuns.latest} · ${workflowRuns.status}` : "Could not load workflow status"}</strong></div></div></div>
        </section>
        </div>
      </main>
    </div>
    <nav className="mobile-nav finance-mobile-nav" aria-label="Mobile navigation">{mobileNav.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} aria-current={active === id ? "page" : undefined}><Icon size={20} aria-hidden />{label}</a>)}</nav>
    {accountEditor !== undefined && <AccountModal account={accountEditor ?? undefined} userId={session.userId} onClose={() => setAccountEditor(undefined)} onSave={saveAccount} />}
    {editor && <RecordModal record={editor} userId={session.userId} accounts={accounts} onClose={() => setEditor(undefined)} onSave={saveRecord} />}
  </div>;
}

function TransactionRow({ item, onEdit, onDelete }: { item: Transaction; onEdit: () => void; onDelete?: () => void }) {
  return <div className="finance-row"><div className="finance-icon" aria-hidden="true"><ArrowLeftRight size={17} /></div><div className="row-body"><strong>{item.description}</strong><small>{item.date} · {item.category} · {item.type === "payment" ? "Card payment" : item.type}</small><div className="record-actions"><button onClick={onEdit} aria-label={`Details / edit, ${item.description}`}>Details / edit</button>{onDelete && <button className="danger-link" onClick={onDelete}>Delete</button>}</div></div><strong className={item.type === "income" ? "positive" : item.type === "expense" ? "negative" : ""}>{item.type === "income" ? "+" : item.type === "expense" ? "−" : ""}{currency.format(item.amount)}</strong></div>;
}
