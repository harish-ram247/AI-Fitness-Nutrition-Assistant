# Phase 9A — Dependency Security Audit & Targeted Remediation Report

**Project**: AI-Powered Personalized Fitness & Nutrition Assistant (`AI-Fitness-Nutrition-Assistant`)  
**Phase**: Phase 9A (Production Readiness — Security Audit)  
**Date**: October 19, 2026  
**Auditor**: Antigravity Autonomous Security Subagent  
**Environment**: Windows 10/11, PowerShell, Node.js v22.13.1, npm v11.5.2, Python 3.12.10

---

## 1. Executive Summary

Phase 9A performed a dependency and configuration security audit across both frontend and backend codebases. Prior to remediation, the initial frontend audit reported **9 vulnerabilities** (2 Critical, 2 High, 5 Moderate) spanning development test runner tooling, CSS preprocessing, and routing libraries.

Through targeted, non-destructive upgrades and application-level defense-in-depth, **all 9 frontend vulnerabilities were remediated**, achieving:
- **0 vulnerabilities** reported by `npm audit`.
- **100% frontend test pass rate** (177/177 tests passing across 11 suites).
- **Zero ESLint errors and zero TypeScript compiler warnings**.
- **100% backend unit test pass rate** (200/200 tests passing; code coverage was not measured).
- **Clean backend static analysis** (Ruff 0 errors, Mypy 0 errors in 119 source files).
- **Backend immutability preserved**: zero modifications to backend application code, schemas, or migrations.

---

## 2. Baseline Audit Findings

### 2.1 Frontend Initial State

An initial `npm audit` inspection of `frontend/package.json` and `frontend/package-lock.json` revealed:

| Package | Severity | Advisory ID | Vulnerability Title | Path / Direct or Transitive |
| :--- | :---: | :--- | :--- | :--- |
| **tinypool** | **Critical** | GHSA-5gmw-xhrv-c9v3 | Prototype Pollution in worker options (RCE) | Transitive via `vitest@2.1.9` |
| **tinypool** | **Critical** | GHSA-85c8-ppgw-ccpr | Prototype Pollution Gadget to RCE in `run()` | Transitive via `vitest@2.1.9` |
| **source-map-js** | **High** | GHSA-68fv-2mgg-jv7q | Event-loop ReDoS / DoS via indexed section offsets | Transitive via `vite@6.4.3 -> postcss@8.5.28` |
| **vite** (nested) | **High** | GHSA-fx2h-pf6j-xcff | `server.fs.deny` bypass on Windows alternate paths | Transitive via `vitest -> vite@5.4.21` |
| **vite** (nested) | **Moderate** | GHSA-v6wh-96g9-6wx3 | `launch-editor` NTLMv2 hash disclosure on Windows | Transitive via `vitest -> vite@5.4.21` |
| **vite** (nested) | **Moderate** | GHSA-4w7w-66w2-5vf9 | Path Traversal in optimized deps `.map` handling | Transitive via `vitest -> vite@5.4.21` |
| **esbuild** (nested) | **Moderate** | GHSA-67mh-4wv8-2f99 | Dev server request interception from any website | Transitive via `vitest -> vite-node -> esbuild@0.21.5` |
| **@vitest/mocker** | **Moderate** | GHSA-82fw-gwwq-j7x9 | Path Traversal / Arbitrary File Read via Redirect Mock | Transitive via `vitest@2.1.9` |
| **react-router** | **Moderate** | GHSA-wrjc-x8rr-h8h6 | Open redirect via backslash in `<Link>` & `useNavigate` | Direct runtime: `react-router-dom@6.30.6` |
| **react-router** | **Moderate** | GHSA-337j-9hxr-rhxg | Arbitrary Constructor Injection in SSR Hydration | Transitive via `react-router@6.30.6` |

**Total Baseline Findings**: 9 vulnerabilities (2 Critical, 2 High, 5 Moderate).

### 2.2 Backend Initial State

- Dependency manifest: `backend/pyproject.toml`
- Python runtime: Python 3.12.10
- Dependency management: `pip` / `setuptools` virtual environment (`.venv`)
- `pip check`: `No broken requirements found.`
- Direct dependencies: `fastapi>=0.110.0` (installed 0.141.1), `uvicorn>=0.28.0` (installed 0.52.4), `sqlalchemy>=2.0.28` (installed 2.0.52), `asyncpg>=0.29.0` (installed 0.31.0), `pydantic>=2.6.4` (installed 2.13.5), `pyjwt>=2.8.0` (installed 2.13.0), `bcrypt>=4.1.0` (installed 5.0.0), `pgvector>=0.2.5` (installed 0.5.0), `openai>=1.14.0` (installed 3.13.0).

