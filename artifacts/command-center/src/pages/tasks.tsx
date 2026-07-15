import { useState } from 'react';
import { Link, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListTasks, useGetTaskMetrics, useCreateTask, useUpdateTask,
  useArchiveTask, useRestoreTask, useDeleteTask,
  getListTasksQueryKey, getGetTaskMetricsQueryKey, TaskRecord,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
  Archive, RotateCcw, Trash2, Loader2, CheckCircle2, AlertTriangle,
  Clock, Layers, Activity,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TaskStatusBadge } from '@/components/tasks/status-badge';
import { PriorityBadge } from '@/components/projects/priority-badge';
import { DueDateBadge } from '@/components/ui/due-date-badge';
import {
  ArchiveTaskDialog, RestoreTaskDialog, DeleteTaskDialog,
} from '@/components/tasks/confirm-dialogs';
import { TaskKanbanBoard } from '@/components/tasks/kanban-board';
import { TaskFormDialog, TaskFormValues } from '@/components/tasks/task-form-dialog';
import { DataPagination } from '@/components/ui/data-pagination';
import {
  TASK_STATUSES, TASK_CATEGORIES, PRIORITIES, TASK_SORT_OPTIONS, TASK_DUE_DATE_OPTIONS,
  getTaskCategoryLabel, getEffortLabel,
} from '@/lib/project-constants';

type ViewMode = 'list' | 'kanban';
type DialogType = 'add' | 'edit' | 'archive' | 'restore' | 'delete' | null;

