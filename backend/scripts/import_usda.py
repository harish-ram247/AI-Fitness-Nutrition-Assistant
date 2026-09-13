import argparse
import asyncio
import json
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.session import AsyncSessionFactory, dispose_engine  # noqa: E402
from app.services.usda_importer import USDAImporter  # noqa: E402


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bulk import USDA FoodData Central JSON export into local PostgreSQL"
    )
    parser.add_argument(
        "--file",
        required=True,
        type=str,
        help="Path to USDA FoodData Central JSON file",
    )
    parser.add_argument(
        "--version",
        default="October 2024",
        type=str,
        help="USDA dataset version label (default: 'October 2024')",
    )

    args = parser.parse_args()
    file_path = Path(args.file)

    if not file_path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading USDA dataset from: {file_path}")
    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)

    async with AsyncSessionFactory() as session:
        importer = USDAImporter(session)
        print("Importing foods into PostgreSQL...")
        stats = await importer.import_from_json(data, dataset_version=args.version)

    await dispose_engine()

    print("\n--- USDA Import Statistics ---")
    print(f"Records Read:     {stats.records_read}")
    print(f"Records Imported: {stats.records_imported}")
    print(f"Records Updated:  {stats.records_updated}")
    print(f"Records Skipped:  {stats.records_skipped}")
    print(f"Records Failed:   {stats.records_failed}")
    print(f"Servings Stored:  {stats.servings_imported}")
    print("------------------------------")


if __name__ == "__main__":
    asyncio.run(main())
