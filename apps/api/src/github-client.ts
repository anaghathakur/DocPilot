import { open } from 'node:fs/promises';

import {
  githubApiBaseUrl,
  githubApiVersion,
  githubArchiveRedirectHost,
  githubUserAgent,
} from './github-config.js';
import type { GitHubAnalysisLimits } from './github-config.js';
import { GitHubAnalysisError } from './github-errors.js';
import type { GitHubRepositoryReference } from './github-url.js';

export interface GitHubRepositoryMetadata {
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
}

export interface GitHubClient {
  getRepositoryMetadata(
    reference: GitHubRepositoryReference,
  ): Promise<GitHubRepositoryMetadata>;
  downloadRepositoryArchive(
    reference: GitHubRepositoryReference,
    defaultBranch: string,
    archivePath: string,
  ): Promise<void>;
}

export interface CreateGitHubClientOptions {
  fetcher?: typeof fetch;
  limits: GitHubAnalysisLimits;
}

export function createGitHubClient({
  fetcher = globalThis.fetch,
  limits,
}: CreateGitHubClientOptions): GitHubClient {
  return {
    async getRepositoryMetadata(reference) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        limits.metadataTimeoutMs,
      );

      try {
        const response = await fetcher(
          githubApiBaseUrl +
            '/repos/' +
            encodeURIComponent(reference.owner) +
            '/' +
            encodeURIComponent(reference.name),
          {
            method: 'GET',
            headers: createGitHubApiHeaders(),
            redirect: 'manual',
            credentials: 'omit',
            signal: controller.signal,
          },
        );

        handleGitHubStatus(response);

        let payload: unknown;

        try {
          payload = await response.json();
        } catch (error) {
          throw new GitHubAnalysisError(
            'GITHUB_UNAVAILABLE',
            'GitHub returned an unreadable repository response.',
            { cause: error },
          );
        }

        if (!isRepositoryMetadataPayload(payload)) {
          throw new GitHubAnalysisError(
            'GITHUB_UNAVAILABLE',
            'GitHub returned an invalid repository response.',
          );
        }

        if (payload.private) {
          throw new GitHubAnalysisError(
            'PRIVATE_REPOSITORY',
            'Private repositories are not supported.',
          );
        }

        return {
          owner: reference.owner,
          name: reference.name,
          url: reference.url,
          defaultBranch: payload.default_branch,
        };
      } catch (error) {
        if (error instanceof GitHubAnalysisError) {
          throw error;
        }

        if (controller.signal.aborted) {
          throw new GitHubAnalysisError(
            'GITHUB_TIMEOUT',
            'GitHub did not respond before the repository metadata timeout.',
            { cause: error },
          );
        }

        throw new GitHubAnalysisError(
          'GITHUB_UNAVAILABLE',
          'GitHub is currently unavailable.',
          { cause: error },
        );
      } finally {
        clearTimeout(timeout);
      }
    },

    async downloadRepositoryArchive(reference, defaultBranch, archivePath) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        limits.archiveTimeoutMs,
      );

      try {
        const archiveApiUrl =
          githubApiBaseUrl +
          '/repos/' +
          encodeURIComponent(reference.owner) +
          '/' +
          encodeURIComponent(reference.name) +
          '/zipball/' +
          encodeURIComponent(defaultBranch);

        const redirectResponse = await fetcher(archiveApiUrl, {
          method: 'GET',
          headers: createGitHubApiHeaders(),
          redirect: 'manual',
          credentials: 'omit',
          signal: controller.signal,
        });

        if (redirectResponse.status !== 302) {
          handleGitHubStatus(redirectResponse);
          throw invalidArchive();
        }

        const redirectUrl = parseArchiveRedirect(
          redirectResponse.headers.get('location'),
        );
        const archiveResponse = await fetcher(redirectUrl, {
          method: 'GET',
          headers: {
            'User-Agent': githubUserAgent,
          },
          redirect: 'manual',
          credentials: 'omit',
          signal: controller.signal,
        });

        if (archiveResponse.status >= 300 && archiveResponse.status < 400) {
          throw invalidArchive();
        }

        handleGitHubStatus(archiveResponse);

        if (archiveResponse.body === null) {
          throw invalidArchive();
        }

        enforceContentLength(
          archiveResponse.headers.get('content-length'),
          limits.maximumArchiveBytes,
        );

        const fileHandle = await open(archivePath, 'wx');
        const reader = archiveResponse.body.getReader();
        let downloadedBytes = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            downloadedBytes += value.byteLength;

            if (downloadedBytes > limits.maximumArchiveBytes) {
              controller.abort();
              await reader.cancel().catch(() => undefined);
              throw new GitHubAnalysisError(
                'REPOSITORY_TOO_LARGE',
                'The repository archive exceeds the 50 MiB download limit.',
              );
            }

            await fileHandle.write(value);
          }
        } finally {
          reader.releaseLock();
          await fileHandle.close();
        }
      } catch (error) {
        if (error instanceof GitHubAnalysisError) {
          throw error;
        }

        if (controller.signal.aborted) {
          throw new GitHubAnalysisError(
            'GITHUB_TIMEOUT',
            'The repository archive download timed out.',
            { cause: error },
          );
        }

        throw new GitHubAnalysisError(
          'GITHUB_UNAVAILABLE',
          'GitHub is currently unavailable.',
          { cause: error },
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function createGitHubApiHeaders(): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': githubUserAgent,
    'X-GitHub-Api-Version': githubApiVersion,
  };
}

