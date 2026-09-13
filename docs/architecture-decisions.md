# Architecture Decision Records
## AI-Powered Personalized Fitness & Nutrition Assistant

**Version:** 1.1  
**Status:** Draft — Phase 0 (Corrected)  
**Date:** 2026-09-10

---

Architecture Decision Records (ADRs) document important technical decisions, the context in which they were made, the options considered, and the rationale for the chosen approach. They serve as institutional memory for future engineers (and interviewers) reviewing the project.

---

## ADR-001: Modular Monolith Architecture

**Date:** 2026-09-10  
**Status:** Accepted  
**Deciders:** Architecture review

### Context

The application needs a backend architecture that:
- Is appropriate for a portfolio project demonstrating system design
- Avoids unnecessary operational complexity
- Preserves the ability to evolve the architecture as requirements change

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Microservices** | Independent scaling; strong boundaries | High operational overhead; distributed system complexity; premature for this stage |
| **Modular Monolith** (chosen) | Single deployment unit; in-process calls; clear module boundaries | Cannot scale modules independently (not currently needed) |
| **Traditional layered monolith** | Simple | No module boundaries; high coupling risk as project grows |

### Decision

Modular monolith. Each feature domain (Auth, Nutrition, Workouts, AI, RAG) is a distinct Python module with clear boundaries, but all are deployed as a single FastAPI process.

### Consequences

- **Positive:** Simple deployment; fast in-process communication; full-stack coherence visible in one codebase
- **Positive:** Demonstrates understanding of when NOT to use microservices (an important engineering judgment)
- **Negative:** If AI workloads need independent scaling later, extraction is required
- **Risk:** Module boundaries can erode without discipline; enforce via code review

---

## ADR-002: PostgreSQL + pgvector Over Dedicated Vector Database

**Date:** 2026-09-10  
**Status:** Accepted

### Context

The RAG system requires vector storage for document chunk embeddings. Options range from dedicated vector databases (Pinecone, Weaviate, Qdrant) to the pgvector extension on PostgreSQL.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Pinecone** | Managed, scalable, easy to start | Additional service cost; vendor lock-in; no free tier for production |
| **Qdrant** (self-hosted) | Open source; good performance | Additional Docker service; operational complexity |
| **Weaviate** | Rich feature set | Heavy; complex setup; over-engineered for this scope |
| **pgvector** (chosen) | Same DB as structured data; fewer services; transactional consistency | Not as scalable as dedicated DBs at very high vector counts |

### Decision

pgvector on the same PostgreSQL instance used for structured data.

### Rationale

- At portfolio scale (< 50K document chunks), pgvector with HNSW index provides excellent performance
- Eliminates a separate infrastructure dependency (simpler local dev, simpler deployment)
- Allows querying vectors alongside structured data in a single query (metadata filtering with SQL + vector search)
- Transactional consistency: metadata and embeddings are updated atomically

### Consequences

- **Positive:** No additional service to run, configure, or pay for
- **Positive:** Demonstrates understanding of pgvector and when it's sufficient
- **Migration path:** If the knowledge base exceeds ~500K chunks, migrate to a dedicated vector DB. The retriever abstraction layer makes this possible without changing the retrieval business logic.

---

## ADR-003: LLM Performs Extraction, Not Calculation

**Date:** 2026-09-10  
**Status:** Accepted

### Context

One of the most important architectural decisions for this system: how should macronutrient data reach the food entry? Two patterns are possible.

### Options Considered

**Option A: LLM calculates macros**
```
User: "I had 3 eggs"
LLM: "3 eggs = 234 kcal, 18g protein, 1.2g carbs, 15g fat"
→ Store those values
```
Problem: LLMs hallucinate nutritional data. A "confident" wrong value of 300 kcal instead of 234 kcal would silently corrupt the user's tracking data.

**Option B: LLM extracts intent, backend calculates (chosen)**
```
User: "I had 3 eggs"
LLM: {food: "egg", quantity: 3, unit: "whole"}
→ Backend looks up "egg" in food_items DB
→ Backend calculates: 3 × 78 kcal = 234 kcal (deterministic)
→ Store that value
```

