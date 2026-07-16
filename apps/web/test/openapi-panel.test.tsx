import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenApiPanel } from '../components/openapi-panel';
import {
  generateOpenApi,
  type GenerateOpenApiResponse,
} from '../lib/generate-openapi';

vi.mock('../lib/generate-openapi', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/generate-openapi')>();

  return {
    ...actual,
    generateOpenApi: vi.fn(),
  };
});

const mockedGenerateOpenApi = vi.mocked(generateOpenApi);
const routes = [
  {
    method: 'GET' as const,
    path: '/users',
    middleware: ['authMiddleware'],
    handler: 'getUsers',
    filePath: 'routes/users.ts',
  },
];
const generatedResponse: GenerateOpenApiResponse = {
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
          'x-docpilot-middleware': ['authMiddleware'],
          'x-docpilot-file': 'routes/users.ts',
        },
      },
    },
  },
  json: '{\n  "openapi": "3.1.0"\n}\n',
  yaml: 'openapi: 3.1.0\n',
  warnings: [],
};

beforeEach(() => {
  mockedGenerateOpenApi.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('OpenApiPanel', () => {
  it('waits for the user, shows loading, and renders generated documentation', async () => {
    const user = userEvent.setup();
    let resolveGeneration:
      ((value: GenerateOpenApiResponse) => void) | undefined;
    mockedGenerateOpenApi.mockReturnValue(
      new Promise((resolve) => {
        resolveGeneration = resolve;
      }),
    );
    render(<OpenApiPanel routes={routes} idPrefix="source" />);

    expect(mockedGenerateOpenApi).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Generate OpenAPI' }));

    expect(
      screen.getByRole('button', { name: 'Generating OpenAPI' }),
    ).toBeDisabled();
    expect(
      screen.getByText('Generating OpenAPI documentation�'),
    ).toBeInTheDocument();
    expect(mockedGenerateOpenApi).toHaveBeenCalledWith({
      routes,
      title: 'DocPilot Generated API',
      version: '1.0.0',
    });

    await act(async () => {
      resolveGeneration?.(generatedResponse);
    });

    expect(await screen.findByText('3.1.0')).toBeInTheDocument();
    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.getByText('Get users')).toBeInTheDocument();
    expect(screen.getByLabelText('OpenAPI JSON preview')).toHaveTextContent(
      '"openapi": "3.1.0"',
    );
  });

  it('validates the server URL before sending a request', async () => {
    const user = userEvent.setup();
    render(<OpenApiPanel routes={routes} idPrefix="source" />);

    await user.type(screen.getByLabelText(/Server URL/), 'ftp://example.com');
    await user.click(screen.getByRole('button', { name: 'Generate OpenAPI' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Server URL must be a valid HTTP or HTTPS URL.',
    );
    expect(mockedGenerateOpenApi).not.toHaveBeenCalled();
  });

  it('renders duplicate and unsupported warnings and switches previews', async () => {
    const user = userEvent.setup();
    mockedGenerateOpenApi.mockResolvedValue({
      ...generatedResponse,
      warnings: [
        {
          code: 'DUPLICATE_OPERATION',
          method: 'GET',
          path: '/users',
          keptRouteIndex: 0,
          ignoredRouteIndex: 1,
          message:
            'GET /users duplicates an earlier operation and was ignored.',
        },
        {
          code: 'UNSUPPORTED_PATH',
          method: 'GET',
          path: '/files/*',
          routeIndex: 2,
          message: 'GET /files/* uses unsupported syntax.',
        },
      ],
    });
    render(<OpenApiPanel routes={routes} idPrefix="project" />);

    await user.click(screen.getByRole('button', { name: 'Generate OpenAPI' }));

    expect(await screen.findByText('Generation warnings')).toBeInTheDocument();
    expect(screen.getByText(/Duplicate operation:/)).toBeInTheDocument();
    expect(screen.getByText(/Unsupported path:/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'YAML' }));
    expect(screen.getByLabelText('OpenAPI YAML preview')).toHaveTextContent(
      'openapi: 3.1.0',
    );
  });

  it('reports copy success and failure', async () => {
    const user = userEvent.setup();
    mockedGenerateOpenApi.mockResolvedValue(generatedResponse);
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new DOMException('denied'));

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<OpenApiPanel routes={routes} idPrefix="github" />);
    await user.click(screen.getByRole('button', { name: 'Generate OpenAPI' }));
    await screen.findByText('/users');

    await user.click(screen.getByRole('button', { name: 'Copy JSON' }));
    expect(screen.getByText('JSON copied to clipboard.')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(generatedResponse.json);

    await user.click(screen.getByRole('button', { name: 'Copy YAML' }));
    expect(screen.getByText(/Unable to copy YAML/)).toBeInTheDocument();
  });

  it('downloads both formats with exact filenames and revokes object URLs', async () => {
    const user = userEvent.setup();
    mockedGenerateOpenApi.mockResolvedValue(generatedResponse);
    const createObjectURL = vi
      .fn()
      .mockReturnValueOnce('blob:openapi-json')
      .mockReturnValueOnce('blob:openapi-yaml');
    const revokeObjectURL = vi.fn();
    const downloadNames: string[] = [];

    render(<OpenApiPanel routes={routes} idPrefix="project" />);
    await user.click(screen.getByRole('button', { name: 'Generate OpenAPI' }));
    await screen.findByText('/users');

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadNames.push(this.download);
    });

    await user.click(screen.getByRole('button', { name: 'Download JSON' }));
    await user.click(screen.getByRole('button', { name: 'Download YAML' }));

    expect(downloadNames).toEqual(['openapi.json', 'openapi.yaml']);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenNthCalledWith(1, 'blob:openapi-json');
    expect(revokeObjectURL).toHaveBeenNthCalledWith(2, 'blob:openapi-yaml');
  });

  it('shows API errors and disables generation without routes', async () => {
    const user = userEvent.setup();
    mockedGenerateOpenApi.mockRejectedValue(
      new Error('The OpenAPI request could not be completed.'),
    );
    const { rerender } = render(
      <OpenApiPanel routes={routes} idPrefix="source" />,
    );

    await user.click(screen.getByRole('button', { name: 'Generate OpenAPI' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The OpenAPI request could not be completed.',
    );

    rerender(<OpenApiPanel routes={[]} idPrefix="source" />);
    expect(
      screen.getByRole('button', { name: 'Generate OpenAPI' }),
    ).toBeDisabled();
    expect(
      screen.getByText('No extracted routes are available for generation.'),
    ).toBeInTheDocument();
  });
});
