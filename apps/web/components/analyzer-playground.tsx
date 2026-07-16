'use client';

import { useState } from 'react';

import { GitHubAnalyzer } from './github-analyzer';
import { ProjectAnalyzer } from './project-analyzer';
import { SourceAnalyzer } from './source-analyzer';

type AnalyzerMode = 'source' | 'project' | 'github';

export function AnalyzerPlayground() {
  const [mode, setMode] = useState<AnalyzerMode>('source');

  return (
    <div>
      <fieldset className="mb-6 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <legend className="sr-only">Analysis mode</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <ModeOption
            checked={mode === 'source'}
            label="Paste source"
            value="source"
            onChange={setMode}
          />
          <ModeOption
            checked={mode === 'project'}
            label="Upload project files"
            value="project"
            onChange={setMode}
          />
          <ModeOption
            checked={mode === 'github'}
            label="GitHub repository"
            value="github"
            onChange={setMode}
          />
        </div>
      </fieldset>

      <div hidden={mode !== 'source'}>
        <SourceAnalyzer />
      </div>
      <div hidden={mode !== 'project'}>
        <ProjectAnalyzer />
      </div>
      <div hidden={mode !== 'github'}>
        <GitHubAnalyzer />
      </div>
    </div>
  );
}

interface ModeOptionProps {
  checked: boolean;
  label: string;
  value: AnalyzerMode;
  onChange: (mode: AnalyzerMode) => void;
}

function ModeOption({ checked, label, value, onChange }: ModeOptionProps) {
  return (
    <label
      className={
        'cursor-pointer rounded-lg px-3 py-2.5 text-center text-sm font-semibold outline-none ring-offset-2 focus-within:ring-2 focus-within:ring-blue-700 ' +
        (checked
          ? 'bg-blue-700 text-white'
          : 'bg-slate-50 text-slate-700 hover:bg-slate-100')
      }
    >
      <input
        type="radio"
        name="analysis-mode"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {label}
    </label>
  );
}
