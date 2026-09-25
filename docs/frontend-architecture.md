# Phase 8 — Frontend Architecture & API Integration Specification

**Status:** APPROVED FOR DESIGN / PENDING IMPLEMENTATION REVIEW  
**Mode:** INSPECT + DESIGN ONLY (Zero code changes, zero database changes, zero commits)  
**Target Application:** AI-Powered Personalized Fitness & Nutrition Platform Frontend  
**Technology Stack:** React 18+ | TypeScript (Strict) | Vite | React Router v6 | Native Fetch Client | Recharts | Vanilla CSS Tokens  

---

## Executive Summary

Phase 8 defines the complete, production-ready frontend architecture for the AI Fitness & Nutrition Assistant platform. This specification is derived entirely from **direct static inspection** of the implemented, tested, and verified FastAPI backend (Phases 0 through 7D: 302/302 regression tests passing, Ruff clean, Mypy clean, PostgreSQL + pgvector active).

No backend APIs are invented or modified. All frontend routes, components, data contracts, and workflows map 1:1 to live backend endpoints in `backend/app/api/v1/routes/`.

---

## 1. Current Backend API Inventory

The backend exposes 38 distinct endpoints under the `/api/v1` prefix. All authenticated endpoints require a valid JWT Bearer access token (`Authorization: Bearer <access_token>`) possessing the claim `type: "access"`.

### 1.1 Health
| Method | Path | Auth | Parameters / Body | Response Schema | Status | Ownership / Security |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | None (Public) | None | `{"status": "healthy"}` | 200 | Open health check probe |

### 1.2 Authentication & Account Management
| Method | Path | Auth | Parameters / Body | Response Schema | Status | Ownership / Security |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | None (Public) | Body: `UserRegisterRequest` (`email`, `password`) | `UserRead` | 201 | Creates user, initializes default profile & preferences. Validates password: >=8 chars, uppercase, digit, special char. 409 if email registered. |
| `POST` | `/api/v1/auth/login` | None (Public) | Body: `UserLoginRequest` (`email`, `password`) | `TokenResponse` (`access_token`, `refresh_token`, `token_type`, `expires_in`) | 200 | Authenticates credentials with bcrypt; issues 30-min access token + 7-day refresh token. 401 on bad credentials or inactive user. |
| `POST` | `/api/v1/auth/refresh` | None (Public) | Body: `RefreshTokenRequest` (`refresh_token`) | `TokenResponse` (`access_token`, `refresh_token`, `token_type`, `expires_in`) | 200 | Validates refresh token signature & `type: "refresh"`; verifies active user in DB; re-issues access token with unchanged refresh token. 401 on expired/invalid token. |
| `POST` | `/api/v1/auth/logout` | Bearer Token | None | Empty / None | 204 | Confirms client-side token disposal. Requires authenticated session. |
| `POST` | `/api/v1/auth/change-password` | Bearer Token | Body: `ChangePasswordRequest` (`current_password`, `new_password`) | `{"message": "Password updated successfully"}` | 200 | Verifies `current_password` via bcrypt, enforces strength validation on `new_password`. 400 on incorrect password. |
| `GET` | `/api/v1/users/me` | Bearer Token | None | `UserRead` | 200 | Returns authenticated user account record. |
| `DELETE` | `/api/v1/users/me` | Bearer Token | Body: `DeleteAccountRequest` (`password`) | None | 204 | Verifies password; sets `deleted_at` timestamp and `is_active=False` (soft-delete). |

### 1.3 Profile & Preferences
| Method | Path | Auth | Parameters / Body | Response Schema | Status | Ownership / Security |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/profile` | Bearer Token | None | `UserProfileRead` | 200 | Returns user's profile with cached `current_weight_kg`. |
| `PUT` | `/api/v1/profile` | Bearer Token | Body: `UserProfileUpdate` (`first_name`, `last_name`, `date_of_birth`, `sex`, `height_cm`, `activity_level`) | `UserProfileRead` | 200 | Replaces profile values. Validates `height_cm` in `[50.0, 300.0]`. |
| `GET` | `/api/v1/profile/preferences` | Bearer Token | None | `UserPreferenceRead` | 200 | Returns preferences (targets, unit system, restrictions, persona). |
| `PATCH` | `/api/v1/profile/preferences` | Bearer Token | Body: `UserPreferenceUpdate` (`unit_system`, `calorie_target`, `protein_target_g`, `carbs_target_g`, `fat_target_g`, `dietary_restrictions`, `ai_persona`) | `UserPreferenceRead` | 200 | Updates non-null preference fields. |

### 1.4 Goals
| Method | Path | Auth | Parameters / Body | Response Schema | Status | Ownership / Security |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/goals` | Bearer Token | Query: `status` (`active`, `completed`, `abandoned`) | `FitnessGoalListResponse` (`items`, `total`) | 200 | Filtered list scoped to current user. |
| `POST` | `/api/v1/goals` | Bearer Token | Body: `FitnessGoalCreate` (`goal_type`, `description`, `target_value`, `target_unit`, `target_date`) | `FitnessGoalRead` | 201 | Creates goal defaulting to status `active`. Scoped to user. |
| `PATCH` | `/api/v1/goals/{goal_id}` | Bearer Token | Path: `goal_id` (UUID); Body: `FitnessGoalUpdate` | `FitnessGoalRead` | 200 | Modifies goal. 404 if goal does not exist or belongs to another user. |
| `DELETE` | `/api/v1/goals/{goal_id}` | Bearer Token | Path: `goal_id` (UUID) | None | 204 | Deletes goal. Enforces user ownership. 404 if not found. |

### 1.5 Progress (Weight Tracking)
| Method | Path | Auth | Parameters / Body | Response Schema | Status | Ownership / Security |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/progress/weight` | Bearer Token | Query: `from` (date), `to` (date) | `WeightHistoryResponse` (`entries`, `current_weight_kg`, `start_weight_kg`, `trend`) | 200 | Returns chronologically ordered weight logs with computed trend (`losing`, `gaining`, `maintaining`). |
| `POST` | `/api/v1/progress/weight` | Bearer Token | Body: `WeightEntryCreate` (`weight_kg`, `logged_at`, `notes`) | `WeightEntryRead` | 201 | Validates weight between 20.0 and 500.0 kg. Updates profile `current_weight_kg` cache. |
| `PATCH` | `/api/v1/progress/weight/{entry_id}` | Bearer Token | Path: `entry_id` (UUID); Body: `WeightEntryUpdate` | `WeightEntryRead` | 200 | Updates weight entry; recalculates latest weight in profile cache. 404 on ownership failure. |
| `DELETE` | `/api/v1/progress/weight/{entry_id}` | Bearer Token | Path: `entry_id` (UUID) | None | 204 | Removes entry and updates profile current weight cache. 404 on ownership failure. |

### 1.6 Food Catalog & Custom Foods
| Method | Path | Auth | Parameters / Body | Response Schema | Status | Ownership / Security |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/foods` | Bearer Token | Query: `q` (str), `category` (str), `page` (int>=1), `size` (int 1-100) | `FoodSearchResponse` (`items`, `total`, `page`, `size`, `pages`) | 200 | Global catalog items + custom items created by the authenticated user. |
| `GET` | `/api/v1/foods/{food_id}` | Bearer Token | Path: `food_id` (UUID) | `FoodItemRead` | 200 | Returns item details and array of available `servings`. 404 if not found or private to another user. |
| `POST` | `/api/v1/foods` | Bearer Token | Body: `CustomFoodCreate` (`name`, `brand`, `category`, `calories_per_100g`, `protein_per_100g`, `carbs_per_100g`, `fat_per_100g`, `servings`) | `FoodItemRead` | 201 | Creates custom food owned by current user (`is_verified=False`). |
| `PATCH` | `/api/v1/foods/{food_id}` | Bearer Token | Path: `food_id` (UUID); Body: `CustomFoodUpdate` | `FoodItemRead` | 200 | Updates custom food. Strict 403 / 404 if not owned by user or system-verified. |
| `DELETE` | `/api/v1/foods/{food_id}` | Bearer Token | Path: `food_id` (UUID) | None | 204 | Soft-deletes user-created food item. Owner only. |

