const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // "owner/repo"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

export const useGitHub = Boolean(GITHUB_TOKEN && GITHUB_REPO);

type GitHubDirEntry = { name: string; type: "file" | "dir" };

function apiUrl(apiPath: string) {
  const [owner, repo] = (GITHUB_REPO as string).split("/");
  return `https://api.github.com/repos/${owner}/${repo}/contents/${apiPath}`;
}

function headers() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

/** Lists .mdx files in content/til/. Cached indefinitely under the "tils" tag. */
export async function listTilDir(): Promise<GitHubDirEntry[]> {
  const res = await fetch(`${apiUrl("content/til")}?ref=${GITHUB_BRANCH}`, {
    headers: headers(),
    next: { tags: ["tils"] },
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error listing content/til (${res.status})`);
  }
  const entries: GitHubDirEntry[] = await res.json();
  return entries.filter((e) => e.type === "file" && e.name.endsWith(".mdx"));
}

/** Fetches one file's content, base64-decoded. Cached indefinitely under the "tils" tag. */
export async function getTilFile(filename: string): Promise<string | null> {
  const res = await fetch(`${apiUrl(`content/til/${filename}`)}?ref=${GITHUB_BRANCH}`, {
    headers: headers(),
    next: { tags: ["tils"] },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error fetching ${filename} (${res.status})`);
  }
  const data = await res.json();
  return Buffer.from(data.content, "base64").toString("utf8");
}

/**
 * Commits a new file to content/til/. Throws `DUPLICATE:<filename>` if it
 * already exists. Always hits the live API (no caching — writes must not be stale).
 */
export async function putTilFile(filename: string, fileContents: string, commitMessage: string) {
  const url = apiUrl(`content/til/${filename}`);

  const existingRes = await fetch(`${url}?ref=${GITHUB_BRANCH}`, { headers: headers() });
  if (existingRes.status === 200) {
    throw new Error(`DUPLICATE:${filename}`);
  }
  if (existingRes.status !== 404) {
    const err = await existingRes.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error checking for existing file (${existingRes.status})`);
  }

  const putRes = await fetch(url, {
    method: "PUT",
    headers: headers(),
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

/**
 * Deletes a file from content/til/. Throws `NOT_FOUND:<filename>` if it
 * doesn't exist. Always hits the live API (no caching).
 */
export async function deleteTilFile(filename: string, commitMessage: string) {
  const url = apiUrl(`content/til/${filename}`);

  const existingRes = await fetch(`${url}?ref=${GITHUB_BRANCH}`, { headers: headers() });
  if (existingRes.status === 404) {
    throw new Error(`NOT_FOUND:${filename}`);
  }
  if (existingRes.status !== 200) {
    const err = await existingRes.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error checking for existing file (${existingRes.status})`);
  }
  const existing = await existingRes.json();

  const delRes = await fetch(url, {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({
      message: commitMessage,
      sha: existing.sha,
      branch: GITHUB_BRANCH,
    }),
  });
  if (!delRes.ok) {
    const err = await delRes.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error deleting file (${delRes.status})`);
  }
  return delRes.json();
}
