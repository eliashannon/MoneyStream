"use client";

import { AuthScreen } from "@/components/auth/auth-screen";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ClientStateProvider, useClientState } from "@/lib/client-state";

export default function Home() {
  return <ClientStateProvider><HomeContent /></ClientStateProvider>;
}

function HomeContent() {
  const { session, setSession, ready, dark, toggleTheme, endSession } = useClientState();
  if (!ready) return <div className="loading-screen"><span className="brand-mark">m</span><span>Opening your workspace...</span></div>;
  return session
    ? <Dashboard session={session} dark={dark} toggleTheme={toggleTheme} onSignOut={endSession} />
    : <AuthScreen dark={dark} toggleTheme={toggleTheme} onSignIn={setSession} />;
}
