import uuid
from collections.abc import Sequence
from typing import Any

import pytest

from app.recommendations import (
    CandidateFilter,
    CandidateGenerator,
    ConstraintContext,
    FactorScore,
    FilterResult,
    GoalContext,
    InvalidCandidateError,
    InvalidRecommendationTypeError,
    InvalidScoringConfigurationError,
    InvalidTopNError,
    NutritionSummaryContext,
    PreferencesContext,
    RecommendationCandidate,
    RecommendationContext,
    RecommendationEngine,
    RecommendationResult,
    RecommendationScorer,
    RecommendationType,
    ScoringFactor,
    UserProfileContext,
    WorkoutSummaryContext,
)

# ---------------------------------------------------------------------------
# Test Helpers & Mock Implementations
# ---------------------------------------------------------------------------


class MockFactor:
    def __init__(
        self,
        name: str,
        weight: float,
        fixed_score: float = 0.5,
        fixed_reason: str | None = None,
    ) -> None:
        self._name = name
        self._weight = weight
        self._score = fixed_score
        self._reason = fixed_reason
        self.call_count = 0

    @property
    def name(self) -> str:
        return self._name

    @property
    def weight(self) -> float:
        return self._weight

    def score(
        self, candidate: RecommendationCandidate[Any], context: RecommendationContext
    ) -> FactorScore:
        self.call_count += 1
        return FactorScore(
            factor_name=self.name,
            raw_score=self._score,
            normalized_score=self._score,
            weight=self._weight,
            weighted_contribution=self._score * self._weight,
            reason=self._reason,
        )


class MockFilter:
    def __init__(self, name: str, should_pass: bool = True, reason: str | None = None) -> None:
        self._name = name
        self.should_pass = should_pass
        self.reason = reason
        self.evaluated_candidates: list[str] = []

    @property
    def name(self) -> str:
        return self._name

    def filter(
        self, candidate: RecommendationCandidate[Any], context: RecommendationContext
    ) -> FilterResult:
        self.evaluated_candidates.append(candidate.id)
        return FilterResult(is_eligible=self.should_pass, reason=self.reason)


class MockCandidateGenerator:
    def __init__(self, candidates: Sequence[RecommendationCandidate[Any]]) -> None:
        self._candidates = list(candidates)

    async def generate_candidates(
        self, context: RecommendationContext
    ) -> Sequence[RecommendationCandidate[Any]]:
        return list(self._candidates)


def test_protocols_runtime_checkable() -> None:
    factor = MockFactor(name="f1", weight=1.0)
    assert isinstance(factor, ScoringFactor)

    filter_obj = MockFilter(name="fil1")
    assert isinstance(filter_obj, CandidateFilter)

    generator = MockCandidateGenerator([])
    assert isinstance(generator, CandidateGenerator)


# ---------------------------------------------------------------------------
# 1. Recommendation Context Tests
# ---------------------------------------------------------------------------


def test_context_minimal_creation() -> None:
    user_id = uuid.uuid4()
    context = RecommendationContext(
        user_id=user_id,
        recommendation_type=RecommendationType.MEAL,
    )
    assert context.user_id == user_id
    assert context.recommendation_type == RecommendationType.MEAL
    assert context.profile is None
    assert context.goal is None
    assert context.preferences is None
    assert context.nutrition_summary is None
    assert context.workout_summary is None
    assert isinstance(context.constraints, ConstraintContext)
    assert context.metadata == {}


def test_context_optional_sub_contexts() -> None:
    user_id = uuid.uuid4()
    profile = UserProfileContext(age=28, gender="male", height_cm=180.0, weight_kg=78.5)
    goal = GoalContext(goal_type="weight_loss", target_value=72.0, target_unit="kg")
    pref = PreferencesContext(
        dietary_restrictions=["vegetarian"],
        target_calories=2000,
        target_protein_g=140.0,
    )
    nutrition = NutritionSummaryContext(calories_consumed=1200.0, remaining_calories=800.0)
    workout = WorkoutSummaryContext(
        recent_session_count_7d=3, recent_muscle_groups=["chest", "back"]
    )
    constraints = ConstraintContext(
        available_equipment=["dumbbells"], max_preparation_time_minutes=30
    )

    context = RecommendationContext(
        user_id=user_id,
        recommendation_type=RecommendationType.WORKOUT,
        profile=profile,
        goal=goal,
        preferences=pref,
        nutrition_summary=nutrition,
        workout_summary=workout,
        constraints=constraints,
        metadata={"source": "unit_test"},
    )

    assert context.profile is not None
    assert context.profile.age == 28
    assert context.goal is not None
    assert context.goal.goal_type == "weight_loss"
    assert context.preferences is not None
    assert "vegetarian" in context.preferences.dietary_restrictions
    assert context.nutrition_summary is not None
    assert context.nutrition_summary.remaining_calories == 800.0
    assert context.workout_summary is not None
    assert context.workout_summary.recent_session_count_7d == 3
    assert context.constraints.available_equipment == ["dumbbells"]
    assert context.metadata["source"] == "unit_test"


