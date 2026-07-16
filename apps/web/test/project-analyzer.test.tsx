import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectAnalyzer } from '../components/project-analyzer';
import {
  analyzeProject,
  type AnalyzeProjectResponse,
} from '../lib/analyze-project';

vi.mock('../lib/analyze-project', () => ({
  analyzeProject: vi.fn(),
}));

const mockedAnalyzeProject = vi.mocked(analyzeProject);

const successfulResponse: AnalyzeProjectResponse = {
  routes: [
    {
      method: 'GET',
      path: '/users',
      middleware: ['authMiddleware'],
      handler: 'getUsers',
      filePath: 'routes/users.ts',
    },
    {
      method: 'POST',
      path: '/products',
      middleware: ['validateProduct'],
      handler: 'createProduct',
      filePath: 'routes/products.ts',
    },
  ],
  routeCount: 2,
  filesAnalyzed: 2,
  filesSkipped: [],
  errors: [],
};

beforeEach(() => {
  mockedAnalyzeProject.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ProjectAnalyzer file selection', () => {
  it('selects multiple files without reading or analyzing them automatically', async () => {
    const user = userEvent.setup();
    const usersFile = createSourceFile(
      'users.ts',
      "router.get('/users', getUsers);",
      'routes/users.ts',
    );
    const productsFile = createSourceFile(
      'products.js',
      "router.get('/products', getProducts);",
      'routes/products.js',
    );
    render(<ProjectAnalyzer />);

    await user.upload(screen.getByLabelText('Choose project files'), [
      usersFile,
      productsFile,
    ]);

    expect(screen.getByText('routes/users.ts')).toBeInTheDocument();
    expect(screen.getByText('routes/products.js')).toBeInTheDocument();
    expect(screen.getByText('2 files selected')).toBeInTheDocument();
    expect(screen.getAllByText(/\d+ B/)).toHaveLength(2);
    expect(usersFile.text).not.toHaveBeenCalled();
    expect(productsFile.text).not.toHaveBeenCalled();
    expect(mockedAnalyzeProject).not.toHaveBeenCalled();
  });

  it('removes individual files and clears the remaining selection', async () => {
    const user = userEvent.setup();
    render(<ProjectAnalyzer />);

    await user.upload(screen.getByLabelText('Choose project files'), [
      createSourceFile(
        'users.ts',
        "router.get('/users', getUsers);",
        'routes/users.ts',
      ),
      createSourceFile(
        'products.ts',
        "router.get('/products', getProducts);",
        'routes/products.ts',
      ),
    ]);

    await user.click(
      screen.getByRole('button', { name: 'Remove routes/users.ts' }),
    );

    expect(screen.queryByText('routes/users.ts')).not.toBeInTheDocument();
    expect(screen.getByText('routes/products.ts')).toBeInTheDocument();
    expect(screen.getByText('1 file selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(screen.getByText('No project files selected')).toBeInTheDocument();
    expect(screen.queryByText('routes/products.ts')).not.toBeInTheDocument();
  });

  it('reports unsupported, empty, and duplicate files instead of silently discarding them', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ProjectAnalyzer />);

    await user.upload(
      screen.getByLabelText('Choose project files'),
      createSourceFile(
        'users.ts',
        "router.get('/users', getUsers);",
        'routes/users.ts',
      ),
    );
    await user.upload(screen.getByLabelText('Choose project files'), [
      createSourceFile('notes.md', 'documentation', 'notes/notes.md'),
      createSourceFile('empty.ts', '', 'routes/empty.ts'),
      createSourceFile(
        'duplicate.ts',
        "router.post('/users', createUser);",
        'routes/users.ts',
      ),
    ]);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('unsupported extension');
    expect(alert).toHaveTextContent('is empty and was not selected');
    expect(alert).toHaveTextContent('is already selected');
    expect(screen.getByText('1 file selected')).toBeInTheDocument();
  });

  it('rejects a selection that would exceed 100 files', async () => {
    const user = userEvent.setup();
    const files = Array.from({ length: 101 }, (_value, index) =>
      createSourceFile(
        'file-' + String(index) + '.ts',
        'const value = ' + String(index) + ';',
      ),
    );
    render(<ProjectAnalyzer />);

    await user.upload(screen.getByLabelText('Choose project files'), files);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'A project can contain at most 100 files',
    );
    expect(screen.getByText('0 files selected')).toBeInTheDocument();
    expect(mockedAnalyzeProject).not.toHaveBeenCalled();
  });
});

