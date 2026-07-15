import { useState } from 'react';
import { Link } from 'wouter';
import { MoreHorizontal, Archive, RotateCcw, Trash2, Pencil, ExternalLink } from 'lucide-react';
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
import { ProjectStatusBadge } from './status-badge';
import { PriorityBadge } from './priority-badge';
import { ProjectProgressBar } from './progress-bar';
import {
  PROJECT_KANBAN_COLUMNS, PROJECT_STATUSES, getPriorityLabel,
  getProjectStatusLabel, isOverdue,
} from '@/lib/project-constants';
import { format } from 'date-fns';

interface ProjectCardData {
  id: string;
  projectName: string;
  projectStatus: string;
  priority: string;
  projectType: string;
  targetCompletionDate?: string | null;
  clientName?: string | null;
  archivedAt?: string | null;
}

interface ProjectKanbanBoardProps {
  projects: ProjectCardData[];
  progressMap?: Record<string, { percentage: number; completed: number; open: number; blocked: number; total: number; overdue: number }>;
  onStatusChange: (projectId: string, newStatus: string) => void;
  onArchive: (project: ProjectCardData) => void;
  onRestore: (project: ProjectCardData) => void;
  onDelete: (project: ProjectCardData) => void;
}

export function ProjectKanbanBoard({
  projects, progressMap = {}, onStatusChange, onArchive, onRestore, onDelete,
}: ProjectKanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
      {PROJECT_KANBAN_COLUMNS.map((colStatus) => {
        const colProjects = projects.filter((p) => p.projectStatus === colStatus);
        const label = getProjectStatusLabel(colStatus);
        return (
          <div key={colStatus} className="flex-shrink-0 w-72">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 h-4 border-border/50 text-muted-foreground">
                  {colProjects.length}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              {colProjects.map((project) => {
                const prog = progressMap[project.id];
                const overdue = isOverdue(project.targetCompletionDate, project.projectStatus);
                return (
                  <Card key={project.id} className="border-border/50 bg-card hover:border-primary/30 transition-colors">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/projects/${project.id}`}>
                          <span className="text-sm font-medium hover:text-primary transition-colors cursor-pointer line-clamp-2 leading-snug">
                            {project.projectName}
                          </span>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-border/50">
                            <DropdownMenuItem asChild>
                              <Link href={`/projects/${project.id}`} className="flex items-center gap-2 cursor-pointer">
                                <ExternalLink className="h-4 w-4" /> View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/projects/${project.id}/edit`} className="flex items-center gap-2 cursor-pointer">
                                <Pencil className="h-4 w-4" /> Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {project.archivedAt ? (
                              <>
                                <DropdownMenuItem onClick={() => onRestore(project)} className="gap-2">
                                  <RotateCcw className="h-4 w-4" /> Restore
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(project)} className="gap-2 text-destructive focus:text-destructive">
                                  <Trash2 className="h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={() => onArchive(project)} className="gap-2">
                                <Archive className="h-4 w-4" /> Archive
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {project.clientName && (
                        <p className="text-[11px] text-muted-foreground truncate">{project.clientName}</p>
                      )}

                      <div className="flex flex-wrap gap-1">
                        <PriorityBadge priority={project.priority} />
                      </div>

                      {prog && prog.total > 0 && (
                        <ProjectProgressBar {...prog} compact />
                      )}

                      {project.targetCompletionDate && (
                        <p className={`text-[11px] ${overdue ? 'text-red-400' : 'text-muted-foreground'}`}>
                          {overdue ? '⚠ Overdue · ' : 'Due '}{format(new Date(project.targetCompletionDate + 'T00:00:00'), 'MMM d, yyyy')}
                        </p>
                      )}

                      {/* Inline status changer */}
                      <div className="pt-1">
                        <Select value={colStatus} onValueChange={(v) => onStatusChange(project.id, v)}>
                          <SelectTrigger className="h-6 text-[10px] border-border/30 bg-muted/30 px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROJECT_STATUSES.filter((s) => s.value !== 'archived').map((s) => (
                              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {colProjects.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/40 bg-muted/20 p-4 text-center text-xs text-muted-foreground/60">
                  No projects
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
