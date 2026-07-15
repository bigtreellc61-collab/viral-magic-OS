import { Badge } from '@/components/ui/badge';
import { TASK_STATUS_COLORS, getTaskStatusLabel } from '@/lib/project-constants';

export function TaskStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const colors = TASK_STATUS_COLORS[status] ?? { bg: 'bg-muted/50', text: 'text-muted-foreground', dot: 'bg-muted-foreground' };
  return (
    <Badge variant="outline" className={`gap-1.5 border-0 text-xs font-medium ${colors.bg} ${colors.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      {getTaskStatusLabel(status)}
    </Badge>
  );
}
