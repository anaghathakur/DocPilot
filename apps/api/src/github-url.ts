import { GitHubAnalysisError } from './github-errors.js';

export interface GitHubRepositoryReference {
  owner: string;
  name: string;
  url: string;
}

const ownerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const repositoryPattern = /^[A-Za-z0-9._-]{1,100}$/;

export function parseGitHubRepositoryUrl(
  repositoryUrl: string,
): GitHubRepositoryReference {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(repositoryUrl.trim());
  } catch {
    throw invalidRepositoryUrl();
  }

  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.hostname.toLowerCase() !== 'github.com' ||
    parsedUrl.port !== '' ||
    parsedUrl.username !== '' ||
    parsedUrl.password !== '' ||
    parsedUrl.search !== '' ||
    parsedUrl.hash !== ''
  ) {
    throw invalidRepositoryUrl();
  }

  const path = parsedUrl.pathname.replace(/\/+$/, '');
  const segments = path.split('/').filter((segment) => segment.length > 0);

  if (segments.length !== 2) {
    throw invalidRepositoryUrl();
  }

  const owner = segments[0];
  const rawRepositoryName = segments[1];

  if (owner === undefined || rawRepositoryName === undefined) {
    throw invalidRepositoryUrl();
  }

  const name = rawRepositoryName.replace(/\.git$/i, '');

  if (
    !ownerPattern.test(owner) ||
    !repositoryPattern.test(name) ||
    name === '.' ||
    name === '..' ||
    rawRepositoryName.includes('%') ||
    owner.includes('%')
  ) {
    throw invalidRepositoryUrl();
  }

  return {
    owner,
    name,
    url: 'https://github.com/' + owner + '/' + name,
  };
}

function invalidRepositoryUrl(): GitHubAnalysisError {
  return new GitHubAnalysisError(
    'INVALID_REPOSITORY_URL',
    'repositoryUrl must be a public https://github.com/owner/repository URL',
  );
}
