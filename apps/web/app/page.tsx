import { AnalyzerPlayground } from '../components/analyzer-playground';

const capabilities = [
  'AST-powered analysis',
  'Public GitHub repositories',
  'OpenAPI JSON and YAML',
  'Extensively tested',
];

export default function Home() {
  return (
    <div className="min-h-screen text-slate-100">
      <header className="border-b border-slate-800/90 bg-[#050914]/90">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <a
            href="#analyzer"
            className="group inline-flex w-fit items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#050914]"
          >
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 font-mono text-sm font-bold text-cyan-300"
            >
              DP
            </span>
            <span>
              <span className="block text-base font-bold tracking-tight text-white">
                DocPilot
              </span>
              <span className="block text-xs text-slate-400">
                Express documentation, on autopilot
              </span>
            </span>
          </a>

          <span className="w-fit rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            OpenAPI 3.1
          </span>
        </div>
      </header>

      <main>
        <div className="mx-auto max-w-[90rem] px-4 pb-14 pt-10 sm:px-6 sm:pt-12 lg:px-8">
          <section aria-labelledby="hero-heading" className="max-w-5xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Source to specification
            </p>
            <h1
              id="hero-heading"
              className="mt-3 max-w-4xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl"
            >
              Turn Express code into production-ready API documentation
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
              Analyze source code, browser-selected project files, or a public
              GitHub repository. Review every detected route, then export a
              deterministic OpenAPI document in JSON or YAML.
            </p>
            <ul
              aria-label="DocPilot capabilities"
              className="mt-5 flex flex-wrap gap-2.5 text-xs font-medium text-slate-300 sm:text-sm"
            >
              {capabilities.map((capability) => (
                <li
                  key={capability}
                  className="rounded-full border border-slate-700/90 bg-slate-900/70 px-3 py-1.5"
                >
                  <span aria-hidden="true" className="mr-2 text-cyan-300">
                    ✓
                  </span>
                  {capability}
                </li>
              ))}
            </ul>
          </section>

          <section
            id="analyzer"
            aria-labelledby="analyzer-heading"
            className="mt-9 scroll-mt-6"
          >
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                  Analyzer workspace
                </p>
                <h2
                  id="analyzer-heading"
                  className="mt-1 text-xl font-bold text-white sm:text-2xl"
                >
                  Choose how to analyze your project
                </h2>
              </div>
              <p className="text-sm text-slate-400">
                JavaScript · JSX · TypeScript · TSX
              </p>
            </div>
            <AnalyzerPlayground />
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-800/90 bg-[#050914]">
        <div className="mx-auto max-w-[90rem] px-4 py-8 text-sm sm:px-6 lg:px-8">
          <div>
            <p className="font-semibold text-slate-200">DocPilot</p>
            <p className="mt-1 max-w-xl leading-6 text-slate-400">
              AST-powered Express route analysis and standards-based OpenAPI
              documentation for JavaScript and TypeScript projects.
            </p>
            <p className="mt-2 font-mono text-xs text-slate-500">
              Express · TypeScript · OpenAPI 3.1
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