### 1.7 Nutrition Logging & Natural Language Flow
| Method | Path | Auth | Parameters / Body | Response Schema | Status | Ownership / Security |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/nutrition/daily` | Bearer Token | Query: `date` (`YYYY-MM-DD`) | `DailyNutritionSummaryResponse` (`date`, `totals`, `meals: dict[str, MealSummary]`) | 200 | Calculates daily aggregated calories, macros, and meal breakdowns (`breakfast`, `lunch`, `dinner`, `snack`). |
| `POST` | `/api/v1/nutrition/entries` | Bearer Token | Body: `FoodEntryCreate` (`food_item_id`, `meal_type`, `logged_at`, `quantity_g` OR `serving_id` + `serving_count`) | `FoodEntryRead` | 201 | Computes and snapshots macros deterministically from DB catalog. Rejects timezone-naive `logged_at`. |
| `PATCH` | `/api/v1/nutrition/entries/{entry_id}` | Bearer Token | Path: `entry_id` (UUID); Body: `FoodEntryUpdate` | `FoodEntryRead` | 200 | Updates quantity or serving; re-computes snapshot macros. Owner only. |
| `DELETE` | `/api/v1/nutrition/entries/{entry_id}` | Bearer Token | Path: `entry_id` (UUID) | None | 204 | Soft-deletes food entry. Owner only. |
| `GET` | `/api/v1/nutrition/history` | Bearer Token | Query: `from` (date), `to` (date) | `NutritionHistoryResponse` (`items: list[NutritionHistoryItem]`, `total_days`) | 200 | Aggregated daily totals across range for trend charts. |
| `POST` | `/api/v1/nutrition/log-natural-language` | Bearer Token | Body: `NaturalLanguageLogRequest` (`text`, `meal_type`, `logged_at`) | `NaturalLanguageLogPreview` (`extraction_id`, `resolved_items`, `unresolved`, `total_calories`, ...) | 200 | Step 1 of NL flow: LLM extracts items, system deterministically matches catalog items, returns preview. **Does NOT persist data.** |
| `POST` | `/api/v1/nutrition/log-natural-language/confirm` | Bearer Token | Body: `NaturalLanguageConfirmRequest` (`confirmed_items: list[ConfirmedFoodItem]`) | `list[FoodEntryRead]` | 201 | Step 2 of NL flow: User confirms items; server verifies catalog IDs and calculates authoritative snapshot entries. |

### 1.8 Exercises
| Method | Path | Auth | Parameters / Body | Response Schema | Status | Ownership / Security |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/exercises` | Bearer Token | Query: `q`, `category`, `muscle_group`, `page`, `size` | `ExerciseSearchResponse` (`items`, `total`, `page`, `size`, `pages`) | 200 | Catalogs exercises (global + custom created by current user). |
| `GET` | `/api/v1/exercises/{exercise_id}` | Bearer Token | Path: `exercise_id` (UUID) | `ExerciseRead` | 200 | Single exercise details. |
| `POST` | `/api/v1/exercises` | Bearer Token | Body: `ExerciseCreate` (`name`, `category`, `muscle_groups`, `equipment`, `instructions`) | `ExerciseRead` | 201 | Creates user custom exercise. |
| `PATCH` | `/api/v1/exercises/{exercise_id}` | Bearer Token | Path: `exercise_id` (UUID); Body: `ExerciseUpdate` | `ExerciseRead` | 200 | Updates user custom exercise. Owner only. |
| `DELETE` | `/api/v1/exercises/{exercise_id}` | Bearer Token | Path: `exercise_id` (UUID) | None | 204 | Soft-deletes user custom exercise. Owner only. |

### 1.9 Workouts
| Method | Path | Auth | Parameters / Body | Response Schema | Status | Ownership / Security |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/workouts` | Bearer Token | Body: `WorkoutSessionCreate` (`name`, `notes`, `started_at`, `ended_at`, `tags`, `exercises: list[WorkoutExerciseCreate]`) | `WorkoutSessionRead` | 201 | Standalone or nested session creation with exercises and sets. `duration_minutes` is server-calculated. Requires timezone-aware timestamps. |
| `GET` | `/api/v1/workouts` | Bearer Token | Query: `from_date`, `to_date`, `page`, `size` | `WorkoutSessionSummaryResponse` (`items`, `total`, `page`, `size`, `pages`) | 200 | Paginated history of sessions with nested exercises and sets. Scoped to user. |
| `GET` | `/api/v1/workouts/{workout_id}` | Bearer Token | Path: `workout_id` (UUID) | `WorkoutSessionRead` | 200 | Full session details. Owner only. |
| `PATCH` | `/api/v1/workouts/{workout_id}` | Bearer Token | Path: `workout_id` (UUID); Body: `WorkoutSessionUpdate` | `WorkoutSessionRead` | 200 | Updates session metadata/timestamps. Owner only. |
| `DELETE` | `/api/v1/workouts/{workout_id}` | Bearer Token | Path: `workout_id` (UUID) | None | 204 | Soft-deletes workout session. Owner only. |
| `POST` | `/api/v1/workouts/{workout_id}/exercises` | Bearer Token | Path: `workout_id`; Body: `WorkoutExerciseCreate` (`exercise_id`, `order_index`, `notes`, `sets`) | `WorkoutExerciseRead` | 201 | Adds an exercise entry (and optional initial sets) to an active session. |
| `PATCH` | `/api/v1/workouts/{workout_id}/exercises/{exercise_entry_id}` | Bearer Token | Paths: `workout_id`, `exercise_entry_id`; Body: `WorkoutExerciseUpdate` | `WorkoutExerciseRead` | 200 | Updates exercise notes or order index. |
| `DELETE` | `/api/v1/workouts/{workout_id}/exercises/{exercise_entry_id}` | Bearer Token | Paths: `workout_id`, `exercise_entry_id` | None | 204 | Removes exercise entry and its associated sets. |
| `POST` | `/api/v1/workouts/{workout_id}/exercises/{exercise_entry_id}/sets` | Bearer Token | Paths: `workout_id`, `exercise_entry_id`; Body: `WorkoutSetCreate` (`set_number`, `set_type`, `reps`, `weight_kg`, `duration_seconds`, `distance_m`, `rpe`, `completed`) | `WorkoutSetRead` | 201 | Adds a set to an exercise entry. Validates `rpe` (1.0–10.0 in 0.5 steps), `set_type` (`warmup`, `working`, `drop_set`, `failure`). |
| `PATCH` | `/api/v1/workouts/{workout_id}/exercises/{exercise_entry_id}/sets/{set_id}` | Bearer Token | Paths: `workout_id`, `exercise_entry_id`, `set_id`; Body: `WorkoutSetUpdate` | `WorkoutSetRead` | 200 | Updates set data. |
| `DELETE` | `/api/v1/workouts/{workout_id}/exercises/{exercise_entry_id}/sets/{set_id}` | Bearer Token | Paths: `workout_id`, `exercise_entry_id`, `set_id` | None | 204 | Deletes specific set. |

### 1.10 AI Assistant
| Method | Path | Auth | Parameters / Body | Response Schema | Status | Ownership / Security |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/ai/chat` | Bearer Token | Body: `ChatRequest` (`message`, `conversation_id: UUID | null`) | `ChatResponse` (`conversation_id`, `message_id`, `response`, `sources: list[ChatSourceRead]`, `user_data_used`, `tokens_used`) | 200 | Standard synchronous REST request/response. Returns answer enriched with RAG chunk citations and list of user metrics inspected. |
| `GET` | `/api/v1/ai/conversations` | Bearer Token | Query: `page`, `size` | `ConversationListResponse` (`items: list[ConversationSummaryRead]`, `total`, `page`, `size`, `pages`) | 200 | Lists user conversations with message counts and timestamps. |
| `GET` | `/api/v1/ai/conversations/{conversation_id}` | Bearer Token | Path: `conversation_id` (UUID) | `ConversationDetailRead` (`id`, `title`, `created_at`, `updated_at`, `messages: list[MessageDetailRead]`) | 200 | Returns conversation with full message history and citations. Owner only. |
| `DELETE` | `/api/v1/ai/conversations/{conversation_id}` | Bearer Token | Path: `conversation_id` (UUID) | None | 204 | Deletes conversation and all associated messages and source links. |
| `POST` | `/api/v1/ai/summarise-today` | Bearer Token | Query: `date` (`YYYY-MM-DD`, optional) | `DailySummaryResponse` (`summary`, `highlights: list[str]`, `tokens_used`) | 200 | Generates an AI narrative review of nutrition and workouts for the requested day. |

