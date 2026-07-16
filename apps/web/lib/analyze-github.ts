import {
  isAnalyzeProjectResponse,
  type AnalyzeProjectResponse,
} from './analyze-project';
import { isRecord, postJson, type ApiErrorDetails } from './api-client';

export interface GitHubRepositorySummary {
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
}

export interface AnalyzeGitHubRequest {
  repositoryUrl: string;
}

export interface AnalyzeGitHubResponse extends AnalyzeProjectResponse {
  repository: GitHubRepositorySummary;
}

export class AnalyzeGitHubApiError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;

  constructor(message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'AnalyzeGitHubApiError';
    this.status = details.status;
    this.code = details.code;
  }
}

export function analyzeGitHub(
  input: AnalyzeGitHubRequest,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<AnalyzeGitHubResponse> {
  return postJson(
    '/analyze/github',
    input,
    isAnalyzeGitHubResponse,
    (message, details) => new AnalyzeGitHubApiError(message, details),
    fetcher,
  );
}

export function validatePublicGitHubRepositoryUrl(input: string): string {
  const value = input.trim();
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw invalidUrl();
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== 'github.com' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw invalidUrl();
  }

  const segments = url.pathname.split('/').filter(Boolean);

  if (segments.length !== 2) {
    throw invalidUrl();
  }

  const owner = decodeSegment(segments[0]);
  const repository = decodeSegment(segments[1]).replace(/\.git$/i, '');

  if (
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) ||
    !/^[A-Za-z0-9._-]+$/.test(repository) ||
    repository === '.' ||
    repository === '..'
  ) {
    throw invalidUrl();
  }

  return (
    'https://github.com/' +
    encodeURIComponent(owner) +
    '/' +
    encodeURIComponent(repository)
  );
}

function isAnalyzeGitHubResponse(
  value: unknown,
): value is AnalyzeGitHubResponse {
  return (
    isRecord(value) &&
    isRecord(value.repository) &&
    isNonEmptyString(value.repository.owner) &&
    isNonEmptyString(value.repository.name) &&
    isNonEmptyString(value.repository.url) &&
    isNonEmptyString(value.repository.defaultBranch) &&
    isAnalyzeProjectResponse(value)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function decodeSegment(value: string | undefined): string {
  if (value === undefined) {
    throw invalidUrl();
  }

  try {
    return decodeURIComponent(value);
  } catch {
    throw invalidUrl();
  }
}

function invalidUrl(): Error {
  return new Error(
    'Enter a public GitHub repository URL such as https://github.com/owner/repository.',
  );
}