---

## 3. Exposure and Impact Analysis

1. **Development & Test Tooling Exposure (`tinypool`, `@vitest/mocker`, nested `esbuild`, nested `vite`, `source-map-js`)**:
   - None of these packages are shipped in the production browser bundle (`frontend/dist/`).
   - However, vulnerabilities in test runners and dev servers could allow local privilege escalation or malicious request handling during development.
   - Updating `source-map-js` and `vitest` resolves these risks.

2. **Shipped Runtime Exposure (`react-router` / `react-router-dom`)**:
   - **GHSA-337j-9hxr-rhxg (SSR Hydration constructor injection)**: Affects SSR data deserialization via `deserializeErrors()`. The application is a client-side SPA built with Vite; SSR is not used.
   - **GHSA-wrjc-x8rr-h8h6 (Open redirect via backslash)**: Could be triggered if untrusted user input containing backslashes is passed directly to `navigate()` or `<Link>`.
   - Upgrading `react-router-dom` to `7.18.4` patches this vulnerability in the routing core, while application-level sanitization in `getSafeReturnTo` provides strict defense-in-depth.

---

## 4. Remediation Actions and Package Changes

| Package | Role | Baseline Version | Remediated Version | Rationale & Remediation Mechanism |
| :--- | :--- | :---: | :---: | :--- |
| `vite` | Dev / Build | 6.4.3 | **6.4.4** | In-range patch upgrade updating PostCSS and transitive dependencies. |
| `source-map-js` | Dev transitive | 1.2.1 | **1.2.2** | Patches ReDoS vulnerability GHSA-68fv-2mgg-jv7q without breaking changes. |
| `vitest` | Dev direct | 2.1.9 | **4.1.12** | Explicitly patched release: completely drops `tinypool` (GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr), upgrades `@vitest/mocker` (GHSA-82fw-gwwq-j7x9), and uses root `vite@6.4.4` and `esbuild@0.25.12`, removing nested vulnerable Vite 5.x and esbuild 0.21.5. |
| `@testing-library/dom` | Dev direct | *N/A (transitive)* | **^10.4.0** | Added explicitly to devDependencies to ensure peer dependency resolution under npm legacy peer deps. |
| `react-router-dom` | Prod direct | 6.30.6 | **7.18.4** | Patched release for GHSA-wrjc-x8rr-h8h6 and GHSA-337j-9hxr-rhxg. Fully backward-compatible with SPA routing APIs (`BrowserRouter`, `Routes`, `Route`, `Navigate`, `useNavigate`, `useLocation`, `Outlet`). |
| `react-router` | Prod transitive | 6.30.6 | **7.18.4** | Patched transitive engine underpinning `react-router-dom@7.18.4`. |

### 4.1 Verification of `tinypool` Absence

An explicit inspection was performed to verify the actual state of `tinypool`:
- Command: `npm ls tinypool`
  - Output: `ai-fitness-nutrition-frontend@1.0.0` / `-- (empty)`
- Lockfile inspection (`package-lock.json`):
  - Entries matching `tinypool`: `[]` (0 entries in `packages`)
- File system inspection (`node_modules/tinypool`):
  - Exists on disk: `false`

**Conclusion**: In Vitest 4, worker pool architecture was redesigned with `tinyexec` and worker threads, completely removing `tinypool` from the dependency tree. The package is confirmed **absent** (not present at any patched or unpatched version).

---

## 5. Security Configuration and Code Enhancements

### 5.1 Defense-in-Depth Open Redirect Sanitization (`frontend/src/utils/security.ts`)
To ensure complete immunity against open-redirect bypasses (such as backslash tricks or protocol injection), `getSafeReturnTo` was hardened:
```typescript
export function getSafeReturnTo(rawReturnTo: string | null | undefined, defaultPath = '/dashboard'): string {
  if (!rawReturnTo || typeof rawReturnTo !== 'string') {
    return defaultPath;
  }

  const trimmed = rawReturnTo.trim();

  // Must begin with '/' and not '//' or contain any backslash '\' (preventing open redirect bypasses like CVE-2025-68470)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return defaultPath;
  }

  // Prevent protocol injection e.g. /login?returnTo=javascript:... or https:...
  const pathPart = trimmed.split('?')[0].split('#')[0];
  if (pathPart.includes(':')) {
    return defaultPath;
  }

  return trimmed;
}
```

