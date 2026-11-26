"use client";

import { AuthScreen } from "@/components/auth/auth-screen";
import { BrandLogo } from "@/components/brand-logo";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ClientStateProvider, useClientState } from "@/lib/client-state";

export default function Home() {
  return <ClientStateProvider><HomeContent /></ClientStateProvider>;
}

function HomeContent() {
  const { session, setSession, ready, dark, toggleTheme, endSession } = useClientState();
  if (!ready) return <div className="loading-screen" role="status"><span className="finance-brand"><BrandLogo /></span><span className="loading-line"><span className="button-spinner" aria-hidden="true" />Opening your workspace...</span></div>;
  return session
    ? <Dashboard session={session} dark={dark} toggleTheme={toggleTheme} onSignOut={endSession} />
    : <AuthScreen dark={dark} toggleTheme={toggleTheme} onSignIn={setSession} />;
}