export function TasksPage() {
  const search = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = new URLSearchParams(search);

  const [q, setQ] = useState(params.get('search') ?? '');
  const [filterClient, setFilterClient] = useState(params.get('clientId') ?? '');
  const [filterProject, setFilterProject] = useState(params.get('projectId') ?? '');
  const [filterStatus, setFilterStatus] = useState(params.get('status') ?? '');
  const [filterPriority, setFilterPriority] = useState(params.get('priority') ?? '');
  const [filterCategory, setFilterCategory] = useState(params.get('category') ?? '');
  const [filterDueDate, setFilterDueDate] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState('due_date_asc');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);

  const listParams = {
    search: q || undefined,
    clientId: filterClient || undefined,
    projectId: filterProject || undefined,
    status: filterStatus || undefined,
    priority: filterPriority || undefined,
    category: filterCategory || undefined,
    dueDate: filterDueDate || undefined,
    showArchived: showArchived ? 'true' : 'false',
    sort,
    page,
    pageSize: 25,
  };

  const { data, isLoading } = useListTasks(listParams, {
    query: { queryKey: getListTasksQueryKey(listParams) },
  });
  const { data: metrics } = useGetTaskMetrics({ query: { queryKey: getGetTaskMetricsQueryKey() } });

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const archiveTask = useArchiveTask();
  const restoreTask = useRestoreTask();
  const deleteTask = useDeleteTask();

  const tasks = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const hasFilters = Boolean(q || filterClient || filterProject || filterStatus || filterPriority || filterCategory || filterDueDate || showArchived);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['listTasks'] });
    queryClient.invalidateQueries({ queryKey: getGetTaskMetricsQueryKey() });
  };

  const clearFilters = () => {
    setQ(''); setFilterClient(''); setFilterProject('');
    setFilterStatus(''); setFilterPriority(''); setFilterCategory('');
    setFilterDueDate(''); setShowArchived(false); setPage(1);
  };

  const openDialog = (type: DialogType, task: TaskRecord) => {
    setDialogType(type);
    setActiveTask(task);
  };
  const closeDialog = () => { setDialogType(null); setActiveTask(null); };

  const handleTaskSave = (values: TaskFormValues) => {
    if (dialogType === 'edit' && activeTask) {
      updateTask.mutate({ taskId: activeTask.id, data: values as any }, {
        onSuccess: () => { toast({ title: 'Task updated' }); closeDialog(); invalidate(); },
        onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
      });
    } else {
      createTask.mutate({ data: values as any }, {
        onSuccess: () => { toast({ title: 'Task created' }); closeDialog(); invalidate(); },
        onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
      });
    }
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateTask.mutate({ taskId, data: { status: newStatus } as any }, {
      onSuccess: () => { toast({ title: 'Status updated' }); invalidate(); },
      onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
    });
  };

  const metricCards = [
    { label: 'Open Tasks', value: metrics?.open ?? '—', icon: Layers, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'In Progress', value: metrics?.inProgress ?? '—', icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Overdue', value: metrics?.overdue ?? '—', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Blocked', value: metrics?.blocked ?? '—', icon: X, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Completed This Month', value: metrics?.completedThisMonth ?? '—', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage all tasks across projects.</p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => setDialogType('add')}><Plus className="h-4 w-4" /> Add Task</Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metricCards.map((card) => (
          <Card key={card.label} className="border-border/50">
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
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1); }}
                  placeholder="Search tasks, projects, clients…"
                  className="pl-9 border-border/50"
                />
              </div>
              <div className="flex gap-2 items-center shrink-0">
                <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('list')} title="List"><List className="h-4 w-4" /></Button>
                <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('kanban')} title="Kanban"><LayoutGrid className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Select value={filterStatus || '_all'} onValueChange={(v) => { setFilterStatus(v === '_all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[130px] text-xs border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Statuses</SelectItem>
                  {TASK_STATUSES.filter((s) => s.value !== 'archived').map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterPriority || '_all'} onValueChange={(v) => { setFilterPriority(v === '_all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[110px] text-xs border-border/50"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Priorities</SelectItem>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterCategory || '_all'} onValueChange={(v) => { setFilterCategory(v === '_all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[130px] text-xs border-border/50"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Categories</SelectItem>
                  {TASK_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterDueDate || '_all'} onValueChange={(v) => { setFilterDueDate(v === '_all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[130px] text-xs border-border/50"><SelectValue placeholder="Due Date" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Any Due Date</SelectItem>
                  {TASK_DUE_DATE_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Button variant={showArchived ? 'secondary' : 'outline'} size="sm" className="h-8 text-xs border-border/50" onClick={() => { setShowArchived((a) => !a); setPage(1); }}>
                {showArchived ? 'Showing Archived' : 'Show Archived'}
              </Button>

              <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[150px] text-xs border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_SORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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
      ) : tasks.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{hasFilters ? 'No tasks match your filters.' : 'No tasks yet.'}</p>
            {!hasFilters && (
              <Button className="mt-4 gap-2" onClick={() => setDialogType('add')}><Plus className="h-4 w-4" /> Add First Task</Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        <TaskKanbanBoard
          tasks={tasks as any}
          onStatusChange={handleStatusChange}
          onEdit={(t) => openDialog('edit', t as any)}
          onArchive={(t) => openDialog('archive', t as any)}
          onRestore={(t) => openDialog('restore', t as any)}
          onDelete={(t) => openDialog('delete', t as any)}
          onComplete={(t) => handleStatusChange(t.id, 'completed')}
        />
      ) : (
        <Card className="border-border/50">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Task</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task: any) => (
                  <TableRow key={task.id} className="border-border/50 hover:bg-muted/20">
                    <TableCell>
                      <span className="font-medium">{task.title}</span>
                      {task.archivedAt && <Badge variant="outline" className="ml-2 text-[10px] border-orange-500/30 text-orange-400">Archived</Badge>}
                    </TableCell>
                    <TableCell>
                      {task.projectId ? (
                        <Link href={`/projects/${task.projectId}`}>
                          <span className="text-xs hover:text-primary transition-colors cursor-pointer text-muted-foreground">{task.projectName ?? '—'}</span>
                        </Link>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{task.clientName ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{getTaskCategoryLabel(task.category)}</TableCell>
                    <TableCell><PriorityBadge priority={task.priority} /></TableCell>
                    <TableCell><TaskStatusBadge status={task.status} /></TableCell>
                    <TableCell><DueDateBadge dueDate={task.dueDate} status={task.status} /></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-border/50">
                          <DropdownMenuItem onClick={() => openDialog('edit', task)} className="gap-2">
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          {task.status !== 'completed' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'completed')} className="gap-2 text-emerald-400 focus:text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" /> Complete
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {task.archivedAt ? (
                            <>
                              <DropdownMenuItem onClick={() => openDialog('restore', task)} className="gap-2">
                                <RotateCcw className="h-4 w-4" /> Restore
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDialog('delete', task)} className="gap-2 text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem onClick={() => openDialog('archive', task)} className="gap-2">
                              <Archive className="h-4 w-4" /> Archive
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
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
      {(dialogType === 'add' || dialogType === 'edit') && (
        <TaskFormDialog
          open
          onClose={closeDialog}
          onSubmit={handleTaskSave}
          isPending={createTask.isPending || updateTask.isPending}
          defaultTask={activeTask}
          title={dialogType === 'edit' ? 'Edit Task' : 'Add Task'}
        />
      )}
      {dialogType === 'archive' && activeTask && (
        <ArchiveTaskDialog
          open onClose={closeDialog}
          onConfirm={() => archiveTask.mutate({ taskId: activeTask.id }, {
            onSuccess: () => { toast({ title: 'Task archived' }); closeDialog(); invalidate(); },
            onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
          })}
          taskTitle={activeTask.title}
          isPending={archiveTask.isPending}
        />
      )}
      {dialogType === 'restore' && activeTask && (
        <RestoreTaskDialog
          open onClose={closeDialog}
          onConfirm={(status) => restoreTask.mutate({ taskId: activeTask.id, data: { status } }, {
            onSuccess: () => { toast({ title: 'Task restored' }); closeDialog(); invalidate(); },
            onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
          })}
          taskTitle={activeTask.title}
          isPending={restoreTask.isPending}
        />
      )}
      {dialogType === 'delete' && activeTask && (
        <DeleteTaskDialog
          open onClose={closeDialog}
          onConfirm={() => deleteTask.mutate({ taskId: activeTask.id }, {
            onSuccess: () => { toast({ title: 'Task deleted' }); closeDialog(); invalidate(); },
            onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
          })}
          taskTitle={activeTask.title}
          isPending={deleteTask.isPending}
        />
      )}
    </div>
  );
}
