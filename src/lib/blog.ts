import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import gfm from "remark-gfm";
import readingTime from "reading-time";

/**
 * Blog post loader. Reads markdown files from /content/blog at build
 * time and parses frontmatter + body. Posts are sorted newest-first.
 *
 * Server-only. Uses `fs`, so do NOT import from a client component.
 * Use it inside page.tsx (RSC) or API routes only.
 */

export interface PostFrontmatter {
  title: string;
  slug: string;
  description: string;
  date: string;            // ISO 8601, e.g. "2026-05-11"
  keywords?: string[];
  ogImage?: string;        // absolute or root-relative; falls back to /opengraph-image
  author?: string;
  category?: string;       // e.g. "Due Diligence", "Market Guide"
  market?: string;         // for city-specific posts, e.g. "Dallas"
  draft?: boolean;         // if true, hidden from listing + sitemap
}

export interface Post extends PostFrontmatter {
  contentHtml: string;
  readingMinutes: number;
}

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

function listMarkdownFiles(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
}

function parseFile(filename: string): { fm: PostFrontmatter; body: string } {
  const full = path.join(BLOG_DIR, filename);
  const raw = fs.readFileSync(full, "utf8");
  const parsed = matter(raw);
  const fm = parsed.data as PostFrontmatter;
  // Allow slug omission: derive from filename.
  if (!fm.slug) {
    fm.slug = filename.replace(/\.(md|mdx)$/, "");
  }
  return { fm, body: parsed.content };
}

/** All non-draft posts, sorted newest-first. */
export function getAllPosts(): Array<PostFrontmatter & { readingMinutes: number }> {
  return listMarkdownFiles()
    .map((f) => {
      const { fm, body } = parseFile(f);
      return { ...fm, readingMinutes: Math.max(1, Math.round(readingTime(body).minutes)) };
    })
    .filter((p) => !p.draft)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** All post slugs (for static path generation). */
export function getAllSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}

/** A single post by slug, with markdown rendered to HTML. */
export async function getPostBySlug(slug: string): Promise<Post | null> {
  const files = listMarkdownFiles();
  const file =
    files.find((f) => f.replace(/\.(md|mdx)$/, "") === slug) ??
    files.find((f) => {
      const { fm } = parseFile(f);
      return fm.slug === slug;
    });
  if (!file) return null;

  const { fm, body } = parseFile(file);
  if (fm.draft) return null;

  const processed = await remark().use(gfm).use(html).process(body);
  // Open external (http/https) links in a new tab, with rel=noopener
  // to prevent reverse tab-nabbing. Internal (/relative) links are
  // left as same-tab so internal nav doesn't spawn new tabs.
  const contentHtml = processed
    .toString()
    .replace(
      /<a href="(https?:\/\/[^"]+)"([^>]*)>/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer"$2>'
    );
  return {
    ...fm,
    contentHtml,
    readingMinutes: Math.max(1, Math.round(readingTime(body).minutes)),
  };
}
