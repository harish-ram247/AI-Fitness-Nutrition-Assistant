def format_rag_context(chunks: list[dict[str, str | float | None]]) -> str:
    if not chunks:
        return "No specific reference documents found matching this query."

    parts: list[str] = []
    for i, c in enumerate(chunks, start=1):
        doc_title = c.get("document_title") or "General Knowledge"
        sec_title = c.get("section_title") or "Overview"
        content = c.get("content") or ""
        parts.append(f"--- Reference Source [{i}]: {doc_title} > {sec_title} ---\n{content}\n")

    return "\n".join(parts)


def format_user_context(user_data: dict[str, str | int | float | None]) -> str:
    if not user_data:
        return "User profile context not available."

    lines: list[str] = []
    if "age" in user_data:
        lines.append(f"- Age: {user_data['age']}")
    if "gender" in user_data:
        lines.append(f"- Sex: {user_data['gender']}")
    if "height_cm" in user_data:
        lines.append(f"- Height: {user_data['height_cm']} cm")
    if "weight_kg" in user_data:
        lines.append(f"- Current Weight: {user_data['weight_kg']} kg")
    if "goal_type" in user_data:
        lines.append(f"- Active Goal: {user_data['goal_type']}")
    if "target_calories" in user_data:
        lines.append(f"- Target Calories: {user_data['target_calories']} kcal")
    if "activity_level" in user_data:
        lines.append(f"- Activity Level: {user_data['activity_level']}")
    if "extra_context" in user_data and user_data["extra_context"]:
        lines.append(f"- Additional Context: {user_data['extra_context']}")

    return "\n".join(lines)
