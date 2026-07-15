import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetProject, useGetProjectProgress, useGetProjectActivity,
  useListProjectTasks, useArchiveProject, useRestoreProject, useDeleteProject,
  useUpdateProject, useCreateTask, useUpdateTask, useArchiveTask, useRestoreTask, useDeleteTask,
  getGetProjectQueryKey, getGetProjectProgressQueryKey, getGetProjectActivityQueryKey,
  getListProjectTasksQueryKey, getListProjectsQueryKey, TaskRecord,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft, Pencil, Archive, RotateCcw, Trash2, Plus,
  MoreHorizontal, Loader2, Calendar, DollarSign, User,
  CheckCircle2, LayoutGrid, List,
} from 'lucide-react';
import { format } from 'date-fns';
import { ProjectStatusBadge } from '@/components/projects/status-badge';
import { PriorityBadge } from '@/components/projects/priority-badge';
import { ProjectProgressBar } from '@/components/projects/progress-bar';
import {
  ArchiveProjectDialog, RestoreProjectDialog, DeleteProjectDialog,
} from '@/components/projects/confirm-dialogs';
import {
  ArchiveTaskDialog, RestoreTaskDialog, DeleteTaskDialog,
} from '@/components/tasks/confirm-dialogs';
import { TaskKanbanBoard } from '@/components/tasks/kanban-board';
import { TaskStatusBadge } from '@/components/tasks/status-badge';
import { DueDateBadge } from '@/components/ui/due-date-badge';
import { TaskFormDialog, TaskFormValues } from '@/components/tasks/task-form-dialog';
import { ActivityTimeline } from '@/components/clients/activity-timeline';
import {
  getProjectTypeLabel, getPlatformLabel, getTaskCategoryLabel,
  getEffortLabel, TASK_STATUSES, TASK_CATEGORIES, PRIORITIES, PROJECT_STATUSES,
} from '@/lib/project-constants';

type Tab = 'overview' | 'tasks' | 'activity' | 'notes';
type ProjectDialogType = 'archive' | 'restore' | 'delete' | null;
type TaskDialogType = 'add' | 'edit' | 'archive' | 'restore' | 'delete' | null;
type ViewMode = 'list' | 'kanban';

interface ProjectDetailPageProps { projectId: string; }

