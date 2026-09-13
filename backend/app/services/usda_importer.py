import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.food import FoodItem, FoodItemServing


@dataclass
class USDAImportStats:
    records_read: int = 0
    records_imported: int = 0
    records_updated: int = 0
    records_skipped: int = 0
    records_failed: int = 0
    servings_imported: int = 0


class USDAImporter:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def import_from_json(
        self,
        json_data: dict[str, Any] | list[dict[str, Any]],
        dataset_version: str = "October 2024",
    ) -> USDAImportStats:
        stats = USDAImportStats()
        raw_items: list[dict[str, Any]] = []

        if isinstance(json_data, list):
            raw_items = json_data
        elif isinstance(json_data, dict):
            for key in ["FoundationFoods", "SRLegacyFoods", "SurveyFoods", "foods"]:
                if key in json_data and isinstance(json_data[key], list):
                    raw_items.extend(json_data[key])
            if not raw_items and "fdcId" in json_data:
                raw_items = [json_data]

        for raw in raw_items:
            stats.records_read += 1
            try:
                processed = self._process_raw_food(raw, dataset_version)
                if not processed:
                    stats.records_skipped += 1
                    continue

                food_dict, servings_list = processed
                fdc_id = food_dict["usda_fdc_id"]

                # Check if item already exists by unique usda_fdc_id
                stmt = (
                    select(FoodItem)
                    .where(FoodItem.usda_fdc_id == fdc_id)
                    .options(selectinload(FoodItem.servings))
                )
                res = await self.session.execute(stmt)
                existing = res.scalar_one_or_none()

                if existing:
                    # Idempotent update without touching historical FoodEntry snapshots
                    existing.name = food_dict["name"]
                    existing.category = food_dict["category"]
                    existing.calories_per_100g = food_dict["calories_per_100g"]
                    existing.protein_per_100g = food_dict["protein_per_100g"]
                    existing.carbs_per_100g = food_dict["carbs_per_100g"]
                    existing.fat_per_100g = food_dict["fat_per_100g"]
                    existing.fiber_per_100g = food_dict["fiber_per_100g"]
                    existing.sugar_per_100g = food_dict["sugar_per_100g"]
                    existing.sodium_per_100g = food_dict["sodium_per_100g"]
                    existing.usda_data_type = food_dict["usda_data_type"]
                    existing.usda_dataset_version = food_dict["usda_dataset_version"]
                    existing.usda_imported_at = food_dict["usda_imported_at"]
                    existing.is_verified = True

                    # Replace servings
                    existing.servings.clear()
                    for s in servings_list:
                        serving_obj = FoodItemServing(
                            id=uuid.uuid4(),
                            food_item_id=existing.id,
                            description=s["description"],
                            grams=s["grams"],
                            is_default=s["is_default"],
                        )
                        existing.servings.append(serving_obj)
                        stats.servings_imported += 1

                    stats.records_updated += 1
                else:
                    new_item = FoodItem(
                        id=uuid.uuid4(),
                        name=food_dict["name"],
                        category=food_dict["category"],
                        calories_per_100g=food_dict["calories_per_100g"],
                        protein_per_100g=food_dict["protein_per_100g"],
                        carbs_per_100g=food_dict["carbs_per_100g"],
                        fat_per_100g=food_dict["fat_per_100g"],
                        fiber_per_100g=food_dict["fiber_per_100g"],
                        sugar_per_100g=food_dict["sugar_per_100g"],
                        sodium_per_100g=food_dict["sodium_per_100g"],
                        source="usda",
                        usda_fdc_id=fdc_id,
                        usda_data_type=food_dict["usda_data_type"],
                        usda_dataset_version=food_dict["usda_dataset_version"],
                        usda_imported_at=food_dict["usda_imported_at"],
                        created_by_user_id=None,
                        is_verified=True,
                    )
                    for s in servings_list:
                        new_item.servings.append(
                            FoodItemServing(
                                id=uuid.uuid4(),
                                description=s["description"],
                                grams=s["grams"],
                                is_default=s["is_default"],
                            )
                        )
                        stats.servings_imported += 1

                    self.session.add(new_item)
                    stats.records_imported += 1

            except Exception:
                stats.records_failed += 1

        await self.session.commit()
        return stats

    def _process_raw_food(
        self, raw: dict[str, Any], dataset_version: str
    ) -> tuple[dict[str, Any], list[dict[str, Any]]] | None:
        fdc_id = raw.get("fdcId")
        if not fdc_id or not isinstance(fdc_id, int):
            return None

        description = raw.get("description", "").strip()
        if not description:
            return None

        data_type = raw.get("dataType", "Foundation")
        food_category_info = raw.get("foodCategory")
        category: str | None = None
        if isinstance(food_category_info, dict):
            category = food_category_info.get("description")
        elif isinstance(food_category_info, str):
            category = food_category_info

        # Extract nutrients using deterministic tiered precedence and intra-tier tie-breaking.
        # Order of objects in the raw JSON array does NOT affect the selected nutrient value.
        nutrients = raw.get("foodNutrients", [])

        two_places = Decimal("0.01")

        # Candidate tuples: (tier, -fn_id, dec_val)
        energy_candidates: list[tuple[int, int, Decimal]] = []
        protein_candidates: list[tuple[int, int, Decimal]] = []
        fat_candidates: list[tuple[int, int, Decimal]] = []
        carbs_candidates: list[tuple[int, int, Decimal]] = []
        fiber_candidates: list[tuple[int, int, Decimal]] = []
        sugar_candidates: list[tuple[int, int, Decimal]] = []
        sodium_candidates: list[tuple[int, int, Decimal]] = []

        for fn in nutrients:
            nutrient_obj = fn.get("nutrient", {})
            nutrient_num = str(nutrient_obj.get("number", "")).strip()
            nutrient_name = str(nutrient_obj.get("name", "")).lower().strip()
            unit_name = str(nutrient_obj.get("unitName", "")).lower().strip()
            amount = fn.get("amount")
            raw_id = fn.get("id")
            fn_id = raw_id if isinstance(raw_id, int) else 0

            if amount is None:
                continue

            try:
                dec_val = Decimal(str(amount))
            except Exception:
                continue

            if dec_val < 0:
                continue

            # Energy: 1008 > 208 > kcal > kJ / 4.184
            if nutrient_num == "1008":
                energy_candidates.append((1, -fn_id, dec_val))
            elif nutrient_num == "208":
                energy_candidates.append((2, -fn_id, dec_val))
            elif "energy" in nutrient_name and unit_name == "kcal":
                energy_candidates.append((3, -fn_id, dec_val))
            elif "energy" in nutrient_name and unit_name == "kj":
                converted = (dec_val / Decimal("4.184")).quantize(
                    two_places, rounding=ROUND_HALF_UP
                )
                energy_candidates.append((4, -fn_id, converted))

            # Protein: 203 > 1003 > name="protein"
            if nutrient_num == "203":
                protein_candidates.append((1, -fn_id, dec_val))
            elif nutrient_num == "1003":
                protein_candidates.append((2, -fn_id, dec_val))
            elif "protein" in nutrient_name and unit_name == "g":
                protein_candidates.append((3, -fn_id, dec_val))

            # Total Lipid / Fat: 204 > 1004 > name="total lipid" / "fat"
            if nutrient_num == "204":
                fat_candidates.append((1, -fn_id, dec_val))
            elif nutrient_num == "1004":
                fat_candidates.append((2, -fn_id, dec_val))
            elif (
                "total lipid" in nutrient_name
                or ("fat" in nutrient_name and "fatty acid" not in nutrient_name)
            ) and unit_name == "g":
                fat_candidates.append((3, -fn_id, dec_val))

            # Carbohydrate: 205 > 1005 > name="carbohydrate"
            if nutrient_num == "205":
                carbs_candidates.append((1, -fn_id, dec_val))
            elif nutrient_num == "1005":
                carbs_candidates.append((2, -fn_id, dec_val))
            elif "carbohydrate" in nutrient_name and unit_name == "g":
                carbs_candidates.append((3, -fn_id, dec_val))

            # Optional micronutrients
            # Fiber: 291 > 1079 > name="fiber"
            if nutrient_num == "291":
                fiber_candidates.append((1, -fn_id, dec_val))
            elif nutrient_num == "1079":
                fiber_candidates.append((2, -fn_id, dec_val))
            elif "fiber" in nutrient_name and unit_name == "g":
                fiber_candidates.append((3, -fn_id, dec_val))

            # Sugar: 269 > 2000 > name="sugar"
            if nutrient_num == "269":
                sugar_candidates.append((1, -fn_id, dec_val))
            elif nutrient_num == "2000":
                sugar_candidates.append((2, -fn_id, dec_val))
            elif "sugar" in nutrient_name and unit_name == "g":
                sugar_candidates.append((3, -fn_id, dec_val))

            # Sodium: 307 > 1095 > name="sodium"
            if nutrient_num == "307":
                sodium_candidates.append((1, -fn_id, dec_val))
            elif nutrient_num == "1095":
                sodium_candidates.append((2, -fn_id, dec_val))
            elif "sodium" in nutrient_name and unit_name == "mg":
                sodium_candidates.append((3, -fn_id, dec_val))

        def select_best(candidates: list[tuple[int, int, Decimal]]) -> Decimal | None:
            if not candidates:
                return None
            # Sort deterministically by (tier asc, -fn_id asc, value asc)
            candidates.sort(key=lambda c: (c[0], c[1], c[2]))
            return candidates[0][2].quantize(two_places, rounding=ROUND_HALF_UP)

        energy_kcal = select_best(energy_candidates)
        protein_g = select_best(protein_candidates)
        fat_g = select_best(fat_candidates)
        carbs_g = select_best(carbs_candidates)
        fiber_g = select_best(fiber_candidates)
        sugar_g = select_best(sugar_candidates)
        sodium_mg = select_best(sodium_candidates)

        # Mandatory macronutrient check: if missing, skip record (do not zero-fill)
        if (
            energy_kcal is None
            or protein_g is None
            or fat_g is None
            or carbs_g is None
        ):
            return None

        # Extract portions/servings
        servings: list[dict[str, Any]] = []
        raw_portions = raw.get("foodPortions", [])
        is_first = True

        for p in raw_portions:
            desc = p.get("portionDescription") or p.get("modifier") or ""
            desc = desc.strip()
            gw = p.get("gramWeight")
            if not gw:
                continue
            try:
                dec_gw = Decimal(str(gw)).quantize(two_places, rounding=ROUND_HALF_UP)
                if dec_gw <= Decimal("0.0"):
                    continue
            except Exception:
                continue

            if not desc:
                desc = f"1 serving ({dec_gw}g)"

            servings.append(
                {
                    "description": desc,
                    "grams": dec_gw,
                    "is_default": is_first,
                }
            )
            is_first = False

        if not servings:
            # Default 100g serving if no portions are specified in USDA
            servings.append(
                {
                    "description": "100g",
                    "grams": Decimal("100.00"),
                    "is_default": True,
                }
            )

        food_dict = {
            "name": description,
            "category": category,
            "calories_per_100g": energy_kcal,
            "protein_per_100g": protein_g,
            "carbs_per_100g": carbs_g,
            "fat_per_100g": fat_g,
            "fiber_per_100g": fiber_g,
            "sugar_per_100g": sugar_g,
            "sodium_per_100g": sodium_mg,
            "usda_fdc_id": fdc_id,
            "usda_data_type": data_type,
            "usda_dataset_version": dataset_version,
            "usda_imported_at": datetime.now(UTC),
        }

        return food_dict, servings
