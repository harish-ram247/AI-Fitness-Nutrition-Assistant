import re
from typing import Literal

QueryIntent = Literal["nutrition", "workout", "progress", "general"]


def classify_intent(query: str) -> QueryIntent:
    """Classify user query intent to guide selective SQL data retrieval and RAG filtering."""
    q = query.lower()

    # Nutrition / Diet intent
    nutrition_keywords = [
        "calorie",
        "macro",
        "protein",
        "carb",
        "fat",
        "eat",
        "food",
        "meal",
        "breakfast",
        "lunch",
        "dinner",
        "snack",
        "diet",
        "nutrition",
        "sugar",
        "fiber",
        "micronutrient",
        "supplement",
        "deficit",
        "surplus",
    ]
    # Workout / Exercise intent
    workout_keywords = [
        "workout",
        "exercise",
        "training",
        "lift",
        "gym",
        "squat",
        "bench",
        "deadlift",
        "reps",
        "sets",
        "hypertrophy",
        "strength",
        "cardio",
        "run",
        "running",
        "hiit",
        "volume",
        "1rm",
        "rest day",
        "sore",
        "recovery",
    ]
    # Progress / Weight intent
    progress_keywords = [
        "weight",
        "weigh-in",
        "trend",
        "progress",
        "plateau",
        "scale",
        "body fat",
        "loss",
        "gain",
        "recomposition",
        "goal",
    ]

    # Score matches
    n_score = sum(1 for kw in nutrition_keywords if re.search(rf"\b{kw}\b", q))
    w_score = sum(1 for kw in workout_keywords if re.search(rf"\b{kw}\b", q))
    p_score = sum(1 for kw in progress_keywords if re.search(rf"\b{kw}\b", q))

    max_score = max(n_score, w_score, p_score)
    if max_score == 0:
        return "general"

    if n_score == max_score:
        return "nutrition"
    if w_score == max_score:
        return "workout"
    return "progress"
