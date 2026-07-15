import { Users, SearchX, Archive, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  type: 'no-clients' | 'no-results' | 'no-archived';
  onAddClient?: () => void;
  onClearFilters?: () => void;
}

export function ClientEmptyState({ type, onAddClient, onClearFilters }: EmptyStateProps) {
  if (type === 'no-clients') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-primary/10 mb-4">
          <Users className="h-10 w-10 text-primary/60" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No clients yet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Add your first client to start tracking relationships, notes, and activity.
        </p>
        {onAddClient && (
          <Button onClick={onAddClient} className="gap-2">
            <Plus className="h-4 w-4" />
            Add First Client
          </Button>
        )}
      </div>
    );
  }

  if (type === 'no-results') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-muted/50 mb-4">
          <SearchX className="h-10 w-10 text-muted-foreground/60" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No matching clients</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          No clients match your current search or filters.
        </p>
        {onClearFilters && (
          <Button variant="outline" onClick={onClearFilters}>Clear Filters</Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 rounded-2xl bg-muted/50 mb-4">
        <Archive className="h-10 w-10 text-muted-foreground/60" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No archived clients</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Archived clients will appear here.
      </p>
    </div>
  );
}