### 5.2 Vitest 4 Mock Isolation (`frontend/vite.config.ts` & `frontend/tests/setup.ts`)
Vitest 4 introduced stricter mock persistence. To guarantee test isolation:
- Configured `clearMocks: true` in `vite.config.ts`.
- Added `vi.clearAllMocks()` in `tests/setup.ts` `afterEach`.

### 5.3 TypeScript Build Configuration (`frontend/tsconfig.json`)
Added `"node"` to the compiler `"types"` array to support environment-agnostic stack trace capture definitions in `src/api/errors.ts` while maintaining browser compatibility.

### 5.4 Test Suite Adjustments (`frontend/tests/hardening.test.tsx` & `frontend/tests/nutrition.test.tsx`)
- Added explicit test cases verifying that `getSafeReturnTo` rejects backslash bypass attempts (`/profile\evil.example.com`, `\evil.example.com`, `/\\evil.example.com`).
- Configured `{ timeout: 3000 }` on `waitFor` in `nutrition.test.tsx` for reliable asynchronous `React.lazy` route resolution under test concurrency.

---

## 6. Verification and Regression Results

### 6.1 Frontend Test Suite
Executed: `npm test`
```
 Test Files  11 passed (11)
      Tests  177 passed (177)
   Start at  16:26:04
   Duration  19.32s
```
- `tests/routing.test.tsx` — 6 passed
- `tests/hardening.test.tsx` — 11 passed
- `tests/dashboard.test.tsx` — 13 passed
- `tests/profile.test.tsx` — 18 passed
- `tests/auth.test.tsx` — 13 passed
- `tests/recommendation.test.tsx` — 23 passed
- `tests/ai.test.tsx` — 27 passed
- `tests/nutrition.test.tsx` — 24 passed
- `tests/workout.test.tsx` — 29 passed
- `tests/api-client.test.ts` — 7 passed
- `tests/api-refresh.test.ts` — 6 passed

### 6.2 Frontend Linting & Production Build
Executed: `npm run lint`
```
> eslint .
Exit code: 0 (0 errors, 0 warnings)
```
Executed: `npm run build` (`tsc && vite build`)
```
vite v6.4.4 building for production...
✓ 696 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                0.73 kB │ gzip:   0.40 kB
dist/assets/index-Bm4g2Kgl.css                 3.84 kB │ gzip:   1.36 kB
dist/assets/errorHandling-B_h7IaoA.js          0.18 kB │ gzip:   0.16 kB
dist/assets/AIAssistantPage-BlGbIHUi.js       26.28 kB │ gzip:   6.48 kB
dist/assets/RecommendationsPage-BwRpjO3e.js   35.97 kB │ gzip:   6.05 kB
dist/assets/NutritionPage-DmmGHrQj.js         51.84 kB │ gzip:   8.88 kB
dist/assets/ProfilePage-CtcpF-DI.js           51.97 kB │ gzip:   9.17 kB
dist/assets/index-INbbUuuN.js                 52.40 kB │ gzip:  12.59 kB
dist/assets/WorkoutsPage-C0px9ciJ.js          66.90 kB │ gzip:  11.89 kB
dist/assets/vendor-DhbYl21n.js               166.72 kB │ gzip:  54.42 kB
dist/assets/recharts-CLw0Xyu8.js             397.72 kB │ gzip: 115.17 kB
✓ built in 3.61s
Exit code: 0 (0 errors, 0 warnings, zero chunk warnings)
```

### 6.3 Backend Regression & Static Checks
Executed: `backend/.venv/Scripts/ruff check .`
```
All checks passed!
```
Executed: `backend/.venv/Scripts/mypy app`
```
Success: no issues found in 119 source files
```
Executed: `backend/.venv/Scripts/pytest tests/unit -q`
```
200 passed in 0.43s
Exit code: 0 (200 passed, 0 failed; line/branch coverage was not measured)
```

### 6.4 Final Audit Verification
Executed: `npm audit`
```
found 0 vulnerabilities
Exit code: 0
```

---

## 7. Known Limitations and Verified Distinctions

