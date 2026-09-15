# Phase 7C: Workout Recommendation Architecture (Revised)

## 1. Objective

Phase 7C establishes a deterministic, server-side workout recommendation engine. Building directly upon the Phase 7A Recommendation Foundation (`RecommendationEngine`, `RecommendationCandidate`, `CandidateGenerator`, `CandidateFilter`, `RecommendationScorer`), the system synthesizes:
1. The user's current physical profile and activity level.
2. The user's active fitness goal (e.g. `muscle_gain`, `weight_loss`, `strength`, `endurance`, `maintenance`).
3. The user's recent training history (sessions, muscle groups, and exercises logged in the past 7 days) as a personalization variety signal.
4. Available equipment constraints and target session duration.
5. The system's verified exercise catalog plus the user's custom exercises.

The engine outputs ranked, structured workout recommendations with recommended set counts, rep schemes or durations, rest intervals, and estimated duration.

---

## 2. Core Principles & Strict Boundaries

### A. Strict LLM & RAG Boundary
- **No LLM, RAG, or Embeddings:** All candidate generation, filter eligibility, factor scoring, and candidate ranking are 100% deterministic mathematical calculations.
- **No Hallucinated Exercises:** The engine selects exclusively from real exercises in the PostgreSQL `exercises` catalog visible to the requesting user.
- **Phase 7D Boundary:** Natural language explanations, conversational interaction, and LLM-driven reasoning are deferred to Phase 7D.

### B. No Recommendation Persistence
- Recommendations are computed transiently in memory at request time.
- **Zero Database Migrations:** 0 new Alembic migrations.
- **Zero ORM Tables:** 0 new database models, tables, or columns.
- Recommendations are never persisted or converted to logged workouts automatically. Logging workouts remains the explicit domain of Phase 5.

### C. Heuristic Nature & Safety Disclaimers
- Classification, duration estimation, and muscle freshness are deterministic recommendation heuristics.
- The engine does NOT provide medical, rehabilitation, or injury diagnoses.
- The deferred Phase 5 recovery subsystem is NOT reintroduced; recent training history acts solely as a personalization variety signal.
- All API responses carry a mandatory disclaimer:
  > *"Workout recommendations are training suggestions based on catalog metadata and recent logs. They do not replace medical advice or professional athletic instruction."*

---

## 3. Existing Codebase Findings & Source of Truth

