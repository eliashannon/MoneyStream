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
}

export interface CreditCardAccount extends BaseAccount {
  type: "credit";
  statementBalance: number;
  minimumPayment?: number;
  dueDate?: string;
  availableCredit?: number;
  color?: string;
}

export interface BankAccount extends BaseAccount {
  type: "checking" | "savings";
}

export type Account = CreditCardAccount | BankAccount;

export interface ActivityEvent {
  id: string;
  userId: string;
  action: string;
  detail: string;
  createdAt: string;
}
