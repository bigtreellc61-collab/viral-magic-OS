import { useGetFoundationStatus } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Database, Key, ShieldCheck, Settings2, Code2, Loader2, Info } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export function DashboardPage() {
  const { data: status, isLoading, error } = useGetFoundationStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="p-6 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 font-medium">
        Failed to load foundation status. Please check your connection.
      </div>
    );
  }

  const StatusIndicator = ({ active, label, description, icon: Icon }: any) => (
    <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card/50">
      <div className={`p-2 rounded-full mt-0.5 ${active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h4 className="font-semibold text-sm flex items-center gap-2">
          {label}
          <Badge variant="outline" className={active ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-red-500/30 text-red-500 bg-red-500/5'}>
            {active ? 'OPERATIONAL' : 'OFFLINE'}
          </Badge>
        </h4>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Dashboard</h2>
          <p className="text-muted-foreground mt-1 text-sm">Real-time overview of the Viral Magic OS foundation.</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 px-4 py-2 rounded-full border border-border/50">
          <Code2 className="h-4 w-4" />
          <span className="font-medium font-mono">{status.appVersion}</span>
          <span className="text-border mx-1">|</span>
          <span className="uppercase tracking-wider font-semibold text-[10px] text-primary">Phase {status.phase}</span>
        </div>
      </div>

      <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-5 flex items-start gap-4 shadow-sm">
        <div className="p-2 bg-secondary/20 rounded-full shrink-0">
          <Info className="h-5 w-5 text-secondary" />
        </div>
        <div>
          <h3 className="font-semibold text-secondary-foreground">Foundation Release Only</h3>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-4xl">
            You are currently viewing the Phase 1A foundation release. This phase establishes core authentication, 
            the application shell, and global settings. Business modules including clients, projects, diagnostics, 
            blueprints, and billing will arrive in subsequent phases.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusIndicator 
          active={status.databaseConnected} 
          label="Database Connection" 
          description="PostgreSQL connection pool status"
          icon={Database}
        />
        <StatusIndicator 
          active={status.authConfigured} 
          label="Authentication" 
          description="Session and cookie configuration"
          icon={Key}
        />
        <StatusIndicator 
          active={status.adminAccountExists} 
          label="Administrator" 
          description="Master account provisioning"
          icon={ShieldCheck}
        />
        <StatusIndicator 
          active={status.settingsConfigured} 
          label="System Settings" 
          description="Global application configuration"
          icon={Settings2}
        />
      </div>

      <Card className="border-border/50 shadow-md bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">System Activity Log</CardTitle>
          </div>
          <CardDescription>Recent actions and events across the platform.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            {status.recentActivity && status.recentActivity.length > 0 ? (
              <div className="divide-y divide-border/50">
                {status.recentActivity.map((activity) => (
                  <div key={activity.id} className="p-4 hover:bg-muted/30 transition-colors flex gap-4">
                    <div className="mt-0.5 shrink-0">
                      <div className="h-2 w-2 rounded-full bg-primary/80 shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{activity.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono text-[10px] uppercase bg-muted px-1.5 py-0.5 rounded text-muted-foreground/80 border border-border/50">
                          {activity.activityType}
                        </span>
                        {activity.actorName && (
                          <>
                            <span>•</span>
                            <span>{activity.actorName}</span>
                          </>
                        )}
                        <span>•</span>
                        <time dateTime={activity.createdAt}>
                          {format(new Date(activity.createdAt), 'MMM d, yyyy HH:mm:ss')}
                        </time>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Activity className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">No recent activity found.</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      
      <div className="text-right text-xs text-muted-foreground font-mono">
        Status generated at {format(new Date(status.generatedAt), 'HH:mm:ss')}
      </div>
    </div>
  );
}
