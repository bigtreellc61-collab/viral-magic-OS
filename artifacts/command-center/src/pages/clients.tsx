import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListClients, useArchiveClient, useRestoreClient, useDeleteClient,
  getListClientsQueryKey, ListClientsParams, ClientRecord,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Search, X, LayoutGrid, List, MoreHorizontal,
  Eye, Pencil, Archive, RotateCcw, Trash2, Loader2, Users, SlidersHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';
import { ClientStatusBadge } from '@/components/clients/status-badge';
import { ClientCard } from '@/components/clients/client-card';
import { ClientEmptyState } from '@/components/clients/empty-state';
import { ArchiveClientDialog, RestoreClientDialog, DeleteClientDialog } from '@/components/clients/confirm-dialogs';
import { DataPagination } from '@/components/ui/data-pagination';
import {
  CLIENT_STATUSES, BUSINESS_TYPES, CUSTOMER_MARKETS, SORT_OPTIONS,
  getClientDisplayName, getCustomerMarketLabel,
} from '@/lib/client-constants';

type ViewMode = 'table' | 'card';

function useClientFilters() {
  const [, setLocation] = useLocation();
  const [location] = useLocation();

  const getParams = useCallback(() => {
    const search = new URLSearchParams(window.location.search);
    return {
      q: search.get('q') ?? '',
      status: search.get('status') ?? '',
      industry: search.get('industry') ?? '',
      businessType: search.get('businessType') ?? '',
      customerMarket: search.get('customerMarket') ?? '',
      showArchived: search.get('showArchived') === 'true',
      sortBy: (search.get('sortBy') ?? 'newest') as string,
      page: Number(search.get('page') ?? 1),
    };
  }, [location]);

  const setParam = useCallback((key: string, value: string | boolean | number) => {
    const search = new URLSearchParams(window.location.search);
    if (value === '' || value === false || value === 0) {
      search.delete(key);
    } else {
      search.set(key, String(value));
    }
    if (key !== 'page') search.set('page', '1');
    setLocation(`/clients?${search.toString()}`, { replace: true });
  }, [setLocation]);

  const clearAll = useCallback(() => {
    setLocation('/clients', { replace: true });
  }, [setLocation]);

  return { filters: getParams(), setParam, clearAll };
}

