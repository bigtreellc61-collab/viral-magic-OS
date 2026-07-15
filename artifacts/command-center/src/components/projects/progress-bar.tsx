import { getProgressColor } from '@/lib/project-constants';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ProgressBarProps {
  percentage: number;
  completed: number;
  open: number;
  blocked: number;
  total: number;
  overdue: number;
  compact?: boolean;
}

export function ProjectProgressBar({ percentage, completed, open, blocked, total, overdue, compact = false }: ProgressBarProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden min-w-[40px]">
          <div
            className={`h-full rounded-full transition-all ${getProgressColor(percentage)}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{percentage}%</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Project Progress</span>
        <span className="text-muted-foreground tabular-nums">{percentage}%</span>
      </div>
      <div className="bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getProgressColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          {completed} completed
        </span>
        <span>{open} open</span>
        {blocked > 0 && (
          <span className="text-red-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {blocked} blocked
          </span>
        )}
        {overdue > 0 && (
          <span className="text-orange-400">{overdue} overdue</span>
        )}
        {total === 0 && (
          <span className="text-muted-foreground/60 italic">No tasks created</span>
        )}
      </div>
    </div>
  );
}