### 1.11 Recommendations (Deterministic + AI Enrichment Layer)
| Method | Path | Auth | Parameters / Body | Response Schema | Status | Ownership / Security |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/recommendations/meals` | Bearer Token | Query: `meal_type` (str), `target_calories` (int, 100-2500), `allergies` (str list), `disliked_foods` (str list), `limit` (int 1-20), `include_ai` (bool, default `False`) | `MealRecommendationResponse` | 200 | Returns deterministic meal candidates scored against calorie/macro budget. When `include_ai=true`, adds `ai_summary`, `ai_considerations`, `ai_explanation`, and validated `ai_rank`. If LLM fails, returns `ai_fallback=true` with deterministic data intact. |
| `GET` | `/api/v1/recommendations/workouts` | Bearer Token | Query: `target_duration_minutes` (int, 15-120), `workout_type` (canonical str), `equipment` (str list), `limit` (int 1-10), `include_ai` (bool, default `False`) | `WorkoutRecommendationResponse` | 200 | Returns deterministic workout candidates generated from catalog exercises and scored against training history. When `include_ai=true`, enriches with non-authoritative AI narrative. Fallback gracefully supported. |

### 1.12 RAG Ingestion & Admin Search (Administrative Only)
| Method | Path | Auth | Parameters / Body | Response Schema | Status | Security Requirement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/rag/documents` | Header: `X-Admin-Key` | Body: `DocumentIngestRequest` | `DocumentIngestResponse` | 202 | Backend administrative endpoint. **Not exposed to normal users.** |
| `GET` | `/api/v1/rag/documents` | Header: `X-Admin-Key` | Query: `skip`, `limit` | `list[DocumentSummaryRead]` | 200 | Admin only. |
| `GET` | `/api/v1/rag/documents/{id}` | Header: `X-Admin-Key` | Path: `id` | `DocumentDetailRead` | 200 | Admin only. |
| `DELETE` | `/api/v1/rag/documents/{id}` | Header: `X-Admin-Key` | Path: `id` | None | 204 | Admin only. |
| `POST` | `/api/v1/rag/search` | Header: `X-Admin-Key` | Body: `RAGSearchRequest` | `list[ChunkSearchResult]` | 200 | Admin diagnostic search. |

*Architectural Confirmation:* End-users never query `/api/v1/rag/*` directly. Relevant knowledge chunks are retrieved internally during `POST /api/v1/ai/chat` and surfaced via `ChatResponse.sources`.

---

## 2. Authentication Architecture

### 2.1 Backend Implementation Details (Phase 3)
1. **JWT Specifications:**
   - **Access Token:** 30-minute validity (`ACCESS_TOKEN_EXPIRE_MINUTES = 30`), encoded with `HS256`, containing claims: `sub` (User UUID), `type: "access"`, `iat`, `exp`, `jti`.
   - **Refresh Token:** 7-day validity (`REFRESH_TOKEN_EXPIRE_DAYS = 7`), encoded with `HS256`, containing claims: `sub` (User UUID), `type: "refresh"`, `iat`, `exp`, `jti`.
2. **Access Token Enforcement:** `get_current_user` in `backend/app/api/dependencies/auth.py` strictly verifies `payload.get("type") == "access"`. Refresh tokens submitted to protected routes are rejected with HTTP 401.
3. **Refresh Route:** `POST /api/v1/auth/refresh` expects `{ "refresh_token": "..." }`, validates `type: "refresh"`, ensures the user exists and is active, and returns a new 30-minute access token while returning the valid refresh token.
4. **Stateless Logout:** `POST /api/v1/auth/logout` verifies authentication and returns 204 No Content. JWT invalidation on the client requires clearing client-stored tokens.

### 2.2 Storage Strategy Decision
- **In-Memory vs localStorage vs Cookies:**
  - *HttpOnly Cookies:* While technically the most resilient against XSS, the backend returns tokens directly in the JSON response body (`TokenResponse`) and does not issue `Set-Cookie` headers. Altering the backend response format is strictly disallowed by the project boundaries.
  - *Pure In-Memory:* Loses session state upon any browser refresh, forcing the user to log in again.
  - *Decided Practical Hybrid Architecture:*
    1. **Primary Tokens in `localStorage`:** The `access_token` and `refresh_token` are stored in `localStorage` under distinct keys (`fitness_access_token`, `fitness_refresh_token`).
    2. **Active State in React Context:** Upon application bootstrap, the token is read from `localStorage`, verified for expiration client-side, and stored in React memory (`AuthContext`).
    3. **Silent Background Refresh:** The centralized API client intercepts any HTTP 401 response, transparently pauses pending requests, calls `POST /api/v1/auth/refresh` with the stored refresh token, updates `localStorage` and memory, and retries the original request.
    4. **Clean Logout:** Clears both tokens from `localStorage`, resets React AuthContext, and redirects to `/login`.

---

## 3. Frontend Technology Decisions

