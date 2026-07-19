"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ExistingTil = { slug: string; title: string; date: string; tags: string[] };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function slugPreview(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slugOverride, setSlugOverride] = useState("");
  const [date, setDate] = useState(todayISO());
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [existing, setExisting] = useState<ExistingTil[]>([]);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "ok" | "error"; message?: string }>({
    kind: "idle",
  });

  async function loadExisting() {
    try {
      const res = await fetch("/api/til");
      if (!res.ok) return;
      const data = await res.json();
      setExisting(data.tils ?? []);
    } catch {
      // best-effort; the admin page still works without this list
    }
  }

  useEffect(() => {
    loadExisting();
  }, []);

  const slug = slugOverride.trim() !== "" ? slugPreview(slugOverride) : slugPreview(title);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/til", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug: slugOverride, date, tags, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? "Something went wrong." });
        return;
      }
      setStatus({ kind: "ok", message: `Saved content/til/${data.slug}.mdx` });
      setTitle("");
      setSlugOverride("");
      setDate(todayISO());
      setTags("");
      setContent("");
      loadExisting();
    } catch {
      setStatus({ kind: "error", message: "Could not reach the server. Is `npm run dev` running?" });
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-2xl">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl text-card">Pin a new note</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="font-mono text-xs uppercase tracking-widest text-muted hover:text-tag"
        >
          Log out
        </button>
      </div>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Writes a new <code className="font-mono text-tag">.mdx</code> file into{" "}
        <code className="font-mono text-tag">content/til/</code>. Locally this writes straight to
        disk. On the deployed site it commits the file directly to GitHub via the Contents API,
        which triggers a redeploy so the note goes live shortly after.
      </p>

      <form onSubmit={handleSubmit} className="index-card mt-6 space-y-4 rounded-sm border border-line px-6 py-6">
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/60">
            Title
          </label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A short, specific title"
            className="w-full rounded-sm border border-line bg-white/40 px-3 py-2 font-body text-sm text-ink focus:border-thread focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/60">
              Slug (optional — auto from title)
            </label>
            <input
              value={slugOverride}
              onChange={(e) => setSlugOverride(e.target.value)}
              placeholder={slugPreview(title) || "auto-generated"}
              className="w-full rounded-sm border border-line bg-white/40 px-3 py-2 font-mono text-xs text-ink focus:border-thread focus:outline-none"
            />
            {slug && <p className="mt-1 font-mono text-[10px] text-ink/50">/til/{slug}</p>}
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/60">
              Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-sm border border-line bg-white/40 px-3 py-2 font-mono text-xs text-ink focus:border-thread focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/60">
            Tags (comma-separated)
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="git, cli"
            className="w-full rounded-sm border border-line bg-white/40 px-3 py-2 font-mono text-xs text-ink focus:border-thread focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/60">
            Content (MDX — use <code>[[slug]]</code> to link another note)
          </label>
          <textarea
            required
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`What you learned, in Markdown.\n\nLink another note with [[git-reflog]].`}
            className="w-full rounded-sm border border-line bg-white/40 px-3 py-2 font-mono text-xs leading-relaxed text-ink focus:border-thread focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status.kind === "saving"}
            className="rounded-sm bg-thread px-4 py-2 font-mono text-xs uppercase tracking-widest text-card hover:bg-thread-dim disabled:opacity-50"
          >
            {status.kind === "saving" ? "Saving…" : "Pin note"}
          </button>
          {status.kind === "ok" && (
            <p className="font-mono text-xs text-green-800">{status.message}</p>
          )}
          {status.kind === "error" && (
            <p className="font-mono text-xs text-thread">{status.message}</p>
          )}
        </div>
      </form>

      {existing.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg text-card">Existing notes</h2>
          <p className="mt-1 font-mono text-[11px] text-muted">
            Slugs you can reference with <code className="text-tag">[[slug]]</code> above.
          </p>
          <ul className="mt-3 divide-y divide-cork-light font-mono text-xs">
            {existing.map((t) => (
              <li key={t.slug} className="flex items-baseline justify-between gap-4 py-2">
                <Link href={`/til/${t.slug}`} className="text-card hover:text-tag">
                  {t.title}
                </Link>
                <span className="shrink-0 text-muted">[[{t.slug}]]</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
