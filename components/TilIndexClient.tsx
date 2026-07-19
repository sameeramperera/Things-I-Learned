"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type TilListItem = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  content: string;
};

function stripMdx(raw: string) {
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~-]/g, " ")
    .toLowerCase();
}

export default function TilIndexClient({ tils }: { tils: TilListItem[] }) {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const searchable = useMemo(
    () => tils.map((t) => ({ ...t, haystack: stripMdx(t.content), titleLower: t.title.toLowerCase() })),
    [tils]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return searchable.filter((t) => {
      const matchesQuery = q === "" || t.titleLower.includes(q) || t.haystack.includes(q);
      const matchesFrom = from === "" || t.date >= from;
      const matchesTo = to === "" || t.date <= to;
      return matchesQuery && matchesFrom && matchesTo;
    });
  }, [searchable, query, from, to]);

  const hasFilters = query !== "" || from !== "" || to !== "";

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        <label className="flex-1">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted">
            Search titles & content
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. rebase, subgrid, explain analyze…"
            className="w-full rounded-sm border border-cork-light bg-cork-dark px-3 py-2 font-body text-sm text-card placeholder:text-muted/60 focus:border-tag focus:outline-none"
          />
        </label>
        <label>
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted">
            From
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-sm border border-cork-light bg-cork-dark px-3 py-2 font-mono text-xs text-card focus:border-tag focus:outline-none"
          />
        </label>
        <label>
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted">
            To
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-sm border border-cork-light bg-cork-dark px-3 py-2 font-mono text-xs text-card focus:border-tag focus:outline-none"
          />
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFrom("");
              setTo("");
            }}
            className="h-fit rounded-sm border border-cork-light px-3 py-2 font-mono text-xs text-muted hover:text-tag"
          >
            Clear
          </button>
        )}
      </div>

      <p className="mt-4 font-mono text-[11px] text-muted">
        {filtered.length} of {tils.length} notes
      </p>

      {filtered.length === 0 ? (
        <p className="mt-6 font-mono text-sm text-muted">Nothing matches that search.</p>
      ) : (
        <ul className="mt-2 divide-y divide-cork-light">
          {filtered.map((t) => (
            <li key={t.slug} className="py-3">
              <Link href={`/til/${t.slug}`} className="group flex items-baseline justify-between gap-4">
                <span className="font-body text-card group-hover:text-tag">{t.title}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted">{t.date}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
