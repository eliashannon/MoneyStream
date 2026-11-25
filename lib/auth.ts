import { storage } from "./storage";
import { Session, User } from "./types";

const SESSION_KEY = "moneystream-session";

// Prototype only: passwords are stored locally in plain text, not production authentication.
// Replace this module with a real authentication service before handling sensitive data.
export async function signIn(username: string, password: string, remember: boolean): Promise<Session> {
  const user = (await storage.users()).find((u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password);
  if (!user) throw new Error("Username or password is incorrect.");
  const session = { userId: user.id, username: user.username };
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function createUser(username: string, password: string): Promise<User> {
  const name = username.trim();
  if ((await storage.users()).some((u) => u.username.toLowerCase() === name.toLowerCase())) throw new Error("That username is already in use on this browser.");
  const user = { id: crypto.randomUUID(), username: name, password, createdAt: new Date().toISOString() };
  await storage.saveUser(user);
  return user;
}

export async function restoreSession(): Promise<Session | null> {
  const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    const user = (await storage.users()).find((item) => item.id === session.userId);
    return user ? { userId: user.id, username: user.username } : null;
  } catch {
    return null;
  }
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}
