import { getAllTils } from "@/lib/til";
import TilIndexClient from "@/components/TilIndexClient";

export default async function TilIndexPage() {
  const tils = (await getAllTils())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((t) => ({ slug: t.slug, title: t.title, date: t.date, tags: t.tags, content: t.content }));

  return (
    <main>
      <h1 className="font-display text-2xl text-card">Every note, in order</h1>
      <div className="mt-6">
        <TilIndexClient tils={tils} />
      </div>
    </main>
  );
}