export function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('overview');
  const [projectDialog, setProjectDialog] = useState<ProjectDialogType>(null);
  const [taskDialog, setTaskDialog] = useState<TaskDialogType>(null);
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);
  const [taskViewMode, setTaskViewMode] = useState<ViewMode>('list');
  const [taskFilterStatus, setTaskFilterStatus] = useState('');
  const [taskFilterPriority, setTaskFilterPriority] = useState('');
  const [taskFilterCategory, setTaskFilterCategory] = useState('');
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { queryKey: getGetProjectQueryKey(projectId) },
  });
  const { data: progress } = useGetProjectProgress(projectId, {
    query: { queryKey: getGetProjectProgressQueryKey(projectId) },
  });
  const { data: activity = [], isLoading: activityLoading } = useGetProjectActivity(projectId, {
    query: { enabled: tab === 'activity', queryKey: getGetProjectActivityQueryKey(projectId) },
  });

  const taskParams = {
    showArchived: showArchivedTasks ? 'true' : 'false',
    status: taskFilterStatus || undefined,
    priority: taskFilterPriority || undefined,
    category: taskFilterCategory || undefined,
  };
  const { data: tasks = [], isLoading: tasksLoading } = useListProjectTasks(projectId, taskParams, {
    query: { enabled: tab === 'tasks', queryKey: getListProjectTasksQueryKey(projectId, taskParams) },
  });

  const archiveProject = useArchiveProject();
  const restoreProject = useRestoreProject();
  const deleteProjectMutation = useDeleteProject();
  const updateProject = useUpdateProject();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const archiveTask = useArchiveTask();
  const restoreTask = useRestoreTask();
  const deleteTask = useDeleteTask();

  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
  };
  const invalidateProgress = () => queryClient.invalidateQueries({ queryKey: getGetProjectProgressQueryKey(projectId) });
  const invalidateTasks = () => {
    queryClient.invalidateQueries({ queryKey: ['listProjectTasks', projectId] });
    invalidateProgress();
  };

  if (isLoading) return <div className="flex items-center justify-center h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!project) return <div className="p-6 text-destructive text-sm">Project not found.</div>;

  const isArchived = Boolean(project.archivedAt);
  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: `Tasks${progress ? ` (${progress.completed}/${progress.total})` : ''}` },
    { id: 'activity', label: 'Activity' },
    { id: 'notes', label: 'Notes' },
  ];

  const handleSaveNotes = () => {
    updateProject.mutate({ projectId, data: { internalNotes: notesValue } }, {
      onSuccess: () => {
        toast({ title: 'Notes saved' });
        setEditingNotes(false);
        invalidateProject();
      },
      onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
    });
  };

  const handleTaskSave = (values: TaskFormValues) => {
    if (taskDialog === 'edit' && activeTask) {
      updateTask.mutate({ taskId: activeTask.id, data: values as any }, {
        onSuccess: () => { toast({ title: 'Task updated' }); setTaskDialog(null); setActiveTask(null); invalidateTasks(); },
        onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
      });
    } else {
      createTask.mutate({ data: { ...values, projectId, clientId: project.clientId } as any }, {
        onSuccess: () => { toast({ title: 'Task created' }); setTaskDialog(null); invalidateTasks(); },
        onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
      });
    }
  };

  const handleTaskStatusChange = (taskId: string, newStatus: string) => {
    updateTask.mutate({ taskId, data: { status: newStatus } as any }, {
      onSuccess: () => { toast({ title: 'Task updated' }); invalidateTasks(); },
      onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Button variant="ghost" size="sm" onClick={() => setLocation('/projects')} className="gap-2 -ml-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight">{project.projectName}</h2>
            <ProjectStatusBadge status={project.projectStatus} />
            <PriorityBadge priority={project.priority} />
            {isArchived && <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">Archived</Badge>}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            {project.clientName && <span className="font-medium text-foreground">{project.clientName}</span>}
            <span>{getProjectTypeLabel(project.projectType)}</span>
            {project.selectedPlatform && <span>{getPlatformLabel(project.selectedPlatform)}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button variant="outline" size="sm" onClick={() => { setTab('tasks'); setTaskDialog('add'); }} className="gap-2 border-border/50">
            <Plus className="h-4 w-4" /> Add Task
          </Button>
          <Link href={`/projects/${projectId}/edit`}>
            <Button variant="outline" size="sm" className="gap-2 border-border/50">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 border-border/50">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-border/50">
              {isArchived ? (
                <>
                  <DropdownMenuItem onClick={() => setProjectDialog('restore')} className="gap-2">
                    <RotateCcw className="h-4 w-4" /> Restore
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setProjectDialog('delete')} className="gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" /> Delete Permanently
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => setProjectDialog('archive')} className="gap-2">
                  <Archive className="h-4 w-4" /> Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Progress bar (always visible) */}
      {progress && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <ProjectProgressBar {...progress} />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {project.projectDescription && (
              <Card className="border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Description</CardTitle></CardHeader>
                <CardContent className="text-sm">{project.projectDescription}</CardContent>
              </Card>
            )}
            {(project.businessProblem || project.desiredBusinessOutcome || project.recommendedSolution) && (
              <Card className="border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Business Context</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {project.businessProblem && (
                    <div><p className="text-xs text-muted-foreground font-medium mb-1">Business Problem</p><p className="text-sm">{project.businessProblem}</p></div>
                  )}
                  {project.desiredBusinessOutcome && (
                    <div><p className="text-xs text-muted-foreground font-medium mb-1">Desired Outcome</p><p className="text-sm">{project.desiredBusinessOutcome}</p></div>
                  )}
                  {project.recommendedSolution && (
                    <div><p className="text-xs text-muted-foreground font-medium mb-1">Recommended Solution</p><p className="text-sm">{project.recommendedSolution}</p></div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="border-border/50">
              <CardContent className="p-4 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span className="font-medium text-right">{project.clientName ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><ProjectStatusBadge status={project.projectStatus} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Priority</span><PriorityBadge priority={project.priority} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{getProjectTypeLabel(project.projectType)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Platform</span><span>{getPlatformLabel(project.selectedPlatform)}</span></div>
                {project.projectOwner && <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span>{project.projectOwner}</span></div>}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4 space-y-3 text-sm">
                {project.startDate && (
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Start</span><span>{format(new Date(project.startDate + 'T00:00:00'), 'MMM d, yyyy')}</span></div>
                )}
                {project.targetCompletionDate && (
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Target</span><span>{format(new Date(project.targetCompletionDate + 'T00:00:00'), 'MMM d, yyyy')}</span></div>
                )}
                {project.actualCompletionDate && (
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /><span className="text-muted-foreground">Completed</span><span>{format(new Date(project.actualCompletionDate + 'T00:00:00'), 'MMM d, yyyy')}</span></div>
                )}
                {project.estimatedProjectValue && (
                  <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Value</span><span>${parseFloat(project.estimatedProjectValue).toLocaleString()}</span></div>
                )}
                {project.estimatedMonthlyRecurringRevenue && (
                  <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">MRR</span><span>${parseFloat(project.estimatedMonthlyRecurringRevenue).toLocaleString()}/mo</span></div>
                )}
              </CardContent>
            </Card>

            <p className="text-[10px] text-muted-foreground/60 px-1">
              Created {format(new Date(project.createdAt), 'MMM d, yyyy')} · Updated {format(new Date(project.updatedAt), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
      )}

      {/* ── Tasks Tab ── */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <Select value={taskFilterStatus || '_all'} onValueChange={(v) => setTaskFilterStatus(v === '_all' ? '' : v)}>
                <SelectTrigger className="h-8 w-[130px] text-xs border-border/50"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Statuses</SelectItem>
                  {TASK_STATUSES.filter((s) => s.value !== 'archived').map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={taskFilterPriority || '_all'} onValueChange={(v) => setTaskFilterPriority(v === '_all' ? '' : v)}>
                <SelectTrigger className="h-8 w-[110px] text-xs border-border/50"><SelectValue placeholder="All Priorities" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Priorities</SelectItem>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={taskFilterCategory || '_all'} onValueChange={(v) => setTaskFilterCategory(v === '_all' ? '' : v)}>
                <SelectTrigger className="h-8 w-[130px] text-xs border-border/50"><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Categories</SelectItem>
                  {TASK_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant={showArchivedTasks ? 'secondary' : 'outline'} size="sm" className="h-8 text-xs border-border/50" onClick={() => setShowArchivedTasks((a) => !a)}>
                {showArchivedTasks ? 'Archived' : 'Show Archived'}
              </Button>
            </div>
            <div className="flex gap-2 items-center">
              <Button variant={taskViewMode === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setTaskViewMode('list')} title="List view"><List className="h-4 w-4" /></Button>
              <Button variant={taskViewMode === 'kanban' ? 'secondary' : 'ghost'} size="icon" onClick={() => setTaskViewMode('kanban')} title="Kanban view"><LayoutGrid className="h-4 w-4" /></Button>
              <Button size="sm" onClick={() => setTaskDialog('add')} className="gap-2"><Plus className="h-4 w-4" /> Add Task</Button>
            </div>
          </div>

          {tasksLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : tasks.length === 0 ? (
            <Card className="border-border/50 border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="font-medium">No tasks yet.</p>
                <Button className="mt-3 gap-2" size="sm" onClick={() => setTaskDialog('add')}><Plus className="h-4 w-4" /> Add First Task</Button>
              </CardContent>
            </Card>
          ) : taskViewMode === 'kanban' ? (
            <TaskKanbanBoard
              tasks={tasks as any}
              onStatusChange={handleTaskStatusChange}
              onEdit={(t) => { setActiveTask(t as any); setTaskDialog('edit'); }}
              onArchive={(t) => { setActiveTask(t as any); setTaskDialog('archive'); }}
              onRestore={(t) => { setActiveTask(t as any); setTaskDialog('restore'); }}
              onDelete={(t) => { setActiveTask(t as any); setTaskDialog('delete'); }}
              onComplete={(t) => handleTaskStatusChange(t.id, 'completed')}
            />
          ) : (
            <Card className="border-border/50">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Task</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Effort</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task: any) => (
                      <TableRow key={task.id} className="border-border/50 hover:bg-muted/20">
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{getTaskCategoryLabel(task.category)}</TableCell>
                        <TableCell><PriorityBadge priority={task.priority} /></TableCell>
                        <TableCell><TaskStatusBadge status={task.status} /></TableCell>
                        <TableCell><DueDateBadge dueDate={task.dueDate} status={task.status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{getEffortLabel(task.estimatedEffort)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border-border/50">
                              <DropdownMenuItem onClick={() => { setActiveTask(task); setTaskDialog('edit'); }} className="gap-2">
                                <Pencil className="h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              {task.status !== 'completed' && (
                                <DropdownMenuItem onClick={() => handleTaskStatusChange(task.id, 'completed')} className="gap-2 text-emerald-400 focus:text-emerald-400">
                                  <CheckCircle2 className="h-4 w-4" /> Complete
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {task.archivedAt ? (
                                <>
                                  <DropdownMenuItem onClick={() => { setActiveTask(task); setTaskDialog('restore'); }} className="gap-2"><RotateCcw className="h-4 w-4" /> Restore</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setActiveTask(task); setTaskDialog('delete'); }} className="gap-2 text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem onClick={() => { setActiveTask(task); setTaskDialog('archive'); }} className="gap-2"><Archive className="h-4 w-4" /> Archive</DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Activity Tab ── */}
      {tab === 'activity' && (
        activityLoading
          ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          : <ActivityTimeline items={activity as any} />
      )}

      {/* ── Notes Tab ── */}
      {tab === 'notes' && (
        <Card className="border-border/50">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Internal Notes</CardTitle>
            {!editingNotes ? (
              <Button variant="outline" size="sm" onClick={() => { setNotesValue(project.internalNotes ?? ''); setEditingNotes(true); }} className="gap-2 border-border/50">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingNotes(false)} className="border-border/50">Cancel</Button>
                <Button size="sm" onClick={handleSaveNotes} disabled={updateProject.isPending}>
                  {updateProject.isPending ? 'Saving…' : 'Save Notes'}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {editingNotes ? (
              <Textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Add internal notes for this project…"
                rows={10}
                className="border-border/50 resize-none"
              />
            ) : (
              <div className="text-sm whitespace-pre-wrap text-muted-foreground min-h-[80px]">
                {project.internalNotes || <span className="italic text-muted-foreground/60">No notes yet. Click Edit to add notes.</span>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Project Dialogs */}
      {projectDialog === 'archive' && (
        <ArchiveProjectDialog
          open onClose={() => setProjectDialog(null)}
          onConfirm={() => archiveProject.mutate({ projectId }, {
            onSuccess: () => { toast({ title: 'Project archived' }); setProjectDialog(null); invalidateProject(); },
            onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
          })}
          projectName={project.projectName}
          isPending={archiveProject.isPending}
        />
      )}
      {projectDialog === 'restore' && (
        <RestoreProjectDialog
          open onClose={() => setProjectDialog(null)}
          onConfirm={(status, restoreTasks) => restoreProject.mutate({ projectId, data: { status, restoreTasks } }, {
            onSuccess: () => { toast({ title: 'Project restored' }); setProjectDialog(null); invalidateProject(); },
            onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
          })}
          projectName={project.projectName}
          isPending={restoreProject.isPending}
        />
      )}
      {projectDialog === 'delete' && (
        <DeleteProjectDialog
          open onClose={() => setProjectDialog(null)}
          onConfirm={() => deleteProjectMutation.mutate({ projectId }, {
            onSuccess: () => { setLocation('/projects'); },
            onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
          })}
          projectName={project.projectName}
          isPending={deleteProjectMutation.isPending}
        />
      )}

      {/* Task Dialogs */}
      {(taskDialog === 'add' || taskDialog === 'edit') && (
        <TaskFormDialog
          open
          onClose={() => { setTaskDialog(null); setActiveTask(null); }}
          onSubmit={handleTaskSave}
          isPending={createTask.isPending || updateTask.isPending}
          defaultTask={activeTask}
          defaultProjectId={projectId}
          defaultClientId={project.clientId}
          title={taskDialog === 'edit' ? 'Edit Task' : 'Add Task'}
        />
      )}
      {taskDialog === 'archive' && activeTask && (
        <ArchiveTaskDialog
          open onClose={() => { setTaskDialog(null); setActiveTask(null); }}
          onConfirm={() => archiveTask.mutate({ taskId: activeTask.id }, {
            onSuccess: () => { toast({ title: 'Task archived' }); setTaskDialog(null); setActiveTask(null); invalidateTasks(); },
            onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
          })}
          taskTitle={activeTask.title}
          isPending={archiveTask.isPending}
        />
      )}
      {taskDialog === 'restore' && activeTask && (
        <RestoreTaskDialog
          open onClose={() => { setTaskDialog(null); setActiveTask(null); }}
          onConfirm={(status) => restoreTask.mutate({ taskId: activeTask.id, data: { status } }, {
            onSuccess: () => { toast({ title: 'Task restored' }); setTaskDialog(null); setActiveTask(null); invalidateTasks(); },
            onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
          })}
          taskTitle={activeTask.title}
          isPending={restoreTask.isPending}
        />
      )}
      {taskDialog === 'delete' && activeTask && (
        <DeleteTaskDialog
          open onClose={() => { setTaskDialog(null); setActiveTask(null); }}
          onConfirm={() => deleteTask.mutate({ taskId: activeTask.id }, {
            onSuccess: () => { toast({ title: 'Task deleted' }); setTaskDialog(null); setActiveTask(null); invalidateTasks(); },
            onError: (e: any) => toast({ title: 'Error', description: e?.data?.error, variant: 'destructive' }),
          })}
          taskTitle={activeTask.title}
          isPending={deleteTask.isPending}
        />
      )}
    </div>
  );
}