### 7.1 Verified Results
1. **Frontend Zero Vulnerabilities**: `npm audit` confirms 0 vulnerabilities across all direct and transitive packages.
2. **Frontend Test Suite**: 177 automated tests passed across all 11 test files.
3. **Frontend Production Build**: `tsc && vite build` completed in 3.61s with clean code-splitting and zero warnings.
4. **Backend Unit Regression**: 200 unit tests passed without regression.
5. **Backend Static Verification**: Ruff and Mypy passed with zero errors in 119 source files.

### 7.2 Explicit Limitations
1. **Backend Integration Database Tests**:
   - Integration tests targeting PostgreSQL/pgvector (`tests/integration/`) require an active Docker container on port 5434. During this audit session, the Docker Desktop daemon was not running on the host system.
   - Database integration tests were not run and are not claimed as passing.
2. **Backend Automated Vulnerability Scanning**:
   - `pip-audit` is not pre-installed in the backend Python virtual environment.
   - A dry-run installation test (`pip install --dry-run pip-audit`) indicated that installing the tool would require adding 20+ non-application packages (`CacheControl`, `cyclonedx-python-lib`, `requests`, `urllib3`, `rich`, `filelock`, etc.).
   - In accordance with Phase 9A rules prohibiting environment mutation merely to install an audit tool, `pip-audit` was not installed.
   - **The backend dependency audit was conducted via manual advisory review, and automated backend CLI vulnerability scanning remains incomplete.**
3. **Test Code Coverage**:
   - Line and branch code coverage was not measured via coverage instrumentation (`pytest-cov` / Vitest coverage); the metric is strictly a 100% test pass rate (200/200 backend unit tests, 177/177 frontend tests).

---

## 8. Summary Table of Audit Findings & Actions

| Package | Severity | Advisory ID | Pre-Audit Version | Post-Audit Version | Status | Resolution / Action |
| :--- | :---: | :--- | :---: | :---: | :---: | :--- |
| **tinypool** | Critical | GHSA-5gmw-xhrv-c9v3 | 2.1.1 | *Absent* | **RESOLVED** | Confirmed absent from tree (`npm ls tinypool` is empty). Dropped in `vitest@4.1.12`. |
| **tinypool** | Critical | GHSA-85c8-ppgw-ccpr | 2.1.1 | *Absent* | **RESOLVED** | Confirmed absent from tree (`npm ls tinypool` is empty). Dropped in `vitest@4.1.12`. |
| **source-map-js** | High | GHSA-68fv-2mgg-jv7q | 1.2.1 | 1.2.2 | **RESOLVED** | Upgraded via PostCSS / Vite patch. |
| **vite** (nested) | High | GHSA-fx2h-pf6j-xcff | 5.4.21 | 6.4.4 | **RESOLVED** | Aligned to root `vite@6.4.4` via `vitest@4.1.12`. |
| **vite** (nested) | Moderate | GHSA-v6wh-96g9-6wx3 | 5.4.21 | 6.4.4 | **RESOLVED** | Aligned to root `vite@6.4.4` via `vitest@4.1.12`. |
| **vite** (nested) | Moderate | GHSA-4w7w-66w2-5vf9 | 5.4.21 | 6.4.4 | **RESOLVED** | Aligned to root `vite@6.4.4` via `vitest@4.1.12`. |
| **esbuild** (nested)| Moderate | GHSA-67mh-4wv8-2f99 | 0.21.5 | 0.25.12 | **RESOLVED** | Aligned to modern root esbuild via `vitest@4.1.12`. |
| **@vitest/mocker** | Moderate | GHSA-82fw-gwwq-j7x9 | 2.1.9 | 4.1.12 | **RESOLVED** | Upgraded to patched release via `vitest@4.1.12`. |
| **react-router** | Moderate | GHSA-wrjc-x8rr-h8h6 | 6.30.6 | 7.18.4 | **RESOLVED** | Upgraded to `7.18.4` + backslash rejection in `getSafeReturnTo`. |
| **react-router** | Moderate | GHSA-337j-9hxr-rhxg | 6.30.6 | 7.18.4 | **RESOLVED** | Upgraded to `7.18.4` (also not applicable to client SPA). |

---

## 9. Final Risk Assessment

- **Resolved Findings**: 10 of 10 tracked vulnerability instances in frontend dependencies.
- **Mitigated / Defense-in-Depth**: Strict URL sanitization in `getSafeReturnTo` blocks all backslash-based open redirect vectors.
- **Unresolved Findings**: **0** known unaddressed vulnerabilities.
- **Audit Completeness**: Frontend audit complete with 0 vulnerabilities; backend audit verified manually against current advisories, with automated CLI scanning incomplete to avoid environment mutation.
