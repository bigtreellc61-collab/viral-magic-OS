import { Badge } from '@/components/ui/badge';
import { PRIORITY_COLORS, getPriorityLabel } from '@/lib/project-constants';

export function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  if (!priority) return null;
  const colors = PRIORITY_COLORS[priority] ?? { bg: 'bg-muted/50', text: 'text-muted-foreground', dot: 'bg-muted-foreground' };
  return (
    <Badge variant="outline" className={`gap-1.5 border-0 text-xs font-medium ${colors.bg} ${colors.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      {getPriorityLabel(priority)}
    </Badge>
  );
}
