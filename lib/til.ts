import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";

export const TIL_DIR = path.join(process.cwd(), "content", "til");

export type TilFrontmatter = {
  title: string;
  date: string;
  tags?: string[];
};

export type Til = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  content: string; // raw mdx body (wiki-links already rewritten to markdown links)
  rawWikiLinks: string[]; // slugs this note links out to
  readingMinutes: number;
};

export type GraphNode = {
  id: string; // slug
  title: string;
  tags: string[];
  date: string;
  degree: number;
};

export type GraphEdge = {
  source: string;
  target: string;
};

export type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const WIKI_LINK_RE = /\[\[([a-zA-Z0-9\-_/]+)(?:\|([^\]]+))?\]\]/g;

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Reads every .mdx file in content/til, extracts frontmatter + body,
 * and rewrites [[wiki-link]] / [[wiki-link|Custom Label]] syntax into
 * real markdown links pointing at /til/<slug>, while recording the
 * raw link targets so we can build the graph.
 */
export function getAllTils(): Til[] {
  if (!fs.existsSync(TIL_DIR)) return [];

  const files = fs.readdirSync(TIL_DIR).filter((f) => f.endsWith(".mdx"));

  return files.map((filename) => {
    const slug = filename.replace(/\.mdx$/, "");
    const raw = fs.readFileSync(path.join(TIL_DIR, filename), "utf8");
    const { data, content } = matter(raw);
    const fm = data as TilFrontmatter;

    const rawWikiLinks: string[] = [];
    const rewritten = content.replace(WIKI_LINK_RE, (_match, target, label) => {
      const targetSlug = slugify(target);
      rawWikiLinks.push(targetSlug);
      const text = label ?? target.replace(/-/g, " ");
      return `[${text}](/til/${targetSlug})`;
    });

    return {
      slug,
      title: fm.title ?? slug,
      date: fm.date ?? "",
      tags: fm.tags ?? [],
      content: rewritten,
      rawWikiLinks: Array.from(new Set(rawWikiLinks)),
      readingMinutes: Math.max(1, Math.round(readingTime(content).minutes)),
    };
  });
}

export function getTilBySlug(slug: string): Til | undefined {
  return getAllTils().find((t) => t.slug === slug);
}

/**
 * Builds the knowledge graph: one node per TIL, one edge per wiki-link
 * (deduplicated, undirected for display purposes). Only links that
 * resolve to a real TIL are included as edges.
 */
export function buildGraph(): Graph {
  const tils = getAllTils();
  const validSlugs = new Set(tils.map((t) => t.slug));

  const edgeKey = (a: string, b: string) => [a, b].sort().join("::");
  const edgeMap = new Map<string, GraphEdge>();
  const degree = new Map<string, number>();
  tils.forEach((t) => degree.set(t.slug, 0));

  for (const til of tils) {
    for (const target of til.rawWikiLinks) {
      if (!validSlugs.has(target) || target === til.slug) continue;
      const key = edgeKey(til.slug, target);
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { source: til.slug, target });
        degree.set(til.slug, (degree.get(til.slug) ?? 0) + 1);
        degree.set(target, (degree.get(target) ?? 0) + 1);
      }
    }
  }

  const nodes: GraphNode[] = tils.map((t) => ({
    id: t.slug,
    title: t.title,
    tags: t.tags,
    date: t.date,
    degree: degree.get(t.slug) ?? 0,
  }));

  return { nodes, edges: Array.from(edgeMap.values()) };
}

/** Notes that link TO this slug (for a "linked from" section on the TIL page). */
export function getBacklinks(slug: string): Til[] {
  const tils = getAllTils();
  return tils.filter((t) => t.rawWikiLinks.includes(slug));
}
