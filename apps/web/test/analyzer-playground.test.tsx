import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AnalyzerPlayground } from '../components/analyzer-playground';

describe('AnalyzerPlayground', () => {
  it('switches between both modes without discarding pasted source', async () => {
    const user = userEvent.setup();
    render(<AnalyzerPlayground />);

    const sourceInput = screen.getByLabelText('Source code');
    await user.clear(sourceInput);
    await user.type(sourceInput, "app.get('/status', statusHandler);");

    await user.click(
      screen.getByRole('radio', { name: 'Upload project files' }),
    );
    expect(screen.getByLabelText('Choose project files')).toBeVisible();

    await user.click(screen.getByRole('radio', { name: 'Paste source' }));
    expect(screen.getByLabelText('Source code')).toHaveValue(
      "app.get('/status', statusHandler);",
    );
  });
});
