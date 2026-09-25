/**
 * TypeScript definitions mapped directly from backend Pydantic schemas:
 * backend/app/schemas/progress.py
 */

export interface WeightHistoryItem {
  id: string;
  date: string;
  weight_kg: number;
  notes?: string | null;
}

export interface WeightHistoryResponse {
  entries: WeightHistoryItem[];
  current_weight_kg?: number | null;
  start_weight_kg?: number | null;
  trend?: string | null;
}
