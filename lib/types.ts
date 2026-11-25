export interface User {
  id: string;
  username: string;
  password: string;
  createdAt: string;
}

export interface Session {
  userId: string;
  username: string;
}

interface BaseAccount {
  id: string;
  userId: string;
  name: string;
  institution: string;
  balance: number;
  notes?: string;
  createdAt: string;
  includeInNetWorth?: boolean;
}

export interface CreditCardAccount extends BaseAccount {
  type: "credit";
  statementBalance: number;
  minimumPayment?: number;
  dueDate?: string;
  availableCredit?: number;
  color?: string;
  paymentsTowardStatement?: number;
  creditLimit?: number;
  closingDate?: string;
}

export interface BankAccount extends BaseAccount {
  type: "checking" | "savings" | "cash" | "investment" | "loan" | "other";
}

export type Account = CreditCardAccount | BankAccount;

export interface ActivityEvent {
  id: string;
  userId: string;
  action: string;
  detail: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  description: string;
  category: string;
  type: "income" | "expense" | "transfer" | "payment";
  amount: number;
  date: string;
  accountId?: string;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  current: number;
  target: number;
}
