import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import fs from "fs";
import path from "path";
import { TIL_DIR, getAllTils, slugify } from "@/lib/til";
import { useGitHub, putTilFile, deleteTilFile } from "@/lib/github";

function revalidateTils() {
  revalidateTag("tils");
  revalidatePath("/");
  revalidatePath("/til");
}

export async function GET() {
  const tils = (await getAllTils())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((t) => ({ slug: t.slug, title: t.title, date: t.date, tags: t.tags }));
  return NextResponse.json({ tils });
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !useGitHub) {
    return NextResponse.json(
      {
        error:
          "The admin write API is disabled in production because GITHUB_TOKEN / GITHUB_REPO are not configured. Set them in the deployment's environment variables so new notes are committed to GitHub directly.",
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

  const frontmatterTags = tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(", ");
  const escapedTitle = title.replace(/"/g, '\\"');
  const file = `---
title: "${escapedTitle}"
date: "${date}"
tags: [${frontmatterTags}]
---

${body.content.trim()}
`;

  if (useGitHub) {
    try {
      await putTilFile(`${slug}.mdx`, file, `Add TIL note: ${title}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown GitHub API error.";
      if (message.startsWith("DUPLICATE:")) {
        return NextResponse.json(
          { error: `A note with slug "${slug}" already exists. Choose a different title or slug.` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: `Failed to commit to GitHub: ${message}` }, { status: 502 });
    }
    revalidateTils();
    return NextResponse.json({ slug, title, date, tags }, { status: 201 });
  }

  if (!fs.existsSync(TIL_DIR)) fs.mkdirSync(TIL_DIR, { recursive: true });
  const filePath = path.join(TIL_DIR, `${slug}.mdx`);
  if (fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: `A note with slug "${slug}" already exists. Choose a different title or slug.` },
      { status: 409 }
    );
  }

  fs.writeFileSync(filePath, file, "utf8");
  revalidateTils();

  return NextResponse.json({ slug, title, date, tags }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !useGitHub) {
    return NextResponse.json(
      {
        error:
          "The admin delete API is disabled in production because GITHUB_TOKEN / GITHUB_REPO are not configured.",
      },
      { status: 403 }
    );
  }

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug || slugify(slug) !== slug) {
    return NextResponse.json({ error: "A valid slug is required." }, { status: 400 });
  }

  if (useGitHub) {
    try {
      await deleteTilFile(`${slug}.mdx`, `Delete TIL note: ${slug}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown GitHub API error.";
      if (message.startsWith("NOT_FOUND:")) {
        return NextResponse.json({ error: `No note with slug "${slug}" was found.` }, { status: 404 });
      }
      return NextResponse.json({ error: `Failed to delete from GitHub: ${message}` }, { status: 502 });
    }
    revalidateTils();
    revalidatePath(`/til/${slug}`);
    return NextResponse.json({ slug }, { status: 200 });
  }

  const filePath = path.join(TIL_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: `No note with slug "${slug}" was found.` }, { status: 404 });
  }
  fs.unlinkSync(filePath);
  revalidateTils();
  revalidatePath(`/til/${slug}`);

  return NextResponse.json({ slug }, { status: 200 });
}
