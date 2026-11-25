import { strict as assert } from "node:assert";
import { test } from "node:test";
import { exportTransactionsCsv, importTransactionsCsv } from "./transaction-csv.ts";

const transaction = { id: "1", userId: "u", date: "2026-01-01", description: "=test,\"quoted\"", category: "'food", type: "expense", amount: 10, accountId: "a", status: "pending", recurring: true, notes: "line one\nline two" };
const accounts = [{ id: "a" }];

test("CSV round-trips quoted, multiline and spreadsheet-sensitive fields", () => {
  const csv = exportTransactionsCsv([transaction]);
  assert.match(csv, /"'=test/);
  assert.deepEqual(importTransactionsCsv(csv, "u", accounts, []), [transaction]);
});

test("CSV rejects duplicates, missing accounts and malformed input", () => {
  const csv = exportTransactionsCsv([transaction]);
  assert.throws(() => importTransactionsCsv(csv, "u", accounts, [transaction]), /Duplicate/);
  assert.throws(() => importTransactionsCsv(csv, "u", [], []), /Unknown account/);
  assert.throws(() => importTransactionsCsv('id,date\n"unclosed', "u", accounts, []), /Unclosed/);
});