### Decision

Option B. The LLM's role is extraction of food names and quantities. All nutritional values come exclusively from the database. All arithmetic is performed by Python code.

### Consequences

- **Positive:** Nutritional data is always accurate (from verified DB)
- **Positive:** Calculation is testable with 100% coverage
- **Positive:** LLM failure does not corrupt historical data
- **Negative:** Requires a well-seeded food database; resolution step adds latency
- **Negative:** LLM may extract a food name that doesn't match any DB record (handled by user confirmation step)

---

## ADR-004: User Confirmation Step for AI-Assisted Food Logging

**Date:** 2026-09-10  
**Status:** Accepted

### Context

When a user says "I had 3 eggs and toast," the LLM extracts food items and the backend resolves them to database records. However:
- The LLM may extract "scrambled eggs" but the DB has "Egg, whole, raw"
- The serving size mapping (e.g., "a cup" to grams) may have uncertainty
- Committing silently wrong entries would corrupt the user's nutrition data

### Decision

Implement a two-step flow:
1. `POST /nutrition/log-natural-language` → returns resolved items for review
2. `POST /nutrition/log-natural-language/confirm` → commits confirmed items

The user sees what was extracted and resolved before any entries are saved.

### Consequences

- **Positive:** User data accuracy is preserved
- **Positive:** Builds user trust (transparency in AI decisions)
- **Negative:** Adds one extra step to the logging flow
- **Mitigation:** High-confidence matches can be pre-checked; user only reviews uncertain ones

---

## ADR-005: Repository Pattern for Data Access

**Date:** 2026-09-10  
**Status:** Accepted

### Context

SQLAlchemy ORM can be used directly in service layer (Active Record pattern) or through an intermediary repository layer.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Active Record / ORM directly in service** | Less code; simpler | DB logic mixed with business logic; hard to test without DB |
| **Repository pattern** (chosen) | Testable services with mocked repos; clear separation | More code; slightly more indirection |

### Decision

Repository pattern. Services receive repository instances via dependency injection. Repositories contain only database logic.

### Rationale

- Services can be unit-tested without a database (mock the repository)
- Repository is the single place to change if the ORM changes
- Demonstrates understanding of layered architecture for interviewers

### Consequences

- Approximately 20% more code for the data access layer
- Services are cleanly unit-testable with mock repositories
- Consistent pattern across all modules

---

## ADR-006: Pydantic Schemas Separate from ORM Models

**Date:** 2026-09-10  
**Status:** Accepted

### Context

FastAPI can return SQLAlchemy ORM objects directly (using `model_config = ConfigDict(from_attributes=True)`) or through separate Pydantic schemas.

### Decision

Separate Pydantic schemas for all API inputs and outputs. ORM models are never returned directly from API routes.

### Rationale

- ORM models may contain sensitive fields (hashed_password); separate schemas prevent accidental exposure
- Response schemas can evolve independently of DB schema
- Pydantic schemas define the API contract explicitly
- Calculated fields (e.g., `remaining_calories`) can be added to response schemas without modifying the ORM model

---

## ADR-007: HNSW Over IVFFlat for pgvector Index

**Date:** 2026-09-10  
**Status:** Accepted

### Context

pgvector supports two approximate nearest neighbour (ANN) index types: HNSW and IVFFlat.

### Comparison

| | HNSW | IVFFlat |
|-|------|---------|
| Training required | No | Yes (needs VACUUM ANALYZE after enough data) |
| Build time | Slower | Faster |
| Query performance | Better recall | Slightly lower recall |
| Memory | Higher | Lower |
| Best for | < ~1M vectors | > ~500K vectors |

### Decision

HNSW with parameters `m=16, ef_construction=64`.

### Rationale

- No training required; simpler operations
- Better recall (fewer missed relevant results)
- Portfolio knowledge base will be < 100K chunks
- Parameters `m=16, ef_construction=64` are standard starting values; can be tuned if needed

