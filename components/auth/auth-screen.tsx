"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, Eye, EyeOff, Fingerprint, LockKeyhole, Moon, Sparkles, Sun } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { createUser, signIn } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { Session } from "@/lib/types";

const schema = z.object({
  username: z.string().trim().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean(),
});
type Fields = z.infer<typeof schema>;

export function AuthScreen({ dark, toggleTheme, onSignIn }: { dark: boolean; toggleTheme: () => void; onSignIn: (session: Session) => void }) {
  const [tab, setTab] = useState<"signin" | "create" | "forgot">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Fields>({ resolver: zodResolver(schema), defaultValues: { username: "", password: "", remember: true } });

  async function enter(username: string, password: string, remember: boolean, create = false) {
    setError(""); setMessage(""); setBusy(true);
    try {
      if (create) {
        if (username.trim().length < 3) throw new Error("Username must be at least 3 characters.");
        if (password.length < 4) throw new Error("Password must be at least 4 characters.");
        await createUser(username, password);
      }
      const session = await signIn(username, password, remember);
      await storage.saveActivity({ id: crypto.randomUUID(), userId: session.userId, action: "Signed in", detail: "Welcome back to your workspace", createdAt: new Date().toISOString() });
      onSignIn(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Check browser storage and try again.");
    } finally { setBusy(false); }
  }

  function switchTab(next: typeof tab) { setTab(next); setError(""); setMessage(""); }

  return <main className="auth-page">
    <div className="auth-top"><Link className="finance-brand" href="/"><BrandLogo /></Link><button className="icon-button" onClick={toggleTheme} aria-label={`Switch to ${dark ? "light" : "dark"} mode`}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></div>
    <div className="auth-layout">
      <section className="auth-story">
        <div className="story-glow" />
        <div className="story-content">
          <div className="eyebrow light"><Sparkles size={14} /> A LITTLE MORE CLARITY</div>
          <h1>Your money.<br /><span>In a better light.</span></h1>
          <p>Make room for what matters. See your accounts together and feel good about where you stand.</p>
          <div className="preview-card">
            <div className="preview-head"><span>YOUR OVERVIEW</span><span className="preview-dot">● &nbsp; ALL ACCOUNTS</span></div>
            <div className="preview-label">Net position</div><div className="preview-amount">$21,474<span>.95</span></div>
            <div className="preview-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            <div className="preview-bottom"><div><ArrowDownLeft size={16} /><span>Cash<br /><strong>$24,690.65</strong></span></div><div><ArrowUpRight size={16} /><span>Credit<br /><strong>$3,215.70</strong></span></div></div>
          </div>
          <div className="story-features"><span><Check size={15} /> Everything in one view</span><span><Check size={15} /> Thoughtfully simple</span></div>
        </div>
        <div className="story-footer">A clearer picture starts here. <span>✳</span></div>
      </section>
      <section className="auth-form-wrap">
        <motion.div className="auth-form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
          <div className="form-kicker">WELCOME TO MONEYSTREAM</div>
          <h2>{tab === "create" ? "Get started." : tab === "forgot" ? "Forgot password?" : "Welcome back."}</h2>
          <p className="muted">{tab === "create" ? "Create your own local space for a clearer view." : tab === "forgot" ? "This is a prototype, so there’s no email or recovery service." : "A little clarity goes a long way. Let’s get started."}</p>
          {tab !== "forgot" && <>
            <div className="tabs auth-tabs" role="tablist" aria-label="Account access">
              <button type="button" role="tab" aria-selected={tab === "signin"} className={tab === "signin" ? "active" : ""} onClick={() => switchTab("signin")}>Sign in</button>
              <button type="button" role="tab" aria-selected={tab === "create"} className={tab === "create" ? "active" : ""} onClick={() => switchTab("create")}>Create account</button>
            </div>
            <form onSubmit={handleSubmit((data) => enter(data.username, data.password, data.remember, tab === "create"))} noValidate>
              <label className="field-label" htmlFor="username">Username</label>
              <input id="username" className="input" placeholder="Enter your username" autoComplete="username" {...register("username")} />
              {errors.username && <p className="field-error">{errors.username.message}</p>}
              <div className="label-row"><label className="field-label" htmlFor="password">Password</label>{tab === "signin" && <button className="text-button" type="button" onClick={() => switchTab("forgot")}>Forgot password?</button>}</div>
              <div className="password-wrap"><input id="password" className="input" type={showPassword ? "text" : "password"} placeholder="Enter your password" autoComplete={tab === "create" ? "new-password" : "current-password"} {...register("password")} /><button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
              {errors.password && <p className="field-error">{errors.password.message}</p>}
              <label className="check-row"><input type="checkbox" {...register("remember")} /> Keep me signed in <span>(remember me)</span></label>
              {error && <div role="alert" className="alert">{error}</div>}
              <button className="button primary wide" disabled={busy}>{busy ? "One moment..." : tab === "create" ? "Create account" : "Sign in"} <ArrowRight size={17} /></button>
            </form>
            <div className="divider"><span>or explore first</span></div>
            <button type="button" className="button secondary wide" disabled={busy} onClick={() => enter("demo", "demo", true)}>Continue with demo account <ArrowRight size={17} /></button>
            <div className="coming-soon"><button disabled><Fingerprint size={16} /> Passkey <span>coming soon</span></button><button disabled>Social sign-in <span>coming soon</span></button></div>
          </>}
          {tab === "forgot" && <div className="forgot-box"><div className="notice"><LockKeyhole size={18} /><div><strong>Prototype / local-only</strong><p>Passwords stay in this browser and cannot be recovered by email. You can create a new local account or use the demo account (demo / demo).</p></div></div><button className="button secondary wide" onClick={() => { setMessage("No recovery email was sent. This is a local-only prototype."); }}>Simulate recovery request</button>{message && <p role="status" className="success-message">{message}</p>}<button className="text-button back-link" onClick={() => switchTab("signin")}>← Back to sign in</button></div>}
          <div className="auth-disclaimer"><LockKeyhole size={15} /><span>Local browser prototype. No bank connections or production security.</span></div>
        </motion.div>
        <div className="auth-footnote">Made for a more mindful relationship with money.</div>
      </section>
    </div>
  </main>;
}
