import { useGetFoundationStatus, useGetClientMetrics, useGetDashboardProjects } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Activity, Database, Key, ShieldCheck, Settings2, Code2, Loader2,
  Users, UserCheck, FolderOpen, CheckSquare, AlertTriangle, Calendar,
  ArrowRight, TrendingUp, Clock, CheckCircle2,
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
import { getProjectTypeLabel, PROJECT_STATUS_COLORS } from '@/lib/project-constants';

export function DashboardPage() {
  const { data: status, isLoading: loadingStatus, error: statusError } = useGetFoundationStatus();
  const { data: clientMetrics, isLoading: loadingClientMetrics } = useGetClientMetrics();
  const { data: projectData, isLoading: loadingProjectData } = useGetDashboardProjects();
  const [, setLocation] = useLocation();

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

  const primaryMetrics = [
    {
      label: 'Active Clients',
      value: clientMetrics?.activeClients ?? '—',
      icon: UserCheck,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      onClick: () => setLocation('/clients?status=active'),
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
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      onClick: () => setLocation('/tasks?status=not_started'),
    },
    {
      label: 'Overdue Tasks',
      value: tasks?.overdue ?? '—',
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      onClick: () => setLocation('/tasks?dueDate=overdue'),
    },
    {
      label: 'Completed Projects',
      value: proj?.completed ?? '—',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      onClick: () => setLocation('/projects?status=completed'),
    },
    {
      label: 'Due This Week',
      value: proj?.dueSoon ?? '—',
      icon: Calendar,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      onClick: () => setLocation('/projects'),
    },
  ];

  const pipeline: { status: string; count: number }[] = proj?.pipeline ?? [];
  const ACTIVE_STATUSES = ["discovery", "diagnostic", "planning", "approved", "building", "testing", "client_review"];
  const pipelineActive = pipeline.filter((p) => ACTIVE_STATUSES.includes(p.status));
  const maxCount = Math.max(...pipelineActive.map((p) => p.count), 1);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Dashboard</h2>
          <p className="text-muted-foreground mt-1 text-sm">Real-time overview of Viral Magic OS.</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 px-4 py-2 rounded-full border border-border/50">
          <Code2 className="h-4 w-4" />
          <span className="font-medium font-mono">{status.appVersion}</span>
          <span className="text-border mx-1">|</span>
          <span className="uppercase tracking-wider font-semibold text-[10px] text-primary">{status.phase}</span>
        </div>
      </div>

      {/* Primary Metrics */}
      <div>
        <h3 className="text-base font-semibold tracking-tight mb-4">Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {primaryMetrics.map((m) => (
            <button
              key={m.label}
              onClick={m.onClick}
              className="rounded-xl border border-border/50 bg-card/80 p-4 text-left hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
            >
              <div className={`inline-flex p-2 rounded-lg ${m.bg} mb-3`}>
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
              <p className="text-2xl font-bold group-hover:text-primary transition-colors">
                {(loadingClientMetrics || loadingProjectData)
                  ? <span className="inline-block h-6 w-8 bg-muted/50 rounded animate-pulse" />
                  : m.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{m.label}</p>
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

      {/* System Status (collapsed) */}
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors list-none py-2">
          <span className="font-medium uppercase tracking-wider text-[10px]">System Status</span>
          <span className="text-[10px] text-muted-foreground/60">Phase 1A Foundation</span>
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
