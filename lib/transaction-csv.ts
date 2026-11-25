import { z } from "zod";
import type { Account, Transaction } from "./types";

const columns = ["id", "date", "description", "accountId", "category", "type", "amount", "status", "recurring", "notes"] as const;
const schema = z.object({
  id: z.string().min(1), date: z.iso.date(), description: z.string().trim().min(1),
  accountId: z.string(), category: z.string(), type: z.enum(["income", "expense", "transfer", "payment"]),
  amount: z.string().min(1).refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0),
  status: z.enum(["", "pending", "posted"]), recurring: z.enum(["", "true", "false"]), notes: z.string(),
});

function protect(value: string) {
  return /^'|^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? `'${value}` : value;
}

function unprotect(value: string) {
  return /^'(?:'|[\s]*[=+\-@]|[\t\r\n])/.test(value) ? value.slice(1) : value;
}

function quote(value: string) {
  return `"${protect(value).replaceAll('"', '""')}"`;
}

export function exportTransactionsCsv(transactions: Transaction[]) {
  const rows = transactions.map((item) => [
    item.id, item.date, item.description, item.accountId ?? "", item.category, item.type,
    String(item.amount), item.status ?? "", item.recurring === undefined ? "" : String(item.recurring), item.notes ?? "",
  ].map(quote).join(","));
  return [columns.join(","), ...rows].join("\r\n") + "\r\n";
}

function parseRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  for (let i = 0; i < input.length; i++) {
    const character = input[i];
    if (quoted) {
      if (character === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (character === '"') { quoted = false; closed = true; }
      else field += character;
    } else if (character === '"' && !field && !closed) quoted = true;
    else if (character === "," || character === "\n" || character === "\r") {
      row.push(field); field = ""; closed = false;
      if (character !== ",") {
        rows.push(row); row = [];
        if (character === "\r" && input[i + 1] === "\n") i++;
      }
    } else {
      if (closed || character === '"') throw new Error("Invalid CSV quoting.");
      field += character;
    }
  }
  if (quoted) throw new Error("Unclosed CSV field.");
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  return rows;
}

export function importTransactionsCsv(input: string, userId: string, accounts: Account[], existing: Transaction[]): Transaction[] {
  const rows = parseRows(input.replace(/^\uFEFF/, ""));
  if (!rows.length || rows[0].length !== columns.length || rows[0].some((value, index) => value !== columns[index])) {
    throw new Error("CSV columns do not match the MoneyStream export format.");
  }
  if (rows.length === 1) throw new Error("CSV contains no transactions.");
  const accountIds = new Set(accounts.map((account) => account.id));
  const ids = new Set(existing.map((item) => item.id));
  return rows.slice(1).map((row, index) => {
    if (row.length !== columns.length) throw new Error(`Invalid column count on row ${index + 2}.`);
    const parsed = schema.safeParse(Object.fromEntries(columns.map((column, i) => [column, unprotect(row[i])])));
    if (!parsed.success) throw new Error(`Invalid transaction on row ${index + 2}.`);
    const item = parsed.data;
    if (ids.has(item.id)) throw new Error(`Duplicate transaction ID on row ${index + 2}.`);
    if (item.accountId && !accountIds.has(item.accountId)) throw new Error(`Unknown account on row ${index + 2}.`);
    ids.add(item.id);
    return {
      id: item.id, userId, date: item.date, description: item.description, accountId: item.accountId || undefined,
      category: item.category, type: item.type, amount: Number(item.amount), status: item.status || undefined,
      recurring: item.recurring === "" ? undefined : item.recurring === "true", notes: item.notes || undefined,
    };
  });
}
