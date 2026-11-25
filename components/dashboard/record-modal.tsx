"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Account, Goal, Transaction } from "@/lib/types";

type Props = {
  userId: string;
  accounts: Account[];
  record: { kind: "goal"; value?: Goal } | { kind: "transaction"; value?: Transaction };
  onClose: () => void;
  onSave: (record: Goal | Transaction) => Promise<void>;
};

export function RecordModal({ userId, accounts, record, onClose, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amount = Number(data.get("amount"));
    const second = Number(data.get("second"));
    const name = String(data.get("name") ?? "").trim();
    const monthlyTarget = String(data.get("monthlyTarget") ?? "").trim();
    if (!name || !Number.isFinite(amount) || amount < 0 || (record.kind === "goal" && (!Number.isFinite(second) || second <= 0 || (monthlyTarget !== "" && (!Number.isFinite(Number(monthlyTarget)) || Number(monthlyTarget) < 0))))) {
      setError("Enter a name and valid amounts. Goal targets must be greater than zero.");
      return;
    }
    const id = record.value?.id ?? crypto.randomUUID();
    const result: Goal | Transaction = record.kind === "goal"
      ? { id, userId, name, current: amount, target: second, description: String(data.get("description") ?? "").trim() || undefined, category: String(data.get("goalCategory") ?? "").trim() || undefined, targetDate: String(data.get("targetDate") ?? "") || undefined, monthlyTarget: monthlyTarget ? Number(monthlyTarget) : undefined, paused: data.get("paused") === "on" }
      : { id, userId, description: name, amount, category: String(data.get("category") ?? "").trim(), type: data.get("type") as Transaction["type"], date: String(data.get("date")), accountId: String(data.get("accountId") || "") || undefined, notes: String(data.get("notes") ?? "").trim() || undefined, recurring: data.get("recurring") === "on", status: data.get("status") === "pending" ? "pending" : data.get("status") === "posted" ? "posted" : undefined };
    setSaving(true);
    setError("");
    try { await onSave(result); } catch { setError("Could not save this record. Check your browser storage and try again."); }
    finally { setSaving(false); }
  }

  return <dialog ref={dialog} className="modal" onCancel={(event) => { event.preventDefault(); onClose(); }} aria-labelledby="record-title">
    <div className="modal-head"><div><h2 id="record-title">{record.value ? "Edit" : "Add"} {record.kind}</h2><p className="muted">Saved locally in this browser.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="full"><label className="field-label" htmlFor="record-name">{record.kind === "goal" ? "Goal name" : "Description"}</label><input className="input" id="record-name" name="name" required defaultValue={record.kind === "goal" ? record.value?.name : record.value?.description} /></div>
        <div><label className="field-label" htmlFor="record-amount">{record.kind === "goal" ? "Current amount" : "Amount"}</label><input className="input" id="record-amount" name="amount" type="number" min="0" step="0.01" required defaultValue={record.kind === "goal" ? record.value?.current : record.value?.amount} /></div>
        {record.kind === "goal" ? <>
          <div><label className="field-label" htmlFor="record-target">Target amount</label><input className="input" id="record-target" name="second" type="number" min="0.01" step="0.01" required defaultValue={record.value?.target} /></div>
          <div className="full"><label className="field-label" htmlFor="goal-description">Description <span>optional</span></label><textarea className="input textarea" id="goal-description" name="description" defaultValue={record.value?.description} /></div>
          <div><label className="field-label" htmlFor="goal-category">Category <span>optional</span></label><input className="input" id="goal-category" name="goalCategory" defaultValue={record.value?.category} /></div>
          <div><label className="field-label" htmlFor="goal-date">Target date <span>optional</span></label><input className="input" id="goal-date" name="targetDate" type="date" defaultValue={record.value?.targetDate} /></div>
          <div><label className="field-label" htmlFor="goal-monthly">Monthly contribution target <span>optional</span></label><input className="input" id="goal-monthly" name="monthlyTarget" type="number" min="0" step="0.01" defaultValue={record.value?.monthlyTarget} /></div>
          <label className="check-row"><input type="checkbox" name="paused" defaultChecked={record.value?.paused} /> Pause this goal</label>
        </> : <>
          <div><label className="field-label" htmlFor="record-type">Type</label><select className="input" id="record-type" name="type" defaultValue={record.value?.type ?? "expense"}><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option><option value="payment">Credit card payment</option></select></div>
          <div><label className="field-label" htmlFor="record-category">Category</label><input className="input" id="record-category" name="category" required defaultValue={record.value?.category} /></div>
          <div><label className="field-label" htmlFor="record-date">Date</label><input className="input" id="record-date" name="date" type="date" required defaultValue={record.value?.date ?? new Date().toLocaleDateString("en-CA")} /></div>
          <div className="full"><label className="field-label" htmlFor="record-account">Account <span>optional</span></label><select className="input" id="record-account" name="accountId" defaultValue={record.value?.accountId ?? ""}><option value="">None</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></div>
          <div><label className="field-label" htmlFor="record-status">Status</label><select className="input" id="record-status" name="status" defaultValue={record.value ? record.value.status ?? "" : "posted"}><option value="">Not recorded</option><option value="posted">Posted</option><option value="pending">Pending</option></select></div>
          <label className="check-row"><input type="checkbox" name="recurring" defaultChecked={record.value?.recurring} /> Recurring transaction</label>
          <div className="full"><label className="field-label" htmlFor="record-notes">Notes <span>optional</span></label><textarea className="input textarea" id="record-notes" name="notes" defaultValue={record.value?.notes} /></div>
          <p className="muted full">Transactions do not automatically change manually entered account balances.</p>
        </>}
      </div>
      {error && <div role="alert" className="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button></div>
    </form>
  </dialog>;
}
