import { format } from 'date-fns';
import { Activity } from 'lucide-react';

interface ActivityItem {
  id: string;
  activityType: string;
  description: string;
  actorName?: string | null;
  createdAt: string | Date;
}

interface ActivityTimelineProps {
  items: ActivityItem[];
  emptyMessage?: string;
}

const TYPE_COLORS: Record<string, string> = {
  'client.created':       'bg-emerald-500',
  'client.updated':       'bg-blue-500',
  'client.archived':      'bg-orange-500',
  'client.restored':      'bg-violet-500',
  'client.deleted':       'bg-red-500',
  'client.note.created':  'bg-cyan-500',
  'client.note.updated':  'bg-blue-400',
  'client.note.archived': 'bg-orange-400',
  'client.note.restored': 'bg-violet-400',
  'setup.completed':      'bg-primary',
};

export function ActivityTimeline({ items, emptyMessage = 'No activity yet.' }: ActivityTimelineProps) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Activity className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {items.map((item, idx) => (
        <div key={item.id} className="flex gap-4 group">
          <div className="flex flex-col items-center">
            <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${TYPE_COLORS[item.activityType] ?? 'bg-primary/60'} shadow-sm`} />
            {idx < items.length - 1 && (
              <div className="w-px flex-1 bg-border/40 mt-1" />
            )}
          </div>
          <div className="pb-4 flex-1 min-w-0">
            <p className="text-sm text-foreground leading-snug">{item.description}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              <span className="font-mono text-[10px] uppercase bg-muted px-1.5 py-0.5 rounded border border-border/50">
                {item.activityType}
              </span>
              {item.actorName && (
                <>
                  <span>•</span>
                  <span>{item.actorName}</span>
                </>
              )}
              <span>•</span>
              <time dateTime={String(item.createdAt)}>
                {format(new Date(item.createdAt), 'MMM d, yyyy HH:mm')}
              </time>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
