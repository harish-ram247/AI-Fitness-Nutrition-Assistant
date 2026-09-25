import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { DailyTotals } from '../../../types/nutrition';

export interface MacroSummaryProps {
  totals: DailyTotals;
}

const MACRO_COLORS = {
  Protein: '#10b981', // Emerald
  Carbs: '#3b82f6',   // Blue
  Fat: '#f59e0b',     // Amber
};

export const MacroSummary: React.FC<MacroSummaryProps> = ({ totals }) => {
  const safeTotals = totals || ({} as Partial<DailyTotals>);
  const protein = Number(safeTotals.protein_g) || 0;
  const carbs = Number(safeTotals.carbs_g) || 0;
  const fat = Number(safeTotals.fat_g) || 0;
  const hasMacroData = protein > 0 || carbs > 0 || fat > 0;

  const chartData = [
    { name: 'Protein', value: Number(protein.toFixed(1)), fill: MACRO_COLORS.Protein },
    { name: 'Carbs', value: Number(carbs.toFixed(1)), fill: MACRO_COLORS.Carbs },
    { name: 'Fat', value: Number(fat.toFixed(1)), fill: MACRO_COLORS.Fat },
  ].filter((item) => item.value > 0);

  return (
    <div>
      {/* Primary Calorie & Macro Numeric Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 'var(--spacing-3)',
          marginBottom: 'var(--spacing-4)',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-3)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block' }}>
            Calories
          </span>
          <span
            data-testid="nutrition-calories"
            style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)' }}
          >
            {Math.round(Number(safeTotals.calories) || 0)}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}> kcal</span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-3)',
            textAlign: 'center',
            borderBottom: `2px solid ${MACRO_COLORS.Protein}`,
          }}
        >
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block' }}>
            Protein
          </span>
          <span
            data-testid="nutrition-protein"
            style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: MACRO_COLORS.Protein }}
          >
            {protein.toFixed(1)}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}> g</span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-3)',
            textAlign: 'center',
            borderBottom: `2px solid ${MACRO_COLORS.Carbs}`,
          }}
        >
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block' }}>
            Carbs
          </span>
          <span
            data-testid="nutrition-carbs"
            style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: MACRO_COLORS.Carbs }}
          >
            {carbs.toFixed(1)}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}> g</span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-3)',
            textAlign: 'center',
            borderBottom: `2px solid ${MACRO_COLORS.Fat}`,
          }}
        >
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block' }}>
            Fat
          </span>
          <span
            data-testid="nutrition-fat"
            style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: MACRO_COLORS.Fat }}
          >
            {fat.toFixed(1)}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}> g</span>
        </div>
      </div>

      {/* Chart or Empty Indicator */}
      {hasMacroData ? (
        <div style={{ width: '100%', height: 180 }} aria-label="Macronutrient distribution chart">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={4}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-sm)',
                }}
                formatter={(value: unknown) => [`${typeof value === 'number' || typeof value === 'string' ? value : 0} g`, '']}
              />
              <Legend
                verticalAlign="bottom"
                height={28}
                formatter={(val) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{val}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          style={{
            padding: 'var(--spacing-4)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 'var(--font-size-sm)',
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          No macronutrient data logged for today yet.
        </div>
      )}
    </div>
  );
};
