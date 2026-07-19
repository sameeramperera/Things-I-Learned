import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllTils, getTilBySlug, getBacklinks } from "@/lib/til";
import DeleteNoteButton from "@/components/DeleteNoteButton";

export async function generateStaticParams() {
  return (await getAllTils()).map((t) => ({ slug: t.slug }));
}

export default async function TilPage({ params }: { params: { slug: string } }) {
  const til = await getTilBySlug(params.slug);
  if (!til) notFound();

  const forwardLinks = (await getAllTils()).filter((t) => til.rawWikiLinks.includes(t.slug));
  const backlinks = (await getBacklinks(til.slug)).filter((b) => b.slug !== til.slug);

  return (
    <main className="mx-auto max-w-2xl">
      <Link href="/" className="font-mono text-xs uppercase tracking-widest text-muted hover:text-tag">
        ← back to the board
      </Link>

      <article className="index-card relative mt-6 rounded-sm border border-line px-8 py-8">
        <div
          className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pin shadow"
          aria-hidden
        />
        <p className="font-mono text-[11px] uppercase tracking-widest text-thread">
          {til.date} · {til.readingMinutes} min read
        </p>
        <h1 className="mt-2 font-display text-2xl leading-snug text-ink">{til.title}</h1>
        {til.tags.length > 0 && (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink/50">
            {til.tags.map((tag) => (
              <span key={tag} className="mr-2 rounded-sm bg-tag/30 px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </p>
        )}

        <div className="prose-til mt-6 text-[15px] text-ink">
          <MDXRemote source={til.content} />
        </div>

        <DeleteNoteButton slug={til.slug} title={til.title} />
      </article>

      {(forwardLinks.length > 0 || backlinks.length > 0) && (
        <section className="mt-8 font-mono text-xs text-muted">
          {forwardLinks.length > 0 && (
            <div className="mb-3">
              <p className="uppercase tracking-widest text-tag">Links out</p>
              <ul className="mt-1 space-y-1">
                {forwardLinks.map((l) => (
                  <li key={l.slug}>
                    <Link href={`/til/${l.slug}`} className="text-card hover:text-tag">
                      → {l.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {backlinks.length > 0 && (
            <div>
              <p className="uppercase tracking-widest text-tag">Linked from</p>
              <ul className="mt-1 space-y-1">
                {backlinks.map((l) => (
                  <li key={l.slug}>
                    <Link href={`/til/${l.slug}`} className="text-card hover:text-tag">
                      ← {l.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
