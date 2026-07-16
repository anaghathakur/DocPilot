# DocPilot

DocPilot analyzes Node.js and TypeScript Express source code and returns structured API route information. The playground supports both pasted source code and multiple browser-selected project files.

The project does not include GitHub repository input, repository cloning, AI, authentication, persistence, or payments.

## Workspace structure

    apps/
      api/       Express API and source-analysis endpoints
      web/       Next.js Source and Project Analyzer Playground
    packages/
      parser/    AST-based Express route extraction library

The repository uses pnpm workspaces. TypeScript, ESLint, and Prettier configuration is shared from the workspace root.

## Prerequisites

- Node.js 20.19 or newer
- pnpm 11

## Install

    pnpm install

## Environment setup

The defaults work for local development. Copy the example files if you want explicit local configuration.

PowerShell:

    Copy-Item apps/api/.env.example apps/api/.env
    Copy-Item apps/web/.env.example apps/web/.env.local

macOS or Linux:

    cp apps/api/.env.example apps/api/.env
    cp apps/web/.env.example apps/web/.env.local

API variables:

- PORT defaults to 4000.
- WEB_ORIGIN defaults to http://localhost:3000 and controls the browser origin allowed by CORS.

Web variables:

- NEXT_PUBLIC_API_BASE_URL defaults to http://localhost:4000.

Restart a development server after changing its environment file.

## Run the complete workflow

Start the API in the first terminal:

    pnpm dev:api

Start the web application in a second terminal:

    pnpm dev:web

Open http://localhost:3000.

### Paste source

1. Keep **Paste source** selected.
2. Edit the prefilled Express example.
3. Select **Analyze source**.

The browser calls POST http://localhost:4000/analyze/source and displays the extracted routes.

### Upload project files

1. Select **Upload project files**.
2. Choose up to 100 .js, .jsx, .ts, or .tsx files.
3. Review the selected paths and sizes. Remove individual files or use **Clear all** if needed.
4. Select **Analyze project**.

Selected files remain in browser memory and are not read or sent until you analyze. The browser reads their text locally, calls POST http://localhost:4000/analyze/project, and displays combined routes, skipped files, and file-level syntax errors.

Use the HTTP method and search controls to filter the displayed routes without another API request. **Download JSON** saves the complete, unfiltered analysis as docpilot-analysis.json.

The API health check remains available at GET http://localhost:4000/health.

## Tests and quality checks

Run every workspace test suite:

    pnpm -r --if-present test

Run the shared quality checks:

    pnpm lint
    pnpm typecheck
    pnpm build
    pnpm format:check

Use pnpm format to apply Prettier formatting.