---

## ADR-008: Versioned API with /api/v1/ Prefix

**Date:** 2026-09-10  
**Status:** Accepted

### Context

API versioning strategy must be chosen before routes are built.

### Options

- URL path versioning (`/api/v1/`)
- Header versioning (`API-Version: 1`)
- No versioning

### Decision

URL path versioning: all routes under `/api/v1/`.

### Rationale

- Most visible and understandable for consumers
- Easy to implement in FastAPI (prefix on router)
- No client configuration required
- Standard approach for REST APIs
- Breaking changes become `/api/v2/` without removing `v1` immediately

---

## ADR-009: Async FastAPI with asyncpg

**Date:** 2026-09-10  
**Status:** Accepted

### Context

FastAPI supports both sync and async route handlers. The application makes many I/O-bound calls (database, LLM API, embedding API).

### Decision

All route handlers, services, and repositories are `async`. Database uses SQLAlchemy async with `asyncpg` driver.

### Rationale

- LLM API calls can take 1–5 seconds; async prevents blocking other requests during this wait
- Embedding API calls during ingestion are similarly slow
- FastAPI is designed for async; the `await` pattern is idiomatic
- `asyncpg` provides native PostgreSQL async support with good performance

### Consequences

- Async requires consistent use throughout the call stack; mixing sync/async is error-prone
- Testing requires `pytest-asyncio`
- The entire codebase uses `async/await`; no sync code in the hot path

---

## ADR-010: Token Budget Management Strategy

**Date:** 2026-09-10  
**Status:** Accepted

### Context

LLM context windows are finite (e.g., 16K tokens for GPT-4o-mini). The system injects:
- System prompt
- User profile + goals
- Today's nutrition data
- Recent workout data
- RAG context (up to 5 chunks × ~512 tokens)
- Conversation history
- User message

All of these together can exceed the context window.

### Decision

Implement a `TokenBudget` class that manages context allocation with a priority-based trimming strategy:

**Priority order (high → low — low is trimmed first):**
1. System prompt (never trimmed)
2. User profile + active goal (never trimmed)
3. Today's nutrition summary
4. RAG context (top-3 chunks if constrained)
5. Recent workouts (summary if constrained)
6. Conversation history (last 3 turns if constrained)

### Rationale