# ---------------------------------------------------------------------------
# 2. Recommendation Candidate Tests
# ---------------------------------------------------------------------------


def test_candidate_valid_creation() -> None:
    candidate = RecommendationCandidate(
        id="cand_1",
        recommendation_type=RecommendationType.MEAL,
        payload={"meal_name": "Oatmeal with Almond Milk"},
        metadata={"prep_time": 10},
        reasons=["High fiber"],
    )
    assert candidate.id == "cand_1"
    assert candidate.recommendation_type == RecommendationType.MEAL
    assert candidate.payload == {"meal_name": "Oatmeal with Almond Milk"}
    assert candidate.reasons == ["High fiber"]


@pytest.mark.parametrize("invalid_id", ["", "   ", None, 123])
def test_candidate_invalid_id_rejected(invalid_id: Any) -> None:
    with pytest.raises(InvalidCandidateError):
        RecommendationCandidate(
            id=invalid_id,
            recommendation_type=RecommendationType.MEAL,
            payload="test",
        )


def test_candidate_type_handling() -> None:
    cand_meal = RecommendationCandidate(
        id="meal_1",
        recommendation_type=RecommendationType.MEAL,
        payload=None,
    )
    assert cand_meal.recommendation_type == RecommendationType.MEAL

    cand_workout = RecommendationCandidate(
        id="workout_1",
        recommendation_type=RecommendationType.WORKOUT,
        payload=None,
    )
    assert cand_workout.recommendation_type == RecommendationType.WORKOUT


# ---------------------------------------------------------------------------
# 3. Deterministic Scoring & Scorer Validation Tests
# ---------------------------------------------------------------------------


def test_scorer_single_factor() -> None:
    factor = MockFactor(name="factor_1", weight=2.0, fixed_score=0.8, fixed_reason="good match")
    scorer = RecommendationScorer([factor])

    candidate = RecommendationCandidate(
        id="c1", recommendation_type=RecommendationType.MEAL, payload=None
    )
    context = RecommendationContext(
        user_id=uuid.uuid4(), recommendation_type=RecommendationType.MEAL
    )

    final_score, factor_scores = scorer.score_candidate(candidate, context)
    assert pytest.approx(final_score, 1e-6) == 0.8
    assert len(factor_scores) == 1
    assert factor_scores[0].factor_name == "factor_1"
    assert factor_scores[0].normalized_score == 0.8
    assert factor_scores[0].weight == 2.0
    assert factor_scores[0].weighted_contribution == 1.6
    assert factor_scores[0].reason == "good match"


def test_scorer_multiple_factors_weighted_average() -> None:
    # Formula: (0.9 * 3.0 + 0.5 * 1.0) / (3.0 + 1.0) = (2.7 + 0.5) / 4.0 = 3.2 / 4.0 = 0.8
    f1 = MockFactor(name="goal_alignment", weight=3.0, fixed_score=0.9)
    f2 = MockFactor(name="preference_match", weight=1.0, fixed_score=0.5)
    scorer = RecommendationScorer([f1, f2])

    candidate = RecommendationCandidate(
        id="c1", recommendation_type=RecommendationType.MEAL, payload=None
    )
    context = RecommendationContext(
        user_id=uuid.uuid4(), recommendation_type=RecommendationType.MEAL
    )

    final_score, factor_scores = scorer.score_candidate(candidate, context)
    assert pytest.approx(final_score, 1e-6) == 0.8
    assert len(factor_scores) == 2
    assert factor_scores[0].factor_name == "goal_alignment"
    assert factor_scores[1].factor_name == "preference_match"


