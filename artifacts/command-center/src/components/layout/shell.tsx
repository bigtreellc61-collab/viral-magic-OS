import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Settings, LogOut, Hexagon, Users, FolderOpen, CheckSquare, Stethoscope } from 'lucide-react';
import { useLogout, AuthUser } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { href: '/',             label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/clients',      label: 'Clients',    icon: Users },
  { href: '/projects',     label: 'Projects',   icon: FolderOpen },
  { href: '/tasks',        label: 'Tasks',      icon: CheckSquare },
  { href: '/diagnostics',  label: 'Diagnostics', icon: Stethoscope },
  { href: '/settings',     label: 'Settings',   icon: Settings },
];

function isActive(location: string, href: string) {
  if (href === '/') return location === '/';
  return location === href || location.startsWith(href + '/') || location.startsWith(href + '?');
}

function getPageTitle(location: string) {
  if (location === '/') return 'Dashboard';
  if (location.startsWith('/clients/') && location.endsWith('/edit')) return 'Edit Client';
  if (location.startsWith('/clients/new')) return 'Add Client';
  if (location.startsWith('/clients/')) return 'Client Detail';
  if (location.startsWith('/clients')) return 'Clients';
  if (location.startsWith('/projects/') && location.endsWith('/edit')) return 'Edit Project';
  if (location.startsWith('/projects/new')) return 'Add Project';
  if (location.startsWith('/projects/')) return 'Project Detail';
  if (location.startsWith('/projects')) return 'Projects';
  if (location.startsWith('/tasks')) return 'Tasks';
  if (location.startsWith('/diagnostics/') && location.endsWith('/compare')) return 'Compare Versions';
  if (location.startsWith('/diagnostics/new')) return 'New Diagnostic';
  if (location.startsWith('/diagnostics/')) return 'Diagnostic Detail';
  if (location.startsWith('/diagnostics')) return 'Diagnostics';
  if (location.startsWith('/settings')) return 'Settings';
  return 'Command Center';
}

export function Shell({ children, user }: { children: React.ReactNode; user: AuthUser }) {
  const [location] = useLocation();
  const logout = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = '/login';
      },
    });
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'AD';

  return (
    <SidebarProvider>
      <div className="flex min-h-[100dvh] w-full bg-background">
        <Sidebar className="border-r border-border bg-sidebar">
          <SidebarHeader className="px-4 py-4">
            <div className="flex items-center gap-2 px-2">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                <Hexagon className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold text-sidebar-foreground tracking-tight">Viral Magic OS</span>
                <span className="text-[10px] text-sidebar-foreground/70 uppercase tracking-widest font-medium">Command Center</span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-4">
            <SidebarMenu>
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={isActive(location, href)}>
                    <Link href={href}>
                      <Icon className="size-4" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-4">
            <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/40 p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-medium border border-border/50">
              <span>Phase 1D Release</span>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4 sm:px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-foreground transition-colors" />
              <h1 className="text-lg font-semibold tracking-tight">{getPageTitle(location)}</h1>
            </div>

            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-border/50 hover:border-primary/50 transition-colors">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{getInitials(user.fullName)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 border-border/50 shadow-xl" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal p-3">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.fullName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mt-2">{user.roleName}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer py-2.5">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span className="font-medium">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
