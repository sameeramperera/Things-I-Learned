"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Incorrect password.");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm">
      <h1 className="font-display text-2xl text-card">Admin login</h1>
      <p className="mt-2 text-sm text-muted">Enter the admin password to add new notes.</p>

      <form
        onSubmit={handleSubmit}
        className="index-card mt-6 space-y-4 rounded-sm border border-line px-6 py-6"
      >
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/60">
            Password
          </label>
          <input
            type="password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-sm border border-line bg-white/40 px-3 py-2 font-mono text-sm text-ink focus:border-thread focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm bg-thread px-4 py-2 font-mono text-xs uppercase tracking-widest text-card hover:bg-thread-dim disabled:opacity-50"
        >
          {loading ? "Checking…" : "Log in"}
        </button>
        {error && <p className="font-mono text-xs text-thread">{error}</p>}
      </form>
    </main>
  );
}
