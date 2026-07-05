import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { configureActivityPub, resetActivityPubConfig, getContentDir, getUsersContentDir } from '../src/config.js';
import { getPublicPostCount, getNodeInfo } from '../src/services/NodeInfoService.js';

// TIN-1931: getPublicPostCount must count posts from the real content root
// (<contentDir>/users/<handle>/{blog,notes}), not the legacy src/content tree,
// and must respect published/visibility frontmatter flags.

function writePost(dir: string, name: string, frontmatter: string): void {
  writeFileSync(join(dir, name), `---\n${frontmatter}\n---\n\nbody\n`, 'utf-8');
}

describe('NodeInfo public post count (TIN-1931)', () => {
  let contentRoot: string;

  beforeEach(() => {
    resetActivityPubConfig();
    contentRoot = mkdtempSync(join(tmpdir(), 'tin1931-content-'));
    configureActivityPub({ contentDir: contentRoot });
  });

  afterEach(() => {
    rmSync(contentRoot, { recursive: true, force: true });
    resetActivityPubConfig();
  });

  it('defaults the content root to ./content (not src/content)', () => {
    resetActivityPubConfig();
    expect(getContentDir()).toBe(join(process.cwd(), 'content'));
    expect(getUsersContentDir()).toBe(join(process.cwd(), 'content', 'users'));
  });

  it('returns 0 when the users directory does not exist', () => {
    expect(getPublicPostCount()).toBe(0);
  });

  it('returns 0 when a user has no blog or notes directories', () => {
    mkdirSync(join(contentRoot, 'users', 'someone'), { recursive: true });
    expect(getPublicPostCount()).toBe(0);
  });

  it('counts published public blog posts and notes across all users', () => {
    const jessBlog = join(contentRoot, 'users', 'jess', 'blog');
    const jessNotes = join(contentRoot, 'users', 'jess', 'notes');
    const rivBlog = join(contentRoot, 'users', 'riv', 'blog');
    mkdirSync(jessBlog, { recursive: true });
    mkdirSync(jessNotes, { recursive: true });
    mkdirSync(rivBlog, { recursive: true });

    writePost(jessBlog, 'a.md', 'title: A\npublished: true\nvisibility: public');
    writePost(jessBlog, 'b.md', 'title: B\npublished: true\nvisibility: public');
    writePost(jessNotes, 'n1.md', 'published: true\nvisibility: public');
    writePost(rivBlog, 'c.mdx', 'title: C'); // no flags -> public + published

    expect(getPublicPostCount()).toBe(4);
  });

  it('excludes unpublished, draft, and non-public posts', () => {
    const blog = join(contentRoot, 'users', 'jess', 'blog');
    mkdirSync(blog, { recursive: true });

    writePost(blog, 'published.md', 'published: true\nvisibility: public');
    writePost(blog, 'unpublished.md', 'published: false\nvisibility: public');
    writePost(blog, 'draft.md', 'draft: true\nvisibility: public');
    writePost(blog, 'private.md', 'published: true\nvisibility: private');
    writePost(blog, 'members.md', 'published: true\nvisibility: members');
    writeFileSync(join(blog, 'not-a-post.txt'), 'ignored', 'utf-8');

    expect(getPublicPostCount()).toBe(1);
  });

  it('feeds the filtered count into nodeinfo localPosts', () => {
    const blog = join(contentRoot, 'users', 'jess', 'blog');
    mkdirSync(blog, { recursive: true });
    writePost(blog, 'a.md', 'published: true\nvisibility: public');
    writePost(blog, 'b.md', 'published: false\nvisibility: public');

    expect(getNodeInfo().usage.localPosts).toBe(1);
  });
});
