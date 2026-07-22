import { useState, useEffect } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListProjects, useGetProjectMetrics, useArchiveProject,
  useRestoreProject, useDeleteProject, useUpdateProject,
  getListProjectsQueryKey, getGetProjectMetricsQueryKey,
  ProjectRecord,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Search, X, LayoutGrid, List, MoreHorizontal, Pencil,
  Archive, RotateCcw, Trash2, Loader2, FolderOpen, CheckCircle2,
  PauseCircle, AlertTriangle, Briefcase,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ProjectStatusBadge } from '@/components/projects/status-badge';
import { PriorityBadge } from '@/components/projects/priority-badge';
import { ProjectProgressBar } from '@/components/projects/progress-bar';
import {
  ArchiveProjectDialog, RestoreProjectDialog, DeleteProjectDialog,
} from '@/components/projects/confirm-dialogs';
import { ProjectKanbanBoard } from '@/components/projects/kanban-board';
import { DataPagination } from '@/components/ui/data-pagination';
import {
  PROJECT_STATUSES, PROJECT_TYPES, PRIORITIES, PLATFORMS, PROJECT_SORT_OPTIONS,
  getProjectTypeLabel, getPlatformLabel, isOverdue,
} from '@/lib/project-constants';

type ViewMode = 'table' | 'kanban';
type DialogType = 'archive' | 'restore' | 'delete' | null;

