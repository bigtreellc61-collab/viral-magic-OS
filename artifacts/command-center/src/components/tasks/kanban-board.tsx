import { Link } from 'wouter';
import { MoreHorizontal, Archive, RotateCcw, Trash2, Pencil, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TaskStatusBadge } from './status-badge';
import { PriorityBadge } from '@/components/projects/priority-badge';
import { DueDateBadge } from '@/components/ui/due-date-badge';
import { TASK_KANBAN_COLUMNS, TASK_STATUSES, getTaskStatusLabel } from '@/lib/project-constants';

interface TaskCardData {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  dueDate?: string | null;
  projectName?: string | null;
  clientName?: string | null;
  projectId?: string | null;
  archivedAt?: string | null;
}

interface TaskKanbanBoardProps {
  tasks: TaskCardData[];
  onStatusChange: (taskId: string, newStatus: string) => void;
  onEdit: (task: TaskCardData) => void;
  onArchive: (task: TaskCardData) => void;
  onRestore: (task: TaskCardData) => void;
  onDelete: (task: TaskCardData) => void;
  onComplete: (task: TaskCardData) => void;
}

export function TaskKanbanBoard({
  tasks, onStatusChange, onEdit, onArchive, onRestore, onDelete, onComplete,
}: TaskKanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
      {TASK_KANBAN_COLUMNS.map((colStatus) => {
        const colTasks = tasks.filter((t) => t.status === colStatus);
        return (
          <div key={colStatus} className="flex-shrink-0 w-64">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-sm font-medium">{getTaskStatusLabel(colStatus)}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 h-4 border-border/50 text-muted-foreground">
                {colTasks.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {colTasks.map((task) => (
                <Card key={task.id} className="border-border/50 bg-card hover:border-primary/30 transition-colors">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-sm font-medium line-clamp-2 leading-snug flex-1">{task.title}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-border/50">
                          <DropdownMenuItem onClick={() => onEdit(task)} className="gap-2">
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          {task.status !== 'completed' && (
                            <DropdownMenuItem onClick={() => onComplete(task)} className="gap-2 text-emerald-400 focus:text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" /> Complete
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {task.archivedAt ? (
                            <>
                              <DropdownMenuItem onClick={() => onRestore(task)} className="gap-2">
                                <RotateCcw className="h-4 w-4" /> Restore
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDelete(task)} className="gap-2 text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem onClick={() => onArchive(task)} className="gap-2">
                              <Archive className="h-4 w-4" /> Archive
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {task.projectName && (
                      <p className="text-[11px] text-muted-foreground truncate">{task.projectName}</p>
                    )}
                    {task.clientName && !task.projectName && (
                      <p className="text-[11px] text-muted-foreground truncate">{task.clientName}</p>
                    )}

                    <div className="flex flex-wrap gap-1">
                      <PriorityBadge priority={task.priority} />
                    </div>

                    {task.dueDate && (
                      <DueDateBadge dueDate={task.dueDate} status={task.status} />
                    )}

                    <div className="pt-1">
                      <Select value={colStatus} onValueChange={(v) => onStatusChange(task.id, v)}>
                        <SelectTrigger className="h-6 text-[10px] border-border/30 bg-muted/30 px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_STATUSES.filter((s) => s.value !== 'archived').map((s) => (
                            <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {colTasks.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/40 bg-muted/20 p-4 text-center text-xs text-muted-foreground/60">
                  Empty
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