- Prevents `context_length_exceeded` errors
- Ensures the most relevant context (profile, today's data) is always present
- Conversation history is the most likely candidate for trimming (it grows over time)

---

## ADR-011: Soft Deletion for User-Owned Records

**Date:** 2026-09-10  
**Status:** Accepted

### Context

When users delete food entries, workout sessions, or other records, should they be physically deleted or logically marked as deleted?

### Decision

Soft deletion (`deleted_at` timestamp) for user-owned records: `food_entries`, `workout_sessions`, `exercises` (user-created), `food_items` (user-created).

Hard deletion for: reference data that users don't own, orphan cleanup.

### Rationale

- Accidental deletion recovery
- Audit trail (important for health data)
- `food_entries` referenced by historical summaries should remain (even if hidden from current view)
- Soft deletion is trivially implemented; hard deletion is irreversible

### Consequences

- All queries on soft-deleted tables must include `WHERE deleted_at IS NULL`
- Implement this as a default filter in the repository layer to prevent omission

---

## ADR-012: Pre-Calculated Macros on food_entries

**Date:** 2026-09-10  
**Status:** Accepted

### Context

When a food entry is logged, the macros can be:
- **Option A:** Stored on the entry (denormalised)
- **Option B:** Re-derived from `food_items` at query time via JOIN

### Decision

Option A, extended: macros and provenance metadata are captured and frozen in snapshot columns on `food_entries` at insert time. These snapshot columns are the exclusive source for all nutritional calculations. The `food_item_id` FK is retained only for display/linkback purposes.

### Rationale

- **Historical integrity:** If USDA releases a revised dataset and `food_items` records change, past entries are not silently altered. The user's history reflects what was logged at the time, against which dataset version.
- **Performance:** Daily totals are a simple `SUM` on snapshot columns — no joins needed.
- **Auditability:** `usda_fdc_id_snapshot` and `usda_dataset_version_snapshot` allow any entry to be traced to its exact source data version.

### Consequences

- The `nutrition_calculator` utility is the authoritative source of calculation logic; it must have 100% test coverage.
- Additional columns on `food_entries` increase row width; negligible at expected volumes.
- If a user wants to retroactively apply a corrected food value to past entries, they must re-log.

---

## Open Architectural Questions

These are not yet decided; they will be resolved during implementation:

| Question | Context | Decision Needed By |
|----------|---------|-------------------|
| Should streaming be used for AI responses? | Affects frontend complexity, API design, user experience | Phase 11 |
| Should Celery be introduced for background jobs? | Relevant if ingestion volumes grow or jobs need scheduling | Phase 9 |
| Should refresh token rotation be enabled? | Security trade-off: more secure vs. more complex | Phase 4 |
| Should admin roles be a DB field or a separate table? | Simpler field vs. RBAC scalability | Phase 16 |
| Intent classification for chat: keyword-based or LLM-based? | Affects latency and cost of every chat request | Phase 11 |

**Resolved:** USDA FoodData Central is the adopted food data source (ADR-013).

---

## ADR-013: USDA FoodData Central as Primary Food Data Source

**Date:** 2026-09-10  
**Status:** Accepted (replaces open question OQ-02)

### Context

The application needs a nutrition data source for the `food_items` database. Options include third-party databases (OpenFoodFacts, Nutritionix, Edamam) and USDA FoodData Central.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **USDA FoodData Central** (chosen) | Public domain; bulk JSON download; stable FDC IDs; Foundation Foods have high analytical quality | Limited branded food coverage |
| OpenFoodFacts | Broad branded food coverage; community-maintained | CC BY-SA license; variable data quality; API rate limits |
| Nutritionix / Edamam | Broad coverage; maintained API | Paid plans; API dependency at runtime; vendor lock-in |
| Manual curation | Full control | Impractical at scale |

### Decision

USDA FoodData Central (Foundation Foods + SR Legacy datasets). Data is imported offline via `scripts/import_usda.py` and stored in the local `food_items` table. The application never calls the USDA API at request time.

### Rationale

- Public domain eliminates any licensing risk
- Offline import eliminates a runtime external dependency (the food search never fails due to a third-party API outage)
- FDC IDs provide a stable external reference for provenance tracking
- Foundation Foods have the highest data quality (analytical laboratory measurements)

### Consequences

- Branded food coverage is limited; users can create custom food items for unrecognised products
- USDA dataset must be re-imported when USDA releases an updated version (~twice yearly)
- Import normalisation logic (per-100g conversion, name cleaning) must be implemented and tested

---

## ADR-014: weight_entries as Single Source of Truth for Body Weight

**Date:** 2026-09-10  
**Status:** Accepted

### Context

The original design had both `user_profiles.weight_kg` and `weight_entries` storing body weight. This created a risk of two independently mutable sources of truth that could diverge.

### Problem

If a user edits their profile `weight_kg` directly AND also logs new weight entries, the two values can diverge, producing contradictory data in the AI context and in TDEE calculations.

### Decision

`weight_entries` is the authoritative source of truth. `user_profiles.current_weight_kg` is a derived read-cache updated automatically by the service layer after every weight entry insertion. Users cannot write `current_weight_kg` directly through the profile API; they must log a weight entry.

### Consequences

- **Positive:** No conflicting weight values; single consistent truth for all TDEE and AI context calculations
- **Positive:** Full audit trail in `weight_entries` for all weight changes
- **Negative:** Profile API requires service-layer coordination to update the cache after weight logging
- **Edge case:** New users with no `weight_entries` have `current_weight_kg = NULL`; TDEE calculation must handle this gracefully (prompt user to log weight)

---

## ADR-015: food_entries Captures Provenance Snapshot at Insert Time

**Date:** 2026-09-10  
**Status:** Accepted

### Context

The `food_items` database is sourced from USDA and may be updated when USDA releases revised datasets. Without explicit provenance capture, a USDA update would silently change the meaning of historical food entries (via re-join to `food_items`).

### Problem

If `food_entries` macros were re-derived from `food_items` at query time and USDA corrected a calorie value (e.g., 100g chicken breast changed from 165 kcal to 172 kcal), every historical entry for that food would retroactively change without the user's knowledge.

### Decision

`food_entries` captures snapshot columns at insert time: `food_name_snapshot`, `data_source_snapshot`, `usda_fdc_id_snapshot`, `usda_dataset_version_snapshot`. All nutritional calculations use these snapshot columns exclusively. `food_item_id` is retained only for display linkback.

### Consequences

- **Positive:** Historical entries are immutable and auditable
- **Positive:** Any entry can be traced to its exact source data version
- **Negative:** Slightly wider row; negligible at expected volumes
- **Negative:** If a user genuinely wants to update past entries after a USDA correction, they must re-log

---

## ADR-016: Workout Recovery Uses Configurable Heuristic, Not Fixed 48-Hour Rule

**Date:** 2026-09-10  
**Status:** Accepted

### Context

The original design described a "48h rule for the same muscle groups" as the recovery decision mechanism. This is factually inaccurate as a universal rule: recovery time is influenced by training volume, intensity, exercise selection, individual fitness level, sleep quality, and nutrition status. Presenting 48 hours as a fixed threshold would produce incorrect recommendations and mislead users.

### Decision

Replace the 48h rule with a **configurable recency-and-volume heuristic**:

- Compute a recency score per muscle group based on: days elapsed since last trained + estimated volume (sets × reps).
- The heuristic has configurable weights and a default lookback window (7–14 days).
- The system uses this heuristic as a recommendation input, not as a hard recovery gate.
- The LLM prompt explicitly acknowledges that recovery is individual and influenced by many factors, and instructs the model not to present any specific time window as a universal rule.

### Consequences

- **Positive:** Factually defensible; does not overstate the precision of recovery science
- **Positive:** Configurable defaults can be adjusted without code changes
- **Negative:** Slightly more complex than a simple threshold check
- **Note:** This heuristic generates recommendations, not medical prescriptions. The AI assistant is instructed to always encourage users to listen to their body.

---

## ADR-017: Intent-Aware Context Selection for AI Requests

**Date:** 2026-09-10  
**Status:** Accepted

### Context

The original design injected all available user context (nutrition, workout, weight history, conversation history) into every AI request regardless of what the user asked. This creates several problems:

1. Irrelevant data consumes token budget that could be used for more relevant content
2. Irrelevant data can cause the LLM to reference data the user didn't ask about
3. Blanket injection may surface sensitive data (e.g., weight history) in conversations about general knowledge topics
4. Higher per-request cost (unnecessary tokens sent to the LLM)

### Decision

Classify query intent before context assembly. Only fetch and inject the SQL data sources that are relevant to the classified intent. Use the intent to also scope the RAG topic filter.

| Intent Class | SQL Sources | RAG Filter |
|-------------|-------------|------------|
| Nutrition question | Profile, nutrition summary | nutrition, meal_planning |
| Workout question | Profile, recent workouts | training, cardio, recovery |
| Progress question | Profile, weight history, trends | weight_management, nutrition, training |
| General knowledge | Profile, goal only | All categories |

### Consequences

- **Positive:** Lower per-request cost
- **Positive:** Higher response relevance (no dilution from irrelevant context)
- **Positive:** Data minimisation (only necessary personal data is sent to the LLM)
- **Negative:** Requires intent classification step before context assembly
- **Complexity:** Intent classification can be wrong; misclassification sends insufficient context. Mitigation: default to a broader context set when intent is ambiguous.
- **Open question:** Whether intent classification is keyword-based (fast, no LLM cost) or LLM-based (more accurate, adds latency). To be decided in Phase 11.
