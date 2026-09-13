from pydantic import BaseModel, ConfigDict, Field


class NutritionSummaryLLMOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(
        ...,
        description="A 2-4 sentence narrative explaining daily nutrition progress against targets.",
    )
    highlights: list[str] = Field(
        ..., description="Key bullet-point highlights (e.g. protein target met, caloric deficit)."
    )


NUTRITION_SUMMARY_SYSTEM_PROMPT = """You are a supportive, insightful nutrition coach.
You will be provided with a user's pre-calculated daily nutrition statistics
(consumed calories, targets, macronutrient breakdown).
Your job is to generate an encouraging, informative narrative summary and a list of key highlights.

RULES:
1. NEVER recalculate or alter the numbers provided. Use the exact pre-calculated values.
2. Highlight positive consistency, suggest areas of focus if targets were missed,
   and maintain a constructive tone.
3. Keep the summary under 150 words.
"""
