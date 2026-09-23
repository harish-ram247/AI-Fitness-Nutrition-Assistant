# Phase 7D: AI Recommendation Layer Architecture

## 1. Objective and System Boundary

Phase 7D implements an AI explanation, personalization, and optional constrained re-ranking layer on top of the deterministic recommendation engines implemented in Phase 7B (meals) and Phase 7C (workouts).

### Non-Authoritative AI Layer
The deterministic recommendation engine is the **sole authoritative source of truth** for:
- Candidate generation and enumeration
- Hard constraint filtering (allergies, disliked foods, duration, equipment)
- Nutritional calculations (calories, protein, carbohydrates, fats, serving sizes)
- Exercise selection and programming (sets, reps, rest intervals, durations)
- Deterministic scoring and multi-factor ranking
- User ownership and isolation rules

The Large Language Model (LLM) operates strictly as an **informational explanation and coaching presentation layer**. The LLM:
- **May**: Provide personalized rationale, practical coaching tips, preparation advice, and optionally propose a reordering permutation among the deterministically supplied candidate IDs.
- **May NOT**: Invent candidates, add/remove exercises, modify numerical nutritional or training values, bypass hard filters, calculate nutrition, alter database state, or provide medical diagnoses or prescriptions.

---

## 2. End-to-End Recommendation Pipeline

```
                     ┌──────────────────────────────┐
                     │   Client Recommendation Req  │
                     │    (e.g., include_ai=true)   │
                     └──────────────┬───────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────┐
                     │ Deterministic Engine (7B/7C) │
                     │  Candidate Gen -> Filter ->  │
                     │    Scoring -> Top-N Ranking  │
                     └──────────────┬───────────────┘
                                    │
                         Deterministic Candidates
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │ if include_ai == false                                │ if include_ai == true
        ▼                                                       ▼
┌──────────────────────────────┐                ┌──────────────────────────────┐
│ Return Deterministic Result  │                │ RAG Knowledge Retrieval      │
│ (ai_used=False,              │                │ (Informational context only) │
│  ai_fallback=False)          │                └──────────────┬───────────────┘
└──────────────────────────────┘                               │
                                                               ▼
                                                ┌──────────────────────────────┐
                                                │ Prompt Assembly & Isolation  │
                                                │ (Delimited Untrusted Data)   │
                                                └──────────────┬───────────────┘
                                                               │
                                                               ▼
                                                ┌──────────────────────────────┐
                                                │ AbstractLLMProvider          │
                                                │ (Structured Output Pydantic) │
                                                └──────────────┬───────────────┘
                                                               │
                                                               ▼
                                                ┌──────────────────────────────┐
                                                │ CandidateValidator           │
                                                │ (Server-side constraint chk) │
                                                └──────┬────────────────┬──────┘
                                                       │                │
                                               Valid   │                │ Invalid / Error
                                                       ▼                ▼
                                        ┌────────────────┐    ┌────────────────┐
                                        │ Apply AI Ranks │    │ Deterministic  │
                                        │ & Explanations │    │ Fallback       │
                                        │ (ai_used=True) │    │ (ai_fallback=  │
                                        │                │    │   True)        │
                                        └───────┬────────┘    └────────┬───────┘
                                                │                      │
                                                └──────────┬───────────┘
                                                           ▼
                                            ┌──────────────────────────────┐
                                            │ Final Response Model         │
                                            └──────────────────────────────┘
```

---

## 3. Structured LLM Response Schema

The LLM output is parsed directly into the strict Pydantic model `RecommendationAIOutput`:

```python
class RecommendationItemExplanation(BaseModel):
    candidate_id: str
    explanation: str

class RecommendationAIOutput(BaseModel):
    selected_candidate_id: str | None = None
    ranked_candidate_ids: list[str] = Field(default_factory=list)
    explanation: str
    item_explanations: list[RecommendationItemExplanation] = Field(default_factory=list)
    considerations: list[str] = Field(default_factory=list)
    disclaimer: str | None = None
```

All fields strictly forbid extra attributes (`extra="forbid"`). Raw LLM output is never trusted or exposed without server-side validation.

---

## 4. Server-Side Candidate Validation

The `CandidateValidator` enforces the following invariants against the deterministic candidate set before any AI output can be applied:

