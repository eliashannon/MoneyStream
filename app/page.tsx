"use client";

import { useEffect, useState } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { Dashboard } from "@/components/dashboard/dashboard";
import { restoreSession, signOut } from "@/lib/auth";
import { Session } from "@/lib/types";

export default function Home() {
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

  if (!ready) return <div className="loading-screen"><span className="brand-mark">m</span><span>Opening your workspace...</span></div>;
  return session
    ? <Dashboard session={session} dark={dark} toggleTheme={toggleTheme} onSignOut={() => { signOut(); setSession(null); }} />
    : <AuthScreen dark={dark} toggleTheme={toggleTheme} onSignIn={setSession} />;
}
