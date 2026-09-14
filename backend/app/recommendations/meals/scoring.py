"""Phase 7B – Deterministic Scoring Factors for meal recommendations.

All four factors implement the synchronous ScoringFactor protocol from Phase 7A.
Every formula is proved to return a score in [0.0, 1.0].

Key design decisions:
  - Both MealMacroBalanceFactor and MealGoalAlignmentFactor use E_macro as the
    denominator (not recorded_calories) to guarantee r_p + r_c + r_f = 1.0.
  - MealProteinProximityFactor returns neutral 1.0 when P_meal <= 0 (daily
    protein target already met) to prevent division by zero.
  - All factors defensively clamp to [0.0, 1.0] as a floating-point epsilon
    guard; the formulas themselves are proved bounded.
"""

import math
from typing import Any

from app.recommendations.candidate import RecommendationCandidate
from app.recommendations.context import RecommendationContext
from app.recommendations.meals.models import MealPayload
from app.recommendations.scoring import FactorScore


def _e_macro(protein_g: float, carbs_g: float, fat_g: float) -> float:
    """Atwater macro-energy denominator: 4P + 4C + 9F."""
    return 4.0 * protein_g + 4.0 * carbs_g + 9.0 * fat_g


def _clamp(value: float) -> float:
    """Defensive floating-point epsilon clamp to [0.0, 1.0]."""
    return max(0.0, min(1.0, value))


