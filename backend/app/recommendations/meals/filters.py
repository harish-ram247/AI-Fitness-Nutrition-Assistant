"""Phase 7B – Hard Constraint Filters for meal candidates.

All five filters implement the synchronous CandidateFilter protocol from Phase 7A.
They are applied in strict order AFTER candidate generation:

  1. MealAllergyFilter          – canonical allergen groups + literal fallback
  2. MealDietaryRestrictionFilter – vegetarian / vegan / gluten-free keyword sets
  3. MealDislikedFoodFilter     – user's disliked food name list
  4. MealNutrientCompletenessFilter – positive calories, non-negative macros, E_macro > 0, finite
  5. MealCalorieCeilingFilter   – hard calorie ceiling from context metadata

A candidate that fails any filter is rejected (is_eligible=False).  Scoring
factors are only applied after all five filters pass.
"""

import math
from typing import Any

from app.recommendations.candidate import RecommendationCandidate
from app.recommendations.context import RecommendationContext
from app.recommendations.filter import FilterResult
from app.recommendations.meals.models import MealPayload

# ---------------------------------------------------------------------------
# Canonical allergen groups
# ---------------------------------------------------------------------------
# Maps a canonical allergy key to the set of normalized substrings that
# trigger rejection on the food name (case-insensitive).  USDA category
# matching is handled separately.
_ALLERGY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "peanut": ("peanut", "peanuts", "arachis"),
    "tree_nut": (
        "tree nut",
        "tree_nut",
        "almond",
        "walnut",
        "cashew",
        "pistachio",
        "pecan",
        "hazelnut",
        "macadamia",
        "brazil nut",
    ),
    "dairy": ("dairy", "milk", "cheese", "butter", "cream", "yogurt", "whey", "casein", "ghee"),
    "egg": ("egg", "eggs", "albumin", "ovalbumin", "mayonnaise"),
    "fish": ("fish", "salmon", "tuna", "cod", "halibut", "trout", "tilapia", "anchovy"),
    "shellfish": (
        "shellfish", "shrimp", "prawn", "crab", "lobster",
        "clam", "mussel", "oyster", "scallop",
    ),
    "gluten": ("gluten", "wheat", "barley", "rye", "malt", "spelt"),
    "soy": ("soy", "soya", "soybean", "tofu", "edamame", "tempeh", "miso"),
    "sesame": ("sesame", "tahini"),
}

# USDA categories that implicitly contain an allergen
_ALLERGY_CATEGORIES: dict[str, tuple[str, ...]] = {
    "fish": ("Finfish and Shellfish Products",),
    "dairy": ("Dairy and Egg Products",),
}

# ---------------------------------------------------------------------------
# Dietary exclusion sets
# ---------------------------------------------------------------------------
_VEGETARIAN_CATEGORIES: frozenset[str] = frozenset(
    {
        "Poultry Products",
        "Beef Products",
        "Pork Products",
        "Finfish and Shellfish Products",
        "Lamb, Veal, and Game Products",
        "Sausages and Luncheon Meats",
    }
)

_VEGETARIAN_KEYWORDS: tuple[str, ...] = (
    "chicken", "turkey", "duck", "goose", "beef", "steak", "veal",
    "pork", "bacon", "ham", "sausage", "pepperoni", "salami", "prosciutto",
    "lamb", "mutton", "venison", "bison", "fish", "salmon", "tuna", "cod",
    "trout", "halibut", "tilapia", "anchovy", "sardine", "shrimp", "prawn",
    "crab", "lobster", "clam", "mussel", "oyster", "scallop", "squid",
    "calamari", "octopus", "gelatin", "lard", "tallow",
)

_VEGAN_CATEGORIES: frozenset[str] = _VEGETARIAN_CATEGORIES | frozenset({"Dairy and Egg Products"})

_VEGAN_EXTRA_KEYWORDS: tuple[str, ...] = (
    "milk", "cheese", "butter", "cream", "yogurt", "whey", "casein", "ghee",
    "egg", "eggs", "albumin", "mayonnaise", "honey", "beeswax",
)

_GLUTEN_FREE_KEYWORDS: tuple[str, ...] = (
    "wheat", "barley", "rye", "malt", "spelt", "kamut", "triticale", "farro",
    "semolina", "durum", "couscous", "bread", "pasta", "noodle", "flour",
    "cracker", "cereal", "seitan",
)


def _food_name_matches_any(food_name: str, keywords: tuple[str, ...]) -> bool:
    """Case-insensitive substring match of food_name against any keyword."""
    lower = food_name.lower()
    return any(kw in lower for kw in keywords)


