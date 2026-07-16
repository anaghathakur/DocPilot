import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GitHubAnalyzer } from '../components/github-analyzer';
import {
  analyzeGitHub,
  type AnalyzeGitHubResponse,
} from '../lib/analyze-github';

vi.mock('../lib/analyze-github', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/analyze-github')>();

  return {
    ...actual,
    analyzeGitHub: vi.fn(),
  };
});

const mockedAnalyzeGitHub = vi.mocked(analyzeGitHub);
const successfulResponse: AnalyzeGitHubResponse = {
  repository: {
    owner: 'owner',
    name: 'repository',
    url: 'https://github.com/owner/repository',
    defaultBranch: 'trunk',
  },
  routes: [
    {
      method: 'GET',
      path: '/users',
      middleware: ['authMiddleware'],
      handler: 'getUsers',
      filePath: 'src/routes.ts',
    },
    {
      method: 'POST',
      path: '/products',
      middleware: [],
      handler: 'createProduct',
      filePath: 'src/products.ts',
    },
  ],
  routeCount: 2,
  filesAnalyzed: 3,
  filesSkipped: ['dist/output.js'],
  errors: [],
};

beforeEach(() => {
  mockedAnalyzeGitHub.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('GitHubAnalyzer', () => {
  it('validates the repository URL before calling the API', async () => {
    const user = userEvent.setup();
    render(<GitHubAnalyzer />);

    await user.type(
      screen.getByLabelText('Repository URL'),
      'https://example.com/repo',
    );
    await user.click(
      screen.getByRole('button', { name: 'Analyze repository' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a public GitHub repository URL',
    );
    expect(mockedAnalyzeGitHub).not.toHaveBeenCalled();
  });

  it('shows loading and renders repository and route results', async () => {
    const user = userEvent.setup();
    let resolveAnalysis: ((value: AnalyzeGitHubResponse) => void) | undefined;
    mockedAnalyzeGitHub.mockReturnValue(
      new Promise((resolve) => {
        resolveAnalysis = resolve;
      }),
    );
    render(<GitHubAnalyzer />);

    await user.type(
      screen.getByLabelText('Repository URL'),
      'https://github.com/owner/repository.git/',
    );
    await user.click(
      screen.getByRole('button', { name: 'Analyze repository' }),
    );

    expect(
      screen.getByRole('button', { name: 'Analyzing repository' }),
    ).toBeDisabled();
    expect(
      screen.getByText('Downloading and analyzing repository files�'),
    ).toBeInTheDocument();
    expect(mockedAnalyzeGitHub).toHaveBeenCalledWith({
      repositoryUrl: 'https://github.com/owner/repository',
    });

    await act(async () => {
      resolveAnalysis?.(successfulResponse);
    });

    expect(await screen.findByText('owner/repository')).toBeInTheDocument();
    expect(screen.getByText('trunk')).toBeInTheDocument();
    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.getByText('src/routes.ts')).toBeInTheDocument();
    expect(screen.getByText('dist/output.js')).toBeInTheDocument();
  });

  it('shows partial file errors while preserving successful routes', async () => {
    const user = userEvent.setup();
    mockedAnalyzeGitHub.mockResolvedValue({
      ...successfulResponse,
      routeCount: 1,
      routes: [successfulResponse.routes[0]!],
      errors: [
        {
          filePath: 'src/broken.ts',
          code: 'INVALID_SOURCE_CODE',
          message: 'Unable to parse source code',
        },
      ],
    });
    render(<GitHubAnalyzer />);

    await enterRepositoryAndAnalyze(user);

    expect(
      await screen.findByText('Analysis completed with file errors'),
    ).toBeInTheDocument();
    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.getByText('Unable to parse source code')).toBeInTheDocument();
  });

  it('filters and searches locally without another request', async () => {
    const user = userEvent.setup();
    mockedAnalyzeGitHub.mockResolvedValue(successfulResponse);
    render(<GitHubAnalyzer />);
    await enterRepositoryAndAnalyze(user);
    await screen.findByText('2 routes found');

    await user.selectOptions(screen.getByLabelText('HTTP method'), 'POST');
    expect(screen.getByText('/products')).toBeInTheDocument();
    expect(screen.queryByText('/users')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('HTTP method'), 'ALL');
    await user.type(screen.getByLabelText('Search routes'), 'authmiddleware');
    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.queryByText('/products')).not.toBeInTheDocument();
    expect(mockedAnalyzeGitHub).toHaveBeenCalledTimes(1);
  });

  it('downloads the complete unfiltered response and revokes the object URL', async () => {
    const user = userEvent.setup();
    mockedAnalyzeGitHub.mockResolvedValue(successfulResponse);
    const createObjectURL = vi.fn(() => 'blob:github-analysis');
    const revokeObjectURL = vi.fn();
    let downloadName = '';

    render(<GitHubAnalyzer />);
    await enterRepositoryAndAnalyze(user);
    await screen.findByText('2 routes found');

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadName = this.download;
    });

    await user.selectOptions(screen.getByLabelText('HTTP method'), 'GET');
    await user.click(screen.getByRole('button', { name: 'Download JSON' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(downloadName).toBe('docpilot-github-analysis.json');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:github-analysis');
  });

  it.each([
    'Unable to reach the DocPilot API.',
    'The repository was not found or is private.',
  ])('shows request failure: %s', async (message) => {
    const user = userEvent.setup();
    mockedAnalyzeGitHub.mockRejectedValue(new Error(message));
    render(<GitHubAnalyzer />);

    await enterRepositoryAndAnalyze(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('shows an empty repository analysis', async () => {
    const user = userEvent.setup();
    mockedAnalyzeGitHub.mockResolvedValue({
      ...successfulResponse,
      routes: [],
      routeCount: 0,
    });
    render(<GitHubAnalyzer />);

    await enterRepositoryAndAnalyze(user);

    expect(
      await screen.findByText('No supported Express routes found'),
    ).toBeInTheDocument();
  });
});

async function enterRepositoryAndAnalyze(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.type(
    screen.getByLabelText('Repository URL'),
    'https://github.com/owner/repository',
  );
  await user.click(screen.getByRole('button', { name: 'Analyze repository' }));
}
