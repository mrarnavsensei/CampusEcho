"use client";
import { useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { api, jsonBody } from "@/lib/client-api";
import { useResource } from "@/hooks/use-resource";
import { Brand, Failure } from "./shared";
import { PolicyLinks } from "./policy-links";

export function AuthPanel({ onSignedIn, initialError }: { onSignedIn: () => void; initialError?: unknown }) {
  const config = useResource<{ emailAvailable: boolean; localSignIn: boolean; minimumAge: number; policyApproved: boolean }>("/api/auth/config");
  const [mode, setMode] = useState("login"), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false), [age, setAge] = useState(false), [visible, setVisible] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(initialError), [message, setMessage] = useState(""), [token, setToken] = useState("");
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const purpose = fragment.has("verify") ? "verify" : fragment.has("reset") ? "reset" : null;
    if (purpose) { queueMicrotask(() => { setMode(purpose); setToken(fragment.get(purpose)!); }); window.history.replaceState(null, "", window.location.pathname); }
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(undefined); setMessage("");
    try {
      const body = mode === "register" ? { email, password, displayName: name, termsAccepted: accepted, ageConfirmed: age } : mode === "reset" ? { token, password } : mode === "verify" ? { token } : mode === "login" ? { email, password } : { email };
      const result = await api<{ message?: string }>(`/api/auth/${mode}`, { method: "POST", body: jsonBody(body) });
      if (mode === "login") onSignedIn(); else { setMessage(result.message ?? "Request completed."); setPassword(""); }
    } catch (failure) { setError(failure); } finally { setBusy(false); }
  }
  const changeMode = (next: string) => { setMode(next); setError(undefined); setMessage(""); setPassword(""); };
  return <main className="echo-auth"><section className="echo-auth-intro"><Brand /><span className="eyebrow">Your campus. Your voice.</span><h1>A little more<br />connected.</h1><p>Honest conversations, private messages, and friendly competition — inside your college.</p><div className="identity-note"><LockKeyhole /><span><strong>Anonymous when you choose.</strong><small>Community rules and safety reporting always apply.</small></span></div></section>
    <section className="echo-auth-card"><h2>{({ login: "Welcome to Echo", register: "Find your campus", forgot: "Reset your password", resend: "Verify your college email", verify: "Confirm your email", reset: "Choose a new password" } as Record<string, string>)[mode]}</h2><p className="muted">{mode === "register" ? "Use your approved college email address." : "Your campus community is one step away."}</p>
      <form className="echo-form" onSubmit={submit}>
        {!["verify", "reset"].includes(mode) && <label>College email<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} maxLength={254} /></label>}
        {mode === "register" && <label>Display name<input autoComplete="nickname" required minLength={2} maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label>}
        {["login", "register", "reset"].includes(mode) && <label>Password<span className="password-input"><input autoComplete={mode === "login" ? "current-password" : "new-password"} type={visible ? "text" : "password"} minLength={mode === "login" ? 1 : 12} maxLength={256} required value={password} onChange={e => setPassword(e.target.value)} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff /> : <Eye />}</button></span>{mode !== "login" && <small>At least 12 characters.</small>}</label>}
        {mode === "register" && <><label className="check-label"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} />I agree to the <a href="/community" target="_blank" rel="noreferrer">community and privacy information</a>.</label><label className="check-label"><input type="checkbox" required checked={age} onChange={e => setAge(e.target.checked)} />I am {config.data?.minimumAge ?? 18} or older.</label><p className="muted">Email verification confirms mailbox access. Your college may also require an enrollment review.</p></>}
        {Boolean(error) && <Failure error={error} />}{message && <p role="status" className="echo-success">{message}</p>}
        <button className="primary" disabled={busy}>{busy ? "Please wait…" : ({ login: "Sign in", register: "Create account", forgot: "Send reset link", resend: "Send verification email", verify: "Verify email", reset: "Save new password" } as Record<string, string>)[mode]}</button>
      </form>
      <div className="echo-auth-links">{mode !== "login" ? <button onClick={() => changeMode("login")}>Back to sign in</button> : <><button onClick={() => changeMode("register")}>Create an account</button><button onClick={() => changeMode("forgot")}>Forgot password?</button><button onClick={() => changeMode("resend")}>Resend verification</button></>}</div>
      {config.data && !config.data.emailAvailable && <p className="integration-note"><Mail /> Verification and recovery email will be available once the platform email service is configured.</p>}
      {config.data?.localSignIn && <a className="secondary dev-signin" href="/signin-with-chatgpt?return_to=/">Open local development account</a>}
      <PolicyLinks label="Authentication legal and privacy links" /><a className="admin-entry" href="/admin/login">Administrator sign in</a>
    </section>
  </main>;
}