| Category | Decision | Justification |
| :--- | :--- | :--- |
| **Framework** | **React 18+** | Industry standard, functional components with hooks, robust ecosystem, high rendering efficiency. |
| **Language** | **TypeScript (Strict)** | Strict compile-time typing matching Pydantic backend models; eliminates undefined runtime errors across complex data models. |
| **Build Tool** | **Vite** | Lightning-fast HMR and build times; native ES modules; default dev server port 5173 natively matches `CORS_ORIGINS` in `backend/app/core/config.py`. |
| **Routing** | **React Router v6** | Declarative client-side routing, layout nesting, declarative route guards (`<ProtectedRoute>` / `<PublicRoute>`). |
| **API Client** | **Centralized Fetch Wrapper** | Minimal, zero-dependency typed wrapper around native `fetch`. Implements request queuing, automatic Bearer header injection, 401 token refresh retry, and strongly typed exception parsing. Eliminates need for heavy Axios/React Query dependencies. |
| **State Management** | **React Context + Hooks** | `AuthContext` handles global authentication state. Feature-level state is maintained cleanly in localized component hooks (`useState`, `useReducer`). Eliminates Redux/Zustand boilerplate. |
| **Data Fetching** | **Custom `useApi` Hook** | Clean, declarative lifecycle handling with `AbortController` cancellation, `isLoading`, `data`, and `error` states. |
| **Forms & Validation** | **Controlled Components + Lightweight Validators** | Native form handlers paired with utility validation functions matching backend Pydantic rules (e.g. password complexity, macro positive bounds). |
| **UI Design System** | **Vanilla CSS + CSS Modules** | Zero-dependency styling utilizing modern CSS Variables (Design Tokens). Ensures absolute control over layout, transitions, glassmorphism, and responsive breakpoints without Tailwind framework baggage. |
| **Charting** | **Recharts** | Declarative SVG charting for weight progress trends and macronutrient distribution donuts. Responsive and lightweight. |
| **Testing** | **Vitest + React Testing Library + MSW** | Fast in-memory unit tests; component integration tests against mocked REST endpoints via Mock Service Worker. |

---

## 4. Frontend Architecture & Directory Structure

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx                         # Application entrypoint
│   ├── App.tsx                          # Root router provider
│   ├── index.css                        # Global CSS variables, reset, design tokens
│   │
│   ├── api/                             # Centralized API layer
│   │   ├── client.ts                    # Fetch wrapper with interceptors & refresh queue
│   │   ├── endpoints.ts                 # Strongly typed endpoint paths
│   │   └── errors.ts                    # ApiError and ValidationError classes
│   │
│   ├── components/                      # Shared reusable UI primitives
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── Tabs.tsx
│   │   ├── feedback/
│   │   │   ├── ErrorAlert.tsx
│   │   │   └── EmptyState.tsx
│   │   └── charts/
│   │       ├── WeightTrendChart.tsx
│   │       └── MacroDonutChart.tsx
│   │
│   ├── context/                         # Global application contexts
│   │   ├── AuthContext.tsx              # Auth state, login, logout, refresh
│   │   └── ToastContext.tsx             # Notification toast queue
│   │
│   ├── features/                        # Domain-driven feature modules
│   │   ├── auth/                        # Login, Register, Password Change
│   │   │   ├── components/LoginForm.tsx
│   │   │   ├── components/RegisterForm.tsx
│   │   │   └── authApi.ts
│   │   ├── dashboard/                   # Aggregated dashboard widgets
│   │   │   ├── components/DailyNutritionWidget.tsx
│   │   │   ├── components/WeightWidget.tsx
│   │   │   ├── components/RecentWorkoutsWidget.tsx
│   │   │   └── components/QuickActions.tsx
│   │   ├── profile/                     # User profile, goals, preferences
│   │   │   ├── components/ProfileForm.tsx
│   │   │   ├── components/PreferencesForm.tsx
│   │   │   ├── components/GoalList.tsx
│   │   │   ├── components/GoalModal.tsx
│   │   │   └── profileApi.ts
│   │   ├── nutrition/                   # Food search, logging, NL flow
│   │   │   ├── components/DailyMealSection.tsx
│   │   │   ├── components/FoodSearchModal.tsx
│   │   │   ├── components/ManualFoodEntryModal.tsx
│   │   │   ├── components/NaturalLanguageLogger.tsx
│   │   │   ├── components/NaturalLanguagePreviewModal.tsx
│   │   │   └── nutritionApi.ts
│   │   ├── workouts/                    # Exercise catalog, sessions, sets
│   │   │   ├── components/WorkoutHistoryList.tsx
│   │   │   ├── components/WorkoutSessionLogger.tsx
│   │   │   ├── components/ExerciseSelectorModal.tsx
│   │   │   ├── components/SetEntryRow.tsx
│   │   │   └── workoutApi.ts
│   │   ├── recommendations/             # Meal & Workout recommendations
│   │   │   ├── components/MealRecommendationCard.tsx
│   │   │   ├── components/WorkoutRecommendationCard.tsx
│   │   │   ├── components/FactorScorePopover.tsx
│   │   │   ├── components/AiEnrichmentToggle.tsx
│   │   │   └── recommendationApi.ts
│   │   └── ai/                          # AI Assistant & Chat
│   │       ├── components/ChatWindow.tsx
│   │       ├── components/ChatMessageItem.tsx
│   │       ├── components/CitationBadge.tsx
│   │       ├── components/ConversationListDrawer.tsx
│   │       └── aiApi.ts
│   │
│   ├── hooks/                           # Shared utility hooks
│   │   ├── useApi.ts                    # Async request hook with loading/error state
│   │   ├── useDebounce.ts               # Input debouncing for search
│   │   └── useAuth.ts                   # AuthContext convenience hook
│   │
│   ├── layouts/                         # Page shell layouts
│   │   ├── AppLayout.tsx                # Authenticated layout (Sidebar + Header + Content)
│   │   ├── AuthLayout.tsx               # Public centered card layout
│   │   ├── Sidebar.tsx                  # Desktop navigation sidebar
│   │   ├── Header.tsx                   # Top bar with user profile & quick info
│   │   └── MobileNav.tsx                # Bottom navigation bar for mobile
│   │
│   ├── pages/                           # Route entrypoint components
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── ProfilePage.tsx
│   │   ├── NutritionPage.tsx
│   │   ├── WorkoutsPage.tsx
│   │   ├── WorkoutDetailPage.tsx
│   │   ├── RecommendationsPage.tsx
│   │   ├── AiChatPage.tsx
│   │   └── NotFoundPage.tsx
│   │
│   ├── routes/                          # Route definitions & guards
│   │   ├── AppRoutes.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── PublicRoute.tsx
│   │
│   ├── types/                           # TypeScript interfaces mapped to Pydantic schemas
│   │   ├── api.ts                       # Generic API error & pagination types
│   │   ├── user.ts                      # User, Profile, Preference, Auth
│   │   ├── goal.ts                      # FitnessGoal types
│   │   ├── progress.ts                  # WeightEntry types
│   │   ├── food.ts                      # FoodItem, Serving types
│   │   ├── nutrition.ts                 # FoodEntry, DailySummary, NL Preview
│   │   ├── exercise.ts                  # Exercise catalog types
│   │   ├── workout.ts                   # WorkoutSession, ExerciseEntry, Set types
│   │   ├── recommendation.ts            # Meal & Workout recommendation types
│   │   └── ai.ts                        # Chat, Message, Source types
│   │
│   └── utils/                           # Helper functions
│       ├── date.ts                      # Timezone-aware ISO formatting, date arithmetic
│       ├── formatters.ts                # Calories, grams, kg, duration formatters
│       └── validators.ts                # Client-side input validation rules
```

---

## 5. Application Route Map

| Path | Page Component | Layout | Access | Redirect Logic | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/login` | `LoginPage` | `AuthLayout` | Public | If authenticated -> `/dashboard` | User login form |
| `/register` | `RegisterPage` | `AuthLayout` | Public | If authenticated -> `/dashboard` | New user registration |
| `/dashboard` | `DashboardPage` | `AppLayout` | Protected | If unauthenticated -> `/login` | Main overview dashboard |
| `/profile` | `ProfilePage` | `AppLayout` | Protected | If unauthenticated -> `/login` | Profile, goals, preferences |
| `/nutrition` | `NutritionPage` | `AppLayout` | Protected | If unauthenticated -> `/login` | Daily log, food search, NL log |
| `/workouts` | `WorkoutsPage` | `AppLayout` | Protected | If unauthenticated -> `/login` | Workout history & active session |
| `/workouts/:id`| `WorkoutDetailPage` | `AppLayout` | Protected | If unauthenticated -> `/login` | View details of a specific session |
| `/recommendations` | `RecommendationsPage` | `AppLayout` | Protected | If unauthenticated -> `/login` | Meal & workout recommendation hub |
| `/ai` | `AiChatPage` | `AppLayout` | Protected | If unauthenticated -> `/login` | AI conversation assistant |
| `/ai/:conversationId` | `AiChatPage` | `AppLayout` | Protected | If unauthenticated -> `/login` | Specific AI conversation thread |
| `*` | `NotFoundPage` | `AppLayout` / Standalone | Any | None | 404 resource not found |

