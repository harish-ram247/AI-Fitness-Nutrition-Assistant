# Recommendation Engine Architecture (Phase 7A Foundation)

## 1. Overview and Core Principle

The Recommendation Engine provides a reusable, deterministic foundation for generating personalized recommendations. It is completely decoupled from Large Language Models (LLMs), machine learning models, and persistence layers.

The core architectural pipeline follows a strict unidirectional data flow:

```
    structured user data
            ↓
    recommendation context
            ↓
    candidate generation
            ↓
    candidate validation/filtering (hard constraints)
            ↓
    deterministic scoring (weighted normalization)
            ↓
    ranked candidates (deterministic tie-breaking)
```

The system guarantees that:
- Nutrition calculations, score arithmetic, and candidate eligibility are 100% deterministic and server-side.
- The LLM never computes nutrition, evaluates scores, determines candidate eligibility, or modifies database state.
- Evaluation order and tie-breaking are stable and reproducible.

---

## 2. Recommendation Pipeline Components

### A. Recommendation Context (`RecommendationContext`)
Represents the minimal structured input needed for personalization without coupling to specific domain tables or loading full user histories. Sub-contexts (`UserProfileContext`, `GoalContext`, `PreferencesContext`, `NutritionSummaryContext`, `WorkoutSummaryContext`, `ConstraintContext`) are optional and intent-aware, preserving data minimization principles.

### B. Candidate Representation (`RecommendationCandidate[T]`)
A generic container representing a potential recommendation item. It carries a stable identifier (`id`), recommendation type (`RecommendationType.MEAL` or `RecommendationType.WORKOUT`), an arbitrary payload (`T`), metadata, eligibility metadata, and human-readable reasons.

### C. Candidate Generator Protocol (`CandidateGenerator[T]`)
An asynchronous protocol defining:
```python
async def generate_candidates(self, context: RecommendationContext) -> Sequence[RecommendationCandidate[T]]: ...
```
Generators retrieve raw candidate pools. Asynchronous execution accommodates future database queries in Phase 7B (Meal generation from food catalog) and Phase 7C (Workout generation from exercise library).

### D. Candidate Validation and Filtering Protocol (`CandidateFilter`)
A synchronous protocol defining:
```python
def filter(self, candidate: RecommendationCandidate[Any], context: RecommendationContext) -> FilterResult: ...
```
Filters enforce hard constraints (such as dietary restrictions, severe allergies, or unavailable equipment) prior to scoring. Synchronous execution prevents event-loop scheduling latency across large candidate pools.

### E. Deterministic Scoring (`RecommendationScorer` & `ScoringFactor`)
A synchronous protocol and scoring engine defining:
```python
def score(self, candidate: RecommendationCandidate[Any], context: RecommendationContext) -> FactorScore: ...
```
Each scoring factor evaluates candidate suitability against user context and produces a normalized score strictly bounded within $[0.0, 1.0]$ alongside factor weights and explanations.

The `RecommendationScorer` computes the final weighted score using:
$$\text{final\_score} = \frac{\sum(\text{normalized\_factor\_score}_i \times \text{factor\_weight}_i)}{\sum \text{factor\_weight}_i}$$

Validation constraints enforced at initialization and evaluation:
- Factor weights must be positive, finite numbers ($w > 0.0$); boolean values are explicitly rejected.
- Total factor weight must be positive and finite.
- Every factor's `normalized_score` is strictly validated before aggregation; non-finite (`NaN`, `+/-Inf`), boolean, or out-of-bounds ($< 0.0$ or $> 1.0$) scores raise `InvalidScoringConfigurationError`. Scores are never silently clamped.

### F. Recommendation Engine (`RecommendationEngine[T]`)
The top-level orchestrator that:
1. Validates input parameters (positive integer `top_n`, valid `RecommendationType`).
2. Invokes candidate generation asynchronously.
3. Evaluates hard filters deterministically, skipping ineligible candidates.
4. Scores surviving candidates with the configured `RecommendationScorer`.
5. Deterministically sorts candidates:
   - Primary key: `final_score` descending (`-item.score`).
   - Secondary key: `candidate.id` ascending (stable string comparison).
6. Truncates to top-$N$ and returns a `RecommendationResult`.

---

## 3. Why LLMs are Excluded from Phase 7A

1. **Determinism and Auditability:** Recommendations must rely on factual user constraints, caloric balances, and verifiable factor contributions. LLM hallucinations cannot be permitted in nutritional or fitness eligibility.
2. **Performance and Cost:** Candidate generation, filtering, and scoring operate in milliseconds over candidate pools without API latency or per-token costs.
3. **Strict Separation of Concerns:** Phase 7A establishes the mathematical, deterministic foundation. Future sub-phases can optionally utilize LLMs exclusively for post-hoc explanation and natural-language formatting without altering candidate ranks or scoring.

---

## 4. Extension Model for Phase 7B and Phase 7C

The generic architecture enables Phase 7B and 7C to plug in domain-specific logic without modifying the core engine:

- **Phase 7B (Meal Recommendations):**
  - Implement `MealCandidateGenerator` querying catalog foods and recipes.
  - Implement `DietaryRestrictionFilter`, `AllergyFilter`, `CalorieTargetFilter`.
  - Implement `CalorieProximityFactor`, `MacronutrientBalanceFactor`, `PreferenceMatchFactor`.
- **Phase 7C (Workout Recommendations):**
  - Implement `WorkoutCandidateGenerator` querying exercise libraries and past sessions.
  - Implement `EquipmentAvailabilityFilter`, `InjuryExclusionFilter`.
  - Implement `MuscleRecoveryFactor`, `GoalProgressionFactor`, `TimeConstraintFactor`.
