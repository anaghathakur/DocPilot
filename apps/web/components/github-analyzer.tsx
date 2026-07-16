'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { OpenApiPanel } from './openapi-panel';

import { ProjectResults, type MethodFilter } from './project-analyzer';
import {
  analyzeGitHub,
  validatePublicGitHubRepositoryUrl,
  type AnalyzeGitHubResponse,
} from '../lib/analyze-github';

export function GitHubAnalyzer() {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeGitHubResponse | null>(null);
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

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let normalizedUrl: string;

    try {
      normalizedUrl = validatePublicGitHubRepositoryUrl(repositoryUrl);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Enter a valid public GitHub repository URL.',
      );
      return;
    }

    setRequestError(null);
    setResult(null);
    setMethodFilter('ALL');
    setSearchQuery('');
    setIsLoading(true);

    try {
      setResult(await analyzeGitHub({ repositoryUrl: normalizedUrl }));
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Unable to analyze the GitHub repository. Please try again.',
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
    link.download = 'docpilot-github-analysis.json';

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
          aria-labelledby="github-repository-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h2
            id="github-repository-heading"
            className="text-lg font-semibold text-slate-950"
          >
            Public GitHub repository
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Analyze supported Express source files from a public github.com
            repository. Repository code is never executed.
          </p>

          <form className="mt-5 space-y-5" onSubmit={handleAnalyze}>
            <div>
              <label
                htmlFor="github-repository-url"
                className="block text-sm font-medium text-slate-800"
              >
                Repository URL
              </label>
              <input
                id="github-repository-url"
                type="url"
                value={repositoryUrl}
                onChange={(event) => setRepositoryUrl(event.target.value)}
                placeholder="https://github.com/owner/repository"
                autoComplete="url"
                spellCheck={false}
                aria-describedby="github-repository-help"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
              <p
                id="github-repository-help"
                className="mt-1.5 text-xs leading-5 text-slate-500"
              >
                Public repositories only. Private repositories and GitHub tokens
                are not supported.
              </p>
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
              disabled={isLoading}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white outline-none hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400 sm:w-auto"
            >
              {isLoading ? 'Analyzing repository' : 'Analyze repository'}
            </button>
          </form>
        </section>

        <div className="space-y-4">
          {result !== null ? (
            <section
              aria-label="Repository details"
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <dl className="grid gap-3 sm:grid-cols-3">
                <RepositoryValue
                  label="Repository"
                  value={result.repository.owner + '/' + result.repository.name}
                />
                <RepositoryValue
                  label="Owner"
                  value={result.repository.owner}
                />
                <RepositoryValue
                  label="Default branch"
                  value={result.repository.defaultBranch}
                />
              </dl>
            </section>
          ) : null}

          <ProjectResults
            result={result}
            filteredRoutes={filteredRoutes}
            isLoading={isLoading}
            methodFilter={methodFilter}
            searchQuery={searchQuery}
            onMethodFilterChange={setMethodFilter}
            onSearchQueryChange={setSearchQuery}
            onDownload={downloadResult}
            idPrefix="github"
            heading="Repository results"
            description="Combined routes and repository file-level analysis details."
            loadingMessage="Downloading and analyzing repository files�"
            emptyTitle="No repository analysis yet"
            emptyDescription="Enter a public GitHub repository URL to see detected routes."
          />
        </div>
      </div>
      {result !== null ? (
        <OpenApiPanel routes={result.routes} idPrefix="github" />
      ) : null}
    </div>
  );
}

function RepositoryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd
        className="mt-1 truncate text-sm font-semibold text-slate-900"
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
