"use client";

import { useState } from "react";
import { CreditCard, Landmark, Plus } from "lucide-react";
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

  return <section className="finance-panel full-section" id="accounts">
    <div className="finance-panel-head"><h2><Landmark size={20} /> Accounts</h2><button className="button primary small" onClick={onAdd}><Plus size={16} /> Add account</button></div>
    <p className="finance-muted">Account balances are entered manually and stored locally.</p>
    <div className="transaction-summary account-summary">
      <div><span>Checking</span><strong>{currency.format(overview.checking)}</strong></div>
      <div><span>Savings</span><strong>{currency.format(overview.savings)}</strong></div>
      <div><span>Credit card debt</span><strong>{currency.format(overview.credit)}</strong></div>
      <div><span>Net position</span><strong>{currency.format(overview.netPosition)}</strong></div>
    </div>
    <p className="finance-muted">Net position includes all accounts selected for net position, including other assets and loans. Statement balances are not added to current card debt.</p>
    <div className="account-filters"><label>Search accounts<input className="input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label>Account type<select className="input" value={type} onChange={(event) => setType(event.target.value)}><option value="">All account types</option>{Object.entries(typeLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label></div>
    {visible.length ? visible.map((account) => <div className="finance-row account-workspace-row" key={account.id}>
      <span className="finance-icon">{account.type === "credit" ? <CreditCard size={18} /> : <Landmark size={18} />}</span>
      <div className="row-body"><strong>{account.name}</strong><small>{typeLabels[account.type]} · {account.institution}</small>
        {account.type === "credit" && <small>Statement {currency.format(account.statementBalance)}{account.creditLimit !== undefined ? ` · Limit ${currency.format(account.creditLimit)}` : ""}{availableCredit(account) !== undefined ? ` · Available ${currency.format(availableCredit(account)!)}` : ""}{creditUtilization(account) !== undefined ? ` · Utilization ${Math.round(creditUtilization(account)!)}%` : ""}{account.dueDate ? ` · Due ${account.dueDate}` : ""}</small>}
        <div className="record-actions"><button onClick={() => onEdit(account)}>Details / edit</button><button onClick={() => onDelete(account)}>Delete</button></div>
      </div>
      <strong>{currency.format(account.balance)}</strong>
    </div>) : <p className="finance-muted">No matching accounts.</p>}
  </section>;
}
