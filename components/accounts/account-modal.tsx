"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { Account } from "@/lib/types";

const money = z.string().refine((value) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0, "Enter a valid non-negative amount.");
const optionalMoney = z.string().refine((value) => value.trim() === "" || (Number.isFinite(Number(value)) && Number(value) >= 0), "Enter a valid non-negative amount.");
const schema = z.object({
  type: z.enum(["credit", "checking", "savings"]),
  name: z.string().trim().min(1, "Enter an account name."),
  institution: z.string().trim().min(1, "Enter an institution."),
  balance: money,
  statementBalance: optionalMoney,
  minimumPayment: optionalMoney,
  availableCredit: optionalMoney,
  dueDate: z.string(),
  color: z.string(),
  notes: z.string(),
}).superRefine((value, ctx) => {
  if (value.type === "credit" && !value.statementBalance.trim()) ctx.addIssue({ code: "custom", path: ["statementBalance"], message: "Enter a statement balance." });
});
type Fields = z.infer<typeof schema>;

export function AccountModal({ account, userId, onClose, onSave }: { account?: Account; userId: string; onClose: () => void; onSave: (account: Account) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const credit = account?.type === "credit" ? account : undefined;
  const { register, handleSubmit, control, formState: { errors } } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: account?.type ?? "credit", name: account?.name ?? "", institution: account?.institution ?? "",
      balance: account ? String(account.balance) : "", statementBalance: credit ? String(credit.statementBalance) : "",
      minimumPayment: credit?.minimumPayment?.toString() ?? "", availableCredit: credit?.availableCredit?.toString() ?? "",
      dueDate: credit?.dueDate ?? "", color: credit?.color ?? "indigo", notes: account?.notes ?? "",
    },
  });
  const type = useWatch({ control, name: "type" });
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  async function submit(values: Fields) {
    setSaving(true); setError("");
    const base = { id: account?.id ?? crypto.randomUUID(), userId, name: values.name.trim(), institution: values.institution.trim(), balance: Number(values.balance), notes: values.notes.trim(), createdAt: account?.createdAt ?? new Date().toISOString() };
    const result: Account = values.type === "credit"
      ? { ...base, type: "credit", statementBalance: Number(values.statementBalance), minimumPayment: values.minimumPayment.trim() ? Number(values.minimumPayment) : undefined, availableCredit: values.availableCredit.trim() ? Number(values.availableCredit) : undefined, dueDate: values.dueDate || undefined, color: values.color }
      : { ...base, type: values.type };
    try { await onSave(result); } catch { setError("Could not save your account. Please check browser storage and try again."); }
    finally { setSaving(false); }
  }

  return <dialog ref={dialog} className="modal" onCancel={(event) => { event.preventDefault(); onClose(); }} aria-labelledby="modal-title">
    <div className="modal-head"><div><div className="form-kicker">YOUR ACCOUNTS</div><h2 id="modal-title">{account ? "Edit account" : "Add an account"}</h2><p className="muted">Details are saved only in this browser.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
    <form onSubmit={handleSubmit(submit)} noValidate>
      <div className="form-grid">
        <div className="full"><label className="field-label" htmlFor="type">Account type</label><select id="type" className="input" {...register("type")}><option value="credit">Credit card</option><option value="checking">Checking</option><option value="savings">Savings</option></select></div>
        <div><label className="field-label" htmlFor="name">Account name</label><input id="name" className="input" placeholder="e.g. Everyday Checking" {...register("name")} />{errors.name && <p className="field-error">{errors.name.message}</p>}</div>
        <div><label className="field-label" htmlFor="institution">{type === "credit" ? "Issuer" : "Institution"}</label><input id="institution" className="input" placeholder="e.g. Northstar Bank" {...register("institution")} />{errors.institution && <p className="field-error">{errors.institution.message}</p>}</div>
        <div><label className="field-label" htmlFor="balance">{type === "credit" ? "Full current balance" : "Current balance"}</label><input id="balance" className="input" type="number" step="0.01" min="0" placeholder="0.00" {...register("balance")} />{errors.balance && <p className="field-error">{errors.balance.message}</p>}</div>
        {type === "credit" && <>
          <div><label className="field-label" htmlFor="statementBalance">Statement balance</label><input id="statementBalance" className="input" type="number" step="0.01" min="0" placeholder="0.00" {...register("statementBalance")} />{errors.statementBalance && <p className="field-error">{errors.statementBalance.message}</p>}</div>
          <div><label className="field-label" htmlFor="minimumPayment">Minimum payment <span>optional</span></label><input id="minimumPayment" className="input" type="number" step="0.01" min="0" placeholder="0.00" {...register("minimumPayment")} />{errors.minimumPayment && <p className="field-error">{errors.minimumPayment.message}</p>}</div>
          <div><label className="field-label" htmlFor="dueDate">Due date <span>optional</span></label><input id="dueDate" className="input" type="date" {...register("dueDate")} /></div>
          <div><label className="field-label" htmlFor="availableCredit">Available credit <span>optional</span></label><input id="availableCredit" className="input" type="number" step="0.01" min="0" placeholder="0.00" {...register("availableCredit")} />{errors.availableCredit && <p className="field-error">{errors.availableCredit.message}</p>}</div>
          <div><label className="field-label" htmlFor="color">Card theme</label><select id="color" className="input" {...register("color")}><option value="indigo">Indigo</option><option value="teal">Teal</option><option value="slate">Slate</option></select></div>
        </>}
        <div className="full"><label className="field-label" htmlFor="notes">Notes <span>optional</span></label><textarea id="notes" className="input textarea" placeholder="Anything you’d like to remember" {...register("notes")} /></div>
      </div>
      {error && <div role="alert" className="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving..." : "Save account"}</button></div>
    </form>
  </dialog>;
}
