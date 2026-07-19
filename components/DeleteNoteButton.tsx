"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteNoteButton({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [status, setStatus] = useState<{ kind: "idle" | "deleting" | "error"; message?: string }>({
    kind: "idle",
  });

  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => res.json())
      .then((data) => setAuthenticated(Boolean(data.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);

  if (!authenticated) return null;

  async function handleDelete() {
    if (!window.confirm(`Delete "${title}"? This removes it from GitHub and can't be undone.`)) return;
    setStatus({ kind: "deleting" });
    try {
      const res = await fetch(`/api/til?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? "Something went wrong." });
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Could not reach the server." });
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleDelete}
        disabled={status.kind === "deleting"}
        className="font-mono text-[11px] uppercase tracking-widest text-thread hover:text-thread-dim disabled:opacity-50"
      >
        {status.kind === "deleting" ? "Deleting…" : "Delete note"}
      </button>
      {status.kind === "error" && (
        <p className="mt-1 font-mono text-[11px] text-thread">{status.message}</p>
      )}
    </div>
  );
}
