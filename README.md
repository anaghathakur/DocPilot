# DocPilot

DocPilot is an early-stage platform for generating API documentation from GitHub repositories. The MVP will support repositories containing Node.js and Express applications.

This repository currently contains only the project foundation. It does not include repository parsing, documentation generation, AI integration, authentication, persistence, or product UI.

## Workspace structure

    apps/
      api/       Minimal Express API service
      web/       Minimal Next.js application
    packages/
      parser/    Reusable TypeScript parser package (empty foundation)

The repository uses pnpm workspaces. TypeScript, ESLint, and Prettier configuration is shared from the workspace root.

## Prerequisites

- Node.js 20.9 or newer
- pnpm 11

## Install

    pnpm install

## Run locally

Start the web application at http://localhost:3000:

    pnpm dev:web

Start the API at http://localhost:4000:

    pnpm dev:api

Verify the API with GET http://localhost:4000/health.

## Quality commands

    pnpm lint
    pnpm typecheck
    pnpm build
    pnpm format:check

Use pnpm format to apply Prettier formatting.