# ---------------------------------------------------------------------------
# MealCalorieProximityFactor
# ---------------------------------------------------------------------------
class MealCalorieProximityFactor:
    """Scores candidates by proximity to the meal calorie target T_meal.

    Formula:
        s = exp( -|calories - T_meal| / (0.30 * T_meal) )

    Range: (0.0, 1.0] – exponential decay from 1.0 (exact match) toward 0.0.
    T_meal is stored in context.metadata['target_calories'].
    """

    @property
    def name(self) -> str:
        return "MealCalorieProximityFactor"

    @property
    def weight(self) -> float:
        return 3.0

    def score(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FactorScore:
        t_meal = float(context.metadata.get("target_calories", 0.0))
        payload: MealPayload = candidate.payload
        cals = float(payload.total_calories)

        if t_meal <= 0.0:
            raw = 0.0
            reason = "Target calories not configured; assigning zero score."
        else:
            raw = math.exp(-abs(cals - t_meal) / (0.30 * t_meal))
            reason = f"Calorie proximity: {cals:.1f} kcal vs target {t_meal:.1f} kcal."

        normalized = _clamp(raw)
        return FactorScore(
            factor_name=self.name,
            raw_score=normalized,
            normalized_score=normalized,
            weight=self.weight,
            weighted_contribution=normalized * self.weight,
            reason=reason,
        )


# ---------------------------------------------------------------------------
# MealProteinProximityFactor
# ---------------------------------------------------------------------------
class MealProteinProximityFactor:
    """Scores candidates by proximity to the meal protein target P_meal.

    Formula (when P_meal > 0):
        s = max(0.0, 1.0 - |protein - P_meal| / P_meal)

    Special case (P_meal <= 0):
        Returns neutral score 1.0.
        Rationale: the user's daily protein requirement is already satisfied.
        Division by zero is impossible.

    P_meal is stored in context.metadata['target_protein_g'].
    """

    @property
    def name(self) -> str:
        return "MealProteinProximityFactor"

    @property
    def weight(self) -> float:
        return 2.5

    def score(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FactorScore:
        p_meal = float(context.metadata.get("target_protein_g", 0.0))
        payload: MealPayload = candidate.payload
        prot = float(payload.total_protein_g)

        if p_meal <= 0.0:
            normalized = 1.0
            reason = "Daily protein requirement already met; neutral full score assigned."
        else:
            raw = 1.0 - abs(prot - p_meal) / p_meal
            normalized = _clamp(raw)
            reason = f"Protein proximity: {prot:.1f} g vs target {p_meal:.1f} g."

        return FactorScore(
            factor_name=self.name,
            raw_score=normalized,
            normalized_score=normalized,
            weight=self.weight,
            weighted_contribution=normalized * self.weight,
            reason=reason,
        )


# ---------------------------------------------------------------------------
# MealMacroBalanceFactor
# ---------------------------------------------------------------------------
class MealMacroBalanceFactor:
    """Scores candidates by how closely their macro fractions match derived targets.

    Both actual fractions (r_p, r_c, r_f) and targets (t_p, t_c, t_f) are
    normalized by E_macro = 4P + 4C + 9F, guaranteeing r_p + r_c + r_f = 1.0.

    Formula (L1 Total Variation distance):
        s = 1.0 - (|r_p - t_p| + |r_c - t_c| + |r_f - t_f|) / 2.0

    Mathematical guarantee: s ∈ [0.0, 1.0] because the L1 distance between
    two normalized probability vectors on a 3-element support is at most 2.0.

    Targets are stored in context.metadata:
      - 'macro_target_p': t_p (float, fraction of energy from protein)
      - 'macro_target_c': t_c (float, fraction of energy from carbs)
      - 'macro_target_f': t_f (float, fraction of energy from fat)
    """

    @property
    def name(self) -> str:
        return "MealMacroBalanceFactor"

    @property
    def weight(self) -> float:
        return 1.5

    def score(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FactorScore:
        t_p = float(context.metadata.get("macro_target_p", 0.25))
        t_c = float(context.metadata.get("macro_target_c", 0.50))
        t_f = float(context.metadata.get("macro_target_f", 0.25))

        payload: MealPayload = candidate.payload
        prot = float(payload.total_protein_g)
        carbs = float(payload.total_carbs_g)
        fat = float(payload.total_fat_g)

        em = _e_macro(prot, carbs, fat)
        if em <= 0.0:
            # Rejected by MealNutrientCompletenessFilter; defensive fallback
            normalized = 0.0
            reason = "Macro balance: invalid macro energy (E_macro <= 0)."
        else:
            r_p = 4.0 * prot / em
            r_c = 4.0 * carbs / em
            r_f = 9.0 * fat / em
            l1_distance = abs(r_p - t_p) + abs(r_c - t_c) + abs(r_f - t_f)
            raw = 1.0 - l1_distance / 2.0
            normalized = _clamp(raw)
            reason = (
                f"Macro balance: actual ({r_p:.2f}P/{r_c:.2f}C/{r_f:.2f}F) "
                f"vs target ({t_p:.2f}P/{t_c:.2f}C/{t_f:.2f}F)."
            )

        return FactorScore(
            factor_name=self.name,
            raw_score=normalized,
            normalized_score=normalized,
            weight=self.weight,
            weighted_contribution=normalized * self.weight,
            reason=reason,
        )


# ---------------------------------------------------------------------------
# MealGoalAlignmentFactor
# ---------------------------------------------------------------------------
class MealGoalAlignmentFactor:
    """Scores candidates by how well protein density aligns with fitness goal.

    The protein fraction r_p uses E_macro as the denominator (same as
    MealMacroBalanceFactor), guaranteeing r_p ∈ [0.0, 1.0].

    Formulas:
        muscle_gain:
            s = min(1.0, r_p / 0.35)          → rewards ≥35 % protein energy
        weight_loss:
            s = max(0.0, 1.0 - |r_p - 0.30| / 0.30)  → ideal 30 % protein energy
        maintenance / default / None:
            s = max(0.0, 1.0 - |r_p - 0.25| / 0.25)  → ideal 25 % protein energy

    All formulas are proved to return values in [0.0, 1.0].
    E_macro <= 0 is handled defensively (score = 0.0).
    Goal type is stored in context.metadata['goal_type'] (str | None).
    """

    @property
    def name(self) -> str:
        return "MealGoalAlignmentFactor"

    @property
    def weight(self) -> float:
        return 1.0

    def score(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FactorScore:
        goal_type: str | None = context.metadata.get("goal_type")
        payload: MealPayload = candidate.payload

        prot = float(payload.total_protein_g)
        carbs = float(payload.total_carbs_g)
        fat = float(payload.total_fat_g)

        em = _e_macro(prot, carbs, fat)
        if em <= 0.0:
            normalized = 0.0
            reason = "Goal alignment: invalid macro energy (E_macro <= 0)."
        else:
            r_p = 4.0 * prot / em  # protein fraction of macro energy, ∈ [0, 1]

            if goal_type == "muscle_gain":
                raw = min(1.0, r_p / 0.35)
                reason = f"Goal alignment (muscle_gain): protein fraction {r_p:.3f}, ideal ≥0.35."
            elif goal_type == "weight_loss":
                raw = max(0.0, 1.0 - abs(r_p - 0.30) / 0.30)
                reason = f"Goal alignment (weight_loss): protein fraction {r_p:.3f}, ideal 0.30."
            else:
                # maintenance, None, or any other value
                raw = max(0.0, 1.0 - abs(r_p - 0.25) / 0.25)
                goal_label = goal_type if goal_type else "default"
                reason = f"Goal alignment ({goal_label}): protein fraction {r_p:.3f}, ideal 0.25."

            normalized = _clamp(raw)

        return FactorScore(
            factor_name=self.name,
            raw_score=normalized,
            normalized_score=normalized,
            weight=self.weight,
            weighted_contribution=normalized * self.weight,
            reason=reason,
        )
