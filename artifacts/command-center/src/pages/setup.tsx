import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCompleteSetup, getGetSetupStatusQueryKey, getGetCurrentUserQueryKey } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Hexagon, Loader2 } from 'lucide-react';

const setupSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(10, 'Password must be at least 10 characters'),
  confirmPassword: z.string().min(10, 'Confirm password is required'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export function SetupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const completeSetup = useCompleteSetup();

  const form = useForm<z.infer<typeof setupSchema>>({
    resolver: zodResolver(setupSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  function onSubmit(values: z.infer<typeof setupSchema>) {
    completeSetup.mutate(
      { data: { email: values.email, fullName: values.fullName, password: values.password } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSetupStatusQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          toast({ title: "Setup Complete", description: "Administrator account created successfully." });
          setLocation('/');
        },
        onError: (err: any) => {
          toast({ 
            title: "Setup Failed", 
            description: err?.error || "Could not complete setup. Please try again.", 
            variant: "destructive" 
          });
        }
      }
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4 sm:p-8 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="flex aspect-square size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_0_30px_rgba(139,92,246,0.4)]">
            <Hexagon className="size-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Viral Magic OS</h1>
            <p className="text-xs font-semibold text-primary uppercase tracking-[0.2em] mt-2">Foundation Setup</p>
          </div>
        </div>

        <Card className="border-border/40 shadow-2xl bg-card/80 backdrop-blur-xl">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-xl">System Initialization</CardTitle>
            <CardDescription className="text-sm">
              Create the master administrator account. This is a one-time process for Phase 1A deployment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Full Name</FormLabel>
                      <FormControl>
                        <Input className="bg-background/50 focus-visible:ring-primary/50" placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Email Address</FormLabel>
                      <FormControl>
                        <Input className="bg-background/50 focus-visible:ring-primary/50" type="email" placeholder="admin@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Master Password</FormLabel>
                      <FormControl>
                        <Input className="bg-background/50 focus-visible:ring-primary/50" type="password" placeholder="••••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Confirm Password</FormLabel>
                      <FormControl>
                        <Input className="bg-background/50 focus-visible:ring-primary/50" type="password" placeholder="••••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  size="lg"
                  className="w-full mt-8 font-semibold tracking-wide transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)]" 
                  disabled={completeSetup.isPending}
                >
                  {completeSetup.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  INITIALIZE SYSTEM
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