describe('ProjectAnalyzer analysis', () => {
  it('shows loading and renders a successful combined analysis', async () => {
    const user = userEvent.setup();
    let resolveAnalysis:
      ((response: AnalyzeProjectResponse) => void) | undefined;
    mockedAnalyzeProject.mockReturnValue(
      new Promise((resolve) => {
        resolveAnalysis = resolve;
      }),
    );
    const usersFile = createSourceFile(
      'users.ts',
      "router.get('/users', authMiddleware, getUsers);",
      'routes/users.ts',
    );
    const productsFile = createSourceFile(
      'products.ts',
      "router.post('/products', validateProduct, createProduct);",
      'routes/products.ts',
    );
    render(<ProjectAnalyzer />);

    await user.upload(screen.getByLabelText('Choose project files'), [
      usersFile,
      productsFile,
    ]);
    await user.click(screen.getByRole('button', { name: 'Analyze project' }));

    expect(
      screen.getByRole('button', { name: 'Analyzing project' }),
    ).toBeDisabled();
    expect(mockedAnalyzeProject).toHaveBeenCalledWith({
      files: [
        {
          filePath: 'routes/users.ts',
          sourceCode: "router.get('/users', authMiddleware, getUsers);",
        },
        {
          filePath: 'routes/products.ts',
          sourceCode:
            "router.post('/products', validateProduct, createProduct);",
        },
      ],
    });

    await act(async () => {
      resolveAnalysis?.(successfulResponse);
    });

    expect(await screen.findByText('2 routes found')).toBeInTheDocument();
    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.getByText('/products')).toBeInTheDocument();
    expect(screen.getByText('authMiddleware')).toBeInTheDocument();
    expect(screen.getByText('createProduct')).toBeInTheDocument();
    expect(screen.getAllByText('routes/users.ts').length).toBeGreaterThan(1);
  });

  it('does not send a project request when any browser file cannot be read', async () => {
    const user = userEvent.setup();
    const unreadableFile = createSourceFile(
      'unreadable.ts',
      'source exists',
      'routes/unreadable.ts',
      true,
    );
    render(<ProjectAnalyzer />);

    await user.upload(
      screen.getByLabelText('Choose project files'),
      unreadableFile,
    );
    await user.click(screen.getByRole('button', { name: 'Analyze project' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to read "routes/unreadable.ts". No project request was sent.',
    );
    expect(mockedAnalyzeProject).not.toHaveBeenCalled();
  });

  it('renders partial file errors alongside successful routes', async () => {
    const user = userEvent.setup();
    mockedAnalyzeProject.mockResolvedValue({
      routes: [
        {
          method: 'GET',
          path: '/users',
          middleware: [],
          handler: 'getUsers',
          filePath: 'routes/users.ts',
        },
      ],
      routeCount: 1,
      filesAnalyzed: 2,
      filesSkipped: [],
      errors: [
        {
          filePath: 'routes/broken.ts',
          code: 'INVALID_SOURCE_CODE',
          message: 'Unable to parse source code at 1:24',
        },
      ],
    });
    render(<ProjectAnalyzer />);

    await user.upload(screen.getByLabelText('Choose project files'), [
      createSourceFile(
        'users.ts',
        "router.get('/users', getUsers);",
        'routes/users.ts',
      ),
      createSourceFile(
        'broken.ts',
        "router.get('/broken', brokenHandler);",
        'routes/broken.ts',
      ),
    ]);
    await user.click(screen.getByRole('button', { name: 'Analyze project' }));

    expect(
      await screen.findByText('Analysis completed with file errors'),
    ).toBeInTheDocument();
    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.getAllByText('routes/broken.ts').length).toBeGreaterThan(1);
    expect(
      screen.getByText('Unable to parse source code at 1:24'),
    ).toBeInTheDocument();
  });

  it('shows an empty project result', async () => {
    const user = userEvent.setup();
    mockedAnalyzeProject.mockResolvedValue({
      routes: [],
      routeCount: 0,
      filesAnalyzed: 1,
      filesSkipped: [],
      errors: [],
    });
    render(<ProjectAnalyzer />);

    await user.upload(
      screen.getByLabelText('Choose project files'),
      createSourceFile('empty-routes.ts', 'const value = 1;'),
    );
    await user.click(screen.getByRole('button', { name: 'Analyze project' }));

    expect(
      await screen.findByText('No supported Express routes found'),
    ).toBeInTheDocument();
    expect(screen.getByText('0 routes found')).toBeInTheDocument();
  });

  it('filters and searches locally without making additional API requests', async () => {
    const user = userEvent.setup();
    mockedAnalyzeProject.mockResolvedValue(successfulResponse);
    render(<ProjectAnalyzer />);

    await user.upload(
      screen.getByLabelText('Choose project files'),
      createSourceFile('routes.ts', 'const routes = true;'),
    );
    await user.click(screen.getByRole('button', { name: 'Analyze project' }));
    await screen.findByText('2 routes found');

    await user.selectOptions(screen.getByLabelText('HTTP method'), 'POST');

    expect(screen.getByText('/products')).toBeInTheDocument();
    expect(screen.queryByText('/users')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 2 routes')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('HTTP method'), 'ALL');
    await user.type(screen.getByLabelText('Search routes'), 'authmiddleware');

    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.queryByText('/products')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search routes'));
    await user.type(screen.getByLabelText('Search routes'), 'products.ts');

    expect(screen.getByText('/products')).toBeInTheDocument();
    expect(screen.queryByText('/users')).not.toBeInTheDocument();
    expect(mockedAnalyzeProject).toHaveBeenCalledTimes(1);
  });

  it('downloads the complete unfiltered response and revokes its object URL', async () => {
    const user = userEvent.setup();
    mockedAnalyzeProject.mockResolvedValue(successfulResponse);
    const createObjectUrl = vi.fn((blob: Blob) => {
      void blob;
      return 'blob:docpilot-analysis';
    });
    const revokeObjectUrl = vi.fn();
    let downloadName = '';

    vi.stubGlobal('URL', {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadName = this.download;
    });

    render(<ProjectAnalyzer />);
    await user.upload(
      screen.getByLabelText('Choose project files'),
      createSourceFile('routes.ts', 'const routes = true;'),
    );
    await user.click(screen.getByRole('button', { name: 'Analyze project' }));
    await screen.findByText('2 routes found');
    await user.selectOptions(screen.getByLabelText('HTTP method'), 'GET');
    await user.click(screen.getByRole('button', { name: 'Download JSON' }));

    const downloadedBlob = createObjectUrl.mock.calls[0]?.[0];
    expect(downloadedBlob).toBeInstanceOf(Blob);
    expect(JSON.parse(await readBlob(downloadedBlob as Blob))).toEqual(
      successfulResponse,
    );
    expect(downloadName).toBe('docpilot-analysis.json');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:docpilot-analysis');
  });

  it.each([
    ['network', 'Unable to reach the DocPilot API.'],
    ['API', 'files must be a non-empty array'],
  ])('shows %s failures', async (_kind, message) => {
    const user = userEvent.setup();
    mockedAnalyzeProject.mockRejectedValue(new Error(message));
    render(<ProjectAnalyzer />);

    await user.upload(
      screen.getByLabelText('Choose project files'),
      createSourceFile('routes.ts', 'const routes = true;'),
    );
    await user.click(screen.getByRole('button', { name: 'Analyze project' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});

function createSourceFile(
  name: string,
  sourceCode: string,
  filePath = '',
  readingFails = false,
): File {
  const file = new File([sourceCode], name, {
    type: 'text/plain',
  });

  Object.defineProperty(file, 'webkitRelativePath', {
    configurable: true,
    value: filePath,
  });
  Object.defineProperty(file, 'text', {
    configurable: true,
    value: readingFails
      ? vi.fn().mockRejectedValue(new DOMException('Unable to read file'))
      : vi.fn().mockResolvedValue(sourceCode),
  });

  return file;
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsText(blob);
  });
}
