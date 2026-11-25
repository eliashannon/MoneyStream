import { demoAccounts, demoActivity, demoUser } from "./demoData";
import { Account, ActivityEvent, User } from "./types";

// This adapter is the browser-only boundary to replace with a backend repository later.
const DB_NAME = "moneystream";
const STORES = ["users", "accounts", "activity"] as const;
type Store = (typeof STORES)[number];
let opening: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of STORES) db.createObjectStore(name, { keyPath: "id" });
        const tx = request.transaction!;
        tx.objectStore("users").add(demoUser);
        demoAccounts.forEach((account) => tx.objectStore("accounts").add(account));
        demoActivity.forEach((event) => tx.objectStore("activity").add(event));
      };
      request.onsuccess = () => resolve(request.result);
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

export const storage = {
  users: () => all<User>("users"),
  saveUser: (user: User) => write("users", user),
  accounts: async (userId: string) => (await all<Account>("accounts")).filter((a) => a.userId === userId),
  saveAccount: (account: Account) => write("accounts", account),
  deleteAccount: (id: string) => write("accounts", id, true),
  activity: async (userId: string) => (await all<ActivityEvent>("activity")).filter((event) => event.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  saveActivity: (event: ActivityEvent) => write("activity", event),
};
