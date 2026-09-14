"""Phase 7B – Bounded Meal Candidate Generator.

Generation pipeline (strict order):
  ① SQL queries – visibility, soft-delete, hard nutritional constraints
  ② Python Hard Constraint Filters (defense-in-depth) applied to each pool
  ③ Pool selection: bounded, deterministic
  ④ Candidate generation – single-item and paired (NO over-generation)
  ⑤ Returns at most 62 RecommendationCandidate[MealPayload] objects

≤62 Invariant by construction:
  - Single-item: top-6 × 2 multipliers = ≤12  (snack: top-10 × 2 = ≤20)
  - Paired:      5 protein × 5 side × 2 ratios = ≤50
  - Total:       ≤62  (snack: ≤20, no pairing)

No intermediate list ever exceeds 62 items.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.models.food import FoodItem, FoodItemServing
from app.recommendations.candidate import RecommendationCandidate
from app.recommendations.context import RecommendationContext
from app.recommendations.meals.models import MealFoodItem, MealPayload
from app.recommendations.types import RecommendationType
from app.services.nutrition_calculator import (
    CalculatedNutrients,
    calculate_food_nutrients,
    calculate_serving_quantity,
)

# ── constants ──────────────────────────────────────────────────────────────
_VALID_MEAL_TYPES: frozenset[str] = frozenset({"breakfast", "lunch", "dinner", "snack"})

# Pool limits (SQL-level caps)
_PROTEIN_POOL_SQL_LIMIT = 15
_CARB_POOL_SQL_LIMIT = 15
_VEG_POOL_SQL_LIMIT = 10

# Post-filter selection counts
_SINGLE_ITEM_TOP_N = 6   # breakfast / lunch / dinner
_SINGLE_ITEM_SNACK_N = 10
_PROTEIN_PAIRING_N = 5
_CARB_PAIRING_N = 3     # N in (N carb/base + M veg = 5 side)
_VEG_PAIRING_M = 2      # M in (N carb/base + M veg = 5 side)

# Portion multipliers
_SINGLE_MULTIPLIERS: tuple[Decimal, Decimal] = (Decimal("1.0"), Decimal("1.5"))
_PAIR_RATIOS: tuple[tuple[Decimal, Decimal], ...] = (
    (Decimal("1.0"), Decimal("1.0")),
    (Decimal("1.5"), Decimal("0.5")),
)

# Protein threshold for protein pool
_MIN_PROTEIN_PER_100G = Decimal("8.0")
_MIN_CARB_PER_100G = Decimal("12.0")
_MIN_CAL_FOR_CARB_PER_100G = Decimal("70.0")


# ── helpers ────────────────────────────────────────────────────────────────

def _resolve_serving(food: FoodItem) -> FoodItemServing | None:
    """Return the default serving, the first serving, or None if no servings exist."""
    if not food.servings:
        return None
    for s in food.servings:
        if s.is_default:
            return s
    return food.servings[0]


def _standard_serving_grams(food: FoodItem) -> Decimal:
    """Return serving grams, falling back to 100 g if no serving is found."""
    serving = _resolve_serving(food)
    return serving.grams if serving is not None else Decimal("100.0")


def _build_meal_food_item(
    food: FoodItem,
    multiplier: Decimal,
    nutrients: CalculatedNutrients,
    quantity_g: Decimal,
) -> MealFoodItem:
    serving = _resolve_serving(food)
    base_grams = serving.grams if serving is not None else Decimal("100.0")
    serving_count = (quantity_g / base_grams).quantize(Decimal("0.01"))
    return MealFoodItem(
        food_id=food.id,
        food_name=food.name,
        category=food.category,
        quantity_g=quantity_g,
        serving_id=serving.id if serving is not None else None,
        serving_description=serving.description if serving is not None else "100 g",
        serving_count=serving_count,
        calories=nutrients.calories,
        protein_g=nutrients.protein_g,
        carbs_g=nutrients.carbs_g,
        fat_g=nutrients.fat_g,
    )


def _compute_nutrients(food: FoodItem, quantity_g: Decimal) -> CalculatedNutrients | None:
    """Safely compute nutrients; returns None if quantity is invalid."""
    if quantity_g <= Decimal("0"):
        return None
    try:
        return calculate_food_nutrients(
            calories_per_100g=food.calories_per_100g,
            protein_per_100g=food.protein_per_100g,
            carbs_per_100g=food.carbs_per_100g,
            fat_per_100g=food.fat_per_100g,
            quantity_g=quantity_g,
        )
    except (ValueError, Exception):
        return None


def _single_candidate_id(meal_type: str, food_id: uuid.UUID, multiplier: Decimal) -> str:
    return f"meal:{meal_type}:single:{food_id}_{multiplier:.2f}"


def _paired_candidate_id(
    meal_type: str,
    protein_id: uuid.UUID,
    protein_mult: Decimal,
    side_id: uuid.UUID,
    side_mult: Decimal,
) -> str:
    """Role-labelled, non-sorted paired candidate ID.

    The protein component always comes first, the side component second.
    This preserves semantic roles and prevents collisions when the same
    food ID appears in both protein and side pools.
    """
    return (
        f"meal:{meal_type}:"
        f"protein:{protein_id}_{protein_mult:.2f}+"
        f"side:{side_id}_{side_mult:.2f}"
    )


def _sum_nutrients(items: list[MealFoodItem]) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    """Sum (calories, protein_g, carbs_g, fat_g) across all components."""
    cals = sum((i.calories for i in items), Decimal("0.00"))
    prot = sum((i.protein_g for i in items), Decimal("0.00"))
    carbs = sum((i.carbs_g for i in items), Decimal("0.00"))
    fat = sum((i.fat_g for i in items), Decimal("0.00"))
    return cals, prot, carbs, fat


def _apply_pool_filters(
    foods: list[FoodItem],
    dietary_restrictions: list[str],
    allergies: list[str],
    disliked_foods: list[str],
) -> list[FoodItem]:
    """Apply hard constraint filters at the pool level (food-item level).

    This is the defense-in-depth filtering step applied BEFORE candidate
    generation.  Only foods that pass all constraints enter the generation
    pools.

    The full per-candidate filters (MealAllergyFilter, MealDietaryRestriction,
    MealDislikedFood) are still applied on generated candidates; this
    pre-generation pool filtering ensures invalid foods do not consume the
    generation budget.
    """
    from app.recommendations.meals.filters import (
        _ALLERGY_CATEGORIES,
        _ALLERGY_KEYWORDS,
        _GLUTEN_FREE_KEYWORDS,
        _VEGAN_CATEGORIES,
        _VEGAN_EXTRA_KEYWORDS,
        _VEGETARIAN_CATEGORIES,
        _VEGETARIAN_KEYWORDS,
    )

    restrictions = [r.lower().strip() for r in dietary_restrictions]
    allergy_strings = [a.lower().strip() for a in allergies]
    disliked = [d.lower().strip() for d in disliked_foods if d.strip()]

    result: list[FoodItem] = []
    for food in foods:
        name_lower = food.name.lower()
        category = food.category
        rejected = False

        # Dietary restrictions
        if "vegan" in restrictions:
            if category and category in _VEGAN_CATEGORIES:
                rejected = True
            elif any(kw in name_lower for kw in _VEGETARIAN_KEYWORDS + _VEGAN_EXTRA_KEYWORDS):
                rejected = True

        elif "vegetarian" in restrictions:
            if category and category in _VEGETARIAN_CATEGORIES:
                rejected = True
            elif any(kw in name_lower for kw in _VEGETARIAN_KEYWORDS):
                rejected = True

        if not rejected and ("gluten-free" in restrictions or "gluten_free" in restrictions):
            if any(kw in name_lower for kw in _GLUTEN_FREE_KEYWORDS):
                rejected = True

        # Allergy filters
        if not rejected:
            for raw_allergy in allergy_strings:
                cleaned = raw_allergy
                matched = False
                for group_key, keywords in _ALLERGY_KEYWORDS.items():
                    if cleaned in keywords or cleaned == group_key:
                        if any(kw in name_lower for kw in keywords):
                            rejected = True
                            break
                        if group_key in _ALLERGY_CATEGORIES:
                            if category and category in _ALLERGY_CATEGORIES[group_key]:
                                rejected = True
                                break
                        matched = True
                        break
                if not matched and cleaned and cleaned in name_lower:
                    rejected = True
                if rejected:
                    break

        # Disliked foods
        if not rejected:
            if any(d and d in name_lower for d in disliked):
                rejected = True

        if not rejected:
            result.append(food)

    return result


class MealCandidateGenerator:
    """Generates ≤62 meal candidates deterministically, with bounded pool construction.

    The generator is async (implements CandidateGenerator protocol) because it
    performs SQL queries via the SQLAlchemy AsyncSession embedded in context.
    The session is expected as context.metadata['db_session'].
    """

    async def generate_candidates(
        self, context: RecommendationContext
    ) -> Sequence[RecommendationCandidate[MealPayload]]:
        user_id: uuid.UUID = context.user_id
        meal_type: str = context.metadata.get("meal_type", "lunch")
        db_session = context.metadata.get("db_session")

        if db_session is None:
            return []

        # Preferences for pool filtering
        dietary_restrictions: list[str] = list(
            context.preferences.dietary_restrictions if context.preferences else []
        )
        allergies: list[str] = list(
            context.preferences.allergies if context.preferences else []
        )
        disliked_foods: list[str] = list(
            context.preferences.disliked_foods if context.preferences else []
        )

        # ── ① SQL queries: visibility + soft-delete + hard nutritional constraints ──
        from sqlalchemy.sql import Select

        def visibility_filter(stmt: Select) -> Select:  # type: ignore[type-arg]
            return stmt.where(
                FoodItem.deleted_at.is_(None),
                or_(
                    FoodItem.created_by_user_id.is_(None),
                    FoodItem.created_by_user_id == user_id,
                ),
            )

        # Protein pool
        protein_stmt = (
            visibility_filter(select(FoodItem))
            .where(FoodItem.protein_per_100g >= _MIN_PROTEIN_PER_100G)
            .order_by(FoodItem.protein_per_100g.desc(), FoodItem.id.asc())
            .limit(_PROTEIN_POOL_SQL_LIMIT)
            .options(selectinload(FoodItem.servings))
        )

        # Carb/Base pool
        carb_stmt = (
            visibility_filter(select(FoodItem))
            .where(
                FoodItem.carbs_per_100g >= _MIN_CARB_PER_100G,
                FoodItem.calories_per_100g >= _MIN_CAL_FOR_CARB_PER_100G,
            )
            .order_by(FoodItem.carbs_per_100g.desc(), FoodItem.id.asc())
            .limit(_CARB_POOL_SQL_LIMIT)
            .options(selectinload(FoodItem.servings))
        )

        # Vegetable/Side pool
        veg_stmt = (
            visibility_filter(select(FoodItem))
            .where(
                or_(
                    FoodItem.category.ilike("%Vegetable%"),
                    FoodItem.calories_per_100g <= Decimal("70.0"),
                )
            )
            .order_by(FoodItem.calories_per_100g.asc(), FoodItem.id.asc())
            .limit(_VEG_POOL_SQL_LIMIT)
            .options(selectinload(FoodItem.servings))
        )

        protein_res = await db_session.execute(protein_stmt)
        carb_res = await db_session.execute(carb_stmt)
        veg_res = await db_session.execute(veg_stmt)

        raw_protein_pool: list[FoodItem] = list(protein_res.scalars().all())
        raw_carb_pool: list[FoodItem] = list(carb_res.scalars().all())
        raw_veg_pool: list[FoodItem] = list(veg_res.scalars().all())

        # ── ② Python Hard Constraint Filters applied to each pool individually ──
        protein_pool = _apply_pool_filters(
            raw_protein_pool, dietary_restrictions, allergies, disliked_foods
        )
        carb_pool = _apply_pool_filters(
            raw_carb_pool, dietary_restrictions, allergies, disliked_foods
        )
        veg_pool = _apply_pool_filters(
            raw_veg_pool, dietary_restrictions, allergies, disliked_foods
        )

        # ── ③ Pool selection: bounded, deterministic ──
        # Build merged single-item pool: P then C then V, deduplicated by food_id
        seen_ids: set[uuid.UUID] = set()
        merged: list[FoodItem] = []
        for food in protein_pool + carb_pool + veg_pool:
            if food.id not in seen_ids:
                seen_ids.add(food.id)
                merged.append(food)

        # Determine how many single items to use
        if meal_type == "snack":
            single_pool = merged[:_SINGLE_ITEM_SNACK_N]  # top 10
        else:
            single_pool = merged[:_SINGLE_ITEM_TOP_N]   # top 6

        # Pairing pools (only for non-snack)
        pairing_protein = protein_pool[:_PROTEIN_PAIRING_N]  # top 5 protein
        pairing_carb_n = carb_pool[:_CARB_PAIRING_N]         # top 3 carb/base
        pairing_veg_m = veg_pool[:_VEG_PAIRING_M]            # top 2 veg

        # Side-union: C[:3] then V[:2], deduplicated by food_id
        side_seen: set[uuid.UUID] = set()
        side_pool: list[FoodItem] = []
        for food in pairing_carb_n + pairing_veg_m:
            if food.id not in side_seen:
                side_seen.add(food.id)
                side_pool.append(food)
        # |side_pool| ≤ 5

        # ── ④ Candidate generation (NO over-generation) ──
        candidates: list[RecommendationCandidate[MealPayload]] = []

        # Single-item candidates
        for food in single_pool:
            base_grams = _standard_serving_grams(food)
            for mult in _SINGLE_MULTIPLIERS:
                quantity_g = calculate_serving_quantity(base_grams, mult)
                nutrients = _compute_nutrients(food, quantity_g)
                if nutrients is None:
                    continue

                component = _build_meal_food_item(food, mult, nutrients, quantity_g)
                total_cals, total_prot, total_carbs, total_fat = _sum_nutrients([component])

                payload = MealPayload(
                    meal_type=meal_type,
                    components=[component],
                    total_calories=total_cals,
                    total_protein_g=total_prot,
                    total_carbs_g=total_carbs,
                    total_fat_g=total_fat,
                )
                cand_id = _single_candidate_id(meal_type, food.id, mult)
                candidates.append(
                    RecommendationCandidate(
                        id=cand_id,
                        recommendation_type=RecommendationType.MEAL,
                        payload=payload,
                    )
                )
        # At this point: len(candidates) ≤ 12 (or ≤ 20 for snack)

        # Paired candidates (only for breakfast / lunch / dinner)
        if meal_type != "snack":
            for p_food in pairing_protein:
                p_base_grams = _standard_serving_grams(p_food)
                for s_food in side_pool:
                    s_base_grams = _standard_serving_grams(s_food)
                    for p_mult, s_mult in _PAIR_RATIOS:
                        p_qty = calculate_serving_quantity(p_base_grams, p_mult)
                        s_qty = calculate_serving_quantity(s_base_grams, s_mult)

                        p_nutrients = _compute_nutrients(p_food, p_qty)
                        s_nutrients = _compute_nutrients(s_food, s_qty)
                        if p_nutrients is None or s_nutrients is None:
                            continue

                        p_component = _build_meal_food_item(p_food, p_mult, p_nutrients, p_qty)
                        s_component = _build_meal_food_item(s_food, s_mult, s_nutrients, s_qty)
                        components = [p_component, s_component]
                        total_cals, total_prot, total_carbs, total_fat = _sum_nutrients(components)

                        payload = MealPayload(
                            meal_type=meal_type,
                            components=components,
                            total_calories=total_cals,
                            total_protein_g=total_prot,
                            total_carbs_g=total_carbs,
                            total_fat_g=total_fat,
                        )
                        cand_id = _paired_candidate_id(
                            meal_type, p_food.id, p_mult, s_food.id, s_mult
                        )
                        candidates.append(
                            RecommendationCandidate(
                                id=cand_id,
                                recommendation_type=RecommendationType.MEAL,
                                payload=payload,
                            )
                        )
            # Paired ≤ 5 × 5 × 2 = 50 → total ≤ 62

        # Invariant assertion (never should trigger – design guarantee)
        assert len(candidates) <= 62, (  # noqa: S101
            f"Generator invariant violated: {len(candidates)} candidates (max 62)"
        )
        return candidates
