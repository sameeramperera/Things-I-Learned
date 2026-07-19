import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { TIL_DIR, getAllTils, slugify } from "@/lib/til";

export async function GET() {
  const tils = getAllTils()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((t) => ({ slug: t.slug, title: t.title, date: t.date, tags: t.tags }));
  return NextResponse.json({ tils });
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error:
          "The admin write API is disabled in production. Run the site locally with `npm run dev` to add notes, then commit and push the new .mdx file.",
      },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || body.title.trim() === "") {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }
  if (typeof body.content !== "string" || body.content.trim() === "") {
    return NextResponse.json({ error: "Note content is required." }, { status: 400 });
  }

  const title = body.title.trim();
  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : new Date().toISOString().slice(0, 10);
  const tags: string[] = Array.isArray(body.tags)
    ? body.tags.filter((t: unknown): t is string => typeof t === "string" && t.trim() !== "")
    : typeof body.tags === "string"
      ? body.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
      : [];

  const slug = slugify(typeof body.slug === "string" && body.slug.trim() !== "" ? body.slug : title);
  if (!slug) {
    return NextResponse.json({ error: "Could not derive a valid slug from that title." }, { status: 400 });
  }

  if (!fs.existsSync(TIL_DIR)) fs.mkdirSync(TIL_DIR, { recursive: true });
  const filePath = path.join(TIL_DIR, `${slug}.mdx`);
  if (fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: `A note with slug "${slug}" already exists. Choose a different title or slug.` },
      { status: 409 }
    );
  }

  const frontmatterTags = tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(", ");
  const escapedTitle = title.replace(/"/g, '\\"');
  const file = `---
title: "${escapedTitle}"
date: "${date}"
tags: [${frontmatterTags}]
---

${body.content.trim()}
`;

  fs.writeFileSync(filePath, file, "utf8");

  return NextResponse.json({ slug, title, date, tags }, { status: 201 });
}