### Route Protection Flow
```
User navigates to URL
       │
       ▼
Is Route Protected? ──(No)──► Is Route Public-Only (/login, /register)?
       │                                     │
     (Yes)                                 (Yes)
       │                                     │
Is User Authenticated?                Is User Authenticated?
  ├── (No)  ──► Redirect to /login      ├── (Yes) ──► Redirect to /dashboard
  └── (Yes) ──► Render AppLayout        └── (No)  ──► Render AuthLayout
```

---

## 6. Dashboard Architecture

The dashboard aggregates data from four backend domains to provide an instant, unified snapshot of the user's daily status without unnecessary API calls.

### 6.1 Widget Architecture Matrix

| Widget | Backend Endpoint | Request Trigger | Primary Response Data | Loading State | Empty State | Error State |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Calorie & Macro Tracker** | `GET /api/v1/nutrition/daily?date={today}` and `GET /api/v1/profile/preferences` | Page Mount | `totals: DailyTotals`, `calorie_target`, `protein_target_g`, etc. | Circular skeleton gauge | Shows 0 kcal consumed with target budget remaining | Error banner with Retry button |
| **Meal Breakdown List** | `GET /api/v1/nutrition/daily?date={today}` | Reuses daily call | `meals: dict[str, MealSummary]` (`breakfast`, `lunch`, `dinner`, `snack`) | 4-row card skeletons | "No meals logged today yet" + Log Food button | Inline retry prompt |
| **Weight Trend Sparkline** | `GET /api/v1/progress/weight` (last 30 days) and `GET /api/v1/goals?status=active` | Page Mount | `entries: list[WeightHistoryItem]`, `current_weight_kg`, `trend` | Line chart shimmer | "No weight logged yet" + Log Weight button | Inline error message |
| **Recent Workouts** | `GET /api/v1/workouts?page=1&size=3` | Page Mount | `items: list[WorkoutSessionRead]` | 3-row session card skeletons | "No workouts logged this week" + Start Workout button | Inline error banner |
| **Daily AI Narrative** | `POST /api/v1/ai/summarise-today?date={today}` | On-Demand (User Click) | `summary: str`, `highlights: list[str]` | Pulsing text skeleton with status message | Button: "Generate Today's AI Summary" | Toast error notification |

---

## 7. Nutrition UI & Natural Language Flow

### 7.1 Authoritative Two-Step Natural Language Flow
The system strictly enforces the backend's deterministic authority architecture. Under no circumstances does the frontend directly persist AI-generated nutritional values.

```
Step 1: User Text Input
("2 scrambled eggs and a slice of toast for breakfast")
       │
       ▼
POST /api/v1/nutrition/log-natural-language
{
  "text": "2 scrambled eggs and a slice of toast for breakfast",
  "meal_type": "breakfast",
  "logged_at": "2026-09-23T08:30:00Z"
}
       │
       ▼ (Backend extracts items, queries food catalog deterministically)
Response: NaturalLanguageLogPreview
{
  "extraction_id": "...",
  "resolved_items": [
    { "food_item_id": "uuid-1", "food_name": "Egg, whole, raw", "quantity_g": 100.0, "calories": 143.0, "confidence": "high" },
    { "food_item_id": "uuid-2", "food_name": "Bread, whole wheat", "quantity_g": 35.0, "calories": 87.0, "confidence": "medium" }
  ],
  "unresolved": [],
  "total_calories": 230.0, ...
}
       │
       ▼
Step 2: Preview & Confirmation Modal
User inspects resolved items, modifies quantity if desired, adjusts meal type.
Unresolved items display suggestions to search the catalog manually.
User clicks "Confirm & Log Entries"
       │
       ▼
POST /api/v1/nutrition/log-natural-language/confirm
{
  "confirmed_items": [
    { "food_item_id": "uuid-1", "quantity_g": 100.0, "meal_type": "breakfast", "logged_at": "2026-09-23T08:30:00Z" },
    { "food_item_id": "uuid-2", "quantity_g": 35.0, "meal_type": "breakfast", "logged_at": "2026-09-23T08:30:00Z" }
  ]
}
       │
       ▼
Backend recalculates macros from DB food catalog, snapshots values, and creates FoodEntry records.
Status: 201 Created -> Frontend updates daily summary cache and closes modal.
```

### 7.2 Manual Food Search & Entry Flow
- **Search:** Debounced (300ms) input calling `GET /api/v1/foods?q={query}`.
- **Serving Selection:** Food detail modal displays available servings (`food.servings`). User selects either a pre-configured serving (e.g., "1 large egg (50g)") with count, or enters direct `quantity_g`.
- **Submission:** Submits `POST /api/v1/nutrition/entries` satisfying backend mutual exclusivity (`quantity_g` OR `serving_id` + `serving_count`).

---

## 8. Workout UI & Logging Flow

### 8.1 Workout Creation Architecture
The backend supports two distinct workout tracking paradigms:
1. **Single-Request Retrospective Logging:** User fills out a complete completed workout and submits nested `WorkoutSessionCreate` with exercises and sets in a single `POST /api/v1/workouts`.
2. **Live Session Incremental Tracking:**
   - **Start Workout:** `POST /api/v1/workouts` with `started_at = now()` and empty exercises. Receives `workout_id`.
   - **Add Exercise:** User picks exercise from catalog (`GET /api/v1/exercises`); UI calls `POST /api/v1/workouts/{id}/exercises`.
   - **Log Set:** User logs reps and weight; UI calls `POST /api/v1/workouts/{id}/exercises/{eid}/sets`.
   - **Finish Workout:** UI updates session `ended_at = now()` via `PATCH /api/v1/workouts/{id}`. The backend automatically computes `duration_minutes`.

### 8.2 Strict Validation Constraints
- `duration_minutes` is **never submitted** in create or update requests (the backend strictly forbids extra fields and calculates duration from timestamps).
- `started_at` and `ended_at` must be explicit timezone-aware ISO 8601 strings (e.g., `2026-09-23T10:00:00+05:30` or `Z`).
- `rpe` (Rate of Perceived Exertion) must be between 1.0 and 10.0 in exact 0.5 increments.
- `set_type` must match one of: `warmup`, `working`, `drop_set`, `failure`.

---

## 9. Recommendations UI & AI Authority Boundary

