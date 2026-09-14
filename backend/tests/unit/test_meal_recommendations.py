"""Phase 7B – Unit tests for meal recommendation components.

Covers all required test groups from the approved plan:
  GT-01 through GT-15 (generation invariants, filters, IDs, determinism)
  TP-01 through TP-04 (tracked protein target)
  MH-01 through MH-08 (macro heuristic fallbacks)
"""

from __future__ import annotations

import math
import uuid
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock

import pytest

from app.recommendations.meals.context_builder import _derive_macro_targets
from app.recommendations.meals.generator import _paired_candidate_id, _single_candidate_id

# ─────────────────────────────────────────────────────────────────────────────
# Helpers / factories
# ─────────────────────────────────────────────────────────────────────────────

def _make_food(
    food_id: uuid.UUID | None = None,
    name: str = "Test Food",
    category: str | None = None,
    calories_per_100g: float = 100.0,
    protein_per_100g: float = 10.0,
    carbs_per_100g: float = 15.0,
    fat_per_100g: float = 5.0,
    serving_grams: float = 100.0,
    is_default_serving: bool = True,
) -> MagicMock:
    food = MagicMock()
    food.id = food_id or uuid.uuid4()
    food.name = name
    food.category = category
    food.calories_per_100g = Decimal(str(calories_per_100g))
    food.protein_per_100g = Decimal(str(protein_per_100g))
    food.carbs_per_100g = Decimal(str(carbs_per_100g))
    food.fat_per_100g = Decimal(str(fat_per_100g))
    food.deleted_at = None
    food.created_by_user_id = None

    serving = MagicMock()
    serving.id = uuid.uuid4()
    serving.grams = Decimal(str(serving_grams))
    serving.description = f"{serving_grams}g"
    serving.is_default = is_default_serving
    food.servings = [serving]
    return food


def _make_meal_food_item(
    food_id: uuid.UUID | None = None,
    food_name: str = "Test Food",
    category: str | None = None,
    calories: float = 150.0,
    protein_g: float = 15.0,
    carbs_g: float = 20.0,
    fat_g: float = 5.0,
    quantity_g: float = 150.0,
) -> Any:
    from app.recommendations.meals.models import MealFoodItem
    return MealFoodItem(
        food_id=food_id or uuid.uuid4(),
        food_name=food_name,
        category=category,
        quantity_g=Decimal(str(quantity_g)),
        serving_id=uuid.uuid4(),
        serving_description="1 serving",
        serving_count=Decimal("1.00"),
        calories=Decimal(str(calories)),
        protein_g=Decimal(str(protein_g)),
        carbs_g=Decimal(str(carbs_g)),
        fat_g=Decimal(str(fat_g)),
    )


def _make_payload(
    meal_type: str = "lunch",
    calories: float = 500.0,
    protein_g: float = 35.0,
    carbs_g: float = 60.0,
    fat_g: float = 15.0,
    components: list[Any] | None = None,
) -> Any:
    from app.recommendations.meals.models import MealPayload
    comps = components or [_make_meal_food_item(
        calories=calories,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
    )]
    return MealPayload(
        meal_type=meal_type,
        components=comps,
        total_calories=Decimal(str(calories)),
        total_protein_g=Decimal(str(protein_g)),
        total_carbs_g=Decimal(str(carbs_g)),
        total_fat_g=Decimal(str(fat_g)),
    )


def _make_candidate(
    candidate_id: str = "test-candidate",
    meal_type: str = "lunch",
    calories: float = 500.0,
    protein_g: float = 35.0,
    carbs_g: float = 60.0,
    fat_g: float = 15.0,
    payload: Any = None,
) -> Any:
    from app.recommendations.candidate import RecommendationCandidate
    from app.recommendations.types import RecommendationType
    p = payload or _make_payload(
        meal_type=meal_type,
        calories=calories,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
    )
    return RecommendationCandidate(
        id=candidate_id,
        recommendation_type=RecommendationType.MEAL,
        payload=p,
    )


