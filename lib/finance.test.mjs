import { strict as assert } from "node:assert";
import { test } from "node:test";
import { accountOverview, availableCredit, cashFlow, creditUtilization, goalOverview, netPosition } from "./finance.ts";

test("net position subtracts liabilities once and respects excluded and negative balances", () => {
  const base = { userId: "u", institution: "", name: "", createdAt: "" };
  assert.equal(netPosition([
    { ...base, id: "1", type: "checking", balance: 100 },
    { ...base, id: "2", type: "savings", balance: -20 },
    { ...base, id: "3", type: "credit", balance: 40, statementBalance: 25 },
    { ...base, id: "4", type: "loan", balance: 10 },
    { ...base, id: "5", type: "cash", balance: 999, includeInNetWorth: false },
  ]), 30);
});

test("cash flow groups months across years and excludes transfers and card payments", () => {
  const base = { userId: "u", category: "", description: "" };
  const chart = cashFlow([
    { ...base, id: "1", type: "income", amount: 100, date: "2025-12-01" },
    { ...base, id: "2", type: "expense", amount: 25, date: "2026-01-03" },
    { ...base, id: "3", type: "transfer", amount: 40, date: "2026-01-03" },
    { ...base, id: "4", type: "payment", amount: 30, date: "2026-01-04" },
  ], 2, new Date(2026, 0, 15));
  assert.deepEqual(chart.map(({ income, expenses }) => ({ income, expenses })), [{ income: 100, expenses: 0 }, { income: 0, expenses: 25 }]);
});

test("credit details use the limit or fall back to manually entered available credit", () => {
  const card = { type: "credit", balance: 200, statementBalance: 150, creditLimit: 1000 };
  assert.equal(availableCredit(card), 800);
  assert.equal(creditUtilization(card), 20);
  assert.equal(creditUtilization({ ...card, creditLimit: undefined, availableCredit: 800 }), 20);
  assert.equal(availableCredit({ ...card, balance: 1200 }), 0);
});

test("account overview totals current card balances without adding statements", () => {
  const accounts = [
    { type: "checking", balance: 100 },
    { type: "savings", balance: 50 },
    { type: "credit", balance: 40, statementBalance: 25 },
    { type: "credit", balance: 10, statementBalance: 10 },
  ];
  assert.deepEqual(accountOverview(accounts), { checking: 100, savings: 50, credit: 50, netPosition: 100 });
});

test("goal overview aggregates actual saved amounts and completed goals", () => {
  assert.deepEqual(goalOverview([{ current: 120, target: 100 }, { current: 20, target: 100 }]), { current: 140, target: 200, completed: 1 });
  assert.deepEqual(goalOverview([]), { current: 0, target: 0, completed: 0 });
});