function handleGitHubStatus(response: Response): void {
  if (response.status >= 200 && response.status < 300) {
    return;
  }

  if (response.status === 404) {
    throw new GitHubAnalysisError(
      'REPOSITORY_NOT_ACCESSIBLE',
      'The repository was not found or is private.',
    );
  }

  if (response.status === 403 || response.status === 429) {
    throw new GitHubAnalysisError(
      'GITHUB_RATE_LIMITED',
      'GitHub rate limiting prevented repository analysis.',
      {
        rateLimitReset: readRateLimitReset(
          response.headers.get('x-ratelimit-reset'),
        ),
      },
    );
  }

  if (response.status >= 500) {
    throw new GitHubAnalysisError(
      'GITHUB_UNAVAILABLE',
      'GitHub is currently unavailable.',
    );
  }

  throw new GitHubAnalysisError(
    'GITHUB_UNAVAILABLE',
    'GitHub could not provide the requested repository.',
  );
}

function parseArchiveRedirect(location: string | null): string {
  if (location === null) {
    throw invalidArchive();
  }

  let redirectUrl: URL;

  try {
    redirectUrl = new URL(location);
  } catch (error) {
    throw new GitHubAnalysisError(
      'INVALID_REPOSITORY_ARCHIVE',
      'GitHub returned an invalid repository archive.',
      { cause: error },
    );
  }

  if (
    redirectUrl.protocol !== 'https:' ||
    redirectUrl.hostname.toLowerCase() !== githubArchiveRedirectHost ||
    redirectUrl.port !== '' ||
    redirectUrl.username !== '' ||
    redirectUrl.password !== ''
  ) {
    throw invalidArchive();
  }

  return redirectUrl.toString();
}

function enforceContentLength(
  contentLength: string | null,
  maximumArchiveBytes: number,
): void {
  if (contentLength === null || !/^\d+$/.test(contentLength)) {
    return;
  }

  const archiveBytes = Number(contentLength);

  if (
    Number.isSafeInteger(archiveBytes) &&
    archiveBytes > maximumArchiveBytes
  ) {
    throw new GitHubAnalysisError(
      'REPOSITORY_TOO_LARGE',
      'The repository archive exceeds the 50 MiB download limit.',
    );
  }
}

function readRateLimitReset(value: string | null): string | undefined {
  if (value === null || !/^\d+$/.test(value)) {
    return undefined;
  }

  const resetMilliseconds = Number(value) * 1000;
  const now = Date.now();

  if (
    !Number.isSafeInteger(resetMilliseconds) ||
    resetMilliseconds < now - 60_000 ||
    resetMilliseconds > now + 7 * 24 * 60 * 60 * 1000
  ) {
    return undefined;
  }

  return new Date(resetMilliseconds).toISOString();
}

function isRepositoryMetadataPayload(
  value: unknown,
): value is { default_branch: string; private: boolean } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'default_branch' in value &&
    typeof value.default_branch === 'string' &&
    value.default_branch.trim().length > 0 &&
    'private' in value &&
    typeof value.private === 'boolean'
  );
}

function invalidArchive(): GitHubAnalysisError {
  return new GitHubAnalysisError(
    'INVALID_REPOSITORY_ARCHIVE',
    'GitHub returned an invalid repository archive.',
  );
}
