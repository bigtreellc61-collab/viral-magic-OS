import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  prospect:      'border-blue-500/30 text-blue-400 bg-blue-500/10',
  discovery:     'border-violet-500/30 text-violet-400 bg-violet-500/10',
  qualified:     'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
  proposal_sent: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10',
  active:        'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  paused:        'border-orange-500/30 text-orange-400 bg-orange-500/10',
  completed:     'border-purple-500/30 text-purple-400 bg-purple-500/10',
  archived:      'border-border text-muted-foreground bg-muted/40',
};

const STATUS_LABELS: Record<string, string> = {
  prospect:      'Prospect',
  discovery:     'Discovery',
  qualified:     'Qualified',
  proposal_sent: 'Proposal Sent',
  active:        'Active',
  paused:        'Paused',
  completed:     'Completed',
  archived:      'Archived',
};

interface StatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export function ClientStatusBadge({ status, className }: StatusBadgeProps) {
  const key = status ?? '';
  return (
    <Badge
      variant="outline"
      className={cn('font-medium text-[10px] uppercase tracking-wider', STATUS_STYLES[key] ?? 'border-border text-muted-foreground', className)}
    >
      {STATUS_LABELS[key] ?? status ?? '—'}
    </Badge>
  );
}
