import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: 'default' | 'primary' | 'success' | 'danger' | 'warning';
  icon?: ReactNode;
}

const TONE_VALUE_CLASS: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-[#3D1023] dark:text-[#FFF5F6]',
  primary: 'text-[#7A2346] dark:text-[#F1BBC8]',
  success: 'text-[#21865B] dark:text-[#5AD29D]',
  danger: 'text-[#D94C65] dark:text-[#F68398]',
  warning: 'text-[#D99A35] dark:text-[#F0BF67]',
};

export function StatCard({
  label,
  value,
  sublabel,
  tone = 'default',
  icon,
}: StatCardProps) {
  return (
    <div className="glass-card glass-card-interactive p-5 space-y-2 hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#7A2346] dark:text-[#F1BBC8] tracking-wide">
          {label}
        </p>
        {icon && (
          <div className="w-8 h-8 rounded-[12px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 text-[#7A2346] dark:text-[#F1BBC8] flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>
      <p className={`font-display text-2xl sm:text-[1.7rem] font-bold tabular-nums leading-tight ${TONE_VALUE_CLASS[tone]}`}>
        {value}
      </p>
      {sublabel && (
        <p className="text-[11px] text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
          {sublabel}
        </p>
      )}
    </div>
  );
}