### 9.1 Architecture & Endpoints
The Recommendations Hub provides separate, specialized interfaces for:
- **Meals:** `GET /api/v1/recommendations/meals`
  - Parameters: `meal_type` (breakfast, lunch, dinner, snack), `target_calories`, `allergies`, `disliked_foods`, `limit`, `include_ai`.
- **Workouts:** `GET /api/v1/recommendations/workouts`
  - Parameters: `target_duration_minutes` (15-120), `workout_type` (canonical type), `equipment`, `limit`, `include_ai`.

### 9.2 Non-Authoritative AI Presentation & Fallback Handling
The frontend visually and logically maintains strict boundaries between deterministic recommendations and AI commentary:
1. **Deterministic Core:** Nutritional values, calories, exercise selections, recommended sets, and rep ranges are displayed strictly from the deterministic fields. Frontend calculations never mutate these values based on AI text.
2. **AI Enrichment Layer:**
   - When `include_ai=true` and `ai_used=true`: An expandable "AI Coach Insights" panel displays `ai_summary` and `ai_considerations`. Each recommendation card displays `ai_explanation` and `ai_rank`.
   - When `ai_fallback=true`: An amber banner informs the user:
     > **Notice:** AI personalization is temporarily unavailable. Displaying verified deterministic recommendations based on your goals and targets.
   - The UI treats `ai_fallback=true` as a valid informational state, **not** as a network or recommendation error.

---

## 10. AI Assistant & RAG Citation Display

### 10.1 Chat Architecture (REST Request / Response)
- **No Streaming / WebSockets:** Backend implements standard synchronous REST endpoints (`POST /api/v1/ai/chat`). The frontend manages optimistic user message rendering with typing indicators until the response resolves.
- **Payload:** `{ "message": "...", "conversation_id": "optional-uuid" }`.
- **Response Handling:** Reads `ChatResponse` (`response`, `conversation_id`, `sources`, `user_data_used`, `tokens_used`).

### 10.2 Source Citation Badges
When `sources` are present, the UI renders interactive citation tags beneath the message:
- Clicking a citation tag opens a lightweight modal/popover displaying:
  - Document Title (e.g., "ISSN Sports Nutrition Guide")
  - Section Title (e.g., "Protein Timing & Hypertrophy")
  - Relevance Match (e.g., "88% similarity match")
- If `user_data_used` contains items (e.g., `["weight_history", "profile", "today_nutrition"]`), the UI renders a badge: "Referenced your profile & nutrition logs".

---

## 11. Centralized API Client Architecture

```typescript
// frontend/src/api/client.ts
export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export class ApiClient {
  private baseUrl: string;
  private isRefreshing: boolean = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private subscribeTokenRefresh(cb: (token: string) => void) {
    this.refreshSubscribers.push(cb);
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  public async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint, options.params);
    const token = localStorage.getItem("fitness_access_token");

    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 && !endpoint.includes("/auth/refresh") && !endpoint.includes("/auth/login")) {
      return this.handle401Retry<T>(endpoint, options);
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new ApiError(response.status, errorBody);
    }

    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  }

  private async handle401Retry<T>(endpoint: string, options: ApiRequestOptions): Promise<T> {
    const refreshToken = localStorage.getItem("fitness_refresh_token");
    if (!refreshToken) {
      this.clearSessionAndRedirect();
      throw new Error("Session expired. Please log in.");
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!refreshResponse.ok) {
          throw new Error("Failed to refresh token");
        }

        const data: TokenResponse = await refreshResponse.json();
        localStorage.setItem("fitness_access_token", data.access_token);
        this.isRefreshing = false;
        this.onRefreshed(data.access_token);
      } catch (err) {
        this.isRefreshing = false;
        this.clearSessionAndRedirect();
        throw err;
      }
    }

    return new Promise<T>((resolve) => {
      this.subscribeTokenRefresh(() => {
        resolve(this.request<T>(endpoint, options));
      });
    });
  }

  private clearSessionAndRedirect() {
    localStorage.removeItem("fitness_access_token");
    localStorage.removeItem("fitness_refresh_token");
    window.location.href = "/login";
  }

  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.pathname + url.search;
  }
}
```

---

## 12. TypeScript Type Mapping

### 12.1 Core Types (`types/user.ts`, `types/goal.ts`, `types/progress.ts`)
```typescript
export interface UserRead {
  id: string;
  email: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfileRead {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string | null;
  date_of_birth: string | null;
  sex: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  activity_level: "sedentary" | "light" | "moderate" | "very_active" | "extra_active";
  created_at: string;
  updated_at: string;
}

export interface UserPreferenceRead {
  id: string;
  user_id: string;
  unit_system: "metric" | "imperial";
  calorie_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
  dietary_restrictions: string[];
  ai_persona: "balanced" | "coach" | "scientific" | "encouraging";
  created_at: string;
  updated_at: string;
}

export interface FitnessGoalRead {
  id: string;
  user_id: string;
  goal_type: string;
  description: string | null;
  target_value: number | null;
  target_unit: string | null;
  target_date: string | null;
  status: "active" | "completed" | "abandoned";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeightEntryRead {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_at: string;
  log_date: string;
  notes: string | null;
  created_at: string;
}

export interface WeightHistoryResponse {
  entries: { id: string; date: string; weight_kg: number; notes: string | null }[];
  current_weight_kg: number | null;
  start_weight_kg: number | null;
  trend: "losing" | "gaining" | "maintaining" | null;
}
```

### 12.2 Nutrition & Food Types (`types/nutrition.ts`, `types/food.ts`)
```typescript
export interface FoodItemServingRead {
  id: string;
  food_item_id: string;
  description: string;
  grams: number;
  is_default: boolean;
}

export interface FoodItemRead {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number | null;
  sugar_per_100g: number | null;
  sodium_per_100g: number | null;
  source: string;
  is_verified: boolean;
  servings: FoodItemServingRead[];
}

export interface FoodEntryRead {
  id: string;
  user_id: string;
  food_item_id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  quantity_g: number;
  food_name_snapshot: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  data_source_snapshot: string;
  logged_at: string;
  log_date: string;
  entry_source: string;
  created_at: string;
  updated_at: string;
}

export interface DailyNutritionSummaryResponse {
  date: string;
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  meals: Record<string, {
    calories: number;
    entries: FoodEntryRead[];
  }>;
}

export interface NaturalLanguageLogPreview {
  extraction_id: string;
  resolved_items: {
    extracted_text: string;
    food_item_id: string;
    food_name: string;
    quantity_g: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    confidence: string;
  }[];
  unresolved: {
    extracted_text: string;
    recognized_name: string;
    suggested_action: string;
  }[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
}
```

### 12.3 Workout Types (`types/workout.ts`, `types/exercise.ts`)
```typescript
export interface WorkoutSetRead {
  id: string;
  workout_exercise_id: string;
  set_number: int;
  set_type: "warmup" | "working" | "drop_set" | "failure";
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  rpe: number | null;
  completed: boolean;
  created_at: string;
}

export interface WorkoutExerciseRead {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  order_index: number;
  notes: string | null;
  exercise: ExerciseRead | null;
  sets: WorkoutSetRead[];
}

export interface WorkoutSessionRead {
  id: string;
  user_id: string;
  name: string | null;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  tags: string[];
  created_at: string;
  exercises: WorkoutExerciseRead[];
}
```