export function ClientsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { filters, setParam, clearAll } = useClientFilters();
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (sessionStorage.getItem('clientViewMode') as ViewMode) ?? 'table'
  );
  const [actionClient, setActionClient] = useState<ClientRecord | null>(null);
  const [actionType, setActionType] = useState<'archive' | 'restore' | 'delete' | null>(null);

  const PAGE_SIZE = 25;

  const queryParams = {
    q: filters.q || undefined,
    status: filters.status || undefined,
    industry: filters.industry || undefined,
    businessType: filters.businessType || undefined,
    customerMarket: filters.customerMarket || undefined,
    showArchived: filters.showArchived || undefined,
    sortBy: filters.sortBy as any,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };

  const { data, isLoading, error } = useListClients(queryParams, {
    query: { staleTime: 10_000, queryKey: getListClientsQueryKey(queryParams) },
  });

  const archiveClient = useArchiveClient();
  const restoreClient = useRestoreClient();
  const deleteClient = useDeleteClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
  };

  const handleSetView = (mode: ViewMode) => {
    setViewMode(mode);
    sessionStorage.setItem('clientViewMode', mode);
  };

  const openAction = (client: ClientRecord, type: 'archive' | 'restore' | 'delete') => {
    setActionClient(client);
    setActionType(type);
  };
  const closeAction = () => { setActionClient(null); setActionType(null); };

  const doArchive = () => {
    if (!actionClient) return;
    archiveClient.mutate({ clientId: actionClient.id }, {
      onSuccess: () => {
        toast({ title: 'Client archived', description: `${getClientDisplayName(actionClient)} was archived.` });
        closeAction(); invalidate();
      },
      onError: (err: any) => toast({ title: 'Archive failed', description: err?.data?.error ?? 'Could not archive client.', variant: 'destructive' }),
    });
  };

  const doRestore = (status: string) => {
    if (!actionClient) return;
    restoreClient.mutate({ clientId: actionClient.id, data: { status } }, {
      onSuccess: () => {
        toast({ title: 'Client restored', description: `${getClientDisplayName(actionClient)} was restored as "${status}".` });
        closeAction(); invalidate();
      },
      onError: (err: any) => toast({ title: 'Restore failed', description: err?.data?.error ?? 'Could not restore client.', variant: 'destructive' }),
    });
  };

  const doDelete = () => {
    if (!actionClient) return;
    deleteClient.mutate({ clientId: actionClient.id }, {
      onSuccess: () => {
        toast({ title: 'Client deleted', description: `${getClientDisplayName(actionClient)} was permanently deleted.` });
        closeAction(); invalidate();
      },
      onError: (err: any) => toast({ title: 'Delete failed', description: err?.data?.error ?? 'Could not delete client.', variant: 'destructive' }),
    });
  };

  const hasFilters = !!(filters.q || filters.status || filters.industry || filters.businessType || filters.customerMarket || filters.showArchived);

  const clients = data?.clients ?? [];
  const total = data?.total ?? 0;
  const isEmpty = !isLoading && !error && total === 0 && !hasFilters;
  const noResults = !isLoading && !error && total === 0 && hasFilters;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Clients</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your client relationships and records.</p>
        </div>
        <Link href="/clients/new">
          <Button className="gap-2 shrink-0 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: data.total, filter: {} },
            { label: 'Active', value: undefined, filter: { status: 'active' } },
            { label: 'Prospects', value: undefined, filter: { status: 'prospect' } },
            { label: 'Archived', value: undefined, filter: { showArchived: true } },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => {
                clearAll();
                Object.entries(s.filter).forEach(([k, v]) => setParam(k, v as any));
              }}
              className="rounded-lg border border-border/50 bg-card/50 p-3 text-left hover:border-primary/30 hover:bg-card transition-colors"
            >
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{s.label}</p>
              <p className="text-xl font-bold mt-0.5">
                {s.value !== undefined ? s.value : '—'}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder="Search by name, company, email, phone, industry, location…"
              className="pl-9 border-border/50"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filters.status || 'all'} onValueChange={(v) => setParam('status', v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[140px] border-border/50 shrink-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {CLIENT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.businessType || 'all'} onValueChange={(v) => setParam('businessType', v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[160px] border-border/50 shrink-0">
                <SelectValue placeholder="Business Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {BUSINESS_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.customerMarket || 'all'} onValueChange={(v) => setParam('customerMarket', v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[120px] border-border/50 shrink-0">
                <SelectValue placeholder="Market" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                {CUSTOMER_MARKETS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filters.sortBy} onValueChange={(v) => setParam('sortBy', v)}>
            <SelectTrigger className="w-[180px] border-border/50 h-8 text-xs">
              <SlidersHorizontal className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <button
            onClick={() => setParam('showArchived', !filters.showArchived)}
            className={`h-8 px-3 rounded-md border text-xs font-medium transition-colors ${
              filters.showArchived
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-border/50 text-muted-foreground hover:border-primary/20'
            }`}
          >
            {filters.showArchived ? '✓ ' : ''}Show Archived
          </button>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 px-2 text-xs gap-1 text-muted-foreground">
              <X className="h-3 w-3" /> Clear Filters
            </Button>
          )}

          <div className="ml-auto flex items-center gap-1 border border-border/50 rounded-md p-0.5">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => handleSetView('table')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'card' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => handleSetView('card')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="p-6 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 text-sm font-medium">
          Failed to load clients. Please refresh.
        </div>
      ) : isEmpty ? (
        <ClientEmptyState type="no-clients" onAddClient={() => window.location.href = '/clients/new'} />
      ) : noResults ? (
        <ClientEmptyState type={filters.showArchived ? 'no-archived' : 'no-results'} onClearFilters={clearAll} />
      ) : viewMode === 'table' ? (
        <TableView
          clients={clients}
          onArchive={(c) => openAction(c, 'archive')}
          onRestore={(c) => openAction(c, 'restore')}
          onDelete={(c) => openAction(c, 'delete')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              onArchive={(c) => openAction(c, 'archive')}
              onRestore={(c) => openAction(c, 'restore')}
              onDelete={(c) => openAction(c, 'delete')}
            />
          ))}
        </div>
      )}

      {!isLoading && total > 0 && (
        <DataPagination
          page={filters.page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={(p) => setParam('page', p)}
        />
      )}

      {/* Dialogs */}
      <ArchiveClientDialog
        open={actionType === 'archive'}
        client={actionClient}
        onConfirm={doArchive}
        onCancel={closeAction}
        isPending={archiveClient.isPending}
      />
      <RestoreClientDialog
        open={actionType === 'restore'}
        client={actionClient}
        onConfirm={doRestore}
        onCancel={closeAction}
        isPending={restoreClient.isPending}
      />
      <DeleteClientDialog
        open={actionType === 'delete'}
        client={actionClient}
        onConfirm={doDelete}
        onCancel={closeAction}
        isPending={deleteClient.isPending}
      />
    </div>
  );
}

// ─── Table View ────────────────────────────────────────────────
function TableView({ clients, onArchive, onRestore, onDelete }: {
  clients: ClientRecord[];
  onArchive: (c: ClientRecord) => void;
  onRestore: (c: ClientRecord) => void;
  onDelete: (c: ClientRecord) => void;
}) {
  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Company</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider hidden sm:table-cell">Contact</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider hidden md:table-cell">Industry</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider hidden lg:table-cell">Market</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider hidden xl:table-cell">Email</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider hidden xl:table-cell">Phone</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider hidden lg:table-cell">Updated</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => {
              const isArchived = Boolean(client.archivedAt);
              const displayName = getClientDisplayName(client);
              return (
                <TableRow
                  key={client.id}
                  className="hover:bg-muted/20 group"
                  onMouseEnter={() => import('@/pages/client-detail')}
                >
                  <TableCell className="font-medium max-w-[200px]">
                    <Link href={`/clients/${client.id}`}>
                      <span className="truncate block hover:text-primary transition-colors cursor-pointer">{displayName}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {[client.contactFirstName, client.contactLastName].filter(Boolean).join(' ') || '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-[160px]">
                    <span className="truncate block">{client.industry || '—'}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {client.customerMarket ? (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border/50 font-medium">
                        {getCustomerMarketLabel(client.customerMarket)}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell><ClientStatusBadge status={client.status} /></TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">{client.email || '—'}</TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">{client.phone || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                    {format(new Date(client.updatedAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="border-border/50">
                        <DropdownMenuItem asChild>
                          <Link href={`/clients/${client.id}`} className="flex items-center gap-2 cursor-pointer">
                            <Eye className="h-4 w-4" /> View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/clients/${client.id}/edit`} className="flex items-center gap-2 cursor-pointer">
                            <Pencil className="h-4 w-4" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {isArchived ? (
                          <>
                            <DropdownMenuItem onClick={() => onRestore(client)} className="gap-2">
                              <RotateCcw className="h-4 w-4" /> Restore
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDelete(client)} className="gap-2 text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onClick={() => onArchive(client)} className="gap-2">
                            <Archive className="h-4 w-4" /> Archive
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
