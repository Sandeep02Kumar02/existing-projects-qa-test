# Decision Log & Traceability

This document is the single source of truth for the "why" behind the Express.js migration of this project. It satisfies the **Explainability** rule: every non-trivial decision is recorded here (decision, alternatives, rationale, risks), and a 100%-coverage bidirectional traceability matrix maps the previous native `http` implementation to its Express equivalent. Rationale lives here, not in code comments.

## Decision Log

| ID | Decision | Alternatives considered | Rationale | Risks / Mitigations |
|----|----------|-------------------------|-----------|---------------------|
| D1 | Adopt Express.js as the HTTP framework | Fastify; Koa; keep native `http` with manual URL routing | User explicitly requested Express; it provides idiomatic routing | Introduces the first external dependency, reversing the documented zero-dependency posture (Technical Specification §3.2.1, §3.2.4); adds supply-chain surface — mitigated by pinning a known-good version and regenerating the lockfile |
| D2 | Pin `express@^5.2.1` | Express 4.x | Latest stable, Technical-Committee production-recommended | Express 5 has breaking changes vs 4 — moot, as no prior Express code exists; requires Node.js ≥ 18 (satisfied) |
| D3 | Migrate the single `http` server to one Express app | Run dual http + Express servers; mount Express via `http.createServer(app)` | A single coherent Express app is the simplest, cleanest form | Entrypoint refactor — mitigated by preserving observable behavior and all hardening |
| D4 | Preserve the catch-all via a terminal `app.use` fallback | Only `app.get('/')`, letting other paths 404 | Keeps the existing public interface for every previously-working request (minimal-change rule) | Fallback masks 404s — accepted for tutorial parity |
| D5 | Route path `GET /good-evening` | `/goodevening`; `/evening`; `/good_evening` | Descriptive, REST-friendly kebab-case | Naming preference only |
| D6 | New body `Good evening` as `text/plain` | Append a trailing newline to match `Hello, World!\n`; return JSON | Matches the user's exact string and the existing content type | Trivial |
| D7 | Retain `HOST`/`PORT` env configuration unchanged | Introduce new config keys | Reuse the existing, working configuration | None |
| D8 | Capture the `app.listen()` server instance to re-attach hardening | Drop or rewrite the hardening | Preserves side effects and resilience (minimal-change rule) | Handlers must bind to the returned server — a verified Express pattern |
| D9 | Deliver the decision log as `DECISIONS.md` | Inline code comments; specification-only | The "Explainability" rule mandates a Markdown decision log as the single source of truth and forbids code-comment rationale | Adds one file — rule-mandated and consistent with scope |
| D10 | Do not add tests, a `start` script, correct `main`, or edit the README | Full project hardening | Minimal-change rule; not requested by the user | Pre-existing conditions remain: `main` → nonexistent `index.js`; placeholder `test` script — logged as accepted deviations |
| D11 | Remove the now-unused direct `require('http')` | Retain the import | Part of the scoped migration; `app.listen` provides the `http.Server` | None |
| D12 | Disable Express's default `X-Powered-By` and `ETag` response headers; accept the `text/plain; charset=utf-8` content type | Leave `X-Powered-By` enabled; keep the weak `ETag`; force a bare `text/plain` via `res.setHeader`/`res.end` | `X-Powered-By` is avoidable framework fingerprinting, so it is disabled (the preferred security fix). `ETag` is disabled because the native server emitted none and keeping it would add new conditional-request (`304`) behavior — disabling it keeps response side-effects identical (minimal-change rule). `charset=utf-8` is accepted: it is the standards-compliant output of the AAP §0.5.2-prescribed `res.type('text/plain').send(...)`, the media type stays `text/plain`, and it changes no behavior | The header set differs from the pre-migration native contract only by the accepted `charset=utf-8` suffix; status (`200`) and body bytes (`14`/`12`) are unchanged — verified via runtime header capture confirming no `X-Powered-By` and no `ETag` |
| D13 | Emit the "Server running" startup log from the server's `'listening'` event instead of from a callback passed to `app.listen()` | (a) Keep the positional `app.listen(port, hostname, cb)` callback; (b) inspect the callback's error argument — `app.listen(port, hostname, (err) => { if (err) return; … })` | Express 5's `app.listen` wraps the supplied callback with `once()` and registers it as **both** the `'listening'` callback **and** a one-time `'error'` listener (`server.once('error', done)`). On a failed bind the callback therefore fired from the `'error'` event and, because it ignored its error argument, logged a misleading `Server running at …` success message before the real error. Binding the log to the server's `'listening'` event — which fires only on a successful bind — restores the original native-`http` startup-log semantics, in which `server.listen(port, host, cb)` invoked the callback only on `'listening'` and never on `'error'` | None — the success log still fires exactly once on a successful bind and never on a failed bind; all other behavior (server capture, error/clientError handlers, graceful shutdown, process guards) is unchanged. Verified via a two-instance EADDRINUSE runtime test: instance B logs only the error path (`Server error: … EADDRINUSE` + `Port … is already in use`) and exits `1`, with no `Server running` line |

