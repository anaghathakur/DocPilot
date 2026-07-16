import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGitHubClient } from '../src/github-client.js';
import type { GitHubAnalysisLimits } from '../src/github-config.js';
import { githubApiVersion, githubUserAgent } from '../src/github-config.js';
import type { GitHubRepositoryReference } from '../src/github-url.js';

const directories: string[] = [];
const reference: GitHubRepositoryReference = {
  owner: 'owner name',
  name: 'repo#name',
  url: 'https://github.com/owner%20name/repo%23name',
};
const metadata = {
  owner: reference.owner,
  name: reference.name,
  url: reference.url,
  defaultBranch: 'feature/name',
};
const limits: GitHubAnalysisLimits = {
  metadataTimeoutMs: 100,
  archiveTimeoutMs: 100,
  maximumArchiveBytes: 100,
  maximumFileBytes: 100,
  maximumCombinedSourceBytes: 100,
  maximumSupportedFiles: 100,
  maximumArchiveEntries: 100,
};

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('GitHub client', () => {
  it('uses fixed API headers, encoded URL segments, a safe redirect, and streams the archive', async () => {
    const calls: Array<{ input: string; init: RequestInit | undefined }> = [];
    const fetcher = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ input: String(input), init });

        if (calls.length === 1) {
          return Response.json({
            private: false,
            default_branch: 'feature/name',
          });
        }

        if (calls.length === 2) {
          return new Response(null, {
            status: 302,
            headers: {
              location:
                'https://codeload.github.com/owner/repo/legacy.zip/refs/heads/feature/name',
            },
          });
        }

        return new Response('zip-bytes', {
          status: 200,
          headers: { 'content-length': '9' },
        });
      },
    ) as unknown as typeof fetch;
    const client = createGitHubClient({ fetcher, limits });
    const actualMetadata = await client.getRepositoryMetadata(reference);
    const archivePath = await createArchivePath();

    await client.downloadRepositoryArchive(
      reference,
      actualMetadata.defaultBranch,
      archivePath,
    );

    expect(calls[0]?.input).toBe(
      'https://api.github.com/repos/owner%20name/repo%23name',
    );
    expect(calls[1]?.input).toContain('/zipball/feature%2Fname');
    expect(calls[0]?.init).toMatchObject({
      redirect: 'manual',
      credentials: 'omit',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': githubUserAgent,
        'X-GitHub-Api-Version': githubApiVersion,
      },
    });
    expect(calls[2]?.input).toContain('https://codeload.github.com/');
    expect(calls[2]?.init).toMatchObject({
      redirect: 'manual',
      credentials: 'omit',
      headers: { 'User-Agent': githubUserAgent },
    });
    expect(await readFile(archivePath, 'utf8')).toBe('zip-bytes');
  });

  it.each([
    [null],
    ['http://codeload.github.com/owner/repo/archive.zip'],
    ['https://example.com/owner/repo/archive.zip'],
    ['not a url'],
  ])('rejects an unsafe archive redirect: %s', async (location) => {
    const fetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          ...(location === null ? {} : { headers: { location } }),
        }),
    ) as unknown as typeof fetch;
    const client = createGitHubClient({ fetcher, limits });

    await expect(
      client.downloadRepositoryArchive(
        reference,
        metadata.defaultBranch,
        await createArchivePath(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REPOSITORY_ARCHIVE' });
  });

  it('rejects a further codeload redirect', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: 'https://codeload.github.com/owner/repo/archive.zip',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://example.com/next' },
        }),
      ) as unknown as typeof fetch;
    const client = createGitHubClient({ fetcher, limits });

    await expect(
      client.downloadRepositoryArchive(
        reference,
        metadata.defaultBranch,
        await createArchivePath(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REPOSITORY_ARCHIVE' });
  });

  it.each([
    ['content length', { 'content-length': '4' }],
    ['streaming bytes', {}],
  ])('enforces compressed size from %s', async (_label, headers) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: 'https://codeload.github.com/owner/repo/archive.zip',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response('1234', { status: 200, headers }),
      ) as unknown as typeof fetch;
    const client = createGitHubClient({
      fetcher,
      limits: { ...limits, maximumArchiveBytes: 3 },
    });

    await expect(
      client.downloadRepositoryArchive(
        reference,
        metadata.defaultBranch,
        await createArchivePath(),
      ),
    ).rejects.toMatchObject({ code: 'REPOSITORY_TOO_LARGE', status: 413 });
  });

  it('maps anonymous 404, explicit private metadata, rate limit, and unavailable responses', async () => {
    const reset = String(Math.floor(Date.now() / 1000) + 60);
    const cases = [
      {
        response: new Response(null, { status: 404 }),
        code: 'REPOSITORY_NOT_ACCESSIBLE',
      },
      {
        response: Response.json({ private: true, default_branch: 'main' }),
        code: 'PRIVATE_REPOSITORY',
      },
      {
        response: new Response(null, {
          status: 429,
          headers: { 'x-ratelimit-reset': reset },
        }),
        code: 'GITHUB_RATE_LIMITED',
      },
      {
        response: new Response(null, { status: 503 }),
        code: 'GITHUB_UNAVAILABLE',
      },
    ];

    for (const testCase of cases) {
      const client = createGitHubClient({
        fetcher: vi
          .fn()
          .mockResolvedValue(testCase.response) as unknown as typeof fetch,
        limits,
      });

      await expect(
        client.getRepositoryMetadata(reference),
      ).rejects.toMatchObject({
        code: testCase.code,
      });
    }
  });

  it('aborts metadata and archive requests after their timeout', async () => {
    const neverResponds = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    ) as unknown as typeof fetch;
    const client = createGitHubClient({
      fetcher: neverResponds,
      limits: { ...limits, metadataTimeoutMs: 5 },
    });

    await expect(client.getRepositoryMetadata(reference)).rejects.toMatchObject(
      {
        code: 'GITHUB_TIMEOUT',
        status: 504,
      },
    );
  });
});

async function createArchivePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'docpilot-client-test-'));
  directories.push(directory);
  return join(directory, 'repository.zip');
}