export function ProjectsPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = new URLSearchParams(search);

  const [q, setQ] = useState(params.get('search') ?? '');
  const [filterClient, setFilterClient] = useState(params.get('clientId') ?? '');
  const [filterStatus, setFilterStatus] = useState(params.get('status') ?? '');
  const [filterPriority, setFilterPriority] = useState(params.get('priority') ?? '');
  const [filterType, setFilterType] = useState(params.get('projectType') ?? '');
  const [filterPlatform, setFilterPlatform] = useState(params.get('selectedPlatform') ?? '');
  const [showArchived, setShowArchived] = useState(params.get('showArchived') === 'true');
  const [sort, setSort] = useState(params.get('sort') ?? 'newest');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [activeProject, setActiveProject] = useState<ProjectRecord | null>(null);

  const listParams = {
    search: q || undefined,
    clientId: filterClient || undefined,
    status: filterStatus || undefined,
    priority: filterPriority || undefined,
    projectType: filterType || undefined,
    selectedPlatform: filterPlatform || undefined,
    showArchived: showArchived ? 'true' : 'false',
    sort,
    page,
    pageSize: 25,
  };

  const { data, isLoading } = useListProjects(listParams, {
    query: { queryKey: getListProjectsQueryKey(listParams) },
  });
  const { data: metrics } = useGetProjectMetrics({ query: { queryKey: getGetProjectMetricsQueryKey() } });

  const archiveProject = useArchiveProject();
  const restoreProject = useRestoreProject();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['listProjects'] });
    queryClient.invalidateQueries({ queryKey: getGetProjectMetricsQueryKey() });
  };

  const projects = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const hasFilters = Boolean(q || filterClient || filterStatus || filterPriority || filterType || filterPlatform || showArchived);

  const clearFilters = () => {
    setQ(''); setFilterClient(''); setFilterStatus('');
    setFilterPriority(''); setFilterType(''); setFilterPlatform('');
    setShowArchived(false); setPage(1);
  };

  const openDialog = (type: DialogType, project: ProjectRecord) => {
    setDialogType(type);
    setActiveProject(project);
  };
  const closeDialog = () => { setDialogType(null); setActiveProject(null); };

  const doArchive = () => {
    if (!activeProject) return;
    archiveProject.mutate({ projectId: activeProject.id }, {
      onSuccess: () => { toast({ title: 'Project archived' }); closeDialog(); invalidate(); },
      onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
    });
  };

  const doRestore = (status: string, restoreTasks: boolean) => {
    if (!activeProject) return;
    restoreProject.mutate({ projectId: activeProject.id, data: { status, restoreTasks } }, {
      onSuccess: () => { toast({ title: 'Project restored' }); closeDialog(); invalidate(); },
      onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
    });
  };

  const doDelete = () => {
    if (!activeProject) return;
    deleteProject.mutate({ projectId: activeProject.id }, {
      onSuccess: () => { toast({ title: 'Project deleted' }); closeDialog(); invalidate(); },
      onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
    });
  };

  const handleStatusChange = (projectId: string, newStatus: string) => {
    updateProject.mutate({ projectId, data: { projectStatus: newStatus } }, {
      onSuccess: () => { toast({ title: 'Status updated' }); invalidate(); },
      onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
    });
  };

  const metricCards = [
    { label: 'Total Projects', value: metrics?.total ?? '—', icon: Briefcase, color: 'text-violet-400', bg: 'bg-violet-500/10', onClick: clearFilters },
    { label: 'Active Projects', value: metrics?.active ?? '—', icon: FolderOpen, color: 'text-blue-400', bg: 'bg-blue-500/10', onClick: () => { setFilterStatus('building'); setPage(1); } },
    { label: 'Completed', value: metrics?.completed ?? '—', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', onClick: () => { setFilterStatus('completed'); setPage(1); } },
    { label: 'On Hold', value: metrics?.onHold ?? '—', icon: PauseCircle, color: 'text-slate-400', bg: 'bg-slate-500/10', onClick: () => { setFilterStatus('on_hold'); setPage(1); } },
    { label: 'Overdue', value: metrics?.overdue ?? '—', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', onClick: () => { setSort('target_date'); setPage(1); } },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage all client projects.</p>
        </div>
        <Link href="/projects/new">
          <Button className="gap-2 shrink-0"><Plus className="h-4 w-4" /> Add Project</Button>
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metricCards.map((card) => (
          <button key={card.label} onClick={card.onClick} className="text-left">
            <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <div>
                    <div className="text-xl font-bold tabular-nums">{card.value}</div>
                    <div className="text-[11px] text-muted-foreground leading-tight">{card.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* Filters + toolbar */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1); }}
                  placeholder="Search projects, clients, platforms…"
                  className="pl-9 border-border/50"
                />
              </div>
              <div className="flex gap-2 items-center shrink-0">
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('table')}
                  title="Table view"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('kanban')}
                  title="Kanban view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Select value={filterStatus || '_all'} onValueChange={(v) => { setFilterStatus(v === '_all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[130px] text-xs border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Statuses</SelectItem>
                  {PROJECT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterPriority || '_all'} onValueChange={(v) => { setFilterPriority(v === '_all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[110px] text-xs border-border/50"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Priorities</SelectItem>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterType || '_all'} onValueChange={(v) => { setFilterType(v === '_all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[140px] text-xs border-border/50"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Types</SelectItem>
                  {PROJECT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterPlatform || '_all'} onValueChange={(v) => { setFilterPlatform(v === '_all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[130px] text-xs border-border/50"><SelectValue placeholder="Platform" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Platforms</SelectItem>
                  {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Button
                variant={showArchived ? 'secondary' : 'outline'}
                size="sm"
                className="h-8 text-xs border-border/50"
                onClick={() => { setShowArchived((a) => !a); setPage(1); }}
              >
                {showArchived ? 'Showing Archived' : 'Show Archived'}
              </Button>

              <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[160px] text-xs border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_SORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1 text-muted-foreground">
                  <X className="h-3 w-3" /> Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : projects.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{hasFilters ? 'No projects match your filters.' : 'No projects yet.'}</p>
            {!hasFilters && (
              <Link href="/projects/new">
                <Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> Add First Project</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        <div className="overflow-x-auto">
          <ProjectKanbanBoard
            projects={projects}
            onStatusChange={handleStatusChange}
            onArchive={(p) => openDialog('archive', p as any)}
            onRestore={(p) => openDialog('restore', p as any)}
            onDelete={(p) => openDialog('delete', p as any)}
          />
        </div>
      ) : (
        <Card className="border-border/50">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const overdue = isOverdue(project.targetCompletionDate, project.projectStatus);
                  return (
                    <TableRow
                      key={project.id}
                      className="border-border/50 hover:bg-muted/20"
                      onMouseEnter={() => import('@/pages/project-detail')}
                    >
                      <TableCell>
                        <Link href={`/projects/${project.id}`}>
                          <span className="font-medium hover:text-primary transition-colors cursor-pointer">
                            {project.projectName}
                          </span>
                        </Link>
                        {project.archivedAt && <Badge variant="outline" className="ml-2 text-[10px] border-orange-500/30 text-orange-400">Archived</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{project.clientName ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{getProjectTypeLabel(project.projectType)}</TableCell>
                      <TableCell><ProjectStatusBadge status={project.projectStatus} /></TableCell>
                      <TableCell><PriorityBadge priority={project.priority} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{getPlatformLabel(project.selectedPlatform)}</TableCell>
                      <TableCell className={`text-xs ${overdue ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {project.targetCompletionDate
                          ? format(new Date(project.targetCompletionDate + 'T00:00:00'), 'MMM d, yyyy')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(project.updatedAt), 'MMM d')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-border/50">
                            <DropdownMenuItem asChild>
                              <Link href={`/projects/${project.id}`} className="flex items-center gap-2 cursor-pointer">View</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/projects/${project.id}/edit`} className="flex items-center gap-2 cursor-pointer">
                                <Pencil className="h-4 w-4" /> Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {project.archivedAt ? (
                              <>
                                <DropdownMenuItem onClick={() => openDialog('restore', project)} className="gap-2">
                                  <RotateCcw className="h-4 w-4" /> Restore
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDialog('delete', project)} className="gap-2 text-destructive focus:text-destructive">
                                  <Trash2 className="h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={() => openDialog('archive', project)} className="gap-2">
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
          {totalPages > 1 && (
            <div className="p-4 border-t border-border/50">
              <DataPagination page={page} pageSize={25} total={total} onPageChange={setPage} />
            </div>
          )}
        </Card>
      )}

      {/* Dialogs */}
      {dialogType === 'archive' && activeProject && (
        <ArchiveProjectDialog
          open
          onClose={closeDialog}
          onConfirm={doArchive}
          projectName={activeProject.projectName}
          isPending={archiveProject.isPending}
        />
      )}
      {dialogType === 'restore' && activeProject && (
        <RestoreProjectDialog
          open
          onClose={closeDialog}
          onConfirm={doRestore}
          projectName={activeProject.projectName}
          isPending={restoreProject.isPending}
        />
      )}
      {dialogType === 'delete' && activeProject && (
        <DeleteProjectDialog
          open
          onClose={closeDialog}
          onConfirm={doDelete}
          projectName={activeProject.projectName}
          isPending={deleteProject.isPending}
        />
      )}
    </div>
  );
}
