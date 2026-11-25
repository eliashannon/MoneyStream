import { demoAccounts, demoActivity, demoGoals, demoTransactions, demoUser } from "./demoData";
import { Account, ActivityEvent, Goal, Transaction, User } from "./types";
import { z } from "zod";

// This adapter is the browser-only boundary to replace with a backend repository later.
const DB_NAME = "moneystream";
const STORES = ["users", "accounts", "activity", "transactions", "goals"] as const;
type Store = (typeof STORES)[number];
let opening: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 2);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        for (const name of STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        const tx = request.transaction!;
        if (event.oldVersion === 0) {
          tx.objectStore("users").add(demoUser);
          demoAccounts.forEach((account) => tx.objectStore("accounts").add(account));
          demoActivity.forEach((event) => tx.objectStore("activity").add(event));
        }
        demoTransactions.forEach((item) => tx.objectStore("transactions").add(item));
        demoGoals.forEach((item) => tx.objectStore("goals").add(item));
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); opening = undefined; };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Database upgrade is blocked by another tab."));
    }).catch((error) => { opening = undefined; throw error; });
  }
  return opening!;
}

async function all<T>(store: Store): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function write(store: Store, value: unknown, remove = false): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    if (remove) tx.objectStore(store).delete(value as IDBValidKey);
    else tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function deleteAccount(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["accounts", "transactions"], "readwrite");
    const accounts = tx.objectStore("accounts");
    const request = accounts.get(id);
    request.onsuccess = () => {
      const account = request.result as Account | undefined;
      if (!account) return;
      accounts.delete(id);
      const transactions = tx.objectStore("transactions");
      const cursor = transactions.openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (!item) return;
        const transaction = item.value as Transaction;
        if (transaction.userId === account.userId && transaction.accountId === id) item.update({ ...transaction, accountId: undefined });
        item.continue();
      };
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Account deletion was aborted."));
  });
}

export const storage = {
  users: () => all<User>("users"),
  saveUser: (user: User) => write("users", user),
  accounts: async (userId: string) => (await all<Account>("accounts")).filter((a) => a.userId === userId),
  saveAccount: (account: Account) => write("accounts", account),
  deleteAccount,
  activity: async (userId: string) => (await all<ActivityEvent>("activity")).filter((event) => event.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  saveActivity: (event: ActivityEvent) => write("activity", event),
  transactions: async (userId: string) => (await all<Transaction>("transactions")).filter((item) => item.userId === userId),
  saveTransaction: (item: Transaction) => write("transactions", item),
  deleteTransaction: (id: string) => write("transactions", id, true),
  goals: async (userId: string) => (await all<Goal>("goals")).filter((item) => item.userId === userId),
  saveGoal: (item: Goal) => write("goals", item),
  deleteGoal: (id: string) => write("goals", id, true),
  clearAll: async () => {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([...STORES], "readwrite");
      for (const name of STORES) tx.objectStore(name).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Data deletion was aborted."));
    });
  },
};

const money = z.number().finite();
const baseAccount = z.object({
  id: z.string().min(1), userId: z.string(), name: z.string().min(1), institution: z.string(),
  balance: money, createdAt: z.string(), notes: z.string().optional(), includeInNetWorth: z.boolean().optional(),
});
const accountSchema = z.discriminatedUnion("type", [
  baseAccount.extend({ type: z.literal("credit"), statementBalance: money.nonnegative(), minimumPayment: money.nonnegative().optional(), dueDate: z.string().optional(), availableCredit: money.nonnegative().optional(), color: z.string().optional(), creditLimit: money.nonnegative().optional(), paymentsTowardStatement: money.nonnegative().optional(), closingDate: z.string().optional() }),
  baseAccount.extend({ type: z.enum(["checking", "savings", "cash", "investment", "loan", "other"]) }),
]);
const transactionSchema = z.object({
  id: z.string().min(1), userId: z.string(), description: z.string().min(1), category: z.string(),
  type: z.enum(["income", "expense", "transfer", "payment"]), amount: money.nonnegative(),
  date: z.iso.date(), accountId: z.string().optional(),
});
const goalSchema = z.object({ id: z.string().min(1), userId: z.string(), name: z.string().min(1), current: money.nonnegative(), target: money.positive() });
const backupSchema = z.object({ version: z.literal(1), accounts: z.array(accountSchema), transactions: z.array(transactionSchema), goals: z.array(goalSchema) });

export async function exportBackup(userId: string) {
  const [accounts, transactions, goals] = await Promise.all([storage.accounts(userId), storage.transactions(userId), storage.goals(userId)]);
  return { version: 1 as const, accounts, transactions, goals };
}

export async function replaceFinancialData(userId: string, input: unknown) {
  const backup = backupSchema.parse(input);
  const ids = new Set(backup.accounts.map((item) => item.id));
  if (ids.size !== backup.accounts.length || new Set(backup.transactions.map((item) => item.id)).size !== backup.transactions.length || new Set(backup.goals.map((item) => item.id)).size !== backup.goals.length || backup.transactions.some((item) => item.accountId && !ids.has(item.accountId))) {
    throw new Error("Backup contains duplicate IDs or references a missing account.");
  }
  const accountIds = new Map(backup.accounts.map((item) => [item.id, crypto.randomUUID()]));
  const records = {
    accounts: backup.accounts.map((item) => ({ ...item, id: accountIds.get(item.id)!, userId })),
    transactions: backup.transactions.map((item) => ({ ...item, id: crypto.randomUUID(), userId, accountId: item.accountId ? accountIds.get(item.accountId) : undefined })),
    goals: backup.goals.map((item) => ({ ...item, id: crypto.randomUUID(), userId })),
  };
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["accounts", "transactions", "goals", "activity"], "readwrite");
    for (const name of ["accounts", "transactions", "goals", "activity"] as const) {
      const store = tx.objectStore(name);
      const request = store.getAll();
      request.onsuccess = () => {
        for (const item of request.result as { id: string; userId: string }[]) if (item.userId === userId) store.delete(item.id);
        if (name !== "activity") for (const item of records[name]) store.put(item);
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Data replacement was aborted."));
  });
}
