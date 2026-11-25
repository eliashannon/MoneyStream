import { Account, ActivityEvent, User } from "./types";

const createdAt = new Date().toISOString();
const dueIn = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
export const demoUser: User = { id: "demo", username: "demo", password: "demo", createdAt };

export const demoAccounts: Account[] = [
  { id: "demo-card-1", userId: "demo", type: "credit", name: "Everyday Rewards", institution: "Northstar Bank", balance: 2340.5, statementBalance: 1842.35, minimumPayment: 35, dueDate: dueIn(12), availableCredit: 7659.5, color: "indigo", createdAt },
  { id: "demo-card-2", userId: "demo", type: "credit", name: "Travel Card", institution: "Horizon", balance: 875.2, statementBalance: 642.8, minimumPayment: 25, dueDate: dueIn(18), availableCredit: 5124.8, color: "teal", createdAt },
  { id: "demo-checking", userId: "demo", type: "checking", name: "Everyday Checking", institution: "Northstar Bank", balance: 8240.65, createdAt },
  { id: "demo-savings", userId: "demo", type: "savings", name: "Rainy Day Fund", institution: "Alpine Savings", balance: 16450, createdAt },
];

export const demoActivity: ActivityEvent[] = [
  { id: "demo-event-1", userId: "demo", action: "Account added", detail: "Rainy Day Fund", createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "demo-event-2", userId: "demo", action: "Account added", detail: "Everyday Checking", createdAt: new Date(Date.now() - 172800000).toISOString() },
  { id: "demo-event-3", userId: "demo", action: "Welcome to MoneyStream", detail: "Your local workspace is ready", createdAt: new Date(Date.now() - 259200000).toISOString() },
];
