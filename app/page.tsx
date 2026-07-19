import Link from "next/link";
import { buildGraph, getAllTils } from "@/lib/til";
import KnowledgeGraph from "@/components/KnowledgeGraph";

export default async function HomePage() {
  const graph = await buildGraph();
  const tils = (await getAllTils()).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <main>
      <section className="mb-4">
        <p className="font-mono text-xs uppercase tracking-widest text-tag">
          {tils.length} notes · {graph.edges.length} threads
        </p>
        <h1 className="mt-2 font-display text-3xl text-card sm:text-4xl">
          Things I Don't Want to Forget
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          This is my personal collection of concise, bite-sized write-ups on things I learn as I explore different tools, technologies, languages, workflows, and interesting developer concepts. These are not full-length blog posts, but clear and focused explanations meant to help me (and hopefully you) revisit and understand concepts faster. 
        </p>
      </section>

      <section className="relative h-[560px] w-full overflow-hidden rounded-sm border border-cork-light bg-[#1a1917]">
        {graph.nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-sm text-muted">
            No notes yet.
          </div>
        ) : (
          <KnowledgeGraph graph={graph} />
        )}
      </section>

      <section className="mt-14">
        <h2 className="mb-4 font-display text-lg text-card">Recent notes</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tils.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/til/${t.slug}`}
                className="index-card block h-full rounded-sm border border-line px-4 py-3 transition-transform hover:-translate-y-0.5"
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-thread">
                  {t.date} · {t.readingMinutes} min
                </p>
                <p className="mt-1 font-display text-sm leading-snug">{t.title}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink/50">
                  {t.tags.join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
