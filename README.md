# DocPilot

DocPilot analyzes Node.js and TypeScript Express source code and returns structured API route information. The playground supports pasted source, browser-selected project files, and public GitHub repositories.

The MVP does not include AI, authentication, private-repository access, persistence, or payments.

## Workspace structure

    apps/
      api/       Express API and source-analysis endpoints
      web/       Next.js Source and Project Analyzer Playground
    packages/
      parser/    AST-based Express route extraction library
      openapi/   Framework-independent OpenAPI 3.1 generator

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

- `PORT` defaults to `4000`.
- `WEB_ORIGIN` defaults to `http://localhost:3000` and is the only browser origin granted CORS access.
- `GITHUB_METADATA_TIMEOUT_MS` defaults to 10 seconds.
- `GITHUB_ARCHIVE_TIMEOUT_MS` defaults to 30 seconds.
- `GITHUB_MAX_ARCHIVE_BYTES` defaults to 50 MiB compressed.
- `GITHUB_MAX_FILE_BYTES` defaults to 512 KiB per supported source file.
- `GITHUB_MAX_SOURCE_BYTES` defaults to 5 MiB across supported source files.
- `GITHUB_MAX_ARCHIVE_ENTRIES` defaults to 10,000 ZIP entries.

GitHub hosts and API versioning are fixed in server code rather than configurable download URLs. No GitHub token is required or accepted for this MVP.

Web variables:

- `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:4000`.

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

The browser calls `POST /analyze/source` and displays the extracted routes.

### Upload project files

1. Select **Upload project files**.
2. Choose up to 100 `.js`, `.jsx`, `.ts`, or `.tsx` files.
3. Review the selected paths and sizes. Remove individual files or use **Clear all** if needed.
4. Select **Analyze project**.

Selected files remain in browser memory and are not read or sent until you analyze. The browser reads their text locally, calls `POST /analyze/project`, and displays combined routes, skipped files, and file-level syntax errors.

### Analyze a public GitHub repository

1. Select **GitHub repository**.
2. Enter a public repository URL such as `https://github.com/owner/repository`.
3. Select **Analyze repository**.

The API obtains the repository's default branch from GitHub, downloads its ZIP archive through official GitHub endpoints, and reuses the multi-file parser. The result shows the repository, default branch, analyzed and skipped files, partial file errors, and detected routes.

You can also test the endpoint directly:

    curl -X POST http://localhost:4000/analyze/github -H "Content-Type: application/json" --data '{"repositoryUrl":"https://github.com/owner/repository"}'

GitHub analysis limitations:

- Public `github.com` repositories only; private repositories and tokens are unsupported.
- Anonymous GitHub API rate limits apply.
- Only `.js`, `.jsx`, `.ts`, and `.tsx` source files are analyzed.
- `node_modules`, `dist`, `build`, `coverage`, `.next`, `vendor`, declaration files, and minified files are ignored case-insensitively.
- At most 100 supported files are allowed. Repositories exceeding the file, source-size, archive-size, or entry limits return a clear error instead of a partial arbitrary subset.
- Repository code, package installation, and repository scripts are never executed.

All project-style results can be filtered by method or searched by path, handler, middleware, or file path without additional API requests. **Download JSON** saves the complete unfiltered response.

### Generate OpenAPI documentation

After any source, project-file, or GitHub analysis completes:

1. Keep the extracted route results visible and review them.
2. Edit the API title, version, and optional HTTP or HTTPS server URL.
3. Select **Generate OpenAPI**.
4. Review the endpoint overview and any duplicate or unsupported-path warnings.
5. Switch between the JSON and YAML previews, copy either format, or download openapi.json and openapi.yaml.

OpenAPI generation calls POST /generate/openapi with the structured route results. It does not parse source code or access the repository again.

You can test the endpoint directly:

    curl -X POST http://localhost:4000/generate/openapi -H "Content-Type: application/json" --data '{"routes":[{"method":"GET","path":"/users/:id","middleware":[],"handler":"getUserById"}],"title":"My API","version":"1.0.0"}'

The generator emits OpenAPI 3.1.0 with path parameters, deterministic operation IDs, one generic successful response, and DocPilot handler, middleware, and file extensions. It does not invent request bodies, schemas, authentication, tags, examples, or additional status codes. Duplicate operations keep the first route and return warnings. Wildcards, regular-expression parameters, and optional or repeating path modifiers are skipped with distinct warnings rather than producing invalid OpenAPI.

The API health check remains available at `GET http://localhost:4000/health`.

## API errors for GitHub analysis

`POST /analyze/github` uses stable public error codes:

- `400 INVALID_REPOSITORY_URL`
- `404 REPOSITORY_NOT_ACCESSIBLE`
- `400 PRIVATE_REPOSITORY` when metadata explicitly identifies a private repository
- `429 GITHUB_RATE_LIMITED`
- `413 REPOSITORY_TOO_LARGE`
- `504 GITHUB_TIMEOUT`
- `502 GITHUB_UNAVAILABLE`
- `502 INVALID_REPOSITORY_ARCHIVE`

Anonymous GitHub 404 responses intentionally use the combined `REPOSITORY_NOT_ACCESSIBLE` error because GitHub may conceal private repositories as not found.

## Tests and quality checks

Run every workspace test suite:

    pnpm -r --if-present test

Run the shared quality checks:

    pnpm lint
    pnpm typecheck
    pnpm build
    pnpm format:check

Use `pnpm format` to apply Prettier formatting.
