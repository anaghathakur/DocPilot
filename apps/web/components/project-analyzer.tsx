'use client';

import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { OpenApiPanel } from './openapi-panel';

import {
  analyzeProject,
  type AnalyzeProjectFile,
  type AnalyzeProjectResponse,
  type ProjectRoute,
} from '../lib/analyze-project';
import type { ExpressHttpMethod } from '../lib/api-client';

const maximumFiles = 100;
const supportedFileExtension = /\.(?:js|jsx|ts|tsx)$/i;
const methodFilters = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type MethodFilter = (typeof methodFilters)[number];

interface SelectedProjectFile {
  file: File;
  filePath: string;
}

const methodStyles: Record<ExpressHttpMethod, string> = {
  GET: 'bg-cyan-400/10 text-cyan-200 ring-cyan-400/30',
  POST: 'bg-blue-400/15 text-blue-200 ring-blue-400/30',
  PUT: 'bg-amber-400/10 text-amber-200 ring-amber-400/30',
  PATCH: 'bg-amber-400/10 text-amber-200 ring-amber-400/30',
  DELETE: 'bg-red-400/10 text-red-200 ring-red-400/30',
};

export function ProjectAnalyzer() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedProjectFile[]>([]);
  const [selectionMessages, setSelectionMessages] = useState<string[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeProjectResponse | null>(null);
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const filteredRoutes = useMemo(() => {
    if (result === null) {
      return [];
    }

    const query = searchQuery.trim().toLowerCase();

    return result.routes.filter((route) => {
      if (methodFilter !== 'ALL' && route.method !== methodFilter) {
        return false;
      }

      if (query.length === 0) {
        return true;
      }

      return [
        route.path,
        route.handler,
        route.middleware.join(' '),
        route.filePath,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [methodFilter, result, searchQuery]);

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.currentTarget.files ?? []);
    const knownPaths = new Set(selectedFiles.map((file) => file.filePath));
    const acceptedFiles: SelectedProjectFile[] = [];
    const messages: string[] = [];

    for (const file of incomingFiles) {
      const filePath = getProjectFilePath(file);

      if (!supportedFileExtension.test(filePath)) {
        messages.push(
          '"' +
            filePath +
            '" has an unsupported extension. Select .js, .jsx, .ts, or .tsx files.',
        );
        continue;
      }

      if (file.size === 0) {
        messages.push('"' + filePath + '" is empty and was not selected.');
        continue;
      }

      if (knownPaths.has(filePath)) {
        messages.push(
          '"' +
            filePath +
            '" is already selected. Duplicate paths are not allowed.',
        );
        continue;
      }

      knownPaths.add(filePath);
      acceptedFiles.push({ file, filePath });
    }

    if (selectedFiles.length + acceptedFiles.length > maximumFiles) {
      messages.push(
        'A project can contain at most 100 files. No files from this selection were added.',
      );
      acceptedFiles.length = 0;
    }

    if (acceptedFiles.length > 0) {
      setSelectedFiles((currentFiles) => [...currentFiles, ...acceptedFiles]);
      resetAnalysis();
    }

    setSelectionMessages(messages);
    event.currentTarget.value = '';
  }

  function removeFile(filePath: string) {
    setSelectedFiles((files) =>
      files.filter((file) => file.filePath !== filePath),
    );
    setSelectionMessages([]);
    resetAnalysis();
  }

  function clearFiles() {
    setSelectedFiles([]);
    setSelectionMessages([]);
    setRequestError(null);
    setResult(null);
    setMethodFilter('ALL');
    setSearchQuery('');

    if (fileInputRef.current !== null) {
      fileInputRef.current.value = '';
    }
  }

  function resetAnalysis() {
    setRequestError(null);
    setResult(null);
    setMethodFilter('ALL');
    setSearchQuery('');
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedFiles.length === 0) {
      setRequestError('Select at least one project file before analyzing.');
      return;
    }

    setSelectionMessages([]);
    setRequestError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const files = await Promise.all(selectedFiles.map(readProjectFile));
      const nextResult = await analyzeProject({ files });
      setResult(nextResult);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Unable to analyze the selected project files. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  function downloadResult() {
    if (result === null) {
      return;
    }

    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = objectUrl;
    link.download = 'docpilot-analysis.json';

    try {
      document.body.append(link);
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(objectUrl);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.22fr)]">
        <section
          aria-labelledby="project-files-heading"
          className="rounded-2xl border border-slate-700/80 bg-[#0a1220] p-5 shadow-xl shadow-black/10 sm:p-6"
        >
          <div>
            <h2
              id="project-files-heading"
              className="text-lg font-semibold text-white"
            >
              Project files
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Select up to 100 Express JavaScript or TypeScript files. Files are
              read only when you analyze.
            </p>
          </div>

          <form className="mt-5 space-y-5" onSubmit={handleAnalyze}>
            <div>
              <label
                htmlFor="project-files"
                className="block text-sm font-medium text-slate-200"
              >
                Choose project files
              </label>
              <input
                ref={fileInputRef}
                id="project-files"
                type="file"
                multiple
                accept=".js,.jsx,.ts,.tsx"
                onChange={handleFileSelection}
                aria-describedby="project-files-help"
                className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-950/70 text-sm text-slate-300 file:mr-3 file:border-0 file:border-r file:border-slate-600 file:bg-slate-800 file:px-3 file:py-2.5 file:font-semibold file:text-slate-200 hover:file:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
              <p
                id="project-files-help"
                className="mt-1.5 text-xs text-slate-400"
              >
                Selecting files does not send them to the API.
              </p>
            </div>

            {selectionMessages.length > 0 ? (
              <div
                role="alert"
                className="rounded-lg border border-amber-400/40 bg-amber-950/55 px-4 py-3 text-sm text-amber-100"
              >
                <p className="font-medium">Some files were not added:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {selectionMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-lg border border-slate-700/80">
              <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 px-4 py-3">
                <p className="text-sm font-medium text-slate-200">
                  {selectedFiles.length === 1
                    ? '1 file selected'
                    : String(selectedFiles.length) + ' files selected'}
                </p>
                <button
                  type="button"
                  onClick={clearFiles}
                  disabled={selectedFiles.length === 0}
                  className="text-sm font-semibold text-slate-400 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:text-slate-600"
                >
                  Clear all
                </button>
              </div>

              {selectedFiles.length === 0 ? (
                <p className="px-4 py-7 text-center text-sm text-slate-400">
                  No project files selected
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-slate-700/80 overflow-y-auto">
                  {selectedFiles.map(({ file, filePath }) => (
                    <li
                      key={filePath}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-medium text-slate-200"
                          title={filePath}
                        >
                          {filePath}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(filePath)}
                        aria-label={'Remove ' + filePath}
                        className="shrink-0 rounded-md border border-slate-600 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {requestError !== null ? (
              <div
                role="alert"
                className="rounded-lg border border-red-400/40 bg-red-950/60 px-4 py-3 text-sm text-red-100"
              >
                {requestError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading || selectedFiles.length === 0}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white outline-none hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1220] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:w-auto"
            >
              {isLoading ? 'Analyzing project' : 'Analyze project'}
            </button>
          </form>
        </section>

        <ProjectResults
          result={result}
          filteredRoutes={filteredRoutes}
          isLoading={isLoading}
          methodFilter={methodFilter}
          searchQuery={searchQuery}
          onMethodFilterChange={setMethodFilter}
          onSearchQueryChange={setSearchQuery}
          onDownload={downloadResult}
        />
      </div>
      {result !== null ? (
        <OpenApiPanel routes={result.routes} idPrefix="project" />
      ) : null}
    </div>
  );
}

export interface ProjectResultsProps {
  result: AnalyzeProjectResponse | null;
  filteredRoutes: ProjectRoute[];
  isLoading: boolean;
  methodFilter: MethodFilter;
  searchQuery: string;
  onMethodFilterChange: (method: MethodFilter) => void;
  onSearchQueryChange: (query: string) => void;
  onDownload: () => void;
  idPrefix?: string;
  heading?: string;
  description?: string;
  loadingMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ProjectResults({
  result,
  filteredRoutes,
  isLoading,
  methodFilter,
  searchQuery,
  onMethodFilterChange,
  onSearchQueryChange,
  onDownload,
  idPrefix = 'project',
  heading = 'Project results',
  description = 'Combined routes and file-level analysis details.',
  loadingMessage = 'Analyzing project files�',
  emptyTitle = 'No project analysis yet',
  emptyDescription = 'Select files and analyze them to see combined route details.',
}: ProjectResultsProps) {
  const resultLabel =
    result === null
      ? 'Not analyzed'
      : result.routeCount === 1
        ? '1 route found'
        : String(result.routeCount) + ' routes found';

  return (
    <section
      aria-labelledby={idPrefix + '-results-heading'}
      aria-busy={isLoading}
      className="rounded-2xl border border-slate-700/80 bg-[#0a1220] p-5 shadow-xl shadow-black/10 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-700/80 pb-4">
        <div>
          <h2
            id={idPrefix + '-results-heading'}
            className="text-lg font-semibold text-white"
          >
            {heading}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
            {resultLabel}
          </span>
          {result !== null ? (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex min-h-10 items-center rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              Download JSON
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5" aria-live="polite">
        {isLoading ? (
          <p className="text-sm text-slate-400">{loadingMessage}</p>
        ) : result === null ? (
          <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/60 px-5 py-8 text-center">
            <p className="text-sm font-medium text-slate-300">{emptyTitle}</p>
            <p className="mt-1 text-sm text-slate-400">{emptyDescription}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryValue label="Routes" value={result.routeCount} />
              <SummaryValue
                label="Files analyzed"
                value={result.filesAnalyzed}
              />
              <SummaryValue
                label="Files skipped"
                value={result.filesSkipped.length}
              />
              <SummaryValue label="File errors" value={result.errors.length} />
            </dl>

            {result.errors.length > 0 ? (
              <div className="rounded-xl border border-amber-400/40 bg-amber-950/55 px-4 py-3">
                <p className="text-sm font-semibold text-amber-100">
                  Analysis completed with file errors
                </p>
                <ul className="mt-2 space-y-2">
                  {result.errors.map((error) => (
                    <li key={error.filePath} className="text-sm text-amber-100">
                      <code className="font-semibold">{error.filePath}</code>
                      <span className="block mt-0.5">{error.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.filesSkipped.length > 0 ? (
              <div className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-4 py-3">
                <p className="text-sm font-semibold text-slate-200">
                  Skipped files
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-400">
                  {result.filesSkipped.map((filePath) => (
                    <li key={filePath}>
                      <code>{filePath}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.routeCount > 0 ? (
              <div className="grid gap-4 border-y border-slate-700/80 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <div>
                  <label
                    htmlFor={idPrefix + '-method-filter'}
                    className="block text-sm font-medium text-slate-200"
                  >
                    HTTP method
                  </label>
                  <select
                    id={idPrefix + '-method-filter'}
                    value={methodFilter}
                    onChange={(event) =>
                      onMethodFilterChange(event.target.value as MethodFilter)
                    }
                    className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  >
                    {methodFilters.map((method) => (
                      <option key={method} value={method}>
                        {method === 'ALL' ? 'All methods' : method}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={idPrefix + '-route-search'}
                    className="block text-sm font-medium text-slate-200"
                  >
                    Search routes
                  </label>
                  <input
                    id={idPrefix + '-route-search'}
                    type="search"
                    value={searchQuery}
                    onChange={(event) =>
                      onSearchQueryChange(event.target.value)
                    }
                    placeholder="Path, handler, middleware, or file"
                    className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  />
                </div>
              </div>
            ) : null}

            {result.routeCount === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/60 px-5 py-8 text-center">
                <p className="text-sm font-medium text-slate-300">
                  No supported Express routes found
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  The selected files were analyzed but contained no supported
                  routes.
                </p>
              </div>
            ) : filteredRoutes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/60 px-5 py-8 text-center">
                <p className="text-sm font-medium text-slate-300">
                  No routes match your filters
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Adjust the HTTP method or search query.
                </p>
              </div>
            ) : (
              <div>
                <p className="mb-3 text-xs font-medium text-slate-400">
                  Showing {filteredRoutes.length} of {result.routeCount} routes
                </p>
                <ol className="space-y-4">
                  {filteredRoutes.map((route, index) => (
                    <ProjectRouteCard
                      key={
                        route.filePath +
                        '-' +
                        route.method +
                        '-' +
                        route.path +
                        '-' +
                        String(index)
                      }
                      route={route}
                    />
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/45 px-3 py-3">
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-white">{value}</dd>
    </div>
  );
}

function ProjectRouteCard({ route }: { route: ProjectRoute }) {
  return (
    <li className="rounded-xl border border-slate-700/80 bg-slate-950/35 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            'rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ' +
            methodStyles[route.method]
          }
        >
          {route.method}
        </span>
        <code className="break-all text-sm font-semibold text-white">
          {route.path}
        </code>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-400">Middleware</dt>
          <dd className="mt-1 break-words font-mono text-slate-200">
            {route.middleware.length > 0 ? route.middleware.join(', ') : 'None'}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">Handler</dt>
          <dd
            title={route.handler}
            className="mt-1 line-clamp-2 break-all font-mono leading-6 text-slate-200"
          >
            {route.handler}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-slate-400">File</dt>
          <dd className="mt-1 break-all font-mono text-slate-200">
            {route.filePath}
          </dd>
        </div>
      </dl>
    </li>
  );
}

async function readProjectFile({
  file,
  filePath,
}: SelectedProjectFile): Promise<AnalyzeProjectFile> {
  let sourceCode: string;

  try {
    sourceCode = await file.text();
  } catch {
    throw new Error(
      'Unable to read "' + filePath + '". No project request was sent.',
    );
  }

  if (sourceCode.trim().length === 0) {
    throw new Error(
      '"' + filePath + '" is empty. No project request was sent.',
    );
  }

  return {
    filePath,
    sourceCode,
  };
}

function getProjectFilePath(file: File): string {
  return file.webkitRelativePath || file.name;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return String(bytes) + ' B';
  }

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
