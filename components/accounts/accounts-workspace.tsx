"use client";

import { useState } from "react";
import { CreditCard, Landmark, PiggyBank, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { currency, accountOverview, availableCredit, creditUtilization } from "@/lib/finance";
import type { Account } from "@/lib/types";

const typeLabels: Record<Account["type"], string> = {
  credit: "Credit card", checking: "Checking", savings: "Savings", cash: "Cash", investment: "Investment", loan: "Loan", other: "Other",
};

export function AccountsWorkspace({ accounts, onAdd, onEdit, onDelete }: {
  accounts: Account[];
  onAdd: () => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const overview = accountOverview(accounts);
  const term = search.trim().toLocaleLowerCase();
  const visible = accounts.filter((account) => (!type || account.type === type) && (!term || `${account.name} ${account.institution}`.toLocaleLowerCase().includes(term)));

  return <section className="workspace" id="accounts">
    <header className="page-head">
      <div><h1>Accounts</h1><p>Account balances are entered manually and stored locally.</p></div>
      <div className="page-actions"><button className="button primary small" onClick={onAdd}><Plus size={16} aria-hidden /> Add account</button></div>
    </header>
    <div className="metric-grid">
      <div className="metric"><span>Checking</span><strong>{currency.format(overview.checking)}</strong></div>
      <div className="metric"><span>Savings</span><strong>{currency.format(overview.savings)}</strong></div>
      <div className="metric"><span>Credit card debt</span><strong>{currency.format(overview.credit)}</strong></div>
      <div className="metric featured"><span>Net position</span><strong>{currency.format(overview.netPosition)}</strong></div>
    </div>
    <p className="section-note">Net position includes all accounts selected for net position, including other assets and loans. Statement balances are not added to current card debt.</p>
    <section className="finance-panel" aria-labelledby="account-list-title">
      <div className="finance-panel-head"><h2 id="account-list-title"><Landmark size={20} aria-hidden /> All accounts</h2></div>
      <div className="account-filters"><label>Search accounts<input className="input" type="search" placeholder="Name or institution" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label>Account type<select className="input" value={type} onChange={(event) => setType(event.target.value)}><option value="">All account types</option>{Object.entries(typeLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label></div>
      {visible.length ? visible.map((account) => <div className="finance-row account-workspace-row" key={account.id}>
        <span className="finance-icon" aria-hidden="true">{account.type === "credit" ? <CreditCard size={18} /> : account.type === "savings" ? <PiggyBank size={18} /> : <Landmark size={18} />}</span>
        <div className="row-body"><strong>{account.name}</strong><small>{typeLabels[account.type]} · {account.institution}{account.includeInNetWorth === false ? " · Excluded from net position" : ""}</small>
          {account.type === "credit" && <small>Statement {currency.format(account.statementBalance)}{account.creditLimit !== undefined ? ` · Limit ${currency.format(account.creditLimit)}` : ""}{availableCredit(account) !== undefined ? ` · Available ${currency.format(availableCredit(account)!)}` : ""}{creditUtilization(account) !== undefined ? ` · Utilization ${Math.round(creditUtilization(account)!)}%` : ""}{account.dueDate ? ` · Due ${account.dueDate}` : ""}</small>}
          <div className="record-actions"><button onClick={() => onEdit(account)} aria-label={`Details / edit, ${account.name}`}>Details / edit</button><button className="danger-link" onClick={() => onDelete(account)} aria-label={`Delete ${account.name}`}>Delete</button></div>
        </div>
        <strong>{currency.format(account.balance)}</strong>
      </div>) : accounts.length
        ? <EmptyState icon={Search} title="No matching accounts." action={<button className="button secondary small" onClick={() => { setSearch(""); setType(""); }}>Clear filters</button>}>Try a different name, institution or account type.</EmptyState>
        : <EmptyState icon={Landmark} title="No accounts yet" action={<button className="button primary small" onClick={onAdd}><Plus size={16} aria-hidden /> Add account</button>}>Add your checking, savings and credit card accounts to see them together.</EmptyState>}
    </section>
  </section>;
}
