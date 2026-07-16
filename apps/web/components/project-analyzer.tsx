'use client';

import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

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

type MethodFilter = (typeof methodFilters)[number];

interface SelectedProjectFile {
  file: File;
  filePath: string;
}

const methodStyles: Record<ExpressHttpMethod, string> = {
  GET: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  POST: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  PUT: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PATCH: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  DELETE: 'bg-rose-50 text-rose-700 ring-rose-600/20',
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
    <div className="grid gap-6 lg:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.22fr)]">
      <section
        aria-labelledby="project-files-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div>
          <h2
            id="project-files-heading"
            className="text-lg font-semibold text-slate-950"
          >
            Project files
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Select up to 100 Express JavaScript or TypeScript files. Files are
            read only when you analyze.
          </p>
        </div>

        <form className="mt-5 space-y-5" onSubmit={handleAnalyze}>
          <div>
            <label
              htmlFor="project-files"
              className="block text-sm font-medium text-slate-800"
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
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white text-sm text-slate-600 file:mr-3 file:border-0 file:border-r file:border-slate-300 file:bg-slate-100 file:px-3 file:py-2.5 file:font-semibold file:text-slate-800 hover:file:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
            <p
              id="project-files-help"
              className="mt-1.5 text-xs text-slate-500"
            >
              Selecting files does not send them to the API.
            </p>
          </div>

          {selectionMessages.length > 0 ? (
            <div
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <p className="font-medium">Some files were not added:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {selectionMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-medium text-slate-800">
                {selectedFiles.length === 1
                  ? '1 file selected'
                  : String(selectedFiles.length) + ' files selected'}
              </p>
              <button
                type="button"
                onClick={clearFiles}
                disabled={selectedFiles.length === 0}
                className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Clear all
              </button>
            </div>

            {selectedFiles.length === 0 ? (
              <p className="px-4 py-7 text-center text-sm text-slate-500">
                No project files selected
              </p>
            ) : (
              <ul className="max-h-72 divide-y divide-slate-200 overflow-y-auto">
                {selectedFiles.map(({ file, filePath }) => (
                  <li
                    key={filePath}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-medium text-slate-800"
                        title={filePath}
                      >
                        {filePath}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(filePath)}
                      aria-label={'Remove ' + filePath}
                      className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
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
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {requestError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading || selectedFiles.length === 0}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white outline-none hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400 sm:w-auto"
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
  );
}

interface ProjectResultsProps {
  result: AnalyzeProjectResponse | null;
  filteredRoutes: ProjectRoute[];
  isLoading: boolean;
  methodFilter: MethodFilter;
  searchQuery: string;
  onMethodFilterChange: (method: MethodFilter) => void;
  onSearchQueryChange: (query: string) => void;
  onDownload: () => void;
}

function ProjectResults({
  result,
  filteredRoutes,
  isLoading,
  methodFilter,
  searchQuery,
  onMethodFilterChange,
  onSearchQueryChange,
  onDownload,
}: ProjectResultsProps) {
  const resultLabel =
    result === null
      ? 'Not analyzed'
      : result.routeCount === 1
        ? '1 route found'
        : String(result.routeCount) + ' routes found';

  return (
    <section
      aria-labelledby="project-results-heading"
      aria-busy={isLoading}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2
            id="project-results-heading"
            className="text-lg font-semibold text-slate-950"
          >
            Project results
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Combined routes and file-level analysis details.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {resultLabel}
          </span>
          {result !== null ? (
            <button
              type="button"
              onClick={onDownload}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              Download JSON
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5" aria-live="polite">
        {isLoading ? (
          <p className="text-sm text-slate-600">Analyzing project files…</p>
        ) : result === null ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              No project analysis yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Select files and analyze them to see combined route details.
            </p>
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
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-950">
                  Analysis completed with file errors
                </p>
                <ul className="mt-2 space-y-2">
                  {result.errors.map((error) => (
                    <li key={error.filePath} className="text-sm text-amber-900">
                      <code className="font-semibold">{error.filePath}</code>
                      <span className="block mt-0.5">{error.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.filesSkipped.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">
                  Skipped files
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {result.filesSkipped.map((filePath) => (
                    <li key={filePath}>
                      <code>{filePath}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.routeCount > 0 ? (
              <div className="grid gap-4 border-y border-slate-200 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <div>
                  <label
                    htmlFor="method-filter"
                    className="block text-sm font-medium text-slate-800"
                  >
                    HTTP method
                  </label>
                  <select
                    id="method-filter"
                    value={methodFilter}
                    onChange={(event) =>
                      onMethodFilterChange(event.target.value as MethodFilter)
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
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
                    htmlFor="route-search"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Search routes
                  </label>
                  <input
                    id="route-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) =>
                      onSearchQueryChange(event.target.value)
                    }
                    placeholder="Path, handler, middleware, or file"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
              </div>
            ) : null}

            {result.routeCount === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No supported Express routes found
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  The selected files were analyzed but contained no supported
                  routes.
                </p>
              </div>
            ) : filteredRoutes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No routes match your filters
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Adjust the HTTP method or search query.
                </p>
              </div>
            ) : (
              <div>
                <p className="mb-3 text-xs font-medium text-slate-500">
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
    <div className="rounded-lg bg-slate-50 px-3 py-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function ProjectRouteCard({ route }: { route: ProjectRoute }) {
  return (
    <li className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            'rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ' +
            methodStyles[route.method]
          }
        >
          {route.method}
        </span>
        <code className="break-all text-sm font-semibold text-slate-950">
          {route.path}
        </code>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-500">Middleware</dt>
          <dd className="mt-1 break-words font-mono text-slate-800">
            {route.middleware.length > 0 ? route.middleware.join(', ') : 'None'}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Handler</dt>
          <dd className="mt-1 break-words font-mono text-slate-800">
            {route.handler}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-slate-500">File</dt>
          <dd className="mt-1 break-all font-mono text-slate-800">
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
