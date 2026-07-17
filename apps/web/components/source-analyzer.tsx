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
  GET: 'bg-cyan-400/10 text-cyan-200 ring-cyan-400/30',
  POST: 'bg-blue-400/15 text-blue-200 ring-blue-400/30',
  PUT: 'bg-amber-400/10 text-amber-200 ring-amber-400/30',
  PATCH: 'bg-amber-400/10 text-amber-200 ring-amber-400/30',
  DELETE: 'bg-red-400/10 text-red-200 ring-red-400/30',
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
          className="rounded-2xl border border-slate-700/80 bg-[#0a1220] p-5 shadow-xl shadow-black/10 sm:p-6"
        >
          <div className="mb-5">
            <h2
              id="source-heading"
              className="text-lg font-semibold text-white"
            >
              Express source
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Paste JavaScript or TypeScript that declares routes on an Express
              app or router.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="filename"
                className="block text-sm font-medium text-slate-200"
              >
                Filename
                <span className="ml-1 font-normal text-slate-400">
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
                className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />
              <p id="filename-help" className="mt-1.5 text-xs text-slate-400">
                Used to determine whether the source is JavaScript or
                TypeScript.
              </p>
            </div>

            <div>
              <label
                htmlFor="source-code"
                className="block text-sm font-medium text-slate-200"
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
                className="mt-2 w-full resize-y rounded-lg border border-slate-600 bg-slate-950 px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/25"
              />
              <p id="source-help" className="mt-1.5 text-xs text-slate-400">
                String-literal paths on app or router methods are supported.
              </p>
            </div>

            {error !== null ? (
              <div
                role="alert"
                className="rounded-lg border border-red-400/40 bg-red-950/60 px-4 py-3 text-sm text-red-100"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white outline-none hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1220] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:w-auto"
            >
              {isLoading ? 'Analyzing source' : 'Analyze source'}
            </button>
          </form>
        </section>

        <section
          aria-labelledby="results-heading"
          aria-busy={isLoading}
          className="rounded-2xl border border-slate-700/80 bg-[#0a1220] p-5 shadow-xl shadow-black/10 sm:p-6"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-700/80 pb-4">
            <div>
              <h2
                id="results-heading"
                className="text-lg font-semibold text-white"
              >
                Extracted routes
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Structured output from the Express parser.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
              {resultLabel}
            </span>
          </div>

          <div className="mt-5" aria-live="polite">
            {isLoading ? (
              <p className="text-sm text-slate-400">Analyzing source code…</p>
            ) : result === null ? (
              <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/60 px-5 py-8 text-center">
                <p className="text-sm font-medium text-slate-300">
                  No analysis yet
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Submit the example to see extracted route details.
                </p>
              </div>
            ) : result.count === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/60 px-5 py-8 text-center">
                <p className="text-sm font-medium text-slate-300">
                  No supported Express routes found
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Check that route paths are string literals on app or router.
                </p>
              </div>
            ) : (
              <ol className="space-y-4">
                {result.routes.map((route, index) => (
                  <li
                    key={route.method + '-' + route.path + '-' + String(index)}
                    className="rounded-xl border border-slate-700/80 bg-slate-950/35 p-4"
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
                      <code className="break-all text-sm font-semibold text-white">
                        {route.path}
                      </code>
                    </div>

                    <dl className="mt-4 grid gap-3 text-sm">
                      <div>
                        <dt className="font-medium text-slate-400">
                          Middleware
                        </dt>
                        <dd className="mt-1 break-words font-mono text-slate-200">
                          {route.middleware.length > 0
                            ? route.middleware.join(', ')
                            : 'None'}
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
