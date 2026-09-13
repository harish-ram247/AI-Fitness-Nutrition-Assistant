from pydantic import BaseModel, ConfigDict, Field


class ExtractedFoodItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    extracted_text: str = Field(
        ..., description="The raw phrase in the user input describing this food."
    )
    food_name: str = Field(
        ..., description="A clean, standardized food name suitable for database search."
    )
    quantity: float = Field(..., gt=0, description="Numerical quantity or amount.")
    unit: str = Field(
        ..., description="Unit of measurement, e.g. 'g', 'ml', 'slice', 'cup', 'large', 'serving'."
    )


class ExtractedFoodList(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ExtractedFoodItem] = Field(
        ..., description="List of recognized food items from the input."
    )


FOOD_EXTRACTION_SYSTEM_PROMPT = """You are a precise nutritional entity extraction model.
Your task is to parse unstructured natural language descriptions of meals and extract every
discrete food item into a structured list.

RULES:
1. Extract the exact food name without adjectives that don't specify the food type
   (e.g., 'delicious warm scrambled eggs' -> 'Egg, scrambled').
2. Identify the numerical quantity and the measurement unit.
3. If no unit is specified (e.g. '2 apples'), set unit to 'whole' or 'piece'.
4. If no quantity is specified (e.g. 'a bowl of oatmeal'), estimate a standard serving quantity
   (e.g. quantity=1, unit='bowl').
5. Do NOT calculate calories, protein, carbs, or fat. Only extract name, quantity, and unit.
"""
