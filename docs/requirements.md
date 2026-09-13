# Requirements Specification
## AI-Powered Personalized Fitness & Nutrition Assistant

**Version:** 1.1  
**Status:** Draft — Phase 0 (Corrected)  
**Date:** 2026-09-10

---

## Table of Contents

1. [Introduction](#introduction)
2. [Functional Requirements](#functional-requirements)
3. [Non-Functional Requirements](#non-functional-requirements)
4. [AI Requirements](#ai-requirements)
5. [RAG Requirements](#rag-requirements)
6. [Data Requirements](#data-requirements)
7. [Security Requirements](#security-requirements)
8. [Performance Requirements](#performance-requirements)
9. [Scalability Requirements](#scalability-requirements)
10. [User Journeys](#user-journeys)
11. [Confirmed vs. Assumed Requirements](#confirmed-vs-assumed)
12. [Open Questions](#open-questions)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for the AI-Powered Personalized Fitness & Nutrition Assistant — a full-stack web application combining conventional fitness tracking with AI-assisted coaching, RAG, and personalized recommendations.

### 1.2 Scope

The system provides:
- A React/TypeScript frontend for user interaction
- A Python/FastAPI backend providing REST API services
- A PostgreSQL database for structured data
- A pgvector-enabled PostgreSQL store for embeddings and vector search
- An AI orchestration layer supporting LLM integration, RAG pipelines, and personalized recommendations

### 1.3 Audience

Development engineers, architecture reviewers, and stakeholders assessing project scope.

---

## 2. Functional Requirements

### 2.1 User Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-U01 | Users can register with email and password | MUST |
| FR-U02 | Users can log in and receive a session token | MUST |
| FR-U03 | Users can log out | MUST |
| FR-U04 | Users can update their account email and password | MUST |
| FR-U05 | Users can delete their account | SHOULD |
| FR-U06 | Passwords must be hashed; plaintext passwords must never be stored | MUST |

### 2.2 Fitness Profile

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-P01 | Users can create and maintain a fitness profile | MUST |
| FR-P02 | Profile includes: age, sex, height, current_weight_kg (read-cache derived from weight_entries; see ADR-014), activity level | MUST |
| FR-P03 | System calculates Basal Metabolic Rate (BMR) using Mifflin-St Jeor equation | MUST |
| FR-P04 | Profile is used to personalise AI recommendations | MUST |

### 2.3 Fitness Goals

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-G01 | Users can set one or more fitness goals | MUST |
| FR-G02 | Goal types: weight loss, muscle gain, maintenance, endurance, flexibility | MUST |
| FR-G03 | Goals have a target value and a target date | MUST |
| FR-G04 | Goals can be active, paused, or completed | MUST |
| FR-G05 | Goals influence calorie/macro targets | MUST |

### 2.4 Nutrition Tracking

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-N01 | Users can search for food items from a structured database | MUST |
| FR-N02 | Users can log food items with portion sizes | MUST |
| FR-N03 | Users can log food using natural language (AI-assisted) | MUST |
| FR-N04 | Each food entry records: calories, protein, carbohydrates, fat | MUST |
| FR-N05 | Meals grouped as: Breakfast, Lunch, Dinner, Snacks (extensible) | MUST |
| FR-N06 | Daily nutrition totals are calculated deterministically | MUST |
| FR-N07 | Daily progress is shown against targets | MUST |
| FR-N08 | Remaining daily intake is calculated and displayed | MUST |
| FR-N09 | Users can edit or delete food entries | MUST |
| FR-N10 | Custom food items can be created | SHOULD |

### 2.5 Workout Tracking

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-W01 | Users can browse an exercise database | MUST |
| FR-W02 | Users can log a workout session | MUST |
| FR-W03 | Each workout contains multiple exercises | MUST |
| FR-W04 | Exercise entry records: sets, reps, weight (strength); duration, distance (cardio) | MUST |
| FR-W05 | Users can view workout history | MUST |
| FR-W06 | Users can create custom exercises | SHOULD |
| FR-W07 | Workouts can be tagged (push, pull, legs, cardio, etc.) | SHOULD |

### 2.6 Progress Tracking

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-PR01 | Users can log body weight over time | MUST |
| FR-PR02 | Weight history is stored with timestamps | MUST |
| FR-PR03 | Progress charts shown for weight, nutrition, and workouts | MUST |
| FR-PR04 | Progress is compared against goals | MUST |

### 2.7 Dashboard & Analytics

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-D01 | Dashboard shows today's nutrition summary | MUST |
| FR-D02 | Dashboard shows recent workouts | MUST |
| FR-D03 | Dashboard shows goal progress | MUST |
| FR-D04 | Dashboard shows weight trend | MUST |
| FR-D05 | Weekly/monthly summary views available | SHOULD |

### 2.8 AI Features

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AI01 | AI assistant answers fitness/nutrition questions | MUST |
| FR-AI02 | AI generates meal suggestions based on remaining daily intake | MUST |
| FR-AI03 | AI generates workout suggestions based on history and goals | MUST |
| FR-AI04 | AI provides daily nutrition summaries | MUST |
| FR-AI05 | AI provides progress analysis on request | MUST |
| FR-AI06 | NL food logging: LLM extracts food items; backend resolves to DB records | MUST |
| FR-AI07 | Conversation history is maintained per user | MUST |
| FR-AI08 | AI responses grounded in retrieved domain knowledge and user data | MUST |
| FR-AI09 | AI clearly indicates when a question is outside scope | MUST |

### 2.9 RAG Features

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-R01 | A curated fitness/nutrition knowledge base is ingested and stored | MUST |
| FR-R02 | Relevant knowledge is retrieved at query time | MUST |
| FR-R03 | Retrieved content is cited in responses | MUST |
| FR-R04 | Knowledge base can be updated without redeploying | MUST |
| FR-R05 | Document sources tracked for each retrieved chunk | MUST |

---

## 3. Non-Functional Requirements

### 3.1 Reliability

| ID | Requirement |
|----|-------------|
| NFR-RL01 | API availability target: 99.5% |
| NFR-RL02 | Database data integrity maintained at all times |
| NFR-RL03 | AI service degradation must not block core tracking |
| NFR-RL04 | All DB operations must be transactional and rollback-safe |

### 3.2 Usability

| ID | Requirement |
|----|-------------|
| NFR-US01 | UI must be responsive for desktop and mobile |
| NFR-US02 | AI NL features must handle ambiguous input gracefully |
| NFR-US03 | Food search returns results within 500 ms |

### 3.3 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-MT01 | Backend must be modular; modules independently understandable |
| NFR-MT02 | All API contracts documented via OpenAPI |
| NFR-MT03 | Database migrations version-controlled |
| NFR-MT04 | Configuration is environment-driven; no hardcoded secrets |

### 3.4 Portability

| ID | Requirement |
|----|-------------|
| NFR-PT01 | Local development via Docker Compose |
| NFR-PT02 | Application deployable to standard cloud providers |

---

## 4. AI Requirements

### 4.1 LLM Integration

| ID | Requirement |
|----|-------------|
| AI-L01 | LLM API calls made through an abstraction layer |
| AI-L02 | Abstraction allows switching LLM providers without changing business logic |
| AI-L03 | Structured outputs (JSON) enforced for food extraction and recommendation tasks |
| AI-L04 | All LLM prompts version-controlled and testable |
| AI-L05 | Token usage logged per request for cost tracking |
| AI-L06 | LLM errors handled gracefully (rate limits, timeouts, content filtering) |

### 4.2 Prompt Engineering

| ID | Requirement |
|----|-------------|
| AI-P01 | System prompts establish AI persona, scope limitations, and safety boundaries |
| AI-P02 | User context (profile, goals, intake, workout history) injected into prompts |
| AI-P03 | RAG context injected with source attribution |
| AI-P04 | Prompts instruct LLM not to invent numerical user data |
| AI-P05 | Context budget-managed (token limits respected) |

### 4.3 AI Constraints

| ID | Requirement |
|----|-------------|
| AI-C01 | LLM must NOT perform nutritional calculations |
| AI-C02 | LLM must NOT retrieve structured user data; SQL handles that |
| AI-C03 | AI responses about user data must reference only data from the database |
| AI-C04 | AI must not present itself as a medical professional |

---

## 5. RAG Requirements

| ID | Requirement |
|----|-------------|
| RAG-01 | Knowledge base documents chunked, embedded, stored in pgvector |
| RAG-02 | Retrieval uses semantic vector similarity search |
| RAG-03 | Retrieved chunks include metadata: source, section title, creation date |
| RAG-04 | Retrieval supports metadata filtering (e.g., by topic category) |
| RAG-05 | System tracks which chunks were used in each AI response |
| RAG-06 | Document updates invalidate and replace stale embeddings |
| RAG-07 | Retrieval quality evaluable via offline evaluation pipeline |
| RAG-08 | Retrieved content not treated as authoritative without verification |

---

## 6. Data Requirements

| ID | Requirement |
|----|-------------|
| DR-01 | All user data scoped to authenticated user |
| DR-02 | Historical data preserved (nutrition, workouts, weight) |
| DR-03 | Soft deletion preferred for user-facing records |
| DR-04 | Audit fields (created_at, updated_at) on all major tables |
| DR-05 | Sensitive fields handled with care (email, weight, health data) |
| DR-06 | Schema changes managed through versioned migrations |
| DR-07 | Food nutrition data sourced reliably from USDA FoodData Central (Foundation Foods & SR Legacy) via offline bulk import |

---

## 7. Security Requirements

| ID | Requirement |
|----|-------------|
| SEC-01 | Passwords hashed with bcrypt (minimum cost factor 12) |
| SEC-02 | JWT tokens signed with strong secret key |
| SEC-03 | Access tokens expire (15–60 minutes recommended) |
| SEC-04 | Refresh tokens stored securely |
| SEC-05 | All endpoints require authentication except /auth/register and /auth/login |
| SEC-06 | User A cannot access User B's data (service-layer enforcement) |
| SEC-07 | Input validated with Pydantic before any DB operation |
| SEC-08 | Parameterised queries only; string-concatenated SQL prohibited |
| SEC-09 | CORS policy explicitly configured |
| SEC-10 | Rate limiting on auth and AI endpoints |
| SEC-11 | Secrets in environment variables; never in source code |
| SEC-12 | AI prompts constructed server-side; user input sanitised before injection |
| SEC-13 | System guards against prompt injection attacks |
| SEC-14 | Sensitive user data sent to LLM minimised |

---

## 8. Performance Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| PERF-01 | Food search response time | < 500 ms p95 |
| PERF-02 | Nutrition daily summary response time | < 300 ms p95 |
| PERF-03 | AI assistant response time (streaming) | First token < 2 s |
| PERF-04 | RAG retrieval time | < 200 ms p95 |
| PERF-05 | Dashboard load (all data) | < 1 s p95 |
| PERF-06 | High-frequency queries must use indexes | Required |

---

## 9. Scalability Requirements

> **Note:** Portfolio project — extreme scalability not required. Architecture must avoid anti-patterns.

| ID | Requirement |
|----|-------------|
| SC-01 | Stateless API (session state in JWT, not server memory) |
| SC-02 | Database connection pooling via SQLAlchemy |
| SC-03 | Background jobs for embedding generation (non-blocking) |
| SC-04 | AI calls must not block critical path operations |
| SC-05 | Support at least 100 concurrent users without re-architecting |

---

## 10. User Journeys

### Journey 1: New User Onboarding
```
Register → Create Profile → Set Fitness Goal
→ View Personalised Calorie/Macro Targets → Dashboard
```

### Journey 2: Manual Food Logging
```
Dashboard → Nutrition → Add Food → Search Food Item
→ Select Serving Size → Log Entry → View Updated Daily Totals
```

### Journey 3: AI Natural-Language Food Logging
```
Dashboard → "I had 2 scrambled eggs and toast"
→ LLM extracts [egg: 2, bread: 2 slices]
→ Backend resolves food items from DB
→ Confirm and log → View Updated Daily Totals
```

### Journey 4: Workout Logging
```
Workouts → New Workout → Add Exercises → Log Sets/Reps/Weight
→ Finish Workout → View Workout Summary
```

### Journey 5: AI Nutrition Assistant
```
AI Chat → "What should I eat for dinner?"
→ Backend retrieves: remaining calories/macros + RAG knowledge
→ LLM generates grounded meal suggestions
→ User sees suggestions with nutritional breakdown
```

### Journey 6: Progress Review
```
Progress → View Weight Chart → View Nutrition Trends → View Workout Frequency
→ "Analyze my last 2 weeks" → AI generates summary
```

### Journey 7: RAG-Powered Knowledge Query
```
AI Chat → "Does intermittent fasting help with fat loss?"
→ RAG retrieves relevant knowledge chunks
→ LLM generates grounded response with citations
→ User sees answer with sources
```

### Journey 8: Hybrid Personalised Recommendation
```
AI Chat → "Why haven't I been losing weight?"
→ Backend retrieves: recent calorie intake, weight history, workout log
→ RAG retrieves: energy balance, plateau concepts, TDEE
→ LLM generates personalised analysis referencing user's own data + domain knowledge
```

---

## 11. Confirmed vs. Assumed Requirements

### Confirmed (Explicitly Stated)
- React + TypeScript frontend
- Python + FastAPI backend
- PostgreSQL primary database
- pgvector for vector storage
- Modular monolith architecture
- LLM must NOT perform nutritional calculations
- Natural-language food logging with DB resolution
- Hybrid personal + RAG retrieval
- No separate AI microservice (initially)
- No automatic progression to Phase 1

### Assumptions (Not Explicitly Stated)

| Assumption | Rationale | Risk if Wrong |
|------------|-----------|---------------|
| OpenAI API as initial LLM provider | Most accessible for portfolio demos | Need abstraction layer to swap |
| English-language interface initially | Simplifies NLP | Localisation is significant scope addition |
| Single-user account model | Not a multi-tenant SaaS | Minor redesign if teams needed |
| Food database populated from USDA FoodData Central via offline bulk JSON import script (see ADR-013) | Required for NL logging resolution and food search | Without local food database, food search and NL logging cannot work |
| Email verification optional for MVP | Reduces early scope | Security gap; add before production |
| text-embedding-ada-002 or equivalent as embedding model | Well-documented, widely used | Vendor lock-in if not abstracted |
| No payment/subscription model | Portfolio context | Major scope addition if monetised |

---

## 12. Open Questions

| # | Question | Impact | Needed By |
|---|----------|--------|-----------|
| OQ-01 | Which LLM provider (OpenAI, Anthropic, Gemini)? | Prompt format, function calling API, cost | Phase 8 |
| OQ-02 | [Resolved — ADR-013] Which food database seeds food_items? | Resolved: USDA FoodData Central | Phase 0 |
| OQ-03 | Are streaming responses required for AI assistant? | Frontend complexity, API design | Phase 11 |
| OQ-04 | Target knowledge base size (number of documents)? | Chunking strategy, pgvector index type | Phase 9 |
| OQ-05 | Is email verification required for MVP? | Auth flow design | Phase 4 |
| OQ-06 | Are user-created foods visible to all users? | Data model scoping | Phase 5 |
| OQ-07 | Should workout suggestions include pre-built templates? | Workout data model complexity | Phase 6 |
| OQ-08 | Deployment target (AWS, Railway, Render, etc.)? | Infrastructure and CI/CD design | Phase 16 |
| OQ-09 | Is refresh token rotation required? | Auth security design | Phase 4 |
| OQ-10 | Will micronutrient tracking be required (vitamins, minerals)? | Food data model scope | Phase 5 |
