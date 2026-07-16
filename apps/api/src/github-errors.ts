export type GitHubAnalysisErrorCode =
  | 'INVALID_REPOSITORY_URL'
  | 'REPOSITORY_NOT_ACCESSIBLE'
  | 'PRIVATE_REPOSITORY'
  | 'GITHUB_RATE_LIMITED'
  | 'REPOSITORY_TOO_LARGE'
  | 'GITHUB_TIMEOUT'
  | 'GITHUB_UNAVAILABLE'
  | 'INVALID_REPOSITORY_ARCHIVE';

const statusByCode: Record<GitHubAnalysisErrorCode, number> = {
  INVALID_REPOSITORY_URL: 400,
  REPOSITORY_NOT_ACCESSIBLE: 404,
  PRIVATE_REPOSITORY: 400,
  GITHUB_RATE_LIMITED: 429,
  REPOSITORY_TOO_LARGE: 413,
  GITHUB_TIMEOUT: 504,
  GITHUB_UNAVAILABLE: 502,
  INVALID_REPOSITORY_ARCHIVE: 502,
};

export interface GitHubAnalysisErrorOptions {
  rateLimitReset?: string | undefined;
  cause?: unknown;
}

export class GitHubAnalysisError extends Error {
  readonly code: GitHubAnalysisErrorCode;
  readonly status: number;
  readonly rateLimitReset: string | undefined;

  constructor(
    code: GitHubAnalysisErrorCode,
    message: string,
    options: GitHubAnalysisErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'GitHubAnalysisError';
    this.code = code;
    this.status = statusByCode[code];
    this.rateLimitReset = options.rateLimitReset;
  }
}
