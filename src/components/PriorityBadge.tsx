import { AlertCircle, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { TaskPriority } from '../types/pm';

interface PriorityBadgeProps {
  priority: TaskPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  if (priority === 'urgent') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D94C65] dark:text-[#F18B9E] whitespace-nowrap">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Urgent</span>
      </span>
    );
  }
  if (priority === 'high') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C17A43] dark:text-[#E8B168] whitespace-nowrap">
        <ArrowUp className="w-3.5 h-3.5 shrink-0" />
        <span>High</span>
      </span>
    );
  }
  if (priority === 'medium') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7A2346] dark:text-[#E9A8B8] whitespace-nowrap">
        <Minus className="w-3.5 h-3.5 shrink-0" />
        <span>Medium</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#795D6B] dark:text-[#D9B7C4] whitespace-nowrap">
      <ArrowDown className="w-3.5 h-3.5 shrink-0" />
      <span>Low</span>
    </span>
  );
}