def test_scorer_boundary_scores() -> None:
    f_zero = MockFactor(name="zero_factor", weight=1.0, fixed_score=0.0)
    scorer_zero = RecommendationScorer([f_zero])
    cand = RecommendationCandidate(
        id="c1", recommendation_type=RecommendationType.MEAL, payload=None
    )
    ctx = RecommendationContext(user_id=uuid.uuid4(), recommendation_type=RecommendationType.MEAL)

    score_0, _ = scorer_zero.score_candidate(cand, ctx)
    assert score_0 == 0.0

    f_one = MockFactor(name="one_factor", weight=1.0, fixed_score=1.0)
    scorer_one = RecommendationScorer([f_one])
    score_1, _ = scorer_one.score_candidate(cand, ctx)
    assert score_1 == 1.0


@pytest.mark.parametrize(
    "invalid_weight", [0.0, -1.0, -0.001, float("nan"), float("inf"), float("-inf")]
)
def test_scorer_rejects_non_positive_and_non_finite_weights(invalid_weight: float) -> None:
    f = MockFactor(name="invalid_weight_factor", weight=invalid_weight, fixed_score=0.5)
    with pytest.raises(InvalidScoringConfigurationError):
        RecommendationScorer([f])


def test_scorer_rejects_boolean_weight() -> None:
    # In Python, bool subclasses int (True == 1, False == 0). Ensure bool is explicitly rejected.
    f_true = MockFactor(name="bool_factor", weight=True, fixed_score=0.5)
    with pytest.raises(InvalidScoringConfigurationError):
        RecommendationScorer([f_true])

    f_false = MockFactor(name="bool_factor", weight=False, fixed_score=0.5)
    with pytest.raises(InvalidScoringConfigurationError):
        RecommendationScorer([f_false])


def test_scorer_rejects_empty_factors() -> None:
    with pytest.raises(InvalidScoringConfigurationError):
        RecommendationScorer([])


def test_scorer_rejects_duplicate_factor_names() -> None:
    f1 = MockFactor(name="dup_name", weight=1.0)
    f2 = MockFactor(name="dup_name", weight=2.0)
    with pytest.raises(InvalidScoringConfigurationError):
        RecommendationScorer([f1, f2])


def test_scorer_rejects_empty_factor_name() -> None:
    f = MockFactor(name="   ", weight=1.0)
    with pytest.raises(InvalidScoringConfigurationError):
        RecommendationScorer([f])


@pytest.mark.parametrize("invalid_score", [-0.01, 1.01, float("nan"), float("inf"), float("-inf")])
def test_scorer_rejects_invalid_factor_scores_without_silent_clamping(invalid_score: float) -> None:
    f = MockFactor(name="bad_score_factor", weight=1.0, fixed_score=invalid_score)
    scorer = RecommendationScorer([f])
    cand = RecommendationCandidate(
        id="c1", recommendation_type=RecommendationType.MEAL, payload=None
    )
    ctx = RecommendationContext(user_id=uuid.uuid4(), recommendation_type=RecommendationType.MEAL)

    with pytest.raises(InvalidScoringConfigurationError):
        scorer.score_candidate(cand, ctx)


def test_scorer_rejects_boolean_factor_score() -> None:
    class BoolScoreFactor:
        name = "bool_score"
        weight = 1.0

        def score(self, candidate: Any, context: Any) -> FactorScore:
            return FactorScore(
                factor_name="bool_score",
                raw_score=1.0,
                normalized_score=True,
                weight=1.0,
                weighted_contribution=1.0,
            )

    scorer = RecommendationScorer([BoolScoreFactor()])
    cand = RecommendationCandidate(
        id="c1", recommendation_type=RecommendationType.MEAL, payload=None
    )
    ctx = RecommendationContext(user_id=uuid.uuid4(), recommendation_type=RecommendationType.MEAL)

    with pytest.raises(InvalidScoringConfigurationError):
        scorer.score_candidate(cand, ctx)


def test_scorer_deterministic_repeatability() -> None:
    f1 = MockFactor(name="f1", weight=2.5, fixed_score=0.7)
    f2 = MockFactor(name="f2", weight=1.5, fixed_score=0.3)
    scorer = RecommendationScorer([f1, f2])

    cand = RecommendationCandidate(
        id="c1", recommendation_type=RecommendationType.MEAL, payload=None
    )
    ctx = RecommendationContext(user_id=uuid.uuid4(), recommendation_type=RecommendationType.MEAL)

    score_a, details_a = scorer.score_candidate(cand, ctx)
    score_b, details_b = scorer.score_candidate(cand, ctx)

    assert score_a == score_b
    assert [d.normalized_score for d in details_a] == [d.normalized_score for d in details_b]


