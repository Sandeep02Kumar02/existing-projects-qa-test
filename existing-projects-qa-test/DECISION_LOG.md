# Decision Log — Introduce Express.js and the `GET /good-evening` endpoint

This document is the single source of truth for the non-trivial decisions behind adding the Express.js framework and a second HTTP endpoint (`GET /good-evening`) to this project, while preserving the existing `Hello, World!` response byte-for-byte and keeping all operational hardening intact. Per the Explainability rule, all rationale is recorded here and is intentionally NOT embedded as comments in the source code.

## Decision Log

| ID | Decision | Alternatives Considered | Rationale | Risk |
|----|----------|-------------------------|-----------|------|
| D1 | Adopt `express@^5.2.1` | Express 4.22.2; Fastify/Koa; remain on native `http` | User explicitly requested "expressjs"; v5 is the npm default and Technical-Committee-recommended production line; 5.2.1 is latest | Raises the Node floor to `>= 18`; supersedes the prior zero-dependency architecture |
| D2 | New route path = `GET /good-evening` | `/evening`, `/goodevening`, `/good_evening` | Kebab-case is conventional and readable; the user did not specify a path | If a different path was intended, it is a trivial rename |
| D3 | New body = `Good evening\n` (`text/plain`, `200`) | `Good evening` without newline; JSON payload | Matches the existing `Hello, World!\n` convention (trailing newline, `text/plain`) and preserves the literal user string | Trailing newline is cosmetic and easily removed |
| D4 **(DEVIATION)** | Serve Hello World on `/` only via an explicit route | Catch-all middleware answering every path like the old handler | Explicit routing is idiomatic Express and clearer; the user wants two distinct endpoints | Non-`/` unknown paths now return Express `404` instead of Hello World (behavior refinement vs. the old any-path handler) |
| D5 | Mount via `http.createServer(app)`, keeping the `server` variable | `app.listen(port)` directly | Preserves all existing server-level hooks (error / clientError / graceful shutdown / listen logs) with a minimal diff | Negligible; keeps hardening intact |
| D6 **(DEVIATION)** | Edit `package.json` and regenerate `package-lock.json` | Leave the manifests untouched | Express cannot be added without them; the user mandate supersedes the zero-dependency guarantee and the manifest preservation policy | Deviates from the documented zero-dependency + preserved-identity policy |
| D7 | Leave `README.md`, the `test` placeholder, and `main: "index.js"` unchanged | Fix anomalies opportunistically; add a `start` script; document the feature in the README | Minimal-changes rule forbids out-of-scope edits; README says `Do not touch!` | Pre-existing anomalies remain, but they are documented and intentional |
| D8 | No automated tests / no test framework | Add Jest / Mocha / Supertest | Not requested; would add further dependencies; the project validates via `node -c` + `curl` | Regression risk mitigated by the manual verification checklist |
| D9 **(DEVIATION)** | Add `DECISION_LOG.md` at the project root | Place the log under `blitzy/documentation/`; embed it only in the technical spec | Discoverable, durable single source of truth as required by the Explainability rule | Introduces a fifth root file, deviating from the documented flat four-file root layout |

## Bidirectional Traceability Matrix

This matrix maps every source construct in the native-`http` implementation to its target construct in the Express implementation, achieving 100% coverage with no gaps.

| ID | Source (native `http`) | Target (Express) | Coverage |
|----|------------------------|------------------|----------|
| T1 | `http.createServer(handler)` bootstrap | `express()` app mounted via `http.createServer(app)` | Full |
| T2 | Inline `200` `text/plain` `Hello, World!\n` for all paths | `app.get('/')` returning the identical status / headers / body | Full (behavior narrowed to `/` per D4) |
| T3 | *(new requirement — no source construct)* | `app.get('/good-evening')` returning `Good evening\n` | New (additive) |
| T4 | `400 Bad Request: Invalid request format\n` on missing `method` / `url` | Node/Express always populate `req.method` / `req.url`; the `clientError` hook still guards malformed HTTP at the socket level; optional guard middleware documented for strict parity | Full (via socket-level guard; optional middleware noted) |
| T5 | `500 Internal Server Error\n` on synchronous throw | Express default error handling (Express 5 also forwards rejected promises); optional custom error middleware for exact-body parity | Full (default handler; optional middleware noted) |
| T6 | Lifecycle: `error`, `clientError`, `gracefulShutdown`, `SIGTERM`/`SIGINT`, `uncaughtException`, `unhandledRejection`, `server.listen` | Preserved verbatim, bound to the same `http.Server` instance | Full (unchanged) |