def _category_matches_any(category: str | None, categories: frozenset[str]) -> bool:
    if category is None:
        return False
    return category in categories


# ---------------------------------------------------------------------------
# MealAllergyFilter
# ---------------------------------------------------------------------------
class MealAllergyFilter:
    """Hard Constraint Filter: rejects candidates containing allergens.

    Uses 9 canonical groups (keyword + USDA-category matching) and falls back
    to literal case-insensitive substring matching for unmapped allergy strings.
    """

    @property
    def name(self) -> str:
        return "MealAllergyFilter"

    def filter(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FilterResult:
        if context.preferences is None:
            return FilterResult(is_eligible=True)

        allergies: list[str] = list(context.preferences.allergies)
        if not allergies:
            return FilterResult(is_eligible=True)

        payload: MealPayload = candidate.payload
        for component in payload.components:
            name_lower = component.food_name.lower()
            category = component.category

            for raw_allergy in allergies:
                cleaned = raw_allergy.lower().strip()

                # Try canonical group
                matched_canonical = False
                for group_key, keywords in _ALLERGY_KEYWORDS.items():
                    if cleaned in keywords or cleaned == group_key:
                        # Check name
                        if any(kw in name_lower for kw in keywords):
                            return FilterResult(
                                is_eligible=False,
                                reason=(
                                    f"Allergen '{raw_allergy}' detected in "
                                    f"food '{component.food_name}'."
                                ),
                            )
                        # Check category
                        if group_key in _ALLERGY_CATEGORIES:
                            cats = frozenset(_ALLERGY_CATEGORIES[group_key])
                            if _category_matches_any(category, cats):
                                return FilterResult(
                                    is_eligible=False,
                                    reason=(
                                        f"Allergen '{raw_allergy}' detected via "
                                        f"category for '{component.food_name}'."
                                    ),
                                )
                        matched_canonical = True
                        break

                if not matched_canonical:
                    # Unmapped allergy: literal substring match on food name
                    if cleaned in name_lower:
                        return FilterResult(
                            is_eligible=False,
                            reason=(
                                f"Unmapped allergen '{raw_allergy}' found "
                                f"in food name '{component.food_name}'."
                            ),
                        )

        return FilterResult(is_eligible=True)


# ---------------------------------------------------------------------------
# MealDietaryRestrictionFilter
# ---------------------------------------------------------------------------
class MealDietaryRestrictionFilter:
    """Hard Constraint Filter: rejects candidates violating dietary restrictions.

    Supported restrictions: vegetarian, vegan, gluten-free (gluten_free).
    Unknown restriction strings are ignored (not silently accepted).
    """

    @property
    def name(self) -> str:
        return "MealDietaryRestrictionFilter"

    def filter(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FilterResult:
        if context.preferences is None:
            return FilterResult(is_eligible=True)

        restrictions: list[str] = [
            r.lower().strip() for r in context.preferences.dietary_restrictions
        ]
        if not restrictions:
            return FilterResult(is_eligible=True)

        payload: MealPayload = candidate.payload
        for component in payload.components:
            category = component.category

            fname = component.food_name
            if "vegan" in restrictions:
                if _category_matches_any(category, _VEGAN_CATEGORIES):
                    return FilterResult(
                        is_eligible=False,
                        reason=f"Vegan restriction: '{fname}' category excluded.",
                    )
                vegan_kws = _VEGETARIAN_KEYWORDS + _VEGAN_EXTRA_KEYWORDS
                if _food_name_matches_any(fname, vegan_kws):
                    return FilterResult(
                        is_eligible=False,
                        reason=f"Vegan restriction: '{fname}' keyword excluded.",
                    )

            elif "vegetarian" in restrictions:
                if _category_matches_any(category, _VEGETARIAN_CATEGORIES):
                    return FilterResult(
                        is_eligible=False,
                        reason=f"Vegetarian restriction: '{fname}' category excluded.",
                    )
                if _food_name_matches_any(fname, _VEGETARIAN_KEYWORDS):
                    return FilterResult(
                        is_eligible=False,
                        reason=f"Vegetarian restriction: '{fname}' keyword excluded.",
                    )

            if "gluten-free" in restrictions or "gluten_free" in restrictions:
                if _food_name_matches_any(fname, _GLUTEN_FREE_KEYWORDS):
                    return FilterResult(
                        is_eligible=False,
                        reason=f"Gluten-free restriction: '{fname}' keyword excluded.",
                    )

        return FilterResult(is_eligible=True)


# ---------------------------------------------------------------------------
# MealDislikedFoodFilter
# ---------------------------------------------------------------------------
class MealDislikedFoodFilter:
    """Hard Constraint Filter: rejects candidates containing user's disliked foods.

    Matching is case-insensitive substring matching on food name.
    """

    @property
    def name(self) -> str:
        return "MealDislikedFoodFilter"

    def filter(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FilterResult:
        if context.preferences is None:
            return FilterResult(is_eligible=True)

        disliked: list[str] = [d.lower().strip() for d in context.preferences.disliked_foods]
        if not disliked:
            return FilterResult(is_eligible=True)

        payload: MealPayload = candidate.payload
        for component in payload.components:
            name_lower = component.food_name.lower()
            for dislike in disliked:
                if dislike and dislike in name_lower:
                    return FilterResult(
                        is_eligible=False,
                        reason=f"Food '{component.food_name}' matches disliked food '{dislike}'.",
                    )

        return FilterResult(is_eligible=True)


# ---------------------------------------------------------------------------
# MealNutrientCompletenessFilter
# ---------------------------------------------------------------------------
class MealNutrientCompletenessFilter:
    """Hard Constraint Filter: rejects candidates with invalid nutrition data.

    Explicit validation rules (ALL must hold for candidate to be accepted):
      - total_calories > 0
      - total_protein_g >= 0
      - total_carbs_g >= 0
      - total_fat_g >= 0
      - E_macro = 4*protein + 4*carbs + 9*fat > 0
      - All values must be finite (rejects NaN and ±Inf)
    """

    @property
    def name(self) -> str:
        return "MealNutrientCompletenessFilter"

    def filter(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FilterResult:
        payload: MealPayload = candidate.payload

        cals = float(payload.total_calories)
        prot = float(payload.total_protein_g)
        carbs = float(payload.total_carbs_g)
        fat = float(payload.total_fat_g)

        for val, label in [
            (cals, "total_calories"),
            (prot, "total_protein_g"),
            (carbs, "total_carbs_g"),
            (fat, "total_fat_g"),
        ]:
            if not math.isfinite(val):
                return FilterResult(
                    is_eligible=False,
                    reason=f"Nutrient completeness: '{label}' is non-finite ({val}).",
                )

        if cals <= 0.0:
            return FilterResult(
                is_eligible=False,
                reason=f"Nutrient completeness: total_calories must be > 0 (got {cals}).",
            )

        if prot < 0.0:
            return FilterResult(
                is_eligible=False,
                reason=f"Nutrient completeness: total_protein_g must be >= 0 (got {prot}).",
            )

        if carbs < 0.0:
            return FilterResult(
                is_eligible=False,
                reason=f"Nutrient completeness: total_carbs_g must be >= 0 (got {carbs}).",
            )

        if fat < 0.0:
            return FilterResult(
                is_eligible=False,
                reason=f"Nutrient completeness: total_fat_g must be >= 0 (got {fat}).",
            )

        e_macro = 4.0 * prot + 4.0 * carbs + 9.0 * fat
        if e_macro <= 0.0:
            return FilterResult(
                is_eligible=False,
                reason=f"Nutrient completeness: E_macro (4P+4C+9F) must be > 0 (got {e_macro}).",
            )

        return FilterResult(is_eligible=True)


# ---------------------------------------------------------------------------
# MealCalorieCeilingFilter
# ---------------------------------------------------------------------------
class MealCalorieCeilingFilter:
    """Hard Constraint Filter: rejects candidates exceeding the calorie ceiling.

    The hard ceiling is stored in context.metadata['calorie_ceiling']:
      - Tracked mode:   ceiling = C_remaining (remaining daily budget)
      - Untracked mode: ceiling = target_calories override

    A candidate with total_calories > ceiling is unconditionally rejected,
    regardless of the scoring target.
    """

    @property
    def name(self) -> str:
        return "MealCalorieCeilingFilter"

    def filter(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FilterResult:
        ceiling = context.metadata.get("calorie_ceiling")
        if ceiling is None:
            # No ceiling configured – pass through
            return FilterResult(is_eligible=True)

        ceiling_f = float(ceiling)
        candidate_cals = float(candidate.payload.total_calories)

        if candidate_cals > ceiling_f:
            return FilterResult(
                is_eligible=False,
                reason=(
                    f"Candidate calories ({candidate_cals:.1f} kcal) exceed hard ceiling "
                    f"({ceiling_f:.1f} kcal)."
                ),
            )

        return FilterResult(is_eligible=True)