1. **Selected Candidate Invariant**: If `selected_candidate_id` is supplied, it must exist in the deterministic candidate set.
2. **Authorized ID Invariant**: Every ID in `ranked_candidate_ids` and `item_explanations` must belong to the deterministic candidate set. Invented, foreign, or malformed IDs are strictly rejected.
3. **No Duplicates**: `ranked_candidate_ids` must not contain duplicate candidate IDs.
4. **Complete Permutation Requirement**: If `ranked_candidate_ids` is provided, it must contain a complete permutation of all deterministic candidates. Partial rankings or truncated lists are rejected to prevent unintentional loss of valid candidates. An empty `ranked_candidate_ids` is accepted as "no re-ranking requested."
5. **Atomic Rejection & Fallback**: If any validation rule fails, the entire AI ranking is rejected. No partial re-ordering is performed. The engine falls back to the deterministic ranking with `ai_fallback=True` and logs the reason.

---

## 5. Ranking Semantics

- **Primary / Authoritative**: The deterministic score and ranking generated by Phase 7B/7C.
- **Secondary / Informational**: AI ranking (`ai_rank`), which can only reorder the exact set of deterministically approved candidates.
- **Score Integrity**: Deterministic score values, factor weights, and alignment reasons are immutable and cannot be rewritten or replaced by LLM scores.

---

## 6. Deterministic Fallback Strategy

The application guarantees uninterrupted service when the AI layer is unavailable or encounters errors:
- **Trigger Conditions**:
  - LLM provider timeout or connectivity error
  - Rate limiting (HTTP 429)
  - Malformed LLM output or schema parsing error
  - Candidate validation failure (unknown candidate ID, duplicate ID, incomplete permutation)
  - Unexpected runtime exception
- **Fallback Behavior**:
  - `items`: Retains the exact deterministic candidates in original deterministic rank order.
  - `ai_used`: Set to `False`.
  - `ai_fallback`: Set to `True`.
  - `metadata["ai_fallback_reason"]`: Contains a sanitized description of the failure reason.
  - No empty recommendations are ever returned due to an AI failure.

---

## 7. Retrieval-Augmented Generation (RAG) Boundary

- **Domain Scoping**:
  - Meal recommendations retrieve knowledge chunks filtered by `topic_category="nutrition"`.
  - Workout recommendations retrieve knowledge chunks filtered by `topic_category="training"`.
- **Supporting Role**: RAG chunks serve exclusively as background reference material for coaching explanations. RAG never produces candidate data.
- **Graceful Degradation**: If no relevant RAG documents are found (similarity threshold not met) or if the vector search is unavailable, the AI layer continues without specific citations. The LLM is explicitly forbidden from fabricating sources or citations.

---

## 8. Prompt Injection and Untrusted Data Isolation

To prevent prompt injection from user-generated content (custom exercise names, food descriptions, or retrieved RAG documents), the prompt uses clear structural delimiters:

- `=== CRITICAL SAFETY & INTEGRITY RULES ===`: System instructions specifying authoritative constraints.
- `=== USER CONTEXT ===`: Sanitized profile attributes.
- `=== RAG EVIDENCE (INFORMATIONAL DATA) ===`: External reference chunks explicitly marked as passive data.
- `=== CANDIDATE DATA (UNTRUSTED DATA) ===`: Candidate details explicitly marked as passive data.

The system prompt explicitly commands the model to ignore any instructions, system commands, or prompt overrides embedded within candidate names or RAG documents.

---

## 9. Privacy and Data Minimization

In compliance with Phase 6 privacy standards, the AI layer minimizes user context sent to the LLM:
- **Included**: Age (derived from date of birth), activity level, active goal type, target calories or session duration.
- **Strictly Excluded**: Passwords, password hashes, access tokens, refresh tokens, email addresses, exact dates of birth, physical addresses, and sensitive user identifiers.

---

## 10. Database and Scope Invariants

- **No Migrations**: Phase 7D introduces no database schema migrations.
- **No ORM Changes**: Existing SQLAlchemy models remain unchanged.
- **No New Tables**: Recommendation responses remain computed transient responses without persistence tables.
- **No Recovery Subsystem**: No active recovery subsystem is introduced.
