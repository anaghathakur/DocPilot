'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import { OpenApiPanel } from './openapi-panel';

import {
  analyzeSource,
  type AnalyzeSourceResponse,
  type ExpressHttpMethod,
} from '../lib/analyze-source';

const exampleSource = [
  "import { Router } from 'express';",
  '',
  'const router = Router();',
  '',
  "router.get('/users', authMiddleware, getUsers);",
  "router.post('/users', validateUser, createUser);",
].join('\n');

const methodStyles: Record<ExpressHttpMethod, string> = {
  GET: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  POST: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  PUT: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PATCH: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  DELETE: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

export function SourceAnalyzer() {
  const [sourceCode, setSourceCode] = useState(exampleSource);
  const [filename, setFilename] = useState('routes.ts');
  const [result, setResult] = useState<AnalyzeSourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (sourceCode.trim().length === 0) {
      setResult(null);
      setError('Enter Express route source code before analyzing.');
      return;
    }

    const normalizedFilename = filename.trim() || 'routes.ts';

    setFilename(normalizedFilename);
    setResult(null);
    setError(null);
    setIsLoading(true);

    try {
      const nextResult = await analyzeSource({
        sourceCode,
        filename: normalizedFilename,
      });
      setResult(nextResult);
    } catch (requestError) {
      setResult(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to analyze the source code. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  const resultLabel =
    result === null
      ? 'Not analyzed'
      : result.count === 1
        ? '1 route found'
        : String(result.count) + ' routes found';

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <section
          aria-labelledby="source-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="mb-5">
            <h2
              id="source-heading"
              className="text-lg font-semibold text-slate-950"
            >
              Express source
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Paste JavaScript or TypeScript that declares routes on an Express
              app or router.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="filename"
                className="block text-sm font-medium text-slate-800"
              >
                Filename
                <span className="ml-1 font-normal text-slate-500">
                  (optional)
                </span>
              </label>
              <input
                id="filename"
                name="filename"
                type="text"
                value={filename}
                onChange={(event) => setFilename(event.target.value)}
                aria-describedby="filename-help"
                autoComplete="off"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
              <p id="filename-help" className="mt-1.5 text-xs text-slate-500">
                Used to determine whether the source is JavaScript or
                TypeScript.
              </p>
            </div>

            <div>
              <label
                htmlFor="source-code"
                className="block text-sm font-medium text-slate-800"
              >
                Source code
              </label>
              <textarea
                id="source-code"
                name="sourceCode"
                value={sourceCode}
                onChange={(event) => setSourceCode(event.target.value)}
                aria-describedby="source-help"
                rows={18}
                spellCheck={false}
                className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-slate-950 px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              />
              <p id="source-help" className="mt-1.5 text-xs text-slate-500">
                String-literal paths on app or router methods are supported.
              </p>
            </div>

            {error !== null ? (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white outline-none hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400 sm:w-auto"
            >
              {isLoading ? 'Analyzing source' : 'Analyze source'}
            </button>
          </form>
        </section>

        <section
          aria-labelledby="results-heading"
          aria-busy={isLoading}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2
                id="results-heading"
                className="text-lg font-semibold text-slate-950"
              >
                Extracted routes
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Structured output from the Express parser.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {resultLabel}
            </span>
          </div>

          <div className="mt-5" aria-live="polite">
            {isLoading ? (
              <p className="text-sm text-slate-600">Analyzing source code…</p>
            ) : result === null ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No analysis yet
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Submit the example to see extracted route details.
                </p>
              </div>
            ) : result.count === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No supported Express routes found
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Check that route paths are string literals on app or router.
                </p>
              </div>
            ) : (
              <ol className="space-y-4">
                {result.routes.map((route, index) => (
                  <li
                    key={route.method + '-' + route.path + '-' + String(index)}
                    className="rounded-lg border border-slate-200 p-4"
                  >
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

                    <dl className="mt-4 grid gap-3 text-sm">
                      <div>
                        <dt className="font-medium text-slate-500">
                          Middleware
                        </dt>
                        <dd className="mt-1 break-words font-mono text-slate-800">
                          {route.middleware.length > 0
                            ? route.middleware.join(', ')
                            : 'None'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Handler</dt>
                        <dd className="mt-1 break-words font-mono text-slate-800">
                          {route.handler}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
      {result !== null ? (
        <OpenApiPanel routes={result.routes} idPrefix="source" />
      ) : null}
    </div>
  );
}
