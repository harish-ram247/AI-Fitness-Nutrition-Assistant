# API Design
## AI-Powered Personalized Fitness & Nutrition Assistant

**Version:** 1.1  
**Status:** Draft — Phase 0 (Corrected)  
**Date:** 2026-09-10

---

## Table of Contents

1. [API Conventions](#api-conventions)
2. [Authentication Endpoints](#authentication-endpoints)
3. [User & Profile Endpoints](#user--profile-endpoints)
4. [Goals Endpoints](#goals-endpoints)
5. [Food Endpoints](#food-endpoints)
6. [Nutrition Endpoints](#nutrition-endpoints)
7. [Exercise Endpoints](#exercise-endpoints)
8. [Workout Endpoints](#workout-endpoints)
9. [Progress Endpoints](#progress-endpoints)
10. [AI Endpoints](#ai-endpoints)
11. [RAG Endpoints](#rag-endpoints)
12. [Recommendations Endpoints](#recommendations-endpoints)
13. [Common Response Schemas](#common-response-schemas)
14. [Error Reference](#error-reference)

---

## 1. API Conventions

### 1.1 Base URL

```
/api/v1
```

### 1.2 Authentication

All endpoints except `/auth/register` and `/auth/login` require:

```
Authorization: Bearer <access_token>
```

### 1.3 Standard Response Envelope

**Success:**
```json
{
  "data": { ... },
  "meta": { "request_id": "req-abc-123" }
}
```

> **Note:** For simplicity in early implementation, responses can be flat (no envelope). The envelope adds overhead for a portfolio project; document the pattern but implement flat responses initially.

### 1.4 Pagination

For list endpoints:
```json
{
  "items": [...],
  "total": 142,
  "page": 1,
  "size": 20,
  "pages": 8
}
```

Query parameters: `?page=1&size=20`

### 1.5 Date Handling

- All datetimes in ISO 8601 with UTC timezone: `2026-09-10T08:30:00Z`
- Dates (without time): `2026-09-10`
- Client sends `logged_at` in local timezone; server normalises to UTC

### 1.6 HTTP Methods

| Method | Meaning |
|--------|---------|
| GET | Retrieve (idempotent, no body) |
| POST | Create new resource |
| PUT | Full replacement |
| PATCH | Partial update |
| DELETE | Delete (soft where applicable) |

### 1.7 HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (successful DELETE) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorised (missing/invalid token) |
| 403 | Forbidden (valid token, wrong resource) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 422 | Unprocessable Entity (Pydantic validation) |
| 429 | Too Many Requests |
| 503 | Service Unavailable (AI/external service down) |

---

## 2. Authentication Endpoints

### POST /api/v1/auth/register

**Purpose:** Create a new user account.  
**Auth:** None required.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Validation:**
- `email`: valid format, normalised to lowercase, max 255 chars
- `password`: min 8 chars, at least one uppercase, one digit, one special character

**Response 201:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "is_active": true,
  "created_at": "2026-09-10T08:00:00Z"
}
```

**Error Cases:**
- `409` — email already registered
- `422` — password too weak

---

### POST /api/v1/auth/login

**Purpose:** Authenticate and receive access + refresh tokens.  
**Auth:** None required.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

**Error Cases:**
- `401` — invalid credentials (same message for email not found and wrong password — prevent user enumeration)

---

### POST /api/v1/auth/refresh

**Purpose:** Exchange refresh token for a new access token.  
**Auth:** None required (refresh token in body).

**Request:**
```json
{
  "refresh_token": "eyJ..."
}
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

**Error Cases:**
- `401` — expired or invalid refresh token

---

### POST /api/v1/auth/logout

**Purpose:** Invalidate refresh token.  
**Auth:** Required.

**Request:**
```json
{
  "refresh_token": "eyJ..."
}
```

**Response 204:** No content.

---

### POST /api/v1/auth/change-password

**Purpose:** Change user password.  
**Auth:** Required.

**Request:**
```json
{
  "current_password": "OldPassword123!",
  "new_password": "NewPassword456!"
}
```

**Response 200:**
```json
{
  "message": "Password updated successfully"
}
```

---

## 3. User & Profile Endpoints

### GET /api/v1/users/me

**Purpose:** Get current user account info.  
**Auth:** Required.

**Response 200:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "is_active": true,
  "is_verified": false,
  "created_at": "2026-09-10T08:00:00Z"
}
```

---

### DELETE /api/v1/users/me

**Purpose:** Delete account (soft delete).  
**Auth:** Required.

**Request:**
```json
{
  "password": "Confirm123!"
}
```

**Response 204:** No content.

---

### GET /api/v1/profile

**Purpose:** Get user fitness profile.  
**Auth:** Required.

**Response 200:**
```json
{
  "id": "uuid",
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "1990-05-15",
  "sex": "male",
  "height_cm": 178.0,
  "current_weight_kg": 82.5,
  "activity_level": "moderately_active",
  "calculated_tdee": 2650,
  "updated_at": "2026-09-10T08:00:00Z"
}
```

**Note:** `current_weight_kg` is a service-maintained read cache derived from `weight_entries` (see ADR-014). It is read-only on the profile and returns `null` if no weight entries exist.

---

### PUT /api/v1/profile

**Purpose:** Create or update fitness profile.  
**Auth:** Required.

**Request:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "1990-05-15",
  "sex": "male",
  "height_cm": 178.0,
  "activity_level": "moderately_active"
}
```

**Response 200:** Updated profile object.

**Validation:**
- `height_cm`: 50–300
- `activity_level`: one of defined enum values

**Note:** Body weight is NOT directly user-mutable on profile updates. All weight changes must go through the `weight_entries` workflow (`POST /api/v1/progress/weight`). The profile's `current_weight_kg` field is non-user-mutable and is automatically updated by the service layer whenever a new weight entry is logged (see ADR-014).

---

### GET /api/v1/profile/preferences

**Purpose:** Get user preferences.  
**Auth:** Required.

**Response 200:**
```json
{
  "unit_system": "metric",
  "calorie_target": null,
  "protein_target_g": null,
  "carbs_target_g": null,
  "fat_target_g": null,
  "dietary_restrictions": ["vegetarian"],
  "ai_persona": "balanced"
}
```

---

### PATCH /api/v1/profile/preferences

**Purpose:** Update preferences (partial update).  
**Auth:** Required.

**Request:** Any subset of preference fields.

**Response 200:** Updated preferences object.

---

## 4. Goals Endpoints

### GET /api/v1/goals

**Purpose:** List user's fitness goals.  
**Auth:** Required.  
**Query params:** `?status=active`

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "goal_type": "weight_loss",
      "description": "Lose 5kg by December",
      "target_value": 77.5,
      "target_unit": "kg",
      "target_date": "2026-12-31",
      "status": "active",
      "created_at": "2026-09-10T08:00:00Z"
    }
  ],
  "total": 1
}
```

---

### POST /api/v1/goals

**Purpose:** Create a new fitness goal.  
**Auth:** Required.

**Request:**
```json
{
  "goal_type": "weight_loss",
  "description": "Lose 5kg by December",
  "target_value": 77.5,
  "target_unit": "kg",
  "target_date": "2026-12-31"
}
```

**Response 201:** Created goal object.

---

### PATCH /api/v1/goals/{goal_id}

**Purpose:** Update goal status or details.  
**Auth:** Required.  
**Authorization:** Goal must belong to current user.

**Request:**
```json
{
  "status": "completed",
  "target_date": "2026-11-30"
}
```

**Response 200:** Updated goal object.

---

### DELETE /api/v1/goals/{goal_id}

**Purpose:** Soft delete a goal.  
**Auth:** Required.  
**Response 204:** No content.

---

## 5. Food Endpoints

### GET /api/v1/foods

**Purpose:** Search the food database.  
**Auth:** Required.  
**Query params:** `?q=chicken+breast&page=1&size=20&category=Protein`

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Chicken Breast, cooked",
      "brand": null,
      "category": "Protein",
      "calories_per_100g": 165.0,
      "protein_per_100g": 31.0,
      "carbs_per_100g": 0.0,
      "fat_per_100g": 3.6,
      "servings": [
        { "description": "100g", "grams": 100, "is_default": true },
        { "description": "1 breast (174g)", "grams": 174, "is_default": false }
      ]
    }
  ],
  "total": 12,
  "page": 1,
  "size": 20
}
```

---

### GET /api/v1/foods/{food_id}

**Purpose:** Get a single food item with full details.  
**Auth:** Required.

**Response 200:** Full food item object.

---

### POST /api/v1/foods

**Purpose:** Create a custom food item.  
**Auth:** Required.

**Request:**
```json
{
  "name": "My Protein Shake",
  "calories_per_100g": 400,
  "protein_per_100g": 30,
  "carbs_per_100g": 40,
  "fat_per_100g": 8,
  "servings": [
    { "description": "1 scoop (35g)", "grams": 35, "is_default": true }
  ]
}
```

**Response 201:** Created food item.

---

### PATCH /api/v1/foods/{food_id}

**Purpose:** Update a custom food item (own items only).  
**Auth:** Required.  
**Authorization:** Can only update foods created by current user.

---

### DELETE /api/v1/foods/{food_id}

**Purpose:** Soft delete a custom food item.  
**Auth:** Required.  
**Authorization:** Own items only.

---

## 6. Nutrition Endpoints

### GET /api/v1/nutrition/daily

**Purpose:** Get nutrition summary for a date.  
**Auth:** Required.  
**Query params:** `?date=2026-09-10`

**Response 200:**
```json
{
  "date": "2026-09-10",
  "totals": {
    "calories": 1450.5,
    "protein_g": 98.2,
    "carbs_g": 162.4,
    "fat_g": 44.1
  },
  "targets": {
    "calories": 2200,
    "protein_g": 165.0,
    "carbs_g": 220.0,
    "fat_g": 73.0
  },
  "remaining": {
    "calories": 749.5,
    "protein_g": 66.8,
    "carbs_g": 57.6,
    "fat_g": 28.9
  },
  "meals": {
    "breakfast": { "calories": 420, "entries": [...] },
    "lunch": { "calories": 580, "entries": [...] },
    "dinner": { "calories": 0, "entries": [] },
    "snack": { "calories": 450.5, "entries": [...] }
  }
}
```

---

### POST /api/v1/nutrition/entries

**Purpose:** Log a food entry.  
**Auth:** Required.

**Request:**
```json
{
  "food_item_id": "uuid",
  "quantity_g": 174.0,
  "meal_type": "lunch",
  "logged_at": "2026-09-10T13:15:00Z"
}
```

> Alternatively, pass `serving_id` and `serving_count` — the service calculates `quantity_g`.

**Response 201:**
```json
{
  "id": "uuid",
  "food_item_name": "Chicken Breast, cooked",
  "quantity_g": 174.0,
  "meal_type": "lunch",
  "calories": 286.9,
  "protein_g": 53.9,
  "carbs_g": 0.0,
  "fat_g": 6.3,
  "logged_at": "2026-09-10T13:15:00Z"
}
```

---

### POST /api/v1/nutrition/log-natural-language

**Purpose:** Extract food items from natural-language text (AI-assisted).  
**Auth:** Required.

**Request:**
```json
{
  "text": "I had 3 scrambled eggs and 2 slices of wholegrain toast for breakfast",
  "meal_type": "breakfast",
  "logged_at": "2026-09-10T09:00:00Z"
}
```

**Response 200 (confirmation step — not yet logged):**
```json
{
  "extraction_id": "uuid",
  "resolved_items": [
    {
      "extracted_text": "3 scrambled eggs",
      "food_item": { "id": "uuid", "name": "Egg, scrambled", ... },
      "quantity_g": 150.0,
      "calories": 219.0,
      "confidence": "high"
    },
    {
      "extracted_text": "2 slices wholegrain toast",
      "food_item": { "id": "uuid", "name": "Bread, wholegrain", ... },
      "quantity_g": 60.0,
      "calories": 152.0,
      "confidence": "medium"
    }
  ],
  "unresolved": [],
  "total_calories": 371.0
}
```

---

### POST /api/v1/nutrition/log-natural-language/confirm

**Purpose:** Confirm and commit the extracted entries.  
**Auth:** Required.

**Request:**
```json
{
  "extraction_id": "uuid",
  "confirmed_items": ["item_id_1", "item_id_2"],
  "meal_type": "breakfast"
}
```

**Response 201:** List of created food entries.

---

### PATCH /api/v1/nutrition/entries/{entry_id}

**Purpose:** Edit a food entry (quantity or meal type).  
**Auth:** Required.  
**Authorization:** Entry must belong to current user.

---

### DELETE /api/v1/nutrition/entries/{entry_id}

**Purpose:** Soft delete a food entry.  
**Auth:** Required.  
**Response 204:** No content.

---

### GET /api/v1/nutrition/history

**Purpose:** Get nutrition history for a date range.  
**Auth:** Required.  
**Query params:** `?from=2026-09-01&to=2026-09-10`

**Response 200:**
```json
{
  "items": [
    { "date": "2026-09-10", "calories": 1450, "protein_g": 98, "carbs_g": 162, "fat_g": 44 },
    { "date": "2026-09-09", "calories": 2100, "protein_g": 145, "carbs_g": 210, "fat_g": 70 }
  ]
}
```

---

## 7. Exercise Endpoints

### GET /api/v1/exercises

**Purpose:** Search exercise database.  
**Auth:** Required.  
**Query params:** `?q=bench+press&category=strength&muscle_group=chest`

**Response 200:** Paginated list of exercises.

---

### GET /api/v1/exercises/{exercise_id}

**Purpose:** Get exercise details.  
**Auth:** Required.

---

### POST /api/v1/exercises

**Purpose:** Create custom exercise.  
**Auth:** Required.

**Request:**
```json
{
  "name": "Bulgarian Split Squat",
  "category": "strength",
  "muscle_groups": ["quadriceps", "glutes", "hamstrings"],
  "equipment": "dumbbell",
  "description": "..."
}
```

---

## 8. Workout Endpoints

### GET /api/v1/workouts

**Purpose:** List workout sessions.  
**Auth:** Required.  
**Query params:** `?from=2026-09-01&to=2026-09-10&page=1&size=20`

---

### POST /api/v1/workouts

**Purpose:** Create a new workout session.  
**Auth:** Required.

**Request:**
```json
{
  "name": "Push Day",
  "tags": ["push", "upper_body"],
  "started_at": "2026-09-10T07:00:00Z"
}
```

**Response 201:** Created workout session.

---

### GET /api/v1/workouts/{workout_id}

**Purpose:** Get full workout with exercises and sets.  
**Auth:** Required.  
**Authorization:** Must belong to current user.

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Push Day",
  "started_at": "2026-09-10T07:00:00Z",
  "ended_at": "2026-09-10T08:15:00Z",
  "duration_minutes": 75,
  "exercises": [
    {
      "id": "uuid",
      "exercise": { "name": "Bench Press", "category": "strength" },
      "order_index": 1,
      "sets": [
        { "set_number": 1, "set_type": "warmup", "reps": 10, "weight_kg": 60 },
        { "set_number": 2, "set_type": "working", "reps": 8, "weight_kg": 90 },
        { "set_number": 3, "set_type": "working", "reps": 6, "weight_kg": 95 }
      ]
    }
  ]
}
```

---

### PATCH /api/v1/workouts/{workout_id}

**Purpose:** Update workout (e.g., add end time, notes).  
**Auth:** Required.

---

### DELETE /api/v1/workouts/{workout_id}

**Purpose:** Soft delete workout session.  
**Auth:** Required.

---

### POST /api/v1/workouts/{workout_id}/exercises

**Purpose:** Add an exercise to a workout.  
**Auth:** Required.

**Request:**
```json
{
  "exercise_id": "uuid",
  "order_index": 2,
  "notes": "Focus on slow eccentric"
}
```

---

### POST /api/v1/workouts/{workout_id}/exercises/{workout_exercise_id}/sets

**Purpose:** Log a set.  
**Auth:** Required.

**Request:**
```json
{
  "set_number": 1,
  "set_type": "working",
  "reps": 8,
  "weight_kg": 100,
  "rpe": 8
}
```

---

## 9. Progress Endpoints

### GET /api/v1/progress/weight

**Purpose:** Get weight history.  
**Auth:** Required.  
**Query params:** `?from=2026-08-01&to=2026-09-10`

**Response 200:**
```json
{
  "entries": [
    { "date": "2026-09-10", "weight_kg": 82.5 },
    { "date": "2026-09-07", "weight_kg": 82.9 }
  ],
  "current_weight_kg": 82.5,
  "start_weight_kg": 86.0,
  "trend": "decreasing"
}
```

---

### POST /api/v1/progress/weight

**Purpose:** Log body weight.  
**Auth:** Required.

**Request:**
```json
{
  "weight_kg": 82.5,
  "logged_at": "2026-09-10T07:30:00Z",
  "notes": "Morning, pre-breakfast"
}
```

**Response 201:** Created weight entry.

---

### GET /api/v1/progress/summary

**Purpose:** Get progress overview (goal tracking, trends).  
**Auth:** Required.  
**Query params:** `?period=30d`

**Response 200:**
```json
{
  "period_days": 30,
  "weight_change_kg": -1.5,
  "avg_daily_calories": 2050,
  "avg_protein_g": 148,
  "workouts_completed": 18,
  "goal_progress": {
    "goal_type": "weight_loss",
    "target_weight_kg": 77.5,
    "current_weight_kg": 82.5,
    "remaining_kg": 5.0,
    "estimated_weeks_remaining": 10
  }
}
```

---

## 10. AI Endpoints

### POST /api/v1/ai/chat

**Purpose:** Send a message to the AI assistant.  
**Auth:** Required.  
**Rate limit:** 20 requests/minute.

**Request:**
```json
{
  "message": "Why haven't I been losing weight recently?",
  "conversation_id": "uuid-or-null"
}
```

**Response 200:**
```json
{
  "conversation_id": "uuid",
  "message_id": "uuid",
  "response": "Based on your data from the last 14 days...",
  "sources": [
    {
      "chunk_id": "uuid",
      "document_title": "Energy Balance and Weight Loss",
      "section": "Caloric Deficit Principles",
      "similarity_score": 0.91
    }
  ],
  "user_data_used": ["weight_history", "nutrition_summary", "workout_summary"],
  "tokens_used": 1250
}
```

---

### GET /api/v1/ai/conversations

**Purpose:** List user's AI conversations.  
**Auth:** Required.

**Response 200:** Paginated list of conversations.

---

### GET /api/v1/ai/conversations/{conversation_id}

**Purpose:** Get a conversation with messages.  
**Auth:** Required.

---

### DELETE /api/v1/ai/conversations/{conversation_id}

**Purpose:** Delete a conversation.  
**Auth:** Required.

---

### POST /api/v1/ai/summarise-today

**Purpose:** Generate a nutrition summary for today.  
**Auth:** Required.  
**Rate limit:** 10/minute.

**Response 200:**
```json
{
  "summary": "Today you've consumed 1,450 calories (66% of your target)...",
  "highlights": ["Protein is 40g below target", "Excellent hydration tracking"],
  "tokens_used": 450
}
```

---

## 11. RAG Endpoints

> **Note:** These endpoints are admin-level operations for knowledge base management.

### GET /api/v1/rag/documents

**Purpose:** List knowledge base documents.  
**Auth:** Required + Admin role.

---

### POST /api/v1/rag/documents

**Purpose:** Ingest a new document into the knowledge base.  
**Auth:** Required + Admin role.

**Request:** Multipart form or JSON with URL.

**Response 202 Accepted:** (Ingestion is async)
```json
{
  "document_id": "uuid",
  "status": "pending",
  "message": "Document queued for ingestion"
}
```

---

### GET /api/v1/rag/documents/{document_id}

**Purpose:** Get ingestion status.  
**Auth:** Required + Admin role.

---

### DELETE /api/v1/rag/documents/{document_id}

**Purpose:** Remove document and its chunks.  
**Auth:** Required + Admin role.

---

### POST /api/v1/rag/search

**Purpose:** Debug endpoint — test vector search.  
**Auth:** Required + Admin role.

**Request:**
```json
{
  "query": "protein intake for muscle building",
  "top_k": 5,
  "filters": { "topic_category": "nutrition" }
}
```

---

## 12. Recommendations Endpoints

### GET /api/v1/recommendations/meals

**Purpose:** Get meal suggestions based on remaining daily intake.  
**Auth:** Required.  
**Rate limit:** 10/minute.

**Query params:** `?date=2026-09-10&meal_type=dinner`

**Response 200:**
```json
{
  "remaining_targets": {
    "calories": 750,
    "protein_g": 67,
    "carbs_g": 58,
    "fat_g": 29
  },
  "suggestions": [
    {
      "name": "Grilled Salmon with Quinoa",
      "explanation": "This meal provides 45g protein and fits your remaining calorie budget.",
      "estimated_macros": {
        "calories": 680,
        "protein_g": 45,
        "carbs_g": 52,
        "fat_g": 28
      },
      "food_items": [
        { "food_item_id": "uuid", "name": "Salmon", "quantity_g": 200 },
        { "food_item_id": "uuid", "name": "Quinoa, cooked", "quantity_g": 150 }
      ]
    }
  ],
  "sources": [...]
}
```

---

### GET /api/v1/recommendations/workouts

**Purpose:** Get workout suggestions based on history and goals.  
**Auth:** Required.  
**Rate limit:** 10/minute.

**Response 200:**
```json
{
  "rationale": "You last trained upper body 2 days ago. Today is a good day for lower body.",
  "suggestion": {
    "name": "Lower Body Strength",
    "exercises": [
      { "exercise_id": "uuid", "name": "Squat", "suggested_sets": 4, "suggested_reps": "6-8" },
      { "exercise_id": "uuid", "name": "Romanian Deadlift", "suggested_sets": 3, "suggested_reps": "8-10" }
    ]
  },
  "sources": [...]
}
```

---

## 13. Common Response Schemas

### Error Response
```json
{
  "error": "Food item with id abc-123 not found",
  "request_id": "req-xyz-789",
  "details": {
    "field": "food_item_id",
    "value": "abc-123"
  }
}
```

### Validation Error (422)
```json
{
  "error": "Validation failed",
  "request_id": "req-xyz-789",
  "details": [
    {
      "field": "quantity_g",
      "message": "ensure this value is greater than 0"
    }
  ]
}
```

---

## 14. Error Reference

| Error Code | When Raised |
|------------|-------------|
| `AUTH_INVALID_CREDENTIALS` | Wrong email or password |
| `AUTH_TOKEN_EXPIRED` | JWT has expired |
| `AUTH_UNAUTHORIZED` | Missing or invalid token |
| `USER_NOT_FOUND` | User does not exist |
| `RESOURCE_NOT_FOUND` | Generic 404 |
| `RESOURCE_FORBIDDEN` | User does not own resource |
| `FOOD_ITEM_NOT_FOUND` | Food item lookup failed |
| `GOAL_DUPLICATE_ACTIVE` | Active goal of same type exists |
| `AI_SERVICE_UNAVAILABLE` | LLM provider error |
| `AI_RATE_LIMIT_EXCEEDED` | Too many AI requests |
| `RAG_INGESTION_FAILED` | Document ingestion failed |
| `VALIDATION_ERROR` | Pydantic validation failure |