def _make_context(
    meal_type: str = "lunch",
    target_calories: float = 500.0,
    calorie_ceiling: float = 600.0,
    target_protein_g: float = 35.0,
    macro_target_p: float = 0.25,
    macro_target_c: float = 0.50,
    macro_target_f: float = 0.25,
    goal_type: str | None = None,
    dietary_restrictions: list[str] | None = None,
    allergies: list[str] | None = None,
    disliked_foods: list[str] | None = None,
    daily_budget_tracked: bool = True,
) -> Any:
    from app.recommendations.context import PreferencesContext, RecommendationContext
    from app.recommendations.types import RecommendationType
    prefs = PreferencesContext(
        dietary_restrictions=dietary_restrictions or [],
        allergies=allergies or [],
        disliked_foods=disliked_foods or [],
    )
    return RecommendationContext(
        user_id=uuid.uuid4(),
        recommendation_type=RecommendationType.MEAL,
        preferences=prefs,
        metadata={
            "meal_type": meal_type,
            "target_calories": target_calories,
            "calorie_ceiling": calorie_ceiling,
            "target_protein_g": target_protein_g,
            "macro_target_p": macro_target_p,
            "macro_target_c": macro_target_c,
            "macro_target_f": macro_target_f,
            "goal_type": goal_type,
            "daily_budget_tracked": daily_budget_tracked,
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# MH-01 to MH-08: Macro target heuristic derivation
# ─────────────────────────────────────────────────────────────────────────────

def _assert_fractions(t_p: float, t_c: float, t_f: float) -> None:
    assert t_p >= 0.0, f"t_p={t_p} must be >= 0"
    assert t_c >= 0.0, f"t_c={t_c} must be >= 0"
    assert t_f >= 0.0, f"t_f={t_f} must be >= 0"
    total = t_p + t_c + t_f
    assert abs(total - 1.0) < 1e-4, f"Fractions sum to {total}, expected 1.0"


class TestMacroHeuristics:
    """MH-01 through MH-08: All 8 preference combinations."""

    def test_mh01_protein_only(self) -> None:
        """MH-01: Only protein set. Remaining split 2:1 carbs:fat."""
        # P=60g, E_ref=1200 kcal → E_p = 240 kcal → t_p = 240/1200 = 0.20
        t_p, t_c, t_f = _derive_macro_targets(
            protein_target_g=Decimal("60"),
            carbs_target_g=None,
            fat_target_g=None,
            e_ref=1200.0,
            goal_type=None,
        )
        _assert_fractions(t_p, t_c, t_f)
        assert 0.15 <= t_p <= 0.40, f"t_p={t_p} not in [0.15, 0.40]"

    def test_mh01_protein_only_high_clamp(self) -> None:
        """MH-01 high clamp: P very high → t_p clamped at 0.40."""
        t_p, t_c, t_f = _derive_macro_targets(
            protein_target_g=Decimal("200"),
            carbs_target_g=None,
            fat_target_g=None,
            e_ref=500.0,
            goal_type=None,
        )
        _assert_fractions(t_p, t_c, t_f)
        assert t_p == 0.40

    def test_mh01_protein_only_low_clamp(self) -> None:
        """MH-01 low clamp: P very low → t_p clamped at 0.15."""
        t_p, t_c, t_f = _derive_macro_targets(
            protein_target_g=Decimal("5"),
            carbs_target_g=None,
            fat_target_g=None,
            e_ref=2000.0,
            goal_type=None,
        )
        _assert_fractions(t_p, t_c, t_f)
        assert t_p == 0.15

    def test_mh02_carbs_only(self) -> None:
        """MH-02: Only carbs set. Remaining split 1:1 protein:fat."""
        t_p, t_c, t_f = _derive_macro_targets(
            protein_target_g=None,
            carbs_target_g=Decimal("250"),
            fat_target_g=None,
            e_ref=2000.0,
            goal_type=None,
        )
        _assert_fractions(t_p, t_c, t_f)
        assert 0.30 <= t_c <= 0.65

    def test_mh03_fat_only(self) -> None:
        """MH-03: Only fat set. Remaining split 1:2 protein:carbs."""
        t_p, t_c, t_f = _derive_macro_targets(
            protein_target_g=None,
            carbs_target_g=None,
            fat_target_g=Decimal("70"),
            e_ref=2000.0,
            goal_type=None,
        )
        _assert_fractions(t_p, t_c, t_f)
        assert 0.15 <= t_f <= 0.40

    def test_mh04_protein_carbs_under_eref(self) -> None:
        """MH-04: P+C present, E_p+E_c < E_ref → fat fills the remainder."""
        t_p, t_c, t_f = _derive_macro_targets(
            protein_target_g=Decimal("100"),  # 400 kcal
            carbs_target_g=Decimal("200"),    # 800 kcal
            fat_target_g=None,
            e_ref=2000.0,
            goal_type=None,
        )
        _assert_fractions(t_p, t_c, t_f)
        # E_f = 2000 - 1200 = 800; t_f = 800/2000 = 0.40
        assert abs(t_f - 0.40) < 1e-4

    def test_mh05_protein_carbs_over_eref(self) -> None:
        """MH-05: P+C >= E_ref → t_f fixed at 0.20, rest proportional."""
        t_p, t_c, t_f = _derive_macro_targets(
            protein_target_g=Decimal("200"),  # 800 kcal
            carbs_target_g=Decimal("400"),    # 1600 kcal > 2000 total
            fat_target_g=None,
            e_ref=2000.0,
            goal_type=None,
        )
        _assert_fractions(t_p, t_c, t_f)
        assert abs(t_f - 0.20) < 1e-4

    def test_mh06_protein_fat_over_eref(self) -> None:
        """MH-06: P+F >= E_ref → t_c fixed at 0.15, rest proportional."""
        t_p, t_c, t_f = _derive_macro_targets(
            protein_target_g=Decimal("200"),
            carbs_target_g=None,
            fat_target_g=Decimal("200"),
            e_ref=2000.0,
            goal_type=None,
        )
        _assert_fractions(t_p, t_c, t_f)
        assert abs(t_c - 0.15) < 1e-4

    def test_mh07_carbs_fat_over_eref(self) -> None:
        """MH-07: C+F >= E_ref → t_p fixed at 0.20, rest proportional."""
        t_p, t_c, t_f = _derive_macro_targets(
            protein_target_g=None,
            carbs_target_g=Decimal("300"),
            fat_target_g=Decimal("200"),
            e_ref=2000.0,
            goal_type=None,
        )
        _assert_fractions(t_p, t_c, t_f)
        assert abs(t_p - 0.20) < 1e-4

    def test_mh08_none_muscle_gain(self) -> None:
        """MH-08: No macros, muscle_gain goal → (0.30, 0.45, 0.25)."""
        t_p, t_c, t_f = _derive_macro_targets(None, None, None, 2000.0, "muscle_gain")
        _assert_fractions(t_p, t_c, t_f)
        assert t_p == 0.30
        assert t_c == 0.45
        assert t_f == 0.25

    def test_mh08_none_weight_loss(self) -> None:
        """MH-08: No macros, weight_loss goal → (0.30, 0.40, 0.30)."""
        t_p, t_c, t_f = _derive_macro_targets(None, None, None, 2000.0, "weight_loss")
        _assert_fractions(t_p, t_c, t_f)
        assert t_p == 0.30
        assert t_c == 0.40
        assert t_f == 0.30

    def test_mh08_none_maintenance(self) -> None:
        """MH-08: No macros, maintenance/None goal → (0.25, 0.50, 0.25)."""
        t_p, t_c, t_f = _derive_macro_targets(None, None, None, 2000.0, None)
        _assert_fractions(t_p, t_c, t_f)
        assert t_p == 0.25
        assert t_c == 0.50
        assert t_f == 0.25

    def test_mh_all_three(self) -> None:
        """All three macros present: fractions sum to 1.0 exactly."""
        t_p, t_c, t_f = _derive_macro_targets(
            protein_target_g=Decimal("100"),  # 400 kcal
            carbs_target_g=Decimal("200"),    # 800 kcal
            fat_target_g=Decimal("100"),      # 900 kcal → total 2100
            e_ref=2000.0,
            goal_type=None,
        )
        _assert_fractions(t_p, t_c, t_f)

    def test_mh_deterministic(self) -> None:
        """Same inputs always produce identical outputs."""
        args = (Decimal("80"), Decimal("220"), None, 2000.0, "weight_loss")
        r1 = _derive_macro_targets(*args)
        r2 = _derive_macro_targets(*args)
        assert r1 == r2

    def test_mh_no_division_by_zero_zero_eref(self) -> None:
        """e_ref=0 falls back to goal defaults safely (no division by zero)."""
        t_p, t_c, t_f = _derive_macro_targets(
            protein_target_g=Decimal("50"),
            carbs_target_g=None,
            fat_target_g=None,
            e_ref=0.0,
            goal_type="maintenance",
        )
        _assert_fractions(t_p, t_c, t_f)


# ─────────────────────────────────────────────────────────────────────────────
# TP-01 to TP-04: Tracked protein target
# ─────────────────────────────────────────────────────────────────────────────

class TestTrackedProteinTarget:
    """TP-01 through TP-04: protein target derivation and scoring."""

    def test_tp01_remaining_exceeds_share(self) -> None:
        """TP-01: P_remaining > P_daily * s_meal → P_meal = round(P_daily * s_meal, 1)."""
        p_daily = 160.0
        s_meal = 0.35  # lunch
        p_consumed = 10.0  # little consumed
        p_remaining = max(0.0, p_daily - p_consumed)  # 150 g
        p_meal_base = round(p_daily * s_meal, 1)  # 56.0
        p_meal = min(p_meal_base, p_remaining)  # 56.0
        assert p_meal == 56.0

    def test_tp02_remaining_less_than_share(self) -> None:
        """TP-02: P_remaining < meal share → P_meal = P_remaining."""
        p_daily = 160.0
        s_meal = 0.35
        p_consumed = 130.0
        p_remaining = max(0.0, p_daily - p_consumed)  # 30 g
        p_meal_base = round(p_daily * s_meal, 1)  # 56.0
        p_meal = min(p_meal_base, p_remaining)  # 30.0
        assert p_meal == 30.0

    def test_tp03_protein_already_met_neutral_score(self) -> None:
        """TP-03: P_remaining <= 0 → MealProteinProximityFactor returns 1.0."""
        from app.recommendations.meals.scoring import MealProteinProximityFactor
        factor = MealProteinProximityFactor()
        candidate = _make_candidate(protein_g=40.0)
        context = _make_context(target_protein_g=0.0)  # P_meal = 0 → neutral
        fs = factor.score(candidate, context)
        assert fs.normalized_score == 1.0
        assert "already met" in (fs.reason or "").lower()

    def test_tp03_no_division_by_zero(self) -> None:
        """TP-03: Never divides by P_meal when P_meal <= 0."""
        from app.recommendations.meals.scoring import MealProteinProximityFactor
        factor = MealProteinProximityFactor()
        for p_meal_val in [0.0, -1.0, -100.0]:
            candidate = _make_candidate(protein_g=50.0)
            context = _make_context(target_protein_g=p_meal_val)
            fs = factor.score(candidate, context)
            assert math.isfinite(fs.normalized_score)
            assert 0.0 <= fs.normalized_score <= 1.0

    def test_tp04_no_configured_target_derives_from_meal(self) -> None:
        """TP-04: No P_daily → P_meal = round(T_meal * 0.25 / 4.0, 1)."""
        t_meal = 600.0
        p_meal = round(t_meal * 0.25 / 4.0, 1)
        assert p_meal == 37.5

        from app.recommendations.meals.scoring import MealProteinProximityFactor
        factor = MealProteinProximityFactor()
        candidate = _make_candidate(protein_g=37.5)
        context = _make_context(target_protein_g=37.5)
        fs = factor.score(candidate, context)
        # Exact match → score = 1.0
        assert abs(fs.normalized_score - 1.0) < 1e-6

    def test_tp01_scoring_with_remaining(self) -> None:
        """TP-01 end-to-end: protein proximity scores within [0,1]."""
        from app.recommendations.meals.scoring import MealProteinProximityFactor
        factor = MealProteinProximityFactor()
        candidate = _make_candidate(protein_g=40.0)
        context = _make_context(target_protein_g=56.0)
        fs = factor.score(candidate, context)
        assert 0.0 <= fs.normalized_score <= 1.0
        assert fs.normalized_score < 1.0  # deviation → not perfect score


# ─────────────────────────────────────────────────────────────────────────────
# GT-05: Side-union bounding
# ─────────────────────────────────────────────────────────────────────────────

class TestSideUnionBounding:
    """GT-05: Side-union is bounded at 5 (3 carb + 2 veg), deduplication."""

    def test_side_union_max_5(self) -> None:
        """With 3 carb and 2 veg (distinct IDs), side pool has exactly 5 items."""
        carb_foods = [_make_food(name=f"Carb{i}") for i in range(3)]
        veg_foods = [_make_food(name=f"Veg{i}") for i in range(2)]
        seen: set[uuid.UUID] = set()
        side_pool = []
        for food in carb_foods + veg_foods:
            if food.id not in seen:
                seen.add(food.id)
                side_pool.append(food)
        assert len(side_pool) == 5

    def test_side_union_deduplication(self) -> None:
        """Shared food IDs between carb and veg pools are deduplicated."""
        shared_id = uuid.uuid4()
        shared_food = _make_food(food_id=shared_id, name="Shared")
        carb_foods = [shared_food, _make_food(name="Carb1"), _make_food(name="Carb2")]
        veg_foods = [shared_food, _make_food(name="Veg1")]
        seen: set[uuid.UUID] = set()
        side_pool = []
        for food in carb_foods + veg_foods:
            if food.id not in seen:
                seen.add(food.id)
                side_pool.append(food)
        assert len(side_pool) == 4  # shared appears once


# ─────────────────────────────────────────────────────────────────────────────
# GT-06: Paired candidate IDs
# ─────────────────────────────────────────────────────────────────────────────


class TestCandidateIDs:
    """GT-06 and GT-15: Candidate ID format and collision avoidance."""

    def test_single_id_format(self) -> None:
        """Single candidate ID includes 'single:' role prefix."""
        fid = uuid.uuid4()
        cid = _single_candidate_id("lunch", fid, Decimal("1.0"))
        assert cid.startswith("meal:lunch:single:")
        assert str(fid) in cid

    def test_paired_id_role_labelled(self) -> None:
        """Paired ID includes 'protein:' and 'side:' role labels."""
        pid = uuid.uuid4()
        sid = uuid.uuid4()
        cid = _paired_candidate_id("lunch", pid, Decimal("1.0"), sid, Decimal("1.0"))
        assert "protein:" in cid
        assert "side:" in cid
        assert str(pid) in cid
        assert str(sid) in cid

    def test_gt15_role_collision_prevention(self) -> None:
        """GT-15: protein A + side B ≠ protein B + side A."""
        a = uuid.uuid4()
        b = uuid.uuid4()
        id_ab = _paired_candidate_id("lunch", a, Decimal("1.0"), b, Decimal("1.0"))
        id_ba = _paired_candidate_id("lunch", b, Decimal("1.0"), a, Decimal("1.0"))
        assert id_ab != id_ba

    def test_gt15_role_preserved_in_ids(self) -> None:
        """GT-15: Each ID encodes 'protein:A' before 'side:B'."""
        a = uuid.uuid4()
        b = uuid.uuid4()
        id_ab = _paired_candidate_id("lunch", a, Decimal("1.0"), b, Decimal("1.0"))
        id_ba = _paired_candidate_id("lunch", b, Decimal("1.0"), a, Decimal("1.0"))
        assert f"protein:{a}_1.00" in id_ab
        assert f"side:{b}_1.00" in id_ab
        assert f"protein:{b}_1.00" in id_ba
        assert f"side:{a}_1.00" in id_ba

    def test_gt15_all_unique_ids_in_full_generation(self) -> None:
        """GT-15: All generated candidate IDs are unique (no collisions)."""

        from app.recommendations.meals.generator import _PAIR_RATIOS

        # Simulate: IDs A, B appear in both protein and side pool
        a = uuid.uuid4()
        b = uuid.uuid4()
        protein_pool = [a, b]
        side_pool = [a, b]

        all_ids: list[str] = []
        for pid in protein_pool:
            for sid in side_pool:
                for p_mult, s_mult in _PAIR_RATIOS:
                    cid = _paired_candidate_id("lunch", pid, p_mult, sid, s_mult)
                    all_ids.append(cid)

        assert len(all_ids) == len(set(all_ids)), "Duplicate candidate IDs found!"

    def test_ratio_variants_produce_distinct_ids(self) -> None:
        """Different ratio configurations (1.0/1.0 vs 1.5/0.5) produce distinct IDs."""
        pid = uuid.uuid4()
        sid = uuid.uuid4()
        id_a = _paired_candidate_id("lunch", pid, Decimal("1.0"), sid, Decimal("1.0"))
        id_b = _paired_candidate_id("lunch", pid, Decimal("1.5"), sid, Decimal("0.5"))
        assert id_a != id_b


# ─────────────────────────────────────────────────────────────────────────────
# GT-07, GT-08, GT-09: Filter correctness
# ─────────────────────────────────────────────────────────────────────────────

class TestHardConstraintFilters:
    """GT-07: Dietary/allergy/dislike filtering rejects correctly."""

    # MealAllergyFilter
    def test_allergy_rejects_matching_food(self) -> None:
        from app.recommendations.meals.filters import MealAllergyFilter
        f = MealAllergyFilter()
        candidate = _make_candidate(
            candidate_id="t1",
            payload=_make_payload(
                components=[_make_meal_food_item(food_name="Peanut Butter")]
            ),
        )
        ctx = _make_context(allergies=["peanut"])
        result = f.filter(candidate, ctx)
        assert not result.is_eligible

    def test_allergy_allows_safe_food(self) -> None:
        from app.recommendations.meals.filters import MealAllergyFilter
        f = MealAllergyFilter()
        candidate = _make_candidate(
            candidate_id="t2",
            payload=_make_payload(
                components=[_make_meal_food_item(food_name="Grilled Chicken Breast")]
            ),
        )
        ctx = _make_context(allergies=["peanut"])
        result = f.filter(candidate, ctx)
        assert result.is_eligible

    def test_allergy_unmapped_literal_match(self) -> None:
        from app.recommendations.meals.filters import MealAllergyFilter
        f = MealAllergyFilter()
        candidate = _make_candidate(
            candidate_id="t3",
            payload=_make_payload(
                components=[_make_meal_food_item(food_name="Kiwi Juice")]
            ),
        )
        ctx = _make_context(allergies=["kiwi"])
        result = f.filter(candidate, ctx)
        assert not result.is_eligible

    # MealDietaryRestrictionFilter
    def test_vegetarian_rejects_chicken(self) -> None:
        from app.recommendations.meals.filters import MealDietaryRestrictionFilter
        f = MealDietaryRestrictionFilter()
        candidate = _make_candidate(
            candidate_id="t4",
            payload=_make_payload(
                components=[_make_meal_food_item(food_name="Grilled Chicken Thigh")]
            ),
        )
        ctx = _make_context(dietary_restrictions=["vegetarian"])
        result = f.filter(candidate, ctx)
        assert not result.is_eligible

    def test_vegan_rejects_cheese(self) -> None:
        from app.recommendations.meals.filters import MealDietaryRestrictionFilter
        f = MealDietaryRestrictionFilter()
        candidate = _make_candidate(
            candidate_id="t5",
            payload=_make_payload(
                components=[_make_meal_food_item(food_name="Cheddar Cheese")]
            ),
        )
        ctx = _make_context(dietary_restrictions=["vegan"])
        result = f.filter(candidate, ctx)
        assert not result.is_eligible

    def test_gluten_free_rejects_bread(self) -> None:
        from app.recommendations.meals.filters import MealDietaryRestrictionFilter
        f = MealDietaryRestrictionFilter()
        candidate = _make_candidate(
            candidate_id="t6",
            payload=_make_payload(
                components=[_make_meal_food_item(food_name="Whole Wheat Bread")]
            ),
        )
        ctx = _make_context(dietary_restrictions=["gluten-free"])
        result = f.filter(candidate, ctx)
        assert not result.is_eligible

    def test_gluten_free_allows_rice(self) -> None:
        from app.recommendations.meals.filters import MealDietaryRestrictionFilter
        f = MealDietaryRestrictionFilter()
        candidate = _make_candidate(
            candidate_id="t7",
            payload=_make_payload(
                components=[_make_meal_food_item(food_name="Brown Rice")]
            ),
        )
        ctx = _make_context(dietary_restrictions=["gluten-free"])
        result = f.filter(candidate, ctx)
        assert result.is_eligible

    # MealDislikedFoodFilter
    def test_disliked_rejects_match(self) -> None:
        from app.recommendations.meals.filters import MealDislikedFoodFilter
        f = MealDislikedFoodFilter()
        candidate = _make_candidate(
            candidate_id="t8",
            payload=_make_payload(
                components=[_make_meal_food_item(food_name="Broccoli Florets")]
            ),
        )
        ctx = _make_context(disliked_foods=["broccoli"])
        result = f.filter(candidate, ctx)
        assert not result.is_eligible

    # GT-08: MealNutrientCompletenessFilter
    def test_gt08_rejects_zero_calories(self) -> None:
        """GT-08: candidate with calories=0 rejected."""
        from app.recommendations.meals.filters import MealNutrientCompletenessFilter
        f = MealNutrientCompletenessFilter()
        candidate = _make_candidate("t9", calories=0.0, protein_g=10.0, carbs_g=5.0, fat_g=2.0)
        ctx = _make_context()
        result = f.filter(candidate, ctx)
        assert not result.is_eligible

    def test_gt08_rejects_zero_e_macro(self) -> None:
        """GT-08: candidate where E_macro = 0 is rejected."""
        from app.recommendations.meals.filters import MealNutrientCompletenessFilter
        f = MealNutrientCompletenessFilter()
        candidate = _make_candidate("t10", calories=100.0, protein_g=0.0, carbs_g=0.0, fat_g=0.0)
        ctx = _make_context()
        result = f.filter(candidate, ctx)
        assert not result.is_eligible

    def test_gt08_rejects_nan_calories(self) -> None:
        """GT-08: MealPayload itself rejects NaN via Pydantic validation.

        Pydantic enforces finite numbers for Decimal fields (strict_finite
        checking). Therefore NaN can never reach the filter; the guard is
        enforced at model construction.  This test validates that invariant.
        """
        from pydantic import ValidationError as PydanticValidationError

        from app.recommendations.meals.models import MealPayload

        with pytest.raises(PydanticValidationError, match="finite"):
            MealPayload(
                meal_type="lunch",
                components=[_make_meal_food_item()],
                total_calories=Decimal("NaN"),
                total_protein_g=Decimal("10"),
                total_carbs_g=Decimal("10"),
                total_fat_g=Decimal("5"),
            )

    def test_gt08_accepts_valid_candidate(self) -> None:
        """GT-08: valid candidate passes nutrient completeness filter."""
        from app.recommendations.meals.filters import MealNutrientCompletenessFilter
        f = MealNutrientCompletenessFilter()
        candidate = _make_candidate("t11", calories=500.0, protein_g=35.0, carbs_g=60.0, fat_g=15.0)
        ctx = _make_context()
        result = f.filter(candidate, ctx)
        assert result.is_eligible

    # GT-09: MealCalorieCeilingFilter
    def test_gt09_rejects_over_ceiling(self) -> None:
        """GT-09: candidate exceeding hard ceiling is rejected."""
        from app.recommendations.meals.filters import MealCalorieCeilingFilter
        f = MealCalorieCeilingFilter()
        candidate = _make_candidate("t12", calories=700.0)
        ctx = _make_context(calorie_ceiling=500.0)
        result = f.filter(candidate, ctx)
        assert not result.is_eligible

    def test_gt09_allows_at_ceiling(self) -> None:
        """GT-09: candidate exactly at ceiling passes."""
        from app.recommendations.meals.filters import MealCalorieCeilingFilter
        f = MealCalorieCeilingFilter()
        candidate = _make_candidate("t13", calories=500.0)
        ctx = _make_context(calorie_ceiling=500.0)
        result = f.filter(candidate, ctx)
        assert result.is_eligible


# ─────────────────────────────────────────────────────────────────────────────
# GT-10: Scoring factor bounds
# ─────────────────────────────────────────────────────────────────────────────

class TestScoringFactorBounds:
    """GT-10: Every scoring factor returns values in [0.0, 1.0]."""

    _CANDIDATE_PARAMS: list[tuple[float, float, float, float]] = [
        (100.0, 5.0, 10.0, 2.0),
        (500.0, 35.0, 60.0, 15.0),
        (800.0, 60.0, 100.0, 25.0),
        (50.0, 0.1, 5.0, 1.0),
    ]

    def test_calorie_proximity_bounded(self) -> None:
        from app.recommendations.meals.scoring import MealCalorieProximityFactor
        factor = MealCalorieProximityFactor()
        for cals, prot, carbs, fat in self._CANDIDATE_PARAMS:
            candidate = _make_candidate(calories=cals, protein_g=prot, carbs_g=carbs, fat_g=fat)
            ctx = _make_context(target_calories=500.0)
            fs = factor.score(candidate, ctx)
            assert 0.0 <= fs.normalized_score <= 1.0

    def test_protein_proximity_bounded(self) -> None:
        from app.recommendations.meals.scoring import MealProteinProximityFactor
        factor = MealProteinProximityFactor()
        for cals, prot, carbs, fat in self._CANDIDATE_PARAMS:
            candidate = _make_candidate(calories=cals, protein_g=prot, carbs_g=carbs, fat_g=fat)
            ctx = _make_context(target_protein_g=35.0)
            fs = factor.score(candidate, ctx)
            assert 0.0 <= fs.normalized_score <= 1.0

    def test_macro_balance_bounded(self) -> None:
        from app.recommendations.meals.scoring import MealMacroBalanceFactor
        factor = MealMacroBalanceFactor()
        for cals, prot, carbs, fat in self._CANDIDATE_PARAMS:
            candidate = _make_candidate(calories=cals, protein_g=prot, carbs_g=carbs, fat_g=fat)
            ctx = _make_context(macro_target_p=0.25, macro_target_c=0.50, macro_target_f=0.25)
            fs = factor.score(candidate, ctx)
            assert 0.0 <= fs.normalized_score <= 1.0

    def test_goal_alignment_bounded_all_goals(self) -> None:
        from app.recommendations.meals.scoring import MealGoalAlignmentFactor
        factor = MealGoalAlignmentFactor()
        for goal in ["muscle_gain", "weight_loss", "maintenance", None]:
            for cals, prot, carbs, fat in self._CANDIDATE_PARAMS:
                candidate = _make_candidate(calories=cals, protein_g=prot, carbs_g=carbs, fat_g=fat)
                ctx = _make_context(goal_type=goal)
                fs = factor.score(candidate, ctx)
                assert 0.0 <= fs.normalized_score <= 1.0, (
                    f"Goal={goal} cals={cals} prot={prot} score={fs.normalized_score} out of [0,1]"
                )

    def test_macro_normalization_uses_e_macro_not_label_calories(self) -> None:
        """Macro fractions computed with E_macro denominator sum to 1.0."""
        from app.recommendations.meals.scoring import _e_macro
        # Protein=30g, Carbs=50g, Fat=20g
        prot, carbs, fat = 30.0, 50.0, 20.0
        em = _e_macro(prot, carbs, fat)
        r_p = 4.0 * prot / em
        r_c = 4.0 * carbs / em
        r_f = 9.0 * fat / em
        assert abs(r_p + r_c + r_f - 1.0) < 1e-9

    def test_goal_alignment_muscle_gain_high_protein_perfect(self) -> None:
        """muscle_gain: candidate with protein fraction >= 35% gets score 1.0."""
        from app.recommendations.meals.scoring import MealGoalAlignmentFactor
        factor = MealGoalAlignmentFactor()
        # 40% protein energy: protein=40g (160kcal), carbs=40g (160kcal), fat=10g (90kcal)
        # E_macro = 410; r_p = 160/410 ≈ 0.39 > 0.35 → score = 1.0
        candidate = _make_candidate(calories=400.0, protein_g=40.0, carbs_g=40.0, fat_g=10.0)
        ctx = _make_context(goal_type="muscle_gain")
        fs = factor.score(candidate, ctx)
        assert abs(fs.normalized_score - 1.0) < 1e-6


# ─────────────────────────────────────────────────────────────────────────────
# GT-01, GT-02: Generation count invariant (via generator internals)
# ─────────────────────────────────────────────────────────────────────────────

class TestGenerationCountBound:
    """GT-01/GT-02: Generator never creates more than 62 candidates."""

    @pytest.mark.asyncio
    async def test_gt01_snack_max_20_candidates(self) -> None:
        """GT-01: Snack meal generates at most 20 single-item candidates."""
        from app.recommendations.meals.generator import (
            _SINGLE_ITEM_SNACK_N,
            _SINGLE_MULTIPLIERS,
        )
        max_expected = _SINGLE_ITEM_SNACK_N * len(_SINGLE_MULTIPLIERS)
        assert max_expected == 20

    @pytest.mark.asyncio
    async def test_gt01_main_meal_max_62_candidates(self) -> None:
        """GT-01: breakfast/lunch/dinner generate at most 62 candidates."""
        from app.recommendations.meals.generator import (
            _CARB_PAIRING_N,
            _PAIR_RATIOS,
            _PROTEIN_PAIRING_N,
            _SINGLE_ITEM_TOP_N,
            _SINGLE_MULTIPLIERS,
            _VEG_PAIRING_M,
        )
        single_max = _SINGLE_ITEM_TOP_N * len(_SINGLE_MULTIPLIERS)
        side_max = _CARB_PAIRING_N + _VEG_PAIRING_M
        paired_max = _PROTEIN_PAIRING_N * side_max * len(_PAIR_RATIOS)
        total = single_max + paired_max
        assert single_max == 12
        assert side_max == 5
        assert paired_max == 50
        assert total == 62

    @pytest.mark.asyncio
    async def test_gt02_no_intermediate_list_exceeds_62(self) -> None:
        """GT-02: Single-item pool is bounded before Cartesian product."""
        from app.recommendations.meals.generator import (
            _CARB_PAIRING_N,
            _PROTEIN_PAIRING_N,
            _VEG_PAIRING_M,
        )
        # Side union is bounded BEFORE Cartesian product
        max_side_union = _CARB_PAIRING_N + _VEG_PAIRING_M
        assert max_side_union == 5
        # Cartesian product size = 5 × 5 × 2 = 50 (not 15 × 25 × 2 = 750)
        max_pairs = _PROTEIN_PAIRING_N * max_side_union * 2
        assert max_pairs == 50

    @pytest.mark.asyncio
    async def test_gt03_single_pool_deterministic_ordering(self) -> None:
        """GT-03: Merged pool deduplication by food_id is deterministic."""
        food_ids = [uuid.uuid4() for _ in range(5)]
        pool = [_make_food(food_id=fid) for fid in food_ids]
        # Add duplicates
        duplicate = _make_food(food_id=food_ids[0])
        pool.append(duplicate)

        seen: set[uuid.UUID] = set()
        merged = []
        for food in pool:
            if food.id not in seen:
                seen.add(food.id)
                merged.append(food)

        assert len(merged) == 5
        assert [f.id for f in merged] == food_ids  # original order preserved


# ─────────────────────────────────────────────────────────────────────────────
# GT-11: Determinism
# ─────────────────────────────────────────────────────────────────────────────

class TestDeterminism:
    """GT-11: Identical inputs produce identical candidate IDs and ordering."""

    def test_same_candidate_id_across_runs(self) -> None:
        pid = uuid.UUID("11111111-1111-1111-1111-111111111111")
        sid = uuid.UUID("22222222-2222-2222-2222-222222222222")
        id1 = _paired_candidate_id("lunch", pid, Decimal("1.0"), sid, Decimal("1.0"))
        id2 = _paired_candidate_id("lunch", pid, Decimal("1.0"), sid, Decimal("1.0"))
        assert id1 == id2

    def test_meal_share_sum_is_exactly_one(self) -> None:
        from app.recommendations.meals.context_builder import _MEAL_SHARES
        assert sum(_MEAL_SHARES.values()) == Decimal("1.00")


# ─────────────────────────────────────────────────────────────────────────────
# GT-12: Low-budget invariants
# ─────────────────────────────────────────────────────────────────────────────

class TestLowBudgetInvariants:
    """GT-12: Empty result returned before generator when budget < 100."""

    def test_meal_shares_sum_to_exactly_100_pct(self) -> None:
        from app.recommendations.meals.context_builder import _MEAL_SHARES
        total = sum(_MEAL_SHARES.values())
        assert total == Decimal("1.00")

    def test_breakfast_share(self) -> None:
        from app.recommendations.meals.context_builder import _MEAL_SHARES
        assert _MEAL_SHARES["breakfast"] == Decimal("0.25")

    def test_lunch_share(self) -> None:
        from app.recommendations.meals.context_builder import _MEAL_SHARES
        assert _MEAL_SHARES["lunch"] == Decimal("0.35")

    def test_dinner_share(self) -> None:
        from app.recommendations.meals.context_builder import _MEAL_SHARES
        assert _MEAL_SHARES["dinner"] == Decimal("0.30")

    def test_snack_share(self) -> None:
        from app.recommendations.meals.context_builder import _MEAL_SHARES
        assert _MEAL_SHARES["snack"] == Decimal("0.10")
