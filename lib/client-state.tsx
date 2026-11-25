"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { restoreSession, signOut } from "./auth";
import { Session } from "./types";

interface ClientState {
  session: Session | null;
  setSession: (session: Session | null) => void;
  ready: boolean;
  dark: boolean;
  toggleTheme: () => void;
  endSession: () => void;
}

const Context = createContext<ClientState | null>(null);

export function ClientStateProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("moneystream-theme");
    const isDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isDark);
    restoreSession().then((restored) => { setDark(isDark); setSession(restored); }).catch(() => { setDark(isDark); setSession(null); }).finally(() => setReady(true));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("moneystream-theme", next ? "dark" : "light");
  }

  return <Context.Provider value={{ session, setSession, ready, dark, toggleTheme, endSession: () => { signOut(); setSession(null); } }}>{children}</Context.Provider>;
}

export function useClientState() {
  const value = useContext(Context);
  if (!value) throw new Error("ClientStateProvider is missing.");
  return value;
}