# ---------------------------------------------------------------------------
# 4. Candidate Filter Tests
# ---------------------------------------------------------------------------


def test_candidate_filter_accepted() -> None:
    fil = MockFilter(name="allergy_filter", should_pass=True)
    cand = RecommendationCandidate(
        id="c1", recommendation_type=RecommendationType.MEAL, payload=None
    )
    ctx = RecommendationContext(user_id=uuid.uuid4(), recommendation_type=RecommendationType.MEAL)

    res = fil.filter(cand, ctx)
    assert res.is_eligible is True
    assert res.reason is None


def test_candidate_filter_rejected_with_reason() -> None:
    fil = MockFilter(name="allergy_filter", should_pass=False, reason="Contains peanut allergen")
    cand = RecommendationCandidate(
        id="c1", recommendation_type=RecommendationType.MEAL, payload=None
    )
    ctx = RecommendationContext(user_id=uuid.uuid4(), recommendation_type=RecommendationType.MEAL)

    res = fil.filter(cand, ctx)
    assert res.is_eligible is False
    assert res.reason == "Contains peanut allergen"


# ---------------------------------------------------------------------------
# 5. Recommendation Engine Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_engine_end_to_end_pipeline() -> None:
    c1 = RecommendationCandidate(
        id="c1", recommendation_type=RecommendationType.MEAL, payload="Meal 1"
    )
    c2 = RecommendationCandidate(
        id="c2", recommendation_type=RecommendationType.MEAL, payload="Meal 2"
    )
    c3 = RecommendationCandidate(
        id="c3", recommendation_type=RecommendationType.MEAL, payload="Meal 3"
    )

    generator = MockCandidateGenerator([c1, c2, c3])

    # Filter c2 out
    class RejectC2Filter:
        name = "reject_c2"

        def filter(
            self, candidate: RecommendationCandidate[Any], context: RecommendationContext
        ) -> FilterResult:
            if candidate.id == "c2":
                return FilterResult(is_eligible=False, reason="Excluded")
            return FilterResult(is_eligible=True)

    class VariableFactor:
        name = "var_factor"
        weight = 1.0

        def score(
            self, candidate: RecommendationCandidate[Any], context: RecommendationContext
        ) -> FactorScore:
            score_val = 0.9 if candidate.id == "c3" else 0.4
            return FactorScore(
                factor_name="var_factor",
                raw_score=score_val,
                normalized_score=score_val,
                weight=1.0,
                weighted_contribution=score_val,
                reason=f"Score for {candidate.id}",
            )

    scorer = RecommendationScorer([VariableFactor()])
    engine = RecommendationEngine(generator=generator, scorer=scorer, filters=[RejectC2Filter()])

    ctx = RecommendationContext(user_id=uuid.uuid4(), recommendation_type=RecommendationType.MEAL)
    result = await engine.recommend(ctx, top_n=5)

    assert isinstance(result, RecommendationResult)
    assert result.total_generated == 3
    assert result.total_survived_filtering == 2
    assert len(result.ranked_candidates) == 2

    # c3 scored 0.9, c1 scored 0.4 -> c3 first
    assert result.ranked_candidates[0].candidate.id == "c3"
    assert pytest.approx(result.ranked_candidates[0].score, 1e-6) == 0.9
    assert result.ranked_candidates[1].candidate.id == "c1"
    assert pytest.approx(result.ranked_candidates[1].score, 1e-6) == 0.4


@pytest.mark.asyncio
async def test_engine_filters_before_scoring() -> None:
    # Verifies that rejected candidates are NOT passed to scorer
    c1 = RecommendationCandidate(id="c1", recommendation_type=RecommendationType.MEAL, payload=None)
    c2 = RecommendationCandidate(id="c2", recommendation_type=RecommendationType.MEAL, payload=None)

    generator = MockCandidateGenerator([c1, c2])
    filter_reject_all = MockFilter(name="reject_all", should_pass=False, reason="Hard reject")
    factor = MockFactor(name="f1", weight=1.0, fixed_score=0.5)
    scorer = RecommendationScorer([factor])

    engine = RecommendationEngine(generator=generator, scorer=scorer, filters=[filter_reject_all])
    ctx = RecommendationContext(user_id=uuid.uuid4(), recommendation_type=RecommendationType.MEAL)

    result = await engine.recommend(ctx, top_n=5)
    assert result.total_generated == 2
    assert result.total_survived_filtering == 0
    assert result.ranked_candidates == []
    # Scorer was never called because filtering happened first
    assert factor.call_count == 0


