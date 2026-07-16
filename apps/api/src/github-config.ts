export const githubApiBaseUrl = 'https://api.github.com';
export const githubArchiveRedirectHost = 'codeload.github.com';
export const githubApiVersion = '2026-03-10';
export const githubUserAgent = 'DocPilot/0.1';

export interface GitHubAnalysisLimits {
  metadataTimeoutMs: number;
  archiveTimeoutMs: number;
  maximumArchiveBytes: number;
  maximumFileBytes: number;
  maximumCombinedSourceBytes: number;
  maximumSupportedFiles: number;
  maximumArchiveEntries: number;
}

export const defaultGitHubAnalysisLimits: GitHubAnalysisLimits = {
  metadataTimeoutMs: 10_000,
  archiveTimeoutMs: 30_000,
  maximumArchiveBytes: 50 * 1024 * 1024,
  maximumFileBytes: 512 * 1024,
  maximumCombinedSourceBytes: 5 * 1024 * 1024,
  maximumSupportedFiles: 100,
  maximumArchiveEntries: 10_000,
};

export function loadGitHubAnalysisLimits(
  environment: NodeJS.ProcessEnv = process.env,
): GitHubAnalysisLimits {
  return {
    metadataTimeoutMs: readPositiveInteger(
      environment.GITHUB_METADATA_TIMEOUT_MS,
      defaultGitHubAnalysisLimits.metadataTimeoutMs,
    ),
    archiveTimeoutMs: readPositiveInteger(
      environment.GITHUB_ARCHIVE_TIMEOUT_MS,
      defaultGitHubAnalysisLimits.archiveTimeoutMs,
    ),
    maximumArchiveBytes: readPositiveInteger(
      environment.GITHUB_MAX_ARCHIVE_BYTES,
      defaultGitHubAnalysisLimits.maximumArchiveBytes,
    ),
    maximumFileBytes: readPositiveInteger(
      environment.GITHUB_MAX_FILE_BYTES,
      defaultGitHubAnalysisLimits.maximumFileBytes,
    ),
    maximumCombinedSourceBytes: readPositiveInteger(
      environment.GITHUB_MAX_SOURCE_BYTES,
      defaultGitHubAnalysisLimits.maximumCombinedSourceBytes,
    ),
    maximumSupportedFiles: defaultGitHubAnalysisLimits.maximumSupportedFiles,
    maximumArchiveEntries: readPositiveInteger(
      environment.GITHUB_MAX_ARCHIVE_ENTRIES,
      defaultGitHubAnalysisLimits.maximumArchiveEntries,
    ),
  };
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
