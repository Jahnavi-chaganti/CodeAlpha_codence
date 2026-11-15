import { useState } from 'react';
import type { StatusDistributionItem, TimeSeriesPoint } from '../lib/analyticsService';

interface TaskCompletionChartProps {
  series: TimeSeriesPoint[];
  statusDistribution: StatusDistributionItem[];
}

export function TaskCompletionChart({
  series,
  statusDistribution,
}: TaskCompletionChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(
    1,
    ...series.map((p) => Math.max(p.created, p.completed))
  );

  const width = 460;
  const height = 180;
  const padX = 28;
  const padY = 20;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const pointsFor = (key: 'created' | 'completed') =>
    series
      .map((pt, idx) => {
        const x = padX + (series.length <= 1 ? 0 : (idx / (series.length - 1)) * plotW);
        const y = padY + plotH - (pt[key] / maxVal) * plotH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const hoveredPoint = hoveredIdx !== null ? series[hoveredIdx] ?? null : null;

  return (
    <div className="glass-card p-5 space-y-5 relative">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-[#7A2346] dark:text-[#FFF5F6]">
            7-Day Task Velocity
          </h3>
          <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4]">
            Created vs completed tasks derived from Firestore timestamps
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-medium text-[#513443] dark:text-[#F8DDE3]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7A2346] dark:bg-[#E9A8B8]" />
            <span>Created</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C86B88]" />
            <span>Completed</span>
          </span>
        </div>
      </div>

      {hoveredPoint && (
        <div className="glass-strong rounded-[12px] px-3 py-1.5 text-[11px] font-mono inline-flex items-center gap-3 text-[#3D1023] dark:text-[#FFF5F6]">
          <span className="font-bold text-[#7A2346] dark:text-[#F1BBC8]">{hoveredPoint.date}</span>
          <span>Created: {hoveredPoint.created}</span>
          <span>Completed: {hoveredPoint.completed}</span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="7-day created versus completed task velocity chart"
        className="w-full h-44 overflow-visible"
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = padY + plotH * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-[#EAD7DE] dark:text-[#E9A8B8]/20"
                strokeDasharray="3 3"
              />
              <text
                x={padX - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[#795D6B] dark:fill-[#D9B7C4] text-[10px] font-mono"
              >
                {Math.round(maxVal * ratio)}
              </text>
            </g>
          );
        })}

        <polyline
          fill="none"
          stroke="#7A2346"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsFor('created')}
        />
        <polyline
          fill="none"
          stroke="#C86B88"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsFor('completed')}
        />

        {series.map((pt, idx) => {
          const x = padX + (series.length <= 1 ? 0 : (idx / (series.length - 1)) * plotW);
          const yCreated = padY + plotH - (pt.created / maxVal) * plotH;
          const yDone = padY + plotH - (pt.completed / maxVal) * plotH;
          return (
            <g
              key={pt.date}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <circle cx={x} cy={yCreated} r={hoveredIdx === idx ? 5 : 3.8} fill="#7A2346" stroke="#FFF5F6" strokeWidth="1.5">
                <title>{`${pt.date}: ${pt.created} created`}</title>
              </circle>
              <circle cx={x} cy={yDone} r={hoveredIdx === idx ? 5 : 3.8} fill="#C86B88" stroke="#FFF5F6" strokeWidth="1.5">
                <title>{`${pt.date}: ${pt.completed} completed`}</title>
              </circle>
              <text
                x={x}
                y={height - 2}
                textAnchor="middle"
                className="fill-[#795D6B] dark:fill-[#D9B7C4] text-[10px] font-mono"
              >
                {pt.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="pt-3 border-t border-[#EAD7DE]/70 dark:border-[#E9A8B8]/15 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statusDistribution.map((s) => (
          <div key={s.status} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#513443] dark:text-[#F8DDE3]">{s.label}</span>
              <span className="font-mono font-semibold text-[#3D1023] dark:text-[#FFF5F6] tabular-nums">
                {s.count} ({s.percentage}%)
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#FCE8EC] dark:bg-[#2A0D19] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#8F3157] to-[#C86B88]"
                style={{ width: `${s.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
