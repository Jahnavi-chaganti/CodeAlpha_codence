import type { BurndownPoint } from '../lib/analyticsService';

interface BurndownChartProps {
  sprintName: string;
  points: BurndownPoint[];
}

export function BurndownChart({ sprintName, points }: BurndownChartProps) {
  if (points.length === 0) {
    return (
      <div className="glass-card p-5 text-xs text-[#795D6B] dark:text-[#D9B7C4] text-center">
        Add sprint dates and assign tasks to generate the burndown chart.
      </div>
    );
  }

  const maxTasks = Math.max(
    1,
    ...points.map((p) => Math.max(p.idealRemaining, p.actualRemaining))
  );

  const width = 520;
  const height = 180;
  const padX = 28;
  const padY = 18;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const polyline = (key: 'idealRemaining' | 'actualRemaining') =>
    points
      .map((pt, idx) => {
        const x = padX + (points.length <= 1 ? 0 : (idx / (points.length - 1)) * plotW);
        const y = padY + plotH - (pt[key] / maxTasks) * plotH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const step = Math.max(1, Math.floor(points.length / 6));

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-xs font-bold text-[#7A2346] dark:text-[#FFF5F6]">
          Sprint Burndown — {sprintName}
        </h4>
        <div className="flex items-center gap-3 text-[11px] font-medium text-[#513443] dark:text-[#F8DDE3]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 border-t-2 border-dashed border-[#D989A2]" />
            <span>Ideal Remaining</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 border-t-2 border-[#7A2346] dark:border-[#F1BBC8]" />
            <span>Actual Remaining</span>
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Burndown chart for ${sprintName}`}
        className="w-full h-44 overflow-visible"
      >
        {[0, 0.5, 1].map((r) => {
          const y = padY + plotH * (1 - r);
          return (
            <g key={r}>
              <line
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-[#EAD7DE] dark:text-[#E9A8B8]/20"
                strokeDasharray="2 3"
              />
              <text
                x={padX - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[#795D6B] dark:fill-[#D9B7C4] text-[10px] font-mono"
              >
                {Math.round(maxTasks * r)}
              </text>
            </g>
          );
        })}

        <polyline
          fill="none"
          stroke="#D989A2"
          strokeWidth="2"
          strokeDasharray="4 4"
          points={polyline('idealRemaining')}
        />
        <polyline
          fill="none"
          stroke="#7A2346"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyline('actualRemaining')}
        />

        {points.map((pt, idx) => {
          if (idx % step !== 0 && idx !== points.length - 1) return null;
          const x = padX + (points.length <= 1 ? 0 : (idx / (points.length - 1)) * plotW);
          return (
            <text
              key={pt.day}
              x={x}
              y={height - 2}
              textAnchor="middle"
              className="fill-[#795D6B] dark:fill-[#D9B7C4] text-[10px] font-mono"
            >
              {pt.day}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