### 12.4 Recommendations & AI Types (`types/recommendation.ts`, `types/ai.ts`)
```typescript
export interface FactorScoreResponse {
  factor_name: string;
  normalized_score: number;
  weight: number;
  weighted_contribution: number;
  reason: string | null;
}

export interface MealRecommendationItem {
  id: string;
  name: string;
  meal_type: string;
  components: {
    food_id: string;
    food_name: string;
    quantity_g: number;
    serving_id: string | null;
    serving_description: string;
    serving_count: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  score: number;
  reasons: string[];
  factor_scores: FactorScoreResponse[];
  ai_explanation: string | null;
  ai_rank: number | null;
}

export interface MealRecommendationResponse {
  recommendation_type: string;
  meal_type: string;
  target_calories: number | null;
  target_protein_g: number | null;
  remaining_daily_calories: number | null;
  items: MealRecommendationItem[];
  total_generated: number;
  total_survived_filtering: number;
  disclaimer: string;
  metadata: Record<string, any>;
  ai_used: boolean;
  ai_fallback: boolean;
  ai_summary: string | null;
  ai_considerations: string[];
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  response: string;
  sources: {
    chunk_id: string;
    document_title: string;
    section_title: string | null;
    similarity_score: number;
  }[];
  user_data_used: string[];
  tokens_used: number;
}
```

---

## 13. UI/UX Design System & Tokens

