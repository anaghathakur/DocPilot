import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AnalyzerPlayground } from '../components/analyzer-playground';

describe('AnalyzerPlayground', () => {
  it('keeps all analyzer modes accessible without discarding pasted source', async () => {
    const user = userEvent.setup();
    render(<AnalyzerPlayground />);

    const sourceMode = screen.getByRole('radio', { name: 'Paste source' });
    const projectMode = screen.getByRole('radio', {
      name: 'Upload project files',
    });
    const githubMode = screen.getByRole('radio', {
      name: 'GitHub repository',
    });

    expect(sourceMode).toBeChecked();
    expect(sourceMode).toHaveAttribute(
      'aria-controls',
      'source-analyzer-panel',
    );
    expect(projectMode).toHaveAttribute(
      'aria-controls',
      'project-analyzer-panel',
    );
    expect(githubMode).toHaveAttribute(
      'aria-controls',
      'github-analyzer-panel',
    );

    const sourceInput = screen.getByLabelText('Source code');
    await user.clear(sourceInput);
    await user.type(sourceInput, "app.get('/status', statusHandler);");

    await user.click(projectMode);
    expect(projectMode).toBeChecked();
    expect(screen.getByLabelText('Choose project files')).toBeVisible();

    await user.click(githubMode);
    expect(githubMode).toBeChecked();
    expect(screen.getByLabelText('Repository URL')).toBeVisible();

    await user.click(sourceMode);
    expect(screen.getByLabelText('Source code')).toHaveValue(
      "app.get('/status', statusHandler);",
    );
  });
});
