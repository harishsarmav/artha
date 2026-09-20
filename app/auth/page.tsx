"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  function switchMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setMessage("");
    try {
      if (mode === "signup") {
        if (!fullName.trim()) return setError("Please enter your full name.");
        if (password.length < 8) return setError("Use at least 8 characters for your password.");
        if (password !== confirmPassword) return setError("Passwords do not match.");
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
        const emailRedirectTo = `${window.location.origin}${basePath}/auth`;
        const { error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo },
        });
        if (error) return setError(error.message);
        setMessage("Account created. Check your email to confirm your address, then sign in.");
        setPassword(""); setConfirmPassword("");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return setError(error.message);
      router.replace("/"); router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <main className="authPage">
      <div className="authGlow authGlowA" /><div className="authGlow authGlowB" />
      <section className="authShell">
        <div className="authBrand"><div className="authBrandMark">✦</div><div><div className="authBrandName">Artha</div><div className="authBrandTag">Your AI Financial Coach</div></div></div>
        <div className="authCard">
          <div className="authHeader"><div className="authEyebrow">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</div><h1>{mode === "login" ? "Welcome back 👋" : "Take control of your money."}</h1><p>{mode === "login" ? "Sign in to continue your private financial workspace." : "Create your secure personal financial workspace."}</p></div>
          <form onSubmit={handleSubmit} className="authForm">
            {mode === "signup" && <div className="authField"><label htmlFor="fullName">Full name</label><input id="fullName" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your name" autoComplete="name" required disabled={loading}/></div>}
            <div className="authField"><label htmlFor="email">Email</label><input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={loading}/></div>
            <div className="authField"><label htmlFor="password">Password</label><div className="passwordField"><input id="password" type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required disabled={loading}/><button type="button" className="passwordToggle" onClick={()=>setShowPassword(v=>!v)}>{showPassword ? "Hide" : "Show"}</button></div></div>
            {mode === "signup" && <div className="authField"><label htmlFor="confirmPassword">Confirm password</label><div className="passwordField"><input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter your password" autoComplete="new-password" minLength={8} required disabled={loading}/><button type="button" className="passwordToggle" onClick={()=>setShowConfirmPassword(v=>!v)}>{showConfirmPassword ? "Hide" : "Show"}</button></div></div>}
            {error && <div className="authMessage authError" role="alert"><span>!</span>{error}</div>}
            {message && <div className="authMessage authSuccess" role="status"><span>✓</span>{message}</div>}
            <button type="submit" className="primary authSubmit" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in to Artha →" : "Create my Artha account →"}</button>
          </form>
          <div className="authFooter">{mode === "login" ? <>New to Artha? <button onClick={()=>switchMode("signup")} disabled={loading}>Create an account</button></> : <>Already have an account? <button onClick={()=>switchMode("login")} disabled={loading}>Sign in</button></>}</div>
        </div>
        <div className="authTrust">🔐 Your financial data is stored in your Supabase account and protected by row-level access policies.</div>
        <div className="authCopyright">Artha · Your AI Financial Coach · © 2026</div>
      </section>
    </main>
  );
}
