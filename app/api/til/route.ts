import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { TIL_DIR, getAllTils, slugify } from "@/lib/til";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // "owner/repo"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

/**
 * Vercel's filesystem is read-only/ephemeral, so writing straight to disk
 * (the local-dev path below) is a no-op in production. Instead we commit the
 * new .mdx file to the repo via the GitHub Contents API; a push to the
 * tracked branch triggers a normal redeploy that picks it up at build time.
 */
async function commitToGitHub(filename: string, fileContents: string, commitMessage: string) {
  const [owner, repo] = (GITHUB_REPO as string).split("/");
  const apiPath = `content/til/${filename}`;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${apiPath}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  const existingRes = await fetch(`${url}?ref=${GITHUB_BRANCH}`, { headers });
  if (existingRes.status === 200) {
    throw new Error(`DUPLICATE:${filename}`);
  }
  if (existingRes.status !== 404) {
    const err = await existingRes.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error checking for existing file (${existingRes.status})`);
  }

  const putRes = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: commitMessage,
      content: Buffer.from(fileContents, "utf8").toString("base64"),
      branch: GITHUB_BRANCH,
    }),
  });
  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error committing file (${putRes.status})`);
  }
  return putRes.json();
}

export async function GET() {
  const tils = getAllTils()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((t) => ({ slug: t.slug, title: t.title, date: t.date, tags: t.tags }));
  return NextResponse.json({ tils });
}

export async function POST(req: NextRequest) {
  const useGitHub = Boolean(GITHUB_TOKEN && GITHUB_REPO);

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
      await commitToGitHub(`${slug}.mdx`, file, `Add TIL note: ${title}`);
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

  return NextResponse.json({ slug, title, date, tags }, { status: 201 });
}
