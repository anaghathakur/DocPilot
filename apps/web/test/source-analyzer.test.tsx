import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SourceAnalyzer } from '../components/source-analyzer';
import {
  analyzeSource,
  type AnalyzeSourceResponse,
} from '../lib/analyze-source';

vi.mock('../lib/analyze-source', () => ({
  analyzeSource: vi.fn(),
}));

const mockedAnalyzeSource = vi.mocked(analyzeSource);

beforeEach(() => {
  mockedAnalyzeSource.mockReset();
});

describe('SourceAnalyzer', () => {
  it('prefills an Express example and the default filename', () => {
    render(<SourceAnalyzer />);

    expect(screen.getByRole('textbox', { name: /filename/i })).toHaveValue(
      'routes.ts',
    );
    expect(
      (screen.getByLabelText('Source code') as HTMLTextAreaElement).value,
    ).toContain("router.get('/users'");
    expect(
      screen.getByRole('button', { name: 'Analyze source' }),
    ).toBeEnabled();
  });

  it('does not send whitespace-only source code', async () => {
    const user = userEvent.setup();
    render(<SourceAnalyzer />);

    const sourceInput = screen.getByLabelText('Source code');
    await user.clear(sourceInput);
    await user.type(sourceInput, '   ');
    await user.click(screen.getByRole('button', { name: 'Analyze source' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter Express route source code before analyzing.',
    );
    expect(mockedAnalyzeSource).not.toHaveBeenCalled();
  });

  it('shows loading and renders extracted route details', async () => {
    const user = userEvent.setup();
    let resolveRequest: ((value: AnalyzeSourceResponse) => void) | undefined;
    mockedAnalyzeSource.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(<SourceAnalyzer />);

    await user.click(screen.getByRole('button', { name: 'Analyze source' }));

    expect(
      screen.getByRole('button', { name: 'Analyzing source' }),
    ).toBeDisabled();
    expect(screen.getByText('Analyzing source code…')).toBeInTheDocument();

    await act(async () => {
      resolveRequest?.({
        routes: [
          {
            method: 'GET',
            path: '/users',
            middleware: ['authMiddleware'],
            handler: 'getUsers',
          },
        ],
        count: 1,
      });
    });

    expect(await screen.findByText('1 route found')).toBeInTheDocument();
    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.getByText('authMiddleware')).toBeInTheDocument();
    expect(screen.getByText('getUsers')).toBeInTheDocument();
  });

  it('trims the filename, defaults an empty value, and shows empty results', async () => {
    const user = userEvent.setup();
    mockedAnalyzeSource.mockResolvedValue({
      routes: [],
      count: 0,
    });
    render(<SourceAnalyzer />);

    const filenameInput = screen.getByRole('textbox', { name: /filename/i });
    await user.clear(filenameInput);
    await user.type(filenameInput, '   ');
    await user.click(screen.getByRole('button', { name: 'Analyze source' }));

    await waitFor(() => {
      expect(mockedAnalyzeSource).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'routes.ts',
        }),
      );
    });
    expect(filenameInput).toHaveValue('routes.ts');
    expect(
      await screen.findByText('No supported Express routes found'),
    ).toBeInTheDocument();
    expect(screen.getByText('0 routes found')).toBeInTheDocument();
  });

  it('shows API errors without discarding the editable source', async () => {
    const user = userEvent.setup();
    mockedAnalyzeSource.mockRejectedValue(
      new Error('Unable to reach the DocPilot API.'),
    );
    render(<SourceAnalyzer />);

    const sourceInput = screen.getByLabelText('Source code');
    const initialSource = (sourceInput as HTMLTextAreaElement).value;

    await user.click(screen.getByRole('button', { name: 'Analyze source' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to reach the DocPilot API.',
    );
    expect(sourceInput).toHaveValue(initialSource);
  });
});