### 13.1 Design Tokens (`index.css`)
```css
:root {
  /* Color Palette - Premium Dark Theme */
  --bg-primary: #0b0f19;
  --bg-secondary: #111827;
  --bg-card: rgba(17, 24, 39, 0.75);
  --bg-card-hover: rgba(31, 41, 55, 0.85);
  --bg-input: #1f2937;
  
  /* Borders & Glassmorphism */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-focus: #6366f1;
  --glass-blur: blur(12px);

  /* Accents */
  --color-primary: #6366f1;         /* Indigo / Active state */
  --color-primary-hover: #4f46e5;
  --color-success: #10b981;         /* Mint / Nutrition targets */
  --color-warning: #f59e0b;         /* Amber / AI Fallback notice */
  --color-danger: #ef4444;          /* Red / Deletion, errors */
  --color-nutrition-carbs: #3b82f6; /* Blue */
  --color-nutrition-protein: #10b981;/* Emerald */
  --color-nutrition-fat: #f59e0b;   /* Amber */

  /* Text Colors */
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;

  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;

  /* Elevation & Transitions */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-card: 0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1);
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 13.2 Accessibility (a11y) Standards
- **Keyboard Navigation:** All interactive elements (`Button`, `Modal`, `Tabs`, `Input`) support full Tab, Space, Enter, and Esc key operations.
- **Focus Rings:** Visible, high-contrast outline (`2px solid var(--border-focus)`) on all `:focus-visible` elements.
- **Color Contrast:** All body text meets WCAG AA 4.5:1 contrast against dark background surfaces.
- **Screen Reader Support:** Semantic HTML tags (`<main>`, `<nav>`, `<aside>`, `<header>`, `<article>`); ARIA labels for icon-only buttons (`aria-label="Delete set"`, `role="status"` on loading spinners).

---

## 14. Responsive Layout Strategy

| Device | Screen Width | Navigation Component | Layout Transformation |
| :--- | :--- | :--- | :--- |
| **Desktop** | `>= 1024px` | Persistent Left Sidebar (260px) | 3-column dashboard grid; side-by-side chat history & thread; full exercise set tables |
| **Tablet** | `768px – 1023px` | Collapsible Compact Sidebar (72px icons) | 2-column dashboard layout; drawer for chat conversations; collapsible set tables |
| **Mobile** | `< 768px` | Fixed Bottom Navigation Bar (5 tabs) | 1-column vertically stacked widgets; modal-based chat drawer; touch-friendly stacked card set inputs |

---

## 15. Security Specification

1. **Token Protection:** Tokens stored in `localStorage` are vulnerable to malicious injected scripts. The application strictly forbids `dangerouslySetInnerHTML` and sanitizes all dynamic markdown output using HTML-escaping React Markdown parsers.
2. **Untrusted AI Content:** All text originating from `/api/v1/ai/chat` and `/api/v1/recommendations/*` is rendered as plain text or restricted markdown. Script tags, iframes, and raw HTML inside AI responses are stripped immediately.
3. **No Sensitive Leaks:** Password hashes, admin API keys (`ADMIN_API_KEY`), and backend database credentials are never bundled into frontend assets or environment variables.
4. **Ownership Boundary Handling:** When an API call returns 403 or 404 due to resource ownership restrictions (e.g. attempting to modify another user's workout or custom food), the client displays a clear user error without exposing backend stack traces.

---

## 16. Performance Optimization

1. **Code Splitting:** Every top-level page (`DashboardPage`, `NutritionPage`, `WorkoutsPage`, `AiChatPage`, `RecommendationsPage`) is wrapped in `React.lazy()` with a shared `<Suspense fallback={<PageSkeleton />}>`.
2. **Debounced Search:** Food and exercise catalog searches apply a 300ms debounce timer and use `AbortController` to cancel pending obsolete network requests when the user continues typing.
3. **Request Deduplication:** The dashboard executes parallel requests (`Promise.all`) for independent domain data on initial mount, sharing the user profile and preferences across components via React Context.

---

## 17. Frontend Testing Strategy

- **Unit Testing (Vitest):**
  - Date & timezone conversion utilities (`date.ts`).
  - Nutrition macro calculators and formatting utilities.
  - Password strength validator matching backend regex.
  - ApiClient 401 retry queue logic.
- **Component Testing (React Testing Library):**
  - Form validation states and error messages in `LoginForm` and `RegisterForm`.
  - Mutual exclusivity in `ManualFoodEntryModal` (disabling quantity when serving count is active).
  - Exercise set logger adding, updating, and removing set rows.
- **Integration Testing with Mock Service Worker (MSW):**
  - Full two-step natural language food logging flow: Input text -> verify preview modal items -> confirm -> verify entry creation.
  - AI Assistant message transmission, typing state, and citation badge popover display.
  - Recommendation fallback badge display when `ai_fallback=true`.

---

## 18. Environment Configuration

### Frontend (`frontend/.env.development`)
```env
# Base URL for backend API v1
VITE_API_BASE_URL=http://localhost:8000/api/v1

# App configuration
VITE_APP_TITLE=AI Fitness & Nutrition Assistant
```

### Vite Local Proxy Configuration (`vite.config.ts`)
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

*Note:* Backend `.env` and configuration remain 100% untouched.

---

## 19. Phase 8 Sub-Phases (Implementation Roadmap)

```
Phase 8A: Frontend Foundation (Vite, TS, API Client, Layout Shell)
   │
   ▼
Phase 8B: Authentication & Account (Login, Register, Refresh Interceptor)
   │
   ▼
Phase 8C: Layout & Dashboard (Sidebar, Metric Cards, Recharts Widgets)
   │
   ▼
Phase 8D: Profile, Preferences & Goals (Profile, Unit Toggles, Goals CRUD)
   │
   ▼
Phase 8E: Nutrition UI (Food Search, 2-Step Natural Language Flow, Daily Logs)
   │
   ▼
Phase 8F: Workout UI (Exercise Catalog, Live & Retrospective Workout Trackers)
   │
   ▼
Phase 8G: Recommendation Hub (Deterministic Meals/Workouts, AI Toggle, Fallback)
   │
   ▼
Phase 8H: AI Assistant (REST Chat, RAG Citations, Conversation Drawer)
   │
   ▼
Phase 8I: Testing, Polish & Build Verification (Vitest, MSW, a11y, Build)
```

### Sub-Phase Breakdown

#### Phase 8A — Frontend Foundation
- **Objective:** Initialize the frontend project workspace with strict TypeScript, Vite, CSS design tokens, centralized API client, and layout router shell.
- **Files/Components:** `package.json`, `vite.config.ts`, `src/index.css`, `src/api/client.ts`, `src/api/endpoints.ts`, `src/layouts/AppLayout.tsx`, `src/routes/AppRoutes.tsx`.
- **Endpoints Used:** `GET /api/v1/health`
- **Dependencies:** None
- **Acceptance Criteria:** Vite dev server boots on port 5173; health check successfully resolves.
- **Must NOT Implement Yet:** No feature pages or domain logic.

#### Phase 8B — Authentication & Session Management
- **Objective:** Implement registration, login, silent token refresh, password changes, and route guards.
- **Files/Components:** `features/auth/*`, `context/AuthContext.tsx`, `routes/ProtectedRoute.tsx`, `pages/LoginPage.tsx`, `pages/RegisterPage.tsx`.
- **Endpoints Used:** `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/users/me`.
- **Dependencies:** Phase 8A
- **Acceptance Criteria:** User can register, log in, navigate to protected route, survive page reload with refresh token, and log out.
- **Must NOT Implement Yet:** Dashboard widgets or feature pages.

#### Phase 8C — Layout & Dashboard
- **Objective:** Construct the main application shell and dashboard overview widgets.
- **Files/Components:** `layouts/Sidebar.tsx`, `layouts/MobileNav.tsx`, `pages/DashboardPage.tsx`, `features/dashboard/*`.
- **Endpoints Used:** `GET /api/v1/nutrition/daily`, `GET /api/v1/progress/weight`, `GET /api/v1/goals`, `GET /api/v1/workouts`.
- **Dependencies:** Phase 8B
- **Acceptance Criteria:** Displays calorie budget, macro progress, weight trend sparkline, and recent workouts with loading skeletons and empty states.

#### Phase 8D — Profile, Preferences & Goals
- **Objective:** Enable editing personal profile, unit systems, macro targets, and goal lifecycle.
- **Files/Components:** `features/profile/*`, `pages/ProfilePage.tsx`.
- **Endpoints Used:** `GET /api/v1/profile`, `PUT /api/v1/profile`, `GET /api/v1/profile/preferences`, `PATCH /api/v1/profile/preferences`, `GET /api/v1/goals`, `POST /api/v1/goals`, `PATCH /api/v1/goals/{id}`, `DELETE /api/v1/goals/{id}`.
- **Dependencies:** Phase 8B

#### Phase 8E — Nutrition & Food Logging
- **Objective:** Complete food catalog search, manual food logging, and the authoritative two-step natural language logging flow.
- **Files/Components:** `features/nutrition/*`, `pages/NutritionPage.tsx`.
- **Endpoints Used:** `GET /api/v1/foods`, `GET /api/v1/foods/{id}`, `POST /api/v1/foods`, `GET /api/v1/nutrition/daily`, `POST /api/v1/nutrition/entries`, `DELETE /api/v1/nutrition/entries/{id}`, `POST /api/v1/nutrition/log-natural-language`, `POST /api/v1/nutrition/log-natural-language/confirm`.
- **Dependencies:** Phase 8C
- **Acceptance Criteria:** User can search foods, log manual entries, and perform natural language extraction preview followed by confirmation.

#### Phase 8F — Workouts & Exercise Tracking
- **Objective:** Exercise catalog browsing, custom exercises, and session/set tracking.
- **Files/Components:** `features/workouts/*`, `pages/WorkoutsPage.tsx`, `pages/WorkoutDetailPage.tsx`.
- **Endpoints Used:** `GET /api/v1/exercises`, `POST /api/v1/exercises`, `POST /api/v1/workouts`, `GET /api/v1/workouts`, `GET /api/v1/workouts/{id}`, `PATCH /api/v1/workouts/{id}`, `DELETE /api/v1/workouts/{id}`, `POST /api/v1/workouts/{id}/exercises`, `POST /api/v1/workouts/{id}/exercises/{eid}/sets`.
- **Dependencies:** Phase 8C
- **Acceptance Criteria:** Retrospective nested workout logging and live set-by-set logging work seamlessly.

#### Phase 8G — Recommendation Hub
- **Objective:** Interactive meal and workout recommendations with scoring breakdowns and non-authoritative AI enrichment toggles.
- **Files/Components:** `features/recommendations/*`, `pages/RecommendationsPage.tsx`.
- **Endpoints Used:** `GET /api/v1/recommendations/meals`, `GET /api/v1/recommendations/workouts`.
- **Dependencies:** Phase 8D, 8E, 8F
- **Acceptance Criteria:** Deterministic recommendations display factor score reasons; toggling AI enrichment displays narrative; `ai_fallback=true` shows non-blocking amber notice.

#### Phase 8H — AI Assistant & RAG Citations
- **Objective:** Interactive REST chat assistant with conversation history drawer and RAG source citation popovers.
- **Files/Components:** `features/ai/*`, `pages/AiChatPage.tsx`.
- **Endpoints Used:** `POST /api/v1/ai/chat`, `GET /api/v1/ai/conversations`, `GET /api/v1/ai/conversations/{id}`, `DELETE /api/v1/ai/conversations/{id}`, `POST /api/v1/ai/summarise-today`.
- **Dependencies:** Phase 8B
- **Acceptance Criteria:** User can chat with assistant, view source citations with similarity scores, create new threads, and delete conversations.

#### Phase 8I — Testing, Accessibility & Production Polish
- **Objective:** Comprehensive unit/component tests, accessibility audit, and production build optimization.
- **Files/Components:** `tests/*`, `vitest.config.ts`.
- **Dependencies:** Phase 8A–8H
- **Acceptance Criteria:** Vitest test suite passes; production build (`vite build`) completes cleanly with zero TypeScript errors.

---

## 20. Acceptance Criteria

1. **Zero Backend Modifications:** No backend Python files, database schemas, Alembic migrations, or configurations are altered.
2. **100% Contract Adherence:** Every network request adheres precisely to backend Pydantic schemas, parameter constraints, and status codes.
3. **Deterministic Authority Preserved:** The frontend never submits AI-generated calories or macros directly as authoritative data.
4. **Seamless Token Lifecycle:** Token refresh occurs invisibly to the user upon 401 responses, and expired sessions redirect gracefully to `/login`.
5. **Responsive & Accessible:** Fluid operation across Desktop, Tablet, and Mobile with keyboard accessibility and WCAG AA contrast.

---

## 21. Explicit Deferred Functionality

The following capabilities are deliberately excluded from Phase 8:
- **No WebSockets or SSE Streaming:** Backend AI chat is strictly synchronous REST.
- **No Admin RAG Document Ingestion UI:** `/api/v1/rag/*` endpoints require `X-Admin-Key` and remain administrative backend tools.
- **No Wearable Third-Party Sync:** No integrations with Apple HealthKit, Google Health Connect, Garmin, or Fitbit.
- **No Autonomous Agent Actions:** AI assistant cannot directly mutate database state without explicit user confirmation.
- **No Social / Community Features:** No user sharing, friend lists, or public leaderboards.
- **No Payment or Subscription Processing:** System operates entirely in core application tier.
