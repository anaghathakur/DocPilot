'use client';

import { useState } from 'react';

import { GitHubAnalyzer } from './github-analyzer';
import { ProjectAnalyzer } from './project-analyzer';
import { SourceAnalyzer } from './source-analyzer';

type AnalyzerMode = 'source' | 'project' | 'github';

const analyzerModes: Array<{
  label: string;
  value: AnalyzerMode;
}> = [
  { label: 'Paste source', value: 'source' },
  { label: 'Upload project files', value: 'project' },
  { label: 'GitHub repository', value: 'github' },
];

export function AnalyzerPlayground() {
  const [mode, setMode] = useState<AnalyzerMode>('source');

  return (
    <div className="space-y-6">
      <fieldset className="rounded-2xl border border-slate-700/80 bg-[#0a1220] p-2 shadow-xl shadow-black/10">
        <legend className="sr-only">Analysis mode</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {analyzerModes.map((option) => (
            <label
              key={option.value}
              className={
                'block min-h-11 cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-semibold outline-none transition-colors focus-within:ring-2 focus-within:ring-cyan-400 focus-within:ring-offset-2 focus-within:ring-offset-[#0a1220] ' +
                (mode === option.value
                  ? 'border-blue-400/60 bg-blue-500/15 text-white shadow-sm'
                  : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800/70 hover:text-slate-100')
              }
            >
              <input
                type="radio"
                name="analyzer-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                aria-controls={option.value + '-analyzer-panel'}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div
        id="source-analyzer-panel"
        className={mode === 'source' ? 'block' : 'hidden'}
      >
        <SourceAnalyzer />
      </div>
      <div
        id="project-analyzer-panel"
        className={mode === 'project' ? 'block' : 'hidden'}
      >
        <ProjectAnalyzer />
      </div>
      <div
        id="github-analyzer-panel"
        className={mode === 'github' ? 'block' : 'hidden'}
      >
        <GitHubAnalyzer />
      </div>
    </div>
  );
}
