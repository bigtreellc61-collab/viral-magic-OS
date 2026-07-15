import { useGetFoundationStatus, useGetClientMetrics } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Activity, Database, Key, ShieldCheck, Settings2, Code2, Loader2,
  Users, TrendingUp, UserCheck, Archive, CalendarPlus, ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link, useLocation } from 'wouter';
import { ClientStatusBadge } from '@/components/clients/status-badge';
import { getClientDisplayName } from '@/lib/client-constants';

export function DashboardPage() {
  const { data: status, isLoading: loadingStatus, error: statusError } = useGetFoundationStatus();
  const { data: metrics, isLoading: loadingMetrics } = useGetClientMetrics();
  const [, setLocation] = useLocation();

  const isLoading = loadingStatus;

  if (isLoading) {
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

  const clientMetricCards = [
    {
      label: 'Total Clients',
      value: metrics?.totalClients ?? '—',
      icon: Users,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      onClick: () => setLocation('/clients'),
    },
    {
      label: 'Active Clients',
      value: metrics?.activeClients ?? '—',
      icon: UserCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      onClick: () => setLocation('/clients?status=active'),
    },
    {
      label: 'Prospects',
      value: metrics?.prospects ?? '—',
      icon: TrendingUp,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      onClick: () => setLocation('/clients?status=prospect'),
    },
    {
      label: 'Archived',
      value: metrics?.archivedClients ?? '—',
      icon: Archive,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      onClick: () => setLocation('/clients?showArchived=true'),
    },
    {
      label: 'Added This Month',
      value: metrics?.addedThisMonth ?? '—',
      icon: CalendarPlus,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      onClick: () => setLocation('/clients'),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
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

      {/* Client Metrics */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold tracking-tight">Client Overview</h3>
          <Link href="/clients">
            <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {clientMetricCards.map((m) => (
            <button
              key={m.label}
              onClick={m.onClick}
              className="rounded-lg border border-border/50 bg-card/80 p-4 text-left hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
            >
              <div className={`inline-flex p-2 rounded-lg ${m.bg} mb-3`}>
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
              <p className="text-2xl font-bold group-hover:text-primary transition-colors">
                {loadingMetrics ? <span className="inline-block h-6 w-8 bg-muted/50 rounded animate-pulse" /> : m.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Clients + Client Activity */}
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
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors">View all</button>
              </Link>
            </div>
            <CardDescription>Five most recently added clients.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingMetrics ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : !metrics?.recentClients?.length ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <Users className="h-7 w-7 mb-2 opacity-20" />
                <p className="text-sm">No clients yet.</p>
                <Link href="/clients/new">
                  <button className="mt-2 text-xs text-primary hover:underline">Add your first client</button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {metrics.recentClients.map((c) => (
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

        {/* Recent Client Activity */}
        <Card className="border-border/50 shadow-md bg-card/80">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Recent Client Activity</CardTitle>
            </div>
            <CardDescription>Latest client events and changes.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[280px]">
              {loadingMetrics ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : !metrics?.recentActivity?.length ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <Activity className="h-7 w-7 mb-2 opacity-20" />
                  <p className="text-sm">No client activity yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {metrics.recentActivity.map((a) => (
                    <div key={a.id} className="p-4 hover:bg-muted/20 transition-colors flex gap-3">
                      <div className="mt-1.5 shrink-0">
                        <div className="h-2 w-2 rounded-full bg-primary/80 shadow-[0_0_6px_rgba(139,92,246,0.5)]" />
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
