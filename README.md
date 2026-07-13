# DocPilot

DocPilot analyzes Node.js and TypeScript Express source code and returns structured API route information. The current playground lets you paste route code, call the DocPilot API, and review extracted methods, paths, middleware, and handlers.

The project does not include GitHub repository input, repository cloning, AI, authentication, persistence, or payments.

## Workspace structure

    apps/
      api/       Express API and source-analysis endpoint
      web/       Next.js Source Analyzer Playground
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

Open http://localhost:3000, edit the prefilled Express example, and select **Analyze source**. The browser sends the code to POST http://localhost:4000/analyze/source and displays the extracted routes.

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
