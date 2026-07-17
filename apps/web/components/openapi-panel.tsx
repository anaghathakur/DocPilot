'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import {
  countOpenApiOperations,
  generateOpenApi,
  listOpenApiOperations,
  type GenerateOpenApiResponse,
  type OpenApiRouteInput,
} from '../lib/generate-openapi';

const defaultTitle = 'DocPilot Generated API';
const defaultVersion = '1.0.0';

interface OpenApiPanelProps {
  routes: OpenApiRouteInput[];
  idPrefix: 'source' | 'project' | 'github';
}

export function OpenApiPanel({ routes, idPrefix }: OpenApiPanelProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [version, setVersion] = useState(defaultVersion);
  const [serverUrl, setServerUrl] = useState('');
  const [result, setResult] = useState<GenerateOpenApiResponse | null>(null);
  const [previewFormat, setPreviewFormat] = useState<'json' | 'yaml'>('json');
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (routes.length === 0) {
      setError('At least one extracted route is required to generate OpenAPI.');
      return;
    }

    const normalizedServerUrl = serverUrl.trim();

    if (normalizedServerUrl.length > 0) {
      let parsedServerUrl: URL;

      try {
        parsedServerUrl = new URL(normalizedServerUrl);
      } catch {
        setError('Server URL must be a valid HTTP or HTTPS URL.');
        return;
      }

      if (
        parsedServerUrl.protocol !== 'http:' &&
        parsedServerUrl.protocol !== 'https:'
      ) {
        setError('Server URL must be a valid HTTP or HTTPS URL.');
        return;
      }
    }

    setError(null);
    setActionFeedback(null);
    setResult(null);
    setIsLoading(true);

    try {
      setResult(
        await generateOpenApi({
          routes,
          title: title.trim(),
          version: version.trim(),
          ...(normalizedServerUrl.length === 0
            ? {}
            : { serverUrl: normalizedServerUrl }),
        }),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to generate OpenAPI documentation. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyOutput(format: 'json' | 'yaml') {
    if (result === null) {
      return;
    }

    try {
      if (navigator.clipboard === undefined) {
        throw new Error('Clipboard is unavailable');
      }

      await navigator.clipboard.writeText(result[format]);
      setActionFeedback(
        (format === 'json' ? 'JSON' : 'YAML') + ' copied to clipboard.',
      );
    } catch {
      setActionFeedback(
        'Unable to copy ' +
          (format === 'json' ? 'JSON' : 'YAML') +
          '. Select the preview and copy it manually.',
      );
    }
  }

  function downloadOutput(format: 'json' | 'yaml') {
    if (result === null) {
      return;
    }

    const blob = new Blob([result[format]], {
      type:
        format === 'json'
          ? 'application/json;charset=utf-8'
          : 'application/yaml;charset=utf-8',
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = objectUrl;
    link.download = format === 'json' ? 'openapi.json' : 'openapi.yaml';

    try {
      document.body.append(link);
      link.click();
      setActionFeedback(
        (format === 'json' ? 'JSON' : 'YAML') + ' download started.',
      );
    } finally {
      link.remove();
      URL.revokeObjectURL(objectUrl);
    }
  }

  const operations =
    result === null ? [] : listOpenApiOperations(result.document);
  const preview = result?.[previewFormat] ?? '';

  return (
    <section
      aria-labelledby={idPrefix + '-openapi-heading'}
      className="rounded-2xl border border-slate-700/80 bg-[#0a1220] p-5 shadow-xl shadow-black/10 sm:p-6"
    >
      <div className="border-b border-slate-700/80 pb-4">
        <h2
          id={idPrefix + '-openapi-heading'}
          className="text-lg font-semibold text-white"
        >
          OpenAPI documentation
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Generate an OpenAPI 3.1 document from the extracted routes. No source
          code is parsed again.
        </p>
      </div>

      <form
        className="mt-5 grid gap-4 md:grid-cols-3"
        onSubmit={handleGenerate}
      >
        <div>
          <label
            htmlFor={idPrefix + '-openapi-title'}
            className="block text-sm font-medium text-slate-200"
          >
            API title
          </label>
          <input
            id={idPrefix + '-openapi-title'}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          />
        </div>
        <div>
          <label
            htmlFor={idPrefix + '-openapi-version'}
            className="block text-sm font-medium text-slate-200"
          >
            API version
          </label>
          <input
            id={idPrefix + '-openapi-version'}
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            maxLength={100}
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          />
        </div>
        <div>
          <label
            htmlFor={idPrefix + '-openapi-server'}
            className="block text-sm font-medium text-slate-200"
          >
            Server URL
            <span className="ml-1 font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id={idPrefix + '-openapi-server'}
            type="url"
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
            placeholder="https://api.example.com"
            maxLength={2048}
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          />
        </div>

        <div className="md:col-span-3">
          {routes.length === 0 ? (
            <p className="mb-3 text-sm font-medium text-amber-200">
              No extracted routes are available for generation.
            </p>
          ) : null}
          {error !== null ? (
            <div
              role="alert"
              className="mb-3 rounded-lg border border-red-400/40 bg-red-950/60 px-4 py-3 text-sm text-red-100"
            >
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={isLoading || routes.length === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white outline-none hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1220] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {isLoading ? 'Generating OpenAPI' : 'Generate OpenAPI'}
          </button>
        </div>
      </form>

      <div className="mt-6" aria-live="polite" aria-busy={isLoading}>
        {isLoading ? (
          <p className="text-sm text-slate-400">
            Generating OpenAPI documentation�
          </p>
        ) : result === null ? (
          <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/60 px-5 py-7 text-center">
            <p className="text-sm font-medium text-slate-300">
              No OpenAPI document generated
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Review the metadata and select Generate OpenAPI.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-3">
              <SummaryValue label="OpenAPI" value={result.document.openapi} />
              <SummaryValue
                label="Endpoints"
                value={String(countOpenApiOperations(result.document))}
              />
              <SummaryValue
                label="Warnings"
                value={String(result.warnings.length)}
              />
            </dl>

            {result.warnings.length > 0 ? (
              <div className="rounded-xl border border-amber-400/40 bg-amber-950/55 px-4 py-3">
                <p className="text-sm font-semibold text-amber-100">
                  Generation warnings
                </p>
                <ul className="mt-2 space-y-2">
                  {result.warnings.map((warning, index) => (
                    <li
                      key={warning.code + '-' + String(index)}
                      className="text-sm text-amber-100"
                    >
                      <span className="font-semibold">
                        {warning.code === 'DUPLICATE_OPERATION'
                          ? 'Duplicate operation'
                          : 'Unsupported path'}
                        :
                      </span>{' '}
                      {warning.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Endpoint overview
              </h3>
              {operations.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">
                  No routes could be represented safely in OpenAPI.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-700/80 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/30">
                  {operations.map((operation) => (
                    <li
                      key={operation.method + '-' + operation.path}
                      className="grid gap-1 px-4 py-3 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(8rem,0.7fr)] sm:items-center sm:gap-3"
                    >
                      <span className="w-fit rounded-md bg-blue-400/15 px-2 py-1 text-xs font-bold text-blue-200">
                        {operation.method}
                      </span>
                      <code className="break-all text-sm font-semibold text-slate-100">
                        {operation.path}
                      </code>
                      <span
                        title={operation.summary}
                        className="truncate text-sm text-slate-400"
                      >
                        {operation.summary}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <fieldset>
                  <legend className="text-sm font-semibold text-slate-100">
                    Preview format
                  </legend>
                  <div className="mt-2 inline-flex rounded-xl border border-slate-600 bg-slate-950/60 p-1">
                    {(['json', 'yaml'] as const).map((format) => (
                      <label
                        key={format}
                        className={
                          'cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold focus-within:ring-2 focus-within:ring-cyan-400 focus-within:ring-offset-2 focus-within:ring-offset-[#0a1220] ' +
                          (previewFormat === format
                            ? 'bg-blue-500/20 text-blue-100'
                            : 'text-slate-300')
                        }
                      >
                        <input
                          type="radio"
                          name={idPrefix + '-openapi-preview'}
                          value={format}
                          checked={previewFormat === format}
                          onChange={() => setPreviewFormat(format)}
                          className="sr-only"
                        />
                        {format.toUpperCase()}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-wrap gap-2">
                  <ActionButton onClick={() => void copyOutput('json')}>
                    Copy JSON
                  </ActionButton>
                  <ActionButton onClick={() => void copyOutput('yaml')}>
                    Copy YAML
                  </ActionButton>
                  <ActionButton onClick={() => downloadOutput('json')}>
                    Download JSON
                  </ActionButton>
                  <ActionButton onClick={() => downloadOutput('yaml')}>
                    Download YAML
                  </ActionButton>
                </div>
              </div>

              <pre
                tabIndex={0}
                aria-label={
                  previewFormat === 'json'
                    ? 'OpenAPI JSON preview'
                    : 'OpenAPI YAML preview'
                }
                className="mt-3 max-h-[34rem] overflow-auto rounded-xl border border-slate-700 bg-[#040812] p-4 shadow-inner text-xs leading-5 text-slate-100"
              >
                <code>{preview}</code>
              </pre>
              <p
                className="mt-2 min-h-5 text-sm text-slate-400"
                aria-live="polite"
              >
                {actionFeedback}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/45 px-3 py-3">
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-white">{value}</dd>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1220]"
    >
      {children}
    </button>
  );
}