## Bidirectional Traceability Matrix (http → Express)

The matrix maps every existing `server.js` construct to its Express target at 100% coverage; the final row is the net-new addition.

| Source construct (current `server.js`) | Location | Target construct (Express) |
|-----------------------------------------|----------|----------------------------|
| `require('http')` | L1 | `require('express')` plus `express()`; direct `http` require removed |
| `http.createServer(handler)` | L10 | `const app = express()` |
| `req.method`/`req.url` validation → 400 | L14-L19 | Handled by Express request parsing; an optional guard preserves the 400 semantic |
| 200, `text/plain`, `res.end('Hello, World!\n')` | L22-L24 | `app.use` fallback → `res.status(200).type('text/plain').send('Hello, World!\n')` |
| try/catch → 500 | L25-L37 | Express default error handling / error-handling middleware → 500 |
| `server.on('error')` (EADDRINUSE/EACCES) | L42-L54 | Same handler on the captured `app.listen()` server |
| `server.on('clientError')` | L58-L68 | Same handler on the captured server |
| `gracefulShutdown` + `server.close` | L72-L88 | Unchanged; operates on the captured server |
| `SIGTERM`/`SIGINT` handlers | L92-L93 | Unchanged |
| `uncaughtException` handler | L97-L115 | Unchanged |
| `unhandledRejection` handler | L119-L137 | Unchanged |
| `server.listen(port, hostname, cb)` (callback fires on `'listening'` only) | L140-L143 | `const server = app.listen(port, hostname)` with the startup log bound to `server.on('listening', …)` — preserves native semantics (no success log on a failed bind, D13); the captured `server` re-attaches all hardening |
| Response header set: bare `Content-Type: text/plain`, no `X-Powered-By`, no `ETag` | L22-L24 | `app.disable('x-powered-by')` + `app.disable('etag')`; `res.type('text/plain').send(...)` keeps `text/plain` and adds the accepted `charset=utf-8` (D12) |
| *(new — no source construct)* | — | `app.get('/good-evening', ...)` → `Good evening` |

## Authorized Architectural Deviations

The following pre-existing constraints and framework defaults are intentionally addressed under the user's explicit request to add Express and a new endpoint:

- **Zero-dependency / zero-framework posture reversed (D1):** The technical specification defined a deliberate zero-framework architecture that explicitly excluded Express (Technical Specification §3.2.1, §3.2.4). Adding Express reverses that stance. This is authorized by the user's explicit instruction and is mitigated by pinning a known-good version (`express@^5.2.1`) and regenerating `package-lock.json`.
- **README "Do not touch!" notice superseded for scoped files (D9/D10):** `README.md` marks the repository immutable, but the user's explicit modification request supersedes that notice for the scoped files (`server.js`, `package.json`, `package-lock.json`) and the new `DECISIONS.md`. `README.md` itself is left unchanged, honoring the notice everywhere it does not conflict with the request.
- **Accepted pre-existing conditions left untouched (D10):** `main` still points to a nonexistent `index.js`, and the placeholder `test` script is retained. Correcting these is out of scope under the minimal-change rule.
- **Express default response headers reviewed and secured (D12):** The migration surfaced three response headers absent from the native `http` server — `X-Powered-By: Express`, a weak `ETag` (added by `res.send`), and the `; charset=utf-8` suffix on `Content-Type`. `X-Powered-By` and `ETag` are disabled via `app.disable('x-powered-by')` and `app.disable('etag')`, removing framework fingerprinting (the preferred security fix) and keeping response side-effects identical to the native server (no `ETag`-driven conditional-request / `304` behavior). The `charset=utf-8` suffix is accepted: it is the standards-compliant output of the AAP §0.5.2-prescribed `res.type('text/plain').send(...)`, and the media type remains `text/plain`. Status (`200`) and body bytes are unchanged (`Hello, World!\n` = 14 bytes; `Good evening` = 12 bytes).