@pytest.mark.asyncio
async def test_engine_deterministic_tie_breaking() -> None:
    # Candidates with equal scores must be deterministically sorted by candidate.id ascending
    cand_z = RecommendationCandidate(
        id="cand_z", recommendation_type=RecommendationType.WORKOUT, payload=None
    )
    cand_a = RecommendationCandidate(
        id="cand_a", recommendation_type=RecommendationType.WORKOUT, payload=None
    )
    cand_m = RecommendationCandidate(
        id="cand_m", recommendation_type=RecommendationType.WORKOUT, payload=None
    )

    generator = MockCandidateGenerator([cand_z, cand_a, cand_m])
    factor = MockFactor(name="equal_factor", weight=1.0, fixed_score=0.75)
    scorer = RecommendationScorer([factor])

    engine = RecommendationEngine(generator=generator, scorer=scorer)
    ctx = RecommendationContext(
        user_id=uuid.uuid4(), recommendation_type=RecommendationType.WORKOUT
    )

    result = await engine.recommend(ctx, top_n=3)
    # Since all have score 0.75, tie-breaking sorts by id ascending: cand_a, cand_m, cand_z
    ids = [item.candidate.id for item in result.ranked_candidates]
    assert ids == ["cand_a", "cand_m", "cand_z"]


@pytest.mark.asyncio
async def test_engine_top_n_truncation() -> None:
    candidates = [
        RecommendationCandidate(
            id=f"c_{i}", recommendation_type=RecommendationType.MEAL, payload=None
        )
        for i in range(10)
    ]
    generator = MockCandidateGenerator(candidates)
    factor = MockFactor(name="f", weight=1.0, fixed_score=0.5)
    scorer = RecommendationScorer([factor])

    engine = RecommendationEngine(generator=generator, scorer=scorer)
    ctx = RecommendationContext(user_id=uuid.uuid4(), recommendation_type=RecommendationType.MEAL)

    result_top_3 = await engine.recommend(ctx, top_n=3)
    assert len(result_top_3.ranked_candidates) == 3
    assert result_top_3.total_generated == 10
    assert result_top_3.total_survived_filtering == 10

    result_top_1 = await engine.recommend(ctx, top_n=1)
    assert len(result_top_1.ranked_candidates) == 1


@pytest.mark.asyncio
async def test_engine_fewer_than_n_candidates() -> None:
    candidates = [
        RecommendationCandidate(id="c1", recommendation_type=RecommendationType.MEAL, payload=None),
        RecommendationCandidate(id="c2", recommendation_type=RecommendationType.MEAL, payload=None),
    ]
    generator = MockCandidateGenerator(candidates)
    factor = MockFactor(name="f", weight=1.0, fixed_score=0.5)
    scorer = RecommendationScorer([factor])

    engine = RecommendationEngine(generator=generator, scorer=scorer)
    ctx = RecommendationContext(user_id=uuid.uuid4(), recommendation_type=RecommendationType.MEAL)

    result = await engine.recommend(ctx, top_n=10)
    assert len(result.ranked_candidates) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("invalid_top_n", [0, -1, -10, True, False, "5", 3.5])
async def test_engine_rejects_invalid_top_n(invalid_top_n: Any) -> None:
    generator = MockCandidateGenerator([])
    factor = MockFactor(name="f", weight=1.0, fixed_score=0.5)
    scorer = RecommendationScorer([factor])
    engine = RecommendationEngine(generator=generator, scorer=scorer)
    ctx = RecommendationContext(user_id=uuid.uuid4(), recommendation_type=RecommendationType.MEAL)

    with pytest.raises(InvalidTopNError):
        await engine.recommend(ctx, top_n=invalid_top_n)


@pytest.mark.asyncio
async def test_engine_rejects_invalid_recommendation_type() -> None:
    generator = MockCandidateGenerator([])
    factor = MockFactor(name="f", weight=1.0, fixed_score=0.5)
    scorer = RecommendationScorer([factor])
    engine = RecommendationEngine(generator=generator, scorer=scorer)

    class FakeContext:
        user_id = uuid.uuid4()
        recommendation_type = "invalid_type"

    with pytest.raises(InvalidRecommendationTypeError):
        await engine.recommend(FakeContext(), top_n=5)  # type: ignore[arg-type]
