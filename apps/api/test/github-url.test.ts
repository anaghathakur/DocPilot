import { describe, expect, it } from 'vitest';

import { parseGitHubRepositoryUrl } from '../src/github-url.js';

describe('parseGitHubRepositoryUrl', () => {
  it.each([
    ['https://github.com/owner/repository', 'repository'],
    ['https://github.com/owner/repository/', 'repository'],
    ['https://github.com/owner/repository.git', 'repository'],
    ['https://github.com/owner/repository.git/', 'repository'],
  ])('accepts %s', (input, name) => {
    expect(parseGitHubRepositoryUrl(input)).toEqual({
      owner: 'owner',
      name,
      url: 'https://github.com/owner/repository',
    });
  });

  it.each([
    'http://github.com/owner/repository',
    'https://example.com/owner/repository',
    'https://github.com/owner',
    'https://github.com/owner/repository/extra',
    'https://github.com/owner/repository?token=secret',
    'https://user:pass@github.com/owner/repository',
    'not a url',
  ])('rejects invalid repository URL %s', (input) => {
    expect(() => parseGitHubRepositoryUrl(input)).toThrowError(
      expect.objectContaining({ code: 'INVALID_REPOSITORY_URL', status: 400 }),
    );
  });
});