| Component | Source of Truth File | Actual Interface / Schema Details |
|:---|:---|:---|
| **Exercise Catalog** | [`app/models/exercise.py`](file:///d:/Fitness_Tracker_Project/backend/app/models/exercise.py) | Columns: `id` (UUID), `name` (String), `category` (String: `strength`, `cardio`, `flexibility`, `balance`), `muscle_groups` (ARRAY(String)), `equipment` (String: `barbell`, `dumbbell`, `cable`, `machine`, `bodyweight`, `none`), `is_verified` (Boolean), `created_by_user_id` (UUID, nullable), `deleted_at` (nullable SoftDelete). **No movement pattern field exists in the database.** |
| **Exercise Visibility** | [`app/repositories/exercise_repository.py`](file:///d:/Fitness_Tracker_Project/backend/app/repositories/exercise_repository.py) | Active exercises: `deleted_at.is_(None)` AND (`created_by_user_id.is_(None)` OR `created_by_user_id == user_id`). Other users' custom exercises are strictly hidden. |
| **Workout Sessions** | [`app/models/workout.py`](file:///d:/Fitness_Tracker_Project/backend/app/models/workout.py) | `WorkoutSession` $\to$ `WorkoutExercise` (ordered by `order_index`) $\to$ `WorkoutSet` (ordered by `set_number`). Sets record `reps`, `weight_kg`, `duration_seconds`, `distance_m`. |
| **Workout History** | [`app/repositories/workout_repository.py`](file:///d:/Fitness_Tracker_Project/backend/app/repositories/workout_repository.py) | `get_sessions_by_user(user_id, from_date, to_date, page, size)` retrieves historical sessions with eager-loaded exercises and sets, ordered by `started_at.desc()`. |
| **Fitness Goals** | [`app/models/goal.py`](file:///d:/Fitness_Tracker_Project/backend/app/models/goal.py) | `FitnessGoal`: `goal_type` (String: `muscle_gain`, `weight_loss`, `strength`, `endurance`, `maintenance`), `target_value`, `target_unit`, `status="active"`. |
| **User Profile & Preferences** | [`app/models/user.py`](file:///d:/Fitness_Tracker_Project/backend/app/models/user.py) | `UserProfile`: `date_of_birth` (determines age), `sex`, `height_cm`, `current_weight_kg`, `activity_level`. `UserPreference`: `unit_system`, `calorie_target`. Equipment is NOT stored on `UserPreference`. |
| **Foundation Engine** | [`app/recommendations/`](file:///d:/Fitness_Tracker_Project/backend/app/recommendations/) | Protocol-driven: `RecommendationType.WORKOUT = "workout"`, `RecommendationCandidate[T]`, `CandidateGenerator[T]`, `CandidateFilter`, `RecommendationScorer`, `RecommendationEngine[T]`. |

---

## 4. Canonical Terminology & Movement-Slot Classification

### A. Normalized Canonical Workout Types & Categories
To prevent naming mismatches across templates, context, API, candidate payload, response schema, and tests:

```python
CANONICAL_WORKOUT_TYPES = {
    "full_body",
    "upper_body",
    "lower_body",
    "push",
    "pull",
    "cardio",
    "mobility",
}

CANONICAL_WORKOUT_CATEGORIES = {
    "strength",
    "cardio",
    "mobility",
}
```

**Mapping from `workout_type` to `category`:**
- `full_body`, `upper_body`, `lower_body`, `push`, `pull` $\implies \text{category} = \text{"strength"}$
- `cardio` $\implies \text{category} = \text{"cardio"}$
- `mobility` $\implies \text{category} = \text{"mobility"}$

### B. Canonical Muscle Groups & Synonym Normalization
Muscle groups stored on `Exercise.muscle_groups` are normalized against canonical terms:
```python
CANONICAL_MUSCLE_GROUPS = {
    "chest",
    "back",
    "shoulders",
    "biceps",
    "triceps",
    "quadriceps",
    "hamstrings",
    "glutes",
    "calves",
    "abdominals",
}

MUSCLE_SYNONYMS = {
    "quads": "quadriceps",
    "abs": "abdominals",
    "core": "abdominals",
    "obliques": "abdominals",
    "delts": "shoulders",
    "deltoids": "shoulders",
    "lats": "back",
    "upper back": "back",
    "lower back": "back",
    "traps": "back",
    "rhomboids": "back",
}
```

### C. Order-Independent Heuristic Movement Classifier
Because `Exercise` has `category` and `muscle_groups` but **no movement pattern column**, the classifier maps exercises to functional movement slots at request time.

Let $C = e.\text{category.lower().strip()}$, $N = e.\text{name.lower()}$, and $M$ be the Python `set` of canonical normalized strings from `e.muscle_groups`:
$$M = \{\text{MUSCLE\_SYNONYMS.get}(m.\text{strip().lower()}, m.\text{strip().lower()}) \mid m \in e.\text{muscle\_groups if } m \text{ and } m.\text{strip()}\}$$

Because $M$ is a set, the order of elements in `e.muscle_groups` has zero impact on classification.

**Classification Precedence Rules (Evaluated in Exact Order):**
1. **Cardio Slot:**
   If $C == \text{"cardio"}$: maps to `cardio`.
2. **Mobility Slots (Strictly from `flexibility` and `balance` categories):**
   If $C \in \{\text{"flexibility", "balance"}\}$:
   - If $M \cap \{\text{"quadriceps", "hamstrings", "glutes", "calves"}\} \ne \emptyset$ and $M \cap \{\text{"chest", "shoulders", "back", "biceps", "triceps"}\} == \emptyset$:
     maps to `mobility_lower`.
   - If $M \cap \{\text{"chest", "shoulders", "back", "biceps", "triceps"}\} \ne \emptyset$ and $M \cap \{\text{"quadriceps", "hamstrings", "glutes", "calves"}\} == \emptyset$:
     maps to `mobility_upper`.
   - If $M \cap \{\text{"abdominals"}\} \ne \emptyset$, or if $M$ contains both upper and lower muscles, or if $M == \emptyset$:
     maps to `mobility_core`.
3. **Strength Core Slot:**
   If $C == \text{"strength"}$ and $M == \{\text{"abdominals"}\}$:
   maps to `core`.
4. **Strength Arm Isolation Slots:**
   If $C == \text{"strength"}$:
   - If $M == \{\text{"triceps"}\}$: maps to `triceps`.
   - If $M == \{\text{"biceps"}\}$: maps to `biceps`.
5. **Strength Lower Body Slots:**
   If $C == \text{"strength"}$:
   - If $\text{"quadriceps"} \in M$ and $\text{"hamstrings"} \notin M$: maps to `squat`.
   - If $\text{"hamstrings"} \in M$ and $\text{"quadriceps"} \notin M$: maps to `hinge`.
   - If $\text{"glutes"} \in M$ and $\text{"quadriceps"} \notin M$ and $\text{"hamstrings"} \notin M$: maps to `hinge`.
   - **Ambiguous Lower-Body Rule:** If both $\text{"quadriceps"} \in M$ and $\text{"hamstrings"} \in M$:
     maps to **both** `squat` and `hinge` (eligible in both movement pools).
6. **Strength Upper Push Slots:**
   If $C == \text{"strength"}$:
   - If $\text{"chest"} \in M$: maps to `push_horizontal` and general `push`.
   - If $\text{"shoulders"} \in M$ and $\text{"chest"} \notin M$: maps to `push_vertical` and general `push`.
   - If $\text{"triceps"} \in M$ and $\text{"chest"} \notin M$ and $\text{"shoulders"} \notin M$ and $\text{"back"} \notin M$: maps to general `push`.
7. **Strength Upper Pull Slots:**
   If $C == \text{"strength"}$:
   - If $\text{"back"} \in M$:
     - If any substring in `{"pull", "chin", "down"}` is in $N$: maps to `pull_vertical` and general `pull`.
     - Otherwise: maps to `pull_horizontal` and general `pull`.
   - If $\text{"biceps"} \in M$ and $\text{"back"} \notin M$: maps to general `pull`.
8. **Unmapped Exercises:**
   Any exercise that does not match rules 1–7 above is **excluded from slot-based candidate generation**.
   *(No guesswork, no "dominant muscle" heuristic, no silent fallback).*

---

## 5. Workout Programming & Payload Representation

### A. Simplified Workout Programming Structure
Workout programming is strictly defined by concrete measurable metrics:
- `recommended_sets`: integer $\ge 1$
- `recommended_reps`: integer $\ge 1$ (for repetition-based exercises; `None` for duration-based)
- `recommended_duration_seconds`: integer $\ge 1$ (for timed exercises; `None` for repetition-based)
- `recommended_rest_seconds`: integer $\ge 0$

No subjective intensity values (such as RPE or RIR) are included.

### B. Exact Programming Variants
Every workout template supports exactly two deterministic programming variants:
1. `standard`: Moderate volume with standard rest intervals.
2. `density`: Higher set volume with condensed rest intervals.

| Category / Template Type | Variant | `recommended_sets` | `recommended_reps` | `recommended_duration_seconds` | `recommended_rest_seconds` |
|:---|:---|:---:|:---:|:---:|:---:|
| **Strength** (`full_body`, `upper_body`, `lower_body`, `push`, `pull`) | `standard` | 3 | 10 | `None` | 90 |
| **Strength** (`full_body`, `upper_body`, `lower_body`, `push`, `pull`) | `density` | 4 | 8 | `None` | 60 |
| **Cardio** (`cardio`) | `standard` | 3 | `None` | 300 (5 min) | 60 |
| **Cardio** (`cardio`) | `density` | 4 | `None` | 300 (5 min) | 45 |
| **Mobility** (`mobility`) | `standard` | 3 | `None` | 45 | 30 |
| **Mobility** (`mobility`) | `density` | 4 | `None` | 60 | 30 |

### C. Payload Models
```python
class WorkoutExerciseItem(BaseModel):
    exercise_id: uuid.UUID
    exercise_name: str
    category: str               # "strength", "cardio", "flexibility", "balance"
    muscle_groups: list[str]    # from Exercise.muscle_groups
    equipment: str | None
    order_index: int
    recommended_sets: int
    recommended_reps: int | None
    recommended_duration_seconds: int | None
    recommended_rest_seconds: int

class WorkoutPayload(BaseModel):
    name: str
    workout_type: str           # One of CANONICAL_WORKOUT_TYPES
    category: str               # One of CANONICAL_WORKOUT_CATEGORIES
    target_muscle_groups: list[str]
    exercises: list[WorkoutExerciseItem]
    estimated_duration_minutes: int
    total_sets: int
    primary_equipment_needed: list[str]
    variant: str                # "standard" or "density"
```

### D. Deterministic Equipment Extraction
`primary_equipment_needed` contains the deduplicated, sorted equipment strings across all exercises in the candidate, strictly excluding `"none"` and `""`:
```python
equipment_set = {
    e.equipment.strip().lower()
    for e in exercises
    if e.equipment and e.equipment.strip().lower() not in {"none", ""}
}
primary_equipment_needed = sorted(equipment_set)
```

---

## 6. Exact Duration Estimation Formula & Coherent Hard Filter

### A. Explicit Constants
- $C_{\text{rep}} = 4.0$ seconds per repetition (cadence: eccentric, concentric, turnaround).
- $C_{\text{transition}} = 120.0$ seconds (2 minutes between distinct exercises for equipment setup and transition).

### B. Mathematical Duration Formula
For each exercise $e \in \text{exercises}$ with $S = e.\text{recommended\_sets}$:
1. **Set Work Time:**
   $$t_{\text{work}}(e) = \begin{cases} e.\text{recommended\_reps} \times 4.0 & \text{if rep-based} \\ e.\text{recommended\_duration_seconds} & \text{if duration-based} \end{cases}$$
2. **Exercise Duration:**
   $$t_{\text{exercise}}(e) = S \times t_{\text{work}}(e) + (S - 1) \times e.\text{recommended\_rest\_seconds}$$
3. **Total Workout Duration in Seconds:**
   $$T_{\text{workout\_sec}} = \sum_{e \in \text{exercises}} t_{\text{exercise}}(e) + \max(0, |\text{exercises}| - 1) \times C_{\text{transition}}$$
4. **Estimated Workout Duration in Minutes:**
   $$D_{\text{est}} = \max\left(1, \text{round}\left(\frac{T_{\text{workout\_sec}}}{60.0}\right)\right)$$

### C. Coherent Duration Boundary Hard Filter (`WorkoutDurationFilter`)
`target_duration_minutes` specifies the user's available workout time $D_{\text{target}} \in [15, 120]$ minutes (defaults to 45).

To prevent short requests from receiving bloated candidates while allowing standard sessions to pass:
$$D_{\text{min}} = \max(10, \lfloor 0.50 \times D_{\text{target}} \rfloor)$$
$$D_{\text{max}} = \min(120, \lceil 1.35 \times D_{\text{target}} + 5 \rceil)$$

A candidate survives the duration filter if and only if:
$$D_{\text{min}} \le D_{\text{est}} \le D_{\text{max}}$$

**Boundary Behavior Verification:**
- For $D_{\text{target}} = 15$: Allowable range is $[10, 26]$ minutes. A 44-minute candidate is **strictly rejected**.
- For $D_{\text{target}} = 30$: Allowable range is $[15, 46]$ minutes.
- For $D_{\text{target}} = 45$: Allowable range is $[22, 66]$ minutes. Standard 26-minute session passes cleanly.
- For $D_{\text{target}} = 60$: Allowable range is $[30, 86]$ minutes.
- For $D_{\text{target}} = 90$: Allowable range is $[45, 120]$ minutes.

---

## 7. Equipment Semantics & Hard Constraint Filters

### A. Equipment Semantics Decision
**Decision: Option A — Omitted equipment means unconstrained access (no equipment filter).**
- **Explanation:** In strength training, a standard catalog comprises barbell, dumbbell, machine, cable, and bodyweight movements. If `equipment` query parameter is omitted, `context.constraints.available_equipment` is `None` (unconstrained: all exercises are eligible). If `equipment` is explicitly provided (e.g. `equipment=bodyweight`), only exercises requiring `"none"`, `"bodyweight"`, or specified equipment items are permitted.

### B. Hard Constraint Filters (Synchronous)
1. **`WorkoutVisibilityFilter`** (Defense-in-depth):
   Verifies that every exercise is active (`deleted_at is None`) and visible (`created_by_user_id is None or created_by_user_id == user_id`).
2. **`WorkoutEquipmentFilter`**:
   If `available_equipment is not None`: rejects any workout containing an exercise requiring equipment not in `{"none", "bodyweight"} | set(available_equipment)`.
3. **`WorkoutDurationFilter`**:
   Enforces $D_{\text{min}} \le D_{\text{est}} \le D_{\text{max}}$ as defined in Section 6.
4. **`WorkoutStructureFilter`**:
   Rejects workouts with 0 exercises, workouts with 0 total sets, or workouts containing duplicate exercise IDs. (For strength workouts: minimum 2 exercises; for cardio/mobility: minimum 1 exercise).

---

## 8. Training History & Muscle Freshness Semantics

### A. History as a Personalization Variety Signal
Recent training history is used strictly as a **personalization variety signal** to balance exercise selection across sessions. It does NOT implement physiological recovery tracking or claim medical recovery guarantees.

### B. Exact History Window & Timestamp Handling
- **Window:** Exactly 7 days (168.0 hours) preceding evaluation timestamp $T_{\text{now}}$ (UTC).
- **Session Timestamp:** Each completed session's `started_at` (or `created_at`).
- **Muscle Recency Calculation:**
  For each normalized canonical muscle group $m$ trained in the window:
  $$h(m) = \frac{T_{\text{now}} - \max(\{t_s \mid \text{session } s \text{ trained } m\})}{3600.0}$$
  If $m$ was not trained in the window (or user has no history): $h(m) = \infty$.

### C. Freshness Scoring Formula
For each muscle group $m$:
- If $h(m) \ge 48.0$ hours or $h(m) == \infty$: $f(m) = 1.00$.
- If $24.0 \le h(m) < 48.0$ hours:
  $$f(m) = 0.50 + 0.50 \times \left(\frac{h(m) - 24.0}{24.0}\right) \in [0.50, 1.00)$$
- If $0.0 \le h(m) < 24.0$ hours:
  $$f(m) = \max\left(0.10, \frac{h(m)}{24.0} \times 0.50\right) \in [0.10, 0.50)$$

For candidate workout targeting unique muscle groups $M$:
$$S_{\text{freshness}} = \begin{cases} 1.00 & \text{if } |M| = 0 \\ \frac{1}{|M|} \sum_{m \in M} f(m) & \text{if } |M| > 0 \end{cases}$$

### D. No-History & Missing-Data Behavior
If the user has zero workout history, $h(m) = \infty$ for all $m \implies S_{\text{freshness}} = 1.00$.

---

## 9. Fitness Goal Alignment Logic

The `WorkoutGoalAlignmentFactor` produces an exact score in $[0.0, 1.0]$ based on active `goal_type`. Every formula is mathematically exact with zero undefined functions.

### A. Exact Formulas by Goal Type

1. **`muscle_gain`:**
   - If workout `category != "strength"`: $S = 0.20$.
   - If workout `category == "strength"`:
     Let $S_{\text{sets}} = \text{total\_sets}$ and $R_{\text{reps}} = \text{average of recommended\_reps}$.
     $$v_{\text{vol}} = \begin{cases} 1.00 & \text{if } 10 \le S_{\text{sets}} \le 16 \\ \max\left(0.30, 1.00 - \frac{10 - S_{\text{sets}}}{10.0}\right) & \text{if } S_{\text{sets}} < 10 \\ \max\left(0.30, 1.00 - \frac{S_{\text{sets}} - 16}{10.0}\right) & \text{if } S_{\text{sets}} > 16 \end{cases}$$
     $$v_{\text{rep}} = \begin{cases} 1.00 & \text{if } 8.0 \le R_{\text{reps}} \le 12.0 \\ \max\left(0.40, 1.00 - \frac{8.0 - R_{\text{reps}}}{8.0}\right) & \text{if } R_{\text{reps}} < 8.0 \\ \max\left(0.40, 1.00 - \frac{R_{\text{reps}} - 12.0}{12.0}\right) & \text{if } R_{\text{reps}} > 12.0 \end{cases}$$
     $$S_{\text{muscle\_gain}} = 0.5 \times v_{\text{vol}} + 0.5 \times v_{\text{rep}} \in [0.35, 1.00]$$

2. **`strength`:**
   - If workout `category != "strength"`: $S = 0.15$.
   - If workout `category == "strength"`:
     - Programming variant alignment score ($v_{\text{variant}}$):
       - `density` variant: $v_{\text{variant}} = 0.95$
       - `standard` variant: $v_{\text{variant}} = 0.80$
       *(Note: $v_{\text{variant}}$ values are deterministic, product-defined heuristic alignment scores designed to distinguish programming profiles within the engine. They are NOT claims about physiological superiority or evidence-based strength effectiveness).*
     - Split structure score ($v_{\text{split}}$): $v_{\text{split}} = 1.00$ for all strength splits (`full_body`, `upper_body`, `lower_body`, `push`, `pull`).
     $$S_{\text{strength}} = 0.6 \times v_{\text{variant}} + 0.4 \times v_{\text{split}} \in [0.88, 0.97]$$

3. **`weight_loss`:**
   - If `workout_type == "cardio"`: $S = 1.00$.
   - If `category == "strength"`:
     - Rest density score: $v_{\text{dense}} = 0.90$ for `density` (60s rest), $0.70$ for `standard` (90s rest).
     - Systemic engagement: $v_{\text{split}} = 1.00$ for `full_body`, $0.80$ for splits.
     $$S_{\text{weight\_loss}} = 0.6 \times v_{\text{dense}} + 0.4 \times v_{\text{split}} \in [0.74, 0.94]$$
   - If `workout_type == "mobility"`: $S = 0.40$.

4. **`endurance`:**
   - If `workout_type == "cardio"`:
     - If `variant == "density"` (4 sets $\times 300$s, 45s rest): $S = 1.00$.
     - If `variant == "standard"` (3 sets $\times 300$s, 60s rest): $S = 0.90$.
   - If `category == "strength"`:
     - If `variant == "density"`: $S = 0.50$.
     - If `variant == "standard"`: $S = 0.35$.
   - If `workout_type == "mobility"`: $S = 0.30$.

5. **`maintenance`:**
   - If `workout_type == "full_body"`: $S = 1.00$.
   - If `workout_type \in {"upper_body", "lower_body", "push", "pull"}`: $S = 0.90$.
   - If `workout_type == "cardio"`: $S = 0.85$.
   - If `workout_type == "mobility"`: $S = 0.75$.

6. **No Goal / Unknown Goal Type:**
   Documented neutral midpoint score:
   $$S = 0.50$$

---

## 10. Deterministic Scoring Framework & Exact Weights

All factors implement the `ScoringFactor` protocol and produce normalized scores in $[0.0, 1.0]$.

| Factor Name | Protocol Class | Weight | Output Range | Deterministic Formula / Principle |
|:---|:---|:---:|:---:|:---|
| **Goal Alignment** | `WorkoutGoalAlignmentFactor` | **3.0** | $[0.15, 1.00]$ | Goal type alignment as defined in Section 9 |
| **Muscle Freshness** | `MuscleGroupFreshnessFactor` | **2.5** | $[0.10, 1.00]$ | Average 7-day muscle recency variety score |
| **Duration Fit** | `WorkoutDurationFitFactor` | **1.5** | $(0.00, 1.00]$ | $\exp\left( - \frac{\|D_{\text{est}} - D_{\text{target}}\|}{0.40 \times D_{\text{target}}} \right)$ |
| **Exercise Novelty** | `ExerciseNoveltyFactor` | **1.0** | $[0.00, 1.00]$ | $\frac{\|\{e \in \text{exercises} \mid e.\text{id} \notin \text{recent\_ids}\}\|}{\|\text{exercises}\|}$ |

**Total Factor Weight:** $W_{\text{total}} = 3.0 + 2.5 + 1.5 + 1.0 = \mathbf{8.0}$.

### Final Score Aggregation
$$\text{final\_score} = \frac{3.0 \times S_{\text{goal}} + 2.5 \times S_{\text{freshness}} + 1.5 \times S_{\text{duration}} + 1.0 \times S_{\text{novelty}}}{8.0} \in [0.0, 1.0]$$

### Deterministic Tie-Breaking
Candidates are sorted strictly by:
```python
key = (-candidate.score, candidate.id)
```
Because `candidate.id` is unique and deterministic, rankings are 100% reproducible.

---

## 11. Candidate Generation Algorithm & Proof of Upper Bound

### A. Template Definitions ($T = 7$)
1. `full_body`: Slots [`squat`, `hinge`, `push`, `pull`] (4 exercises)
2. `upper_body`: Slots [`push_horizontal`, `pull_horizontal`, `push_vertical`, `pull_vertical`] (4 exercises)
3. `lower_body`: Slots [`squat`, `hinge`, `core`] (3 exercises)
4. `push`: Slots [`push_horizontal`, `push_vertical`, `triceps`] (3 exercises)
5. `pull`: Slots [`hinge`, `pull_horizontal`, `biceps`] (3 exercises)
6. `cardio`: Dedicated cardio pool selection (1–2 exercises)
7. `mobility`: Dedicated mobility pool selection (1–3 exercises)

### B. Deterministic Distinct Construction Rules

#### Strength Templates (Templates 1–5):
For a template with $K$ slots $[s_1, \dots, s_K]$:
Available exercises matching slot $s_i$ and passing equipment filtering are sorted deterministically: `(is_verified DESC, name ASC, id ASC)`.
- If any slot $s_i$ has 0 matching exercises: template cannot be instantiated ($L = 0$).
- **Lineup 1 (`primary`):**
  Select candidate from slot $s_i$ that is not already chosen in this lineup:
  $e_i = \text{first } e \in P(s_i) \text{ such that } e \notin \{e_1, \dots, e_{i-1}\}$.
  If any slot has no distinct candidate available, the template is skipped ($L = 0$).
- **Lineup 2 (`alternate`):**
  Attempt to substitute index 1 for slots where $|P(s_i)| \ge 2$, maintaining the same no-duplicate constraint.
  If Lineup 2 cannot form a distinct set of exercises or is identical to Lineup 1, Lineup 2 is skipped.
- Total distinct lineups: $L \in \{0, 1, 2\}$.

#### Cardio Template (Template 6):
Draws from visible cardio exercises $C$, sorted by `(is_verified DESC, name ASC, id ASC)`:
- If $|C| == 0$: 0 lineups ($L = 0$).
- If $|C| == 1$: Exactly 1 lineup with 1 exercise: $[C[0]]$ ($L = 1$).
  Instantiated under the canonical programming variants:
  - `standard`: 3 sets $\times 300$ seconds, 60 seconds rest
  - `density`: 4 sets $\times 300$ seconds, 45 seconds rest
- If $|C| == 2$: Exactly 1 lineup with 2 distinct exercises: $[C[0], C[1]]$ ($L = 1$).
  Instantiated under the canonical programming variants:
  - `standard`: 3 sets $\times 300$ seconds, 60 seconds rest per exercise
  - `density`: 4 sets $\times 300$ seconds, 45 seconds rest per exercise
- If $|C| \ge 3$: Exactly 2 lineups:
  - Lineup 1 (`primary`): $[C[0], C[1]]$ (2 distinct exercises)
  - Lineup 2 (`alternate`): $[C[0], C[2]]$ (2 distinct exercises)
  Each instantiated under the canonical `standard` and `density` variants ($L = 2$).
- Zero duplicate exercises are generated by construction.

#### Mobility Template (Template 7):
Draws strictly from visible flexibility and balance exercises $F$, sorted by `(is_verified DESC, name ASC, id ASC)`:
- If $|F| == 0$: 0 lineups ($L = 0$).
- If $|F| == 1$: 1 lineup with 1 exercise: $[F[0]]$ ($L = 1$).
- If $|F| == 2$: 1 lineup with 2 distinct exercises: $[F[0], F[1]]$ ($L = 1$).
- If $|F| \ge 3$:
  - Lineup 1 (`primary`): Select up to 3 distinct exercises:
    1. Slot 1: First in $F_{\text{upper}}$, fallback to first in $F$.
    2. Slot 2: First in $F_{\text{lower}}$ not in `{Slot 1}`, fallback to first in $F$ not in `{Slot 1}`.
    3. Slot 3: First in $F_{\text{core}}$ not in `{Slot 1, Slot 2}`, fallback to first in $F$ not in `{Slot 1, Slot 2}`.
  - Lineup 2 (`alternate`, generated only if $|F| \ge 4$):
    Select next 3 distinct exercises:
    1. Slot 1: Second in $F_{\text{upper}}$ (or next unused in $F$).
    2. Slot 2: Next distinct unused in $F$.
    3. Slot 3: Next distinct unused in $F$.
    If $|F| < 4$: Lineup 2 is skipped ($L = 1$).
- Zero duplicate exercises are generated by construction.

### C. Mathematical Upper-Bound Proof
Each lineup for any template is paired with exactly 2 programming variants (`standard`, `density`).
- Candidates per template: $L(t) \times V \le 2 \times 2 = 4$.
- If `workout_type` is specified in query parameters:
  $$\text{Total Candidates Created} \le 1 \times 4 = \mathbf{4}$$
- If `workout_type` is omitted:
  $$\text{Total Candidates Created} \le 7 \times 4 = \mathbf{28}$$

**Bounding Theorem:**
$$\mathbf{\max(\text{Candidates Created}) = 28 \le 50}$$
The candidate generator asserts `assert len(candidates) <= 28`.
Zero unconstrained Cartesian products are formed.

---

## 12. Deterministic Candidate ID Scheme

### A. ID Syntax
```
workout:{workout_type}:{variant}:{pos_0}+{pos_1}+...+{pos_k}
```
Where each exercise position specifier is:
```
p{order_index}:{exercise_id}:{sets}x{reps}r
# or for timed exercises:
p{order_index}:{exercise_id}:{sets}x{duration}d
```

### B. Demonstration of Order Sensitivity ($[A, B, C] \ne [B, A, C]$)
Given exercises $A$, $B$, $C$:
- Sequence $[A, B, C]$:
  `workout:push:standard:p0:A:3x10r+p1:B:3x10r+p2:C:3x10r`
- Sequence $[B, A, C]$:
  `workout:push:standard:p0:B:3x10r+p1:A:3x10r+p2:C:3x10r`
Since `p0:A` $\ne$ `p0:B`, the candidate ID strings are strictly distinct.

### C. Variant Distinction
Changing the variant from `standard` to `density` transforms the ID:
- Standard: `workout:push:standard:p0:A:3x10r+...`
- Density: `workout:push:density:p0:A:4x8r+...`
Different variants produce unique IDs.

---

## 13. Context Architecture & Clean Dependency Flow

To maintain strict domain separation, infrastructure objects (`AsyncSession`, repositories) are **never embedded** in `RecommendationContext`.

### Dependency Flow:
```
FastAPI Route Dependency (get_db -> AsyncSession)
       ↓
WorkoutRecommendationService(session: AsyncSession)
       ↓
1. ExerciseRepository(session) queries active, visible exercises
2. WorkoutRepository(session) queries 7-day session history
3. WorkoutRecommendationContextBuilder compiles pure RecommendationContext:
   - user_id: uuid.UUID
   - profile: UserProfileContext
   - goal: GoalContext
   - preferences: PreferencesContext
   - workout_summary: WorkoutSummaryContext
   - constraints: ConstraintContext (available_equipment, target_duration_minutes)
   - metadata: {
       "muscle_group_last_trained_hours": dict[str, float],
       "recent_exercise_ids": list[str],
     }
4. WorkoutCandidateGenerator(session) receives context and generates <= 28 candidates
5. RecommendationEngine synchronously runs filters and scoring factors
6. Returns RecommendationResult[WorkoutPayload]
```
`RecommendationContext` remains a 100% pure domain data object.

---

## 14. API Design (`GET /api/v1/recommendations/workouts`)

### A. Endpoint Specification
- **Method:** `GET`
- **Path:** `/api/v1/recommendations/workouts`
- **Authentication:** Bearer token (`get_current_user` dependency).
- **Query Parameters:**
  - `target_duration_minutes: int | None = Query(None, ge=15, le=120)` (defaults to 45 if omitted).
  - `workout_type: str | None = Query(None)` (must be one of `CANONICAL_WORKOUT_TYPES`).
  - `equipment: list[str] = Query(default_factory=list)` (if omitted, unconstrained).
  - `limit: int = Query(5, ge=1, le=10)` (defaults to 5).

### B. Response Schema
```json
{
  "recommendation_type": "workout",
  "target_duration_minutes": 45,
  "workout_type": "full_body",
  "items": [
    {
      "id": "workout:full_body:standard:p0:3fa85f64-...:3x10r+...",
      "name": "Full Body Standard Workout",
      "workout_type": "full_body",
      "category": "strength",
      "target_muscle_groups": ["quadriceps", "hamstrings", "chest", "back"],
      "estimated_duration_minutes": 26,
      "total_sets": 12,
      "primary_equipment_needed": ["barbell", "dumbbell"],
      "variant": "standard",
      "score": 0.92,
      "reasons": [
        "Goal alignment: volume 12 sets aligns with muscle_gain.",
        "Muscle freshness: targeted muscle groups are fresh (>=48h)."
      ],
      "factor_scores": [
        {
          "factor_name": "WorkoutGoalAlignmentFactor",
          "normalized_score": 1.0,
          "weight": 3.0,
          "weighted_contribution": 3.0,
          "reason": "Goal alignment (muscle_gain): volume 12 sets in hypertrophy range."
        }
      ],
      "exercises": [
        {
          "exercise_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "exercise_name": "Barbell Back Squat",
          "category": "strength",
          "muscle_groups": ["quadriceps", "glutes"],
          "equipment": "barbell",
          "order_index": 0,
          "recommended_sets": 3,
          "recommended_reps": 10,
          "recommended_duration_seconds": null,
          "recommended_rest_seconds": 90
        }
      ]
    }
  ],
  "total_generated": 14,
  "total_survived_filtering": 12,
  "disclaimer": "Workout recommendations are training suggestions based on catalog metadata and recent logs. They do not replace medical advice or professional athletic instruction.",
  "metadata": {
    "recent_sessions_found_7d": 2,
    "last_workout_date": "2026-09-12"
  }
}
```

---

## 15. Error Handling & Edge Cases

| Scenario | Behavior | HTTP Status / Response |
|:---|:---|:---:|
| **Empty Exercise Catalog** | Generator yields 0 candidates $\to$ graceful empty list | `200 OK` (`items: []`) |
| **No Equipment Matches** | Filters eliminate candidates; none survive $\to$ graceful empty list | `200 OK` (`items: []`) |
| **Invalid Target Duration** | Validation failure ($< 15$ or $> 120$) | `422 Unprocessable Entity` |
| **Invalid Limit** | Validation failure ($< 1$ or $> 10$) | `422 Unprocessable Entity` |
| **Invalid `workout_type`** | Unknown workout type string | `422 Unprocessable Entity` |
| **No Workout History** | Freshness defaults to 1.00; novelty defaults to 1.00 | `200 OK` (successful recommendations) |
| **All Muscles Trained Recently** | Soft score penalizes freshness ($S_{\text{freshness}} \approx 0.20$), recommendations still return | `200 OK` |
| **Unsupported Goal Type** | Scores neutral default $S = 0.50$ | `200 OK` |

---

## 16. Proposed File Structure for Implementation

```
backend/
├── app/
│   ├── recommendations/
│   │   └── workouts/
│   │       ├── __init__.py            # Domain exports
│   │       ├── models.py              # WorkoutPayload, WorkoutExerciseItem
│   │       ├── filters.py             # Visibility, Equipment, Duration, Structure filters
│   │       ├── scoring.py             # GoalAlignment, Freshness, DurationFit, Novelty factors
│   │       ├── generator.py           # WorkoutCandidateGenerator (templates, <=28 bound)
│   │       ├── context_builder.py     # WorkoutRecommendationContextBuilder
│   │       └── service.py             # WorkoutRecommendationService orchestrator
│   ├── schemas/
│   │   └── recommendation.py          # Add workout response schemas (extend existing)
│   └── api/
│       └── v1/
│           └── routes/
│               └── recommendations.py  # Add GET /workouts endpoint
└── tests/
    ├── unit/
    │   └── test_workout_recommendations.py     # Unit test suite
    └── integration/
        └── test_workout_recommendation_api.py  # API integration test suite
```

**Scope Invariants:**
- 0 Alembic migrations.
- 0 ORM model changes.
- 0 modifications to Phase 7A core engine.
- 0 modifications to Phase 7B meal recommendation files.

---

## 17. Expanded Test Matrix

### Unit Tests (`tests/unit/test_workout_recommendations.py`):
1. **Mobility Template Generation:**
   - Catalog containing only `flexibility` and `balance` exercises successfully populates mobility workouts.
   - Catalog with 0 mobility exercises yields 0 mobility candidates.
   - Catalog with 1 mobility exercise yields 1-exercise candidate without crashing or duplicating.
2. **Cardio Template Generation:**
   - Catalog with 0 cardio exercises yields 0 cardio candidates.
   - Catalog with 1 cardio exercise yields 1-exercise candidate without duplicates.
   - Verify that a one-exercise cardio candidate uses exact canonical variant definitions:
     `standard` = 3 sets $\times 300$ seconds with 60 seconds rest;
     `density` = 4 sets $\times 300$ seconds with 45 seconds rest.
   - Catalog with 2 cardio exercises yields 1 lineup of 2 distinct exercises.
   - Catalog with $\ge 3$ cardio exercises yields 2 distinct lineups.
3. **No Duplicate Exercises Invariant:**
   - Verify zero candidates ever contain duplicate exercise IDs across all 7 templates.
4. **Order-Independent Movement Slot Classifier:**
   - `["quadriceps", "hamstrings"]` and `["hamstrings", "quadriceps"]` produce identical classification results (both map to `squat` and `hinge`).
   - `["chest", "triceps", "shoulders"]` and `["shoulders", "triceps", "chest"]` produce identical results.
   - Exercises with ambiguous lower-body muscles (`quadriceps` and `hamstrings`) are eligible for both `squat` and `hinge`.
   - Exercises with unmapped/unrecognized categories or empty muscle groups are excluded from slot generation.
5. **Exact Duration Boundary Filtering:**
   - For $D_{\text{target}} = 15$: 44-minute candidate is rejected; 15-minute candidate passes; 26-minute candidate passes.
   - For $D_{\text{target}} = 45$: 26-minute candidate passes; 70-minute candidate is rejected.
6. **Exact Goal Alignment Scoring:**
   - `muscle_gain` exact formula verification for varying set counts and rep schemes.
   - `strength` exact formula verification ($0.95$ for density, $0.80$ for standard with neutral $v_{\text{variant}}$ terminology).
   - `weight_loss` exact formula verification ($1.00$ for cardio, $0.90$ for density full_body).
   - `endurance` exact formula verification ($1.00$ for density cardio).
   - `maintenance` exact formula verification ($1.00$ for full_body).
   - Missing or unknown goal returns exactly $0.50$.
7. **Candidate Upper Bound Invariant:**
   - Verify `len(candidates) <= 28` under all full catalog conditions.
   - Verify `len(candidates) <= 4` when filtered to a single `workout_type`.
8. **Candidate ID Properties:**
   - Verify $\text{ID}([A, B, C]) \ne \text{ID}([B, A, C])$.
   - Verify $\text{ID}(\text{standard}) \ne \text{ID}(\text{density})$.
   - Verify all IDs in a batch are unique.
9. **Primary Equipment Deduplication:**
   - Verify `primary_equipment_needed` excludes `"none"`, trims, lowercases, and deduplicates.

### Integration Tests (`tests/integration/test_workout_recommendation_api.py`):
1. `GET /api/v1/recommendations/workouts` requires authentication (401 on missing token).
2. Unconstrained request (no `equipment` param) returns recommendations from all equipment types.
3. Constrained request (`?equipment=bodyweight`) returns bodyweight-only exercises.
4. Specific `workout_type` filter returns only candidates of that type.
5. Invalid parameters ($<15$ duration, unknown `workout_type`) return 422.
6. Ownership isolation: User A's custom exercises are never recommended to User B.
