import { useState, useEffect } from 'react';
import { useGetFoundationStatus, useGetClientMetrics, useGetDashboardProjects, useGetDashboardDiagnostics, useGetDashboardGrowthAssessments } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Activity, Database, Key, ShieldCheck, Settings2, Code2, Loader2,
  Users, FolderOpen, CheckSquare, AlertTriangle,
  ArrowRight, TrendingUp, Clock, CheckCircle2, Stethoscope, Star, ShieldAlert,
  Lightbulb,
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link, useLocation } from 'wouter';
import { ClientStatusBadge } from '@/components/clients/status-badge';
import { ProjectStatusBadge } from '@/components/projects/status-badge';
import { PriorityBadge } from '@/components/projects/priority-badge';
import { DueDateBadge } from '@/components/ui/due-date-badge';
import { getClientDisplayName } from '@/lib/client-constants';
import { PROJECT_STATUS_COLORS } from '@/lib/project-constants';
import { PLAN_STATUS_LABELS, PLAN_STATUS_COLORS } from '@/lib/solution-recommendation-constants';

export function DashboardPage() {
  const { data: status, isLoading: loadingStatus, error: statusError } = useGetFoundationStatus();
  const { data: clientMetrics, isLoading: loadingClientMetrics } = useGetClientMetrics();
  const { data: projectData, isLoading: loadingProjectData } = useGetDashboardProjects();
  const { data: diagData, isLoading: loadingDiagnostics } = useGetDashboardDiagnostics();
  const { data: assessmentData, isLoading: loadingAssessments } = useGetDashboardGrowthAssessments();
  const [, setLocation] = useLocation();

  // Solution Recommendations dashboard data
  const [recData, setRecData] = useState<any>(null);
  const [loadingRecs, setLoadingRecs] = useState(true);
  useEffect(() => {
    fetch('/api/solution-recommendations/dashboard', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setRecData(d))
      .catch(() => setRecData(null))
      .finally(() => setLoadingRecs(false));
  }, []);

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (statusError || !status) {
    return (
      <div className="p-6 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 font-medium">
        Failed to load dashboard. Please check your connection.
      </div>
    );
  }

  const proj = projectData?.projects as any;
  const tasks = projectData?.tasks as any;
  const recentActivity = (projectData?.recentActivity ?? []) as any[];

  // Compute a simple business health indicator from recent diagnostics
  const scoredDiags = ((diagData as any)?.recentDiagnostics ?? []).filter((d: any) => d.overallHealthScore != null);
  const avgHealthScore = scoredDiags.length
    ? Math.round(scoredDiags.reduce((s: number, d: any) => s + Number(d.overallHealthScore), 0) / scoredDiags.length)
    : null;

  const primaryMetrics = [
    {
      label: 'Business Health',
      value: avgHealthScore != null ? `${avgHealthScore}` : '—',
      suffix: avgHealthScore != null ? '/100' : undefined,
      icon: TrendingUp,
      color: avgHealthScore == null ? 'text-muted-foreground' : avgHealthScore >= 70 ? 'text-emerald-400' : avgHealthScore >= 50 ? 'text-amber-400' : 'text-red-400',
      bg: avgHealthScore == null ? 'bg-muted/30' : avgHealthScore >= 70 ? 'bg-emerald-500/10' : avgHealthScore >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10',
      onClick: () => setLocation('/diagnostics'),
    },
    {
      label: 'Diagnostics',
      value: (diagData as any)?.total ?? '—',
      icon: Stethoscope,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      onClick: () => setLocation('/diagnostics'),
    },
    {
      label: 'Critical Bottlenecks',
      value: (diagData as any)?.criticalBottlenecks ?? '—',
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      onClick: () => setLocation('/diagnostics'),
    },
    {
      label: 'Awaiting Review',
      value: (diagData as any)?.awaitingReview ?? '—',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      onClick: () => setLocation('/diagnostics'),
    },
    {
      label: 'Active Projects',
      value: proj?.active ?? '—',
      icon: FolderOpen,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      onClick: () => setLocation('/projects'),
    },
    {
      label: 'Open Tasks',
      value: tasks?.open ?? '—',
      icon: CheckSquare,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      onClick: () => setLocation('/tasks?status=not_started'),
    },
  ];

  const pipeline: { status: string; count: number }[] = proj?.pipeline ?? [];
  const ACTIVE_STATUSES = ["discovery", "diagnostic", "planning", "approved", "building", "testing", "client_review"];
  const pipelineActive = pipeline.filter((p) => ACTIVE_STATUSES.includes(p.status));
  const maxCount = Math.max(...pipelineActive.map((p) => p.count), 1);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Executive Dashboard</h2>
          <p className="text-muted-foreground mt-1 text-sm">Real-time overview · Viral Magic OS™</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border/50 shrink-0">
          <Code2 className="h-3.5 w-3.5" />
          <span className="font-mono font-medium">{status.appVersion}</span>
          <span className="text-border">|</span>
          <span className="uppercase tracking-wider font-semibold text-[10px] text-primary">{status.phase}</span>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div>
        <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">Key Performance Indicators</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {primaryMetrics.map((m) => (
            <button
              key={m.label}
              onClick={m.onClick}
              className="rounded-xl border border-border/50 bg-card/80 p-4 text-left hover:border-primary/30 hover:bg-card hover:shadow-md transition-all duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`${m.label}: ${m.value}`}
            >
              <div className={`inline-flex p-2 rounded-lg ${m.bg} mb-3`}>
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
              <p className={`text-2xl font-bold tabular-nums group-hover:text-primary transition-colors ${m.color}`}>
                {(loadingClientMetrics || loadingProjectData || loadingDiagnostics)
                  ? <span className="inline-block h-6 w-10 bg-muted/50 rounded animate-pulse" />
                  : <>{m.value}{m.suffix && <span className="text-sm text-muted-foreground font-normal ml-0.5">{m.suffix}</span>}</>}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{m.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Project Pipeline + Tasks Due This Week */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Pipeline */}
        <Card className="border-border/50 shadow-md bg-card/80">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Project Pipeline</CardTitle>
              </div>
              <Link href="/projects">
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
            <CardDescription>Active projects by status.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {loadingProjectData ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : pipelineActive.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">No active projects.</div>
            ) : (
              <div className="space-y-3">
                {pipelineActive.map((item) => {
                  const colors = PROJECT_STATUS_COLORS[item.status] ?? { dot: 'bg-muted-foreground', text: 'text-muted-foreground', bg: '' };
                  const pct = Math.round((item.count / maxCount) * 100);
                  return (
                    <Link key={item.status} href={`/projects?status=${item.status}`}>
                      <div className="group flex items-center gap-3 cursor-pointer hover:bg-muted/20 rounded-lg p-2 -mx-2 transition-colors">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${colors.dot}`} />
                        <span className="text-xs text-muted-foreground w-[100px] shrink-0 capitalize">
                          {item.status.replace(/_/g, ' ')}
                        </span>
                        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${colors.dot}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-bold tabular-nums w-5 text-right">{item.count}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks Due This Week */}
        <Card className="border-border/50 shadow-md bg-card/80">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Tasks Due This Week</CardTitle>
              </div>
              <Link href="/tasks?dueDate=this_week">
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
            <CardDescription>Tasks due in the next 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[200px]">
              {loadingProjectData ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : !tasks?.tasksDueThisWeek?.length ? (
                <div className="py-8 text-center text-muted-foreground text-sm">No tasks due this week.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {tasks.tasksDueThisWeek.map((t: any) => (
                    <Link key={t.id} href="/tasks">
                      <div className="px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate flex-1">{t.title}</p>
                          <DueDateBadge dueDate={t.dueDate} status={t.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.projectName ?? t.clientName ?? '—'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects + Overdue Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card className="border-border/50 shadow-md bg-card/80">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Recent Projects</CardTitle>
              </div>
              <Link href="/projects">
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
            <CardDescription>Five most recently updated projects.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingProjectData ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : !proj?.recentProjects?.length ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No projects yet.
                <Link href="/projects/new">
                  <button className="block mx-auto mt-2 text-xs text-primary hover:underline">Create first project</button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {proj.recentProjects.map((p: any) => (
                  <Link key={p.id} href={`/projects/${p.id}`}>
                    <div className="px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.projectName}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.clientName ?? '—'}</p>
                        </div>
                        <ProjectStatusBadge status={p.projectStatus} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Tasks */}
        <Card className="border-border/50 shadow-md bg-card/80">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <CardTitle className="text-base text-red-400">Overdue Tasks</CardTitle>
              </div>
              <Link href="/tasks?dueDate=overdue">
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
            <CardDescription>Tasks past their due date.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[200px]">
              {loadingProjectData ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : !tasks?.overdueTasks?.length ? (
                <div className="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span>No overdue tasks!</span>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {tasks.overdueTasks.map((t: any) => (
                    <Link key={t.id} href="/tasks?dueDate=overdue">
                      <div className="px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{t.title}</p>
                            <p className="text-xs text-muted-foreground">{t.projectName ?? t.clientName ?? '—'}</p>
                          </div>
                          <PriorityBadge priority={t.priority} />
                        </div>
                        <p className="text-xs text-red-400 mt-1">
                          Due {t.dueDate ? format(new Date(t.dueDate + 'T00:00:00'), 'MMM d, yyyy') : '—'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent Clients + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Clients */}
        <Card className="border-border/50 shadow-md bg-card/80">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Recent Clients</CardTitle>
              </div>
              <Link href="/clients">
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
            <CardDescription>Five most recently added clients.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingClientMetrics ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : !clientMetrics?.recentClients?.length ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No clients yet.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {clientMetrics.recentClients.map((c) => (
                  <Link key={c.id} href={`/clients/${c.id}`}>
                    <div className="px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{getClientDisplayName(c)}</p>
                        {c.industry && <p className="text-xs text-muted-foreground truncate">{c.industry}</p>}
                      </div>
                      <ClientStatusBadge status={c.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/50 shadow-md bg-card/80">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </div>
            <CardDescription>Latest project, task, and client events.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[250px]">
              {loadingProjectData ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : !recentActivity.length ? (
                <div className="py-8 text-center text-muted-foreground text-sm">No activity yet.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recentActivity.map((a: any) => (
                    <div key={a.id} className="p-4 hover:bg-muted/20 transition-colors flex gap-3">
                      <div className="mt-1.5 shrink-0">
                        <div className={`h-2 w-2 rounded-full shadow-sm ${
                          a.activityType?.startsWith('PROJECT') ? 'bg-blue-400' :
                          a.activityType?.startsWith('TASK') ? 'bg-amber-400' :
                          'bg-violet-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{a.description}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span className="font-mono text-[10px] uppercase bg-muted px-1 py-0.5 rounded border border-border/50">{a.activityType}</span>
                          <span>•</span>
                          <time>{format(new Date(a.createdAt), 'MMM d, HH:mm')}</time>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Diagnostics — Bottlenecks + Awaiting Review */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
            <Stethoscope className="h-3.5 w-3.5" />
            Diagnostics
          </h3>
          <Link href="/diagnostics">
            <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Bottlenecks */}
          <Card className="border-border/50 shadow-md bg-card/80">
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-3 pt-4 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <CardTitle className="text-sm font-semibold text-red-400">Top Bottlenecks</CardTitle>
                </div>
                {(diagData as any)?.criticalBottlenecks > 0 && (
                  <span className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-full font-medium">
                    {(diagData as any).criticalBottlenecks} critical
                  </span>
                )}
              </div>
              <CardDescription className="text-xs mt-1">Highest priority unresolved issues across all diagnostics.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingDiagnostics ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : !(diagData as any)?.topBottlenecks?.length ? (
                <div className="py-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  <span className="font-medium text-emerald-400">No critical bottlenecks</span>
                  <span className="text-xs">All issues are resolved or low severity.</span>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {(diagData as any).topBottlenecks.slice(0, 5).map((b: any, i: number) => (
                    <Link key={b.scoreId ?? b.id} href={`/diagnostics/${b.diagnosticId}`}>
                      <div className="px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer">
                        <div className="flex items-start gap-2 mb-1">
                          <span className="text-xs text-muted-foreground/60 tabular-nums w-4 shrink-0 mt-0.5 font-mono">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{(b.categoryLabel ?? b.categoryKey)?.replace(/_/g, ' ')}</span>
                              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                                b.severity === 'critical' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                                b.severity === 'high' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                                'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}>{b.severity}</span>
                              {b.priorityScore != null && (
                                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">P: {Number(b.priorityScore).toFixed(0)}</span>
                              )}
                            </div>
                            {b.recommendedFirstAction && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.recommendedFirstAction}</p>
                            )}
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground/60">
                              <span className="truncate">{b.clientName ?? '—'}</span>
                              {b.diagnosticName && <><span>·</span><span className="truncate">{b.diagnosticName}</span></>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Awaiting Review */}
          <Card className="border-border/50 shadow-md bg-card/80">
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-3 pt-4 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <CardTitle className="text-sm font-semibold text-amber-400">Awaiting Review</CardTitle>
                </div>
                {(diagData as any)?.awaitingReview > 0 && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-medium">
                    {(diagData as any).awaitingReview} pending
                  </span>
                )}
              </div>
              <CardDescription className="text-xs mt-1">Diagnostics completed and pending approval.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingDiagnostics ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : !(diagData as any)?.awaitingReviewList?.length ? (
                <div className="py-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  <span className="font-medium text-emerald-400">All reviews complete</span>
                  <span className="text-xs">No diagnostics are pending review.</span>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {(diagData as any).awaitingReviewList.slice(0, 5).map((d: any) => (
                    <Link key={d.id} href={`/diagnostics/${d.id}`}>
                      <div className="px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{d.diagnosticName}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              <span className="truncate">{d.clientName ?? '—'}</span>
                              {d.currentVersionNumber && <><span>·</span><span>v{d.currentVersionNumber}</span></>}
                            </div>
                          </div>
                          {d.overallHealthScore != null ? (
                            <div className="shrink-0 text-right">
                              <span className={`text-sm font-bold tabular-nums ${
                                Number(d.overallHealthScore) >= 70 ? 'text-emerald-400' :
                                Number(d.overallHealthScore) >= 50 ? 'text-amber-400' : 'text-red-400'
                              }`}>{Math.round(Number(d.overallHealthScore))}</span>
                              <span className="text-xs text-muted-foreground">/100</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground shrink-0">No score</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Growth Assessment Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Growth Assessments</h3>
          <Link href="/diagnostics">
            <button className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
              View Diagnostics <ArrowRight className="h-3 w-3" />
            </button>
          </Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assessment metrics */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setLocation('/diagnostics')}
              className="rounded-xl border border-border/50 bg-card/80 p-4 text-left hover:border-primary/30 hover:bg-card hover:shadow-md transition-all duration-200 group"
            >
              <div className="inline-flex p-2 rounded-lg bg-yellow-500/10 mb-3">
                <Clock className="h-4 w-4 text-yellow-400" />
              </div>
              <p className="text-2xl font-bold tabular-nums text-yellow-400">
                {loadingAssessments ? <span className="inline-block h-6 w-8 bg-muted/50 rounded animate-pulse" /> : ((assessmentData as any)?.awaitingReview ?? '—')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Awaiting Review</p>
            </button>
            <button
              onClick={() => setLocation('/diagnostics')}
              className="rounded-xl border border-border/50 bg-card/80 p-4 text-left hover:border-primary/30 hover:bg-card hover:shadow-md transition-all duration-200 group"
            >
              <div className="inline-flex p-2 rounded-lg bg-emerald-500/10 mb-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold tabular-nums text-emerald-400">
                {loadingAssessments ? <span className="inline-block h-6 w-8 bg-muted/50 rounded animate-pulse" /> : ((assessmentData as any)?.approved ?? '—')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Approved</p>
            </button>
            <button
              onClick={() => setLocation('/diagnostics')}
              className="rounded-xl border border-border/50 bg-card/80 p-4 text-left hover:border-primary/30 hover:bg-card hover:shadow-md transition-all duration-200 group"
            >
              <div className="inline-flex p-2 rounded-lg bg-orange-500/10 mb-3">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
              </div>
              <p className="text-2xl font-bold tabular-nums text-orange-400">
                {loadingAssessments ? <span className="inline-block h-6 w-8 bg-muted/50 rounded animate-pulse" /> : ((assessmentData as any)?.atRiskClients?.length ?? '—')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">At-Risk Clients</p>
            </button>
            <button
              onClick={() => setLocation('/diagnostics')}
              className="rounded-xl border border-border/50 bg-card/80 p-4 text-left hover:border-primary/30 hover:bg-card hover:shadow-md transition-all duration-200 group"
            >
              <div className="inline-flex p-2 rounded-lg bg-red-500/10 mb-3">
                <ShieldAlert className="h-4 w-4 text-red-400" />
              </div>
              <p className="text-2xl font-bold tabular-nums text-red-400">
                {loadingAssessments ? <span className="inline-block h-6 w-8 bg-muted/50 rounded animate-pulse" /> : ((assessmentData as any)?.criticalClients?.length ?? '—')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Critical Clients</p>
            </button>
          </div>

          {/* Recent Assessments */}
          <Card className="border-border/50 shadow-md bg-card/80 lg:col-span-2">
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-3 pt-4 px-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-400" />
                <CardTitle className="text-sm font-semibold text-indigo-400">Recent Growth Assessments</CardTitle>
              </div>
              <CardDescription className="text-xs mt-1">Latest assessments across all clients.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingAssessments ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : !(assessmentData as any)?.recentAssessments?.length ? (
                <div className="py-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <Star className="h-6 w-6 opacity-30" />
                  <span>No assessments yet. Generate one from a completed diagnostic.</span>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {((assessmentData as any).recentAssessments as any[]).slice(0, 6).map((a: any) => (
                    <div key={a.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.diagnosticName ?? 'Assessment'}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span className="truncate">{a.clientName ?? '—'}</span>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {a.healthScore != null && (
                            <span className={`text-sm font-bold tabular-nums ${
                              Number(a.healthScore) >= 70 ? 'text-emerald-400' :
                              Number(a.healthScore) >= 50 ? 'text-amber-400' : 'text-red-400'
                            }`}>{Math.round(Number(a.healthScore))}</span>
                          )}
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                            a.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                            a.status === 'awaiting_review' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                            'bg-slate-700/50 text-slate-400 border-slate-600/50'
                          }`}>{a.status === 'awaiting_review' ? 'Review' : a.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Solution Recommendations Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-indigo-400" />
            Solution Recommendations
          </h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Counts */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Draft', value: recData?.draft, color: 'text-slate-300', bg: 'bg-slate-700/40' },
              { label: 'Awaiting Review', value: recData?.awaitingReview, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
              { label: 'Approved', value: recData?.approved, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => setLocation('/clients')}
                className="rounded-xl border border-border/50 bg-card/80 p-4 text-left hover:border-primary/30 hover:bg-card transition-all duration-200"
              >
                <div className={`inline-flex p-2 rounded-lg ${item.bg} mb-3`}>
                  <Lightbulb className={`h-4 w-4 ${item.color}`} />
                </div>
                <p className={`text-2xl font-bold tabular-nums ${item.color}`}>
                  {loadingRecs
                    ? <span className="inline-block h-6 w-8 bg-muted/50 rounded animate-pulse" />
                    : (item.value ?? '—')}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-tight">{item.label}</p>
              </button>
            ))}
          </div>

          {/* Critical + Recent Plans */}
          <Card className="border-border/50 shadow-md bg-card/80 lg:col-span-2">
            <CardHeader className="border-b border-border/50 bg-muted/20 pb-3 pt-4 px-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-indigo-400" />
                <CardTitle className="text-sm font-semibold text-indigo-400">Recent Recommendation Plans</CardTitle>
              </div>
              <CardDescription className="text-xs mt-1">Latest solution recommendation plans across all clients.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingRecs ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : !recData?.recentPlans?.length ? (
                <div className="py-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <Lightbulb className="h-6 w-6 opacity-30" />
                  <span>No recommendation plans yet. Generate one from an approved Growth Assessment.</span>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recData.recentPlans.map((plan: any) => (
                    <Link key={plan.id} href={`/solution-recommendations/${plan.id}`}>
                      <div className="px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{plan.diagnosticName ?? 'Recommendation Plan'}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              <span className="truncate">{plan.clientName ?? '—'}</span>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            {plan.overallPriorityScore != null && (
                              <span className={`text-sm font-bold tabular-nums ${
                                Number(plan.overallPriorityScore) >= 80 ? 'text-red-400' :
                                Number(plan.overallPriorityScore) >= 65 ? 'text-orange-400' : 'text-slate-400'
                              }`}>{Number(plan.overallPriorityScore).toFixed(0)}</span>
                            )}
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                              PLAN_STATUS_COLORS[plan.status] ?? 'text-slate-400 border-slate-600 bg-slate-700/50'
                            }`}>{PLAN_STATUS_LABELS[plan.status] ?? plan.status}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* System Status (collapsed) */}
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors list-none py-2">
          <span className="font-medium uppercase tracking-wider text-[10px]">System Status</span>
          <span className="text-[10px] text-muted-foreground/60">Phase 1E — Growth Assessment</span>
          <span className="ml-auto text-[10px] text-muted-foreground group-open:hidden">▼ Show</span>
          <span className="ml-auto text-[10px] text-muted-foreground hidden group-open:inline">▲ Hide</span>
        </summary>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { active: status.databaseConnected, label: 'Database Connection', desc: 'PostgreSQL connection pool', icon: Database },
            { active: status.authConfigured, label: 'Authentication', desc: 'Session and cookie config', icon: Key },
            { active: status.adminAccountExists, label: 'Administrator', desc: 'Master account provisioned', icon: ShieldCheck },
            { active: status.settingsConfigured, label: 'System Settings', desc: 'Global configuration', icon: Settings2 },
          ].map(({ active, label, desc, icon: Icon }) => (
            <div key={label} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
              <div className={`p-1.5 rounded-full ${active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  {label}
                  <Badge variant="outline" className={`text-[9px] uppercase tracking-wider ${active ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-red-500/30 text-red-500'}`}>
                    {active ? 'OK' : 'OFFLINE'}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-right text-xs text-muted-foreground font-mono mt-3">
          Status at {format(new Date(status.generatedAt), 'HH:mm:ss')}
        </p>
      </details>
    </div>
  );
}
