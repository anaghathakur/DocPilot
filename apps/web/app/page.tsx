import { SourceAnalyzer } from '../components/source-analyzer';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
            Source Analyzer Playground
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            DocPilot
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            Paste Express route code and turn it into clear, structured API
            route data.
          </p>
        </header>

        <SourceAnalyzer />

        <footer className="mt-8 text-sm text-slate-500">
          Supports JavaScript and TypeScript routes declared on Express app and
          router instances.
        </footer>
      </div>
    </main>
  );
}
