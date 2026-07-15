import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { isOverdue } from '@/lib/project-constants';

interface DueDateBadgeProps {
  dueDate: string | null | undefined;
  status: string;
}

export function DueDateBadge({ dueDate, status }: DueDateBadgeProps) {
  if (!dueDate) return <span className="text-xs text-muted-foreground">—</span>;
  const overdue = isOverdue(dueDate, status);
  const today = new Date().toISOString().slice(0, 10);
  const isDueToday = dueDate === today;

  if (overdue) {
    return (
      <Badge variant="outline" className="gap-1.5 border-0 text-xs bg-red-500/15 text-red-400 font-medium">
        <AlertTriangle className="h-3 w-3" />
        Overdue · {format(new Date(dueDate + 'T00:00:00'), 'MMM d')}
      </Badge>
    );
  }
  if (isDueToday) {
    return (
      <Badge variant="outline" className="gap-1.5 border-0 text-xs bg-amber-500/15 text-amber-400 font-medium">
        <Clock className="h-3 w-3" />
        Due Today
      </Badge>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      {format(new Date(dueDate + 'T00:00:00'), 'MMM d, yyyy')}
    </span>
  );
}
