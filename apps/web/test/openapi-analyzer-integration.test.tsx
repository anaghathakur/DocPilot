import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GitHubAnalyzer } from '../components/github-analyzer';
import { ProjectAnalyzer } from '../components/project-analyzer';
import { SourceAnalyzer } from '../components/source-analyzer';
import { analyzeGitHub } from '../lib/analyze-github';
import { analyzeProject } from '../lib/analyze-project';
import { analyzeSource } from '../lib/analyze-source';
import {
  generateOpenApi,
  type GenerateOpenApiResponse,
} from '../lib/generate-openapi';

vi.mock('../lib/analyze-source', () => ({
  analyzeSource: vi.fn(),
}));

vi.mock('../lib/analyze-project', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/analyze-project')>();

  return {
    ...actual,
    analyzeProject: vi.fn(),
  };
});

vi.mock('../lib/analyze-github', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/analyze-github')>();

  return {
    ...actual,
    analyzeGitHub: vi.fn(),
  };
});

vi.mock('../lib/generate-openapi', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/generate-openapi')>();

  return {
    ...actual,
    generateOpenApi: vi.fn(),
  };
});

const mockedAnalyzeSource = vi.mocked(analyzeSource);
const mockedAnalyzeProject = vi.mocked(analyzeProject);
const mockedAnalyzeGitHub = vi.mocked(analyzeGitHub);
const mockedGenerateOpenApi = vi.mocked(generateOpenApi);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGenerateOpenApi.mockResolvedValue(generatedResponse());
});

describe('OpenAPI generation from analyzer workflows', () => {
  it('uses pasted-source routes and clears stale OpenAPI on a new analysis', async () => {
    const user = userEvent.setup();
    const routes = [
      {
        method: 'GET' as const,
        path: '/users',
        middleware: [],
        handler: 'getUsers',
      },
    ];
    mockedAnalyzeSource.mockResolvedValueOnce({
      routes,
      count: 1,
    });
    render(<SourceAnalyzer />);

    await user.click(screen.getByRole('button', { name: 'Analyze source' }));
    expect(
      await screen.findByRole('heading', { name: 'OpenAPI documentation' }),
    ).toBeInTheDocument();
    expect(screen.getByText('/users')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Generate OpenAPI' }));
    expect(mockedGenerateOpenApi).toHaveBeenCalledWith({
      routes,
      title: 'DocPilot Generated API',
      version: '1.0.0',
    });
    expect(await screen.findByText('Endpoint overview')).toBeInTheDocument();

    mockedAnalyzeSource.mockReturnValueOnce(new Promise(() => undefined));
    await user.click(screen.getByRole('button', { name: 'Analyze source' }));

    expect(
      screen.queryByRole('heading', { name: 'OpenAPI documentation' }),
    ).not.toBeInTheDocument();
  });

  it('uses uploaded-project routes including their file paths', async () => {
    const user = userEvent.setup();
    const routes = [
      {
        method: 'POST' as const,
        path: '/products',
        middleware: ['validateProduct'],
        handler: 'createProduct',
        filePath: 'routes/products.ts',
      },
    ];
    mockedAnalyzeProject.mockResolvedValue({
      routes,
      routeCount: 1,
      filesAnalyzed: 1,
      filesSkipped: [],
      errors: [],
    });
    const file = new File(
      ["router.post('/products', createProduct);"],
      'products.ts',
      { type: 'text/plain' },
    );
    Object.defineProperty(file, 'text', {
      configurable: true,
      value: vi
        .fn()
        .mockResolvedValue("router.post('/products', createProduct);"),
    });

    render(<ProjectAnalyzer />);
    await user.upload(screen.getByLabelText('Choose project files'), file);
    await user.click(screen.getByRole('button', { name: 'Analyze project' }));
    await screen.findByRole('heading', { name: 'OpenAPI documentation' });
    await user.click(screen.getByRole('button', { name: 'Generate OpenAPI' }));

    expect(mockedGenerateOpenApi).toHaveBeenCalledWith({
      routes,
      title: 'DocPilot Generated API',
      version: '1.0.0',
    });
  });

  it('uses GitHub project routes while preserving repository results', async () => {
    const user = userEvent.setup();
    const routes = [
      {
        method: 'GET' as const,
        path: '/health',
        middleware: [],
        handler: 'getHealth',
        filePath: 'src/routes.ts',
      },
    ];
    mockedAnalyzeGitHub.mockResolvedValue({
      repository: {
        owner: 'owner',
        name: 'repository',
        url: 'https://github.com/owner/repository',
        defaultBranch: 'main',
      },
      routes,
      routeCount: 1,
      filesAnalyzed: 1,
      filesSkipped: [],
      errors: [],
    });

    render(<GitHubAnalyzer />);
    await user.type(
      screen.getByLabelText('Repository URL'),
      'https://github.com/owner/repository',
    );
    await user.click(
      screen.getByRole('button', { name: 'Analyze repository' }),
    );
    expect(await screen.findByText('owner/repository')).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'OpenAPI documentation' });
    await user.click(screen.getByRole('button', { name: 'Generate OpenAPI' }));

    expect(mockedGenerateOpenApi).toHaveBeenCalledWith({
      routes,
      title: 'DocPilot Generated API',
      version: '1.0.0',
    });
    expect(screen.getByText('owner/repository')).toBeInTheDocument();
  });
});

function generatedResponse(): GenerateOpenApiResponse {
  return {
    document: {
      openapi: '3.1.0',
      info: {
        title: 'DocPilot Generated API',
        version: '1.0.0',
      },
      paths: {
        '/users': {
          get: {
            summary: 'Get users',
            operationId: 'getUsers',
            responses: {
              '200': {
                description: 'Successful response',
              },
            },
            'x-docpilot-handler': 'getUsers',
            'x-docpilot-middleware': [],
          },
        },
      },
    },
    json: '{}\n',
    yaml: 'openapi: 3.1.0\n',
    warnings: [],
  };
}
