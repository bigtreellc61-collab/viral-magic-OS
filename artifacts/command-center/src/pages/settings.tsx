import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useGetSettings, useUpdateSettings, useUpdateAccount, useChangePassword, getGetSettingsQueryKey, getGetCurrentUserQueryKey, AuthUser } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Save, User, Building, Palette, Settings2, Shield, Key } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

const businessProfileSchema = z.object({
  businessName: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  businessEmail: z.string().email('Invalid email').nullable().optional().or(z.literal('')),
  businessPhone: z.string().nullable().optional(),
  website: z.string().url('Invalid URL').nullable().optional().or(z.literal('')),
  address: z.string().nullable().optional(),
});

const brandingSchema = z.object({
  appName: z.string().min(1, 'App name is required'),
  appSubtitle: z.string().nullable().optional(),
  logoUrl: z.string().url('Invalid URL').nullable().optional().or(z.literal('')),
  primaryAccentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color').optional(),
  secondaryAccentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color').optional(),
});

const projectDefaultsSchema = z.object({
  defaultCurrency: z.string().min(1, 'Currency is required'),
  defaultTimezone: z.string().min(1, 'Timezone is required'),
  defaultProjectStatus: z.string().min(1, 'Status is required'),
  defaultTaskPriority: z.string().min(1, 'Priority is required'),
  defaultEstimatedTimelineDays: z.coerce.number().min(1, 'Must be at least 1 day'),
  defaultProjectOwnerName: z.string().nullable().optional(),
});

const accountSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(10, 'New password must be at least 10 characters'),
  confirmPassword: z.string().min(10, 'Confirm password is required'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export function SettingsPage({ user }: { user: AuthUser }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const updateAccount = useUpdateAccount();
  const changePassword = useChangePassword();

  const businessForm = useForm<z.infer<typeof businessProfileSchema>>({
    resolver: zodResolver(businessProfileSchema),
    values: {
      businessName: settings?.businessName || '',
      ownerName: settings?.ownerName || '',
      businessEmail: settings?.businessEmail || '',
      businessPhone: settings?.businessPhone || '',
      website: settings?.website || '',
      address: settings?.address || '',
    },
  });

  const brandingForm = useForm<z.infer<typeof brandingSchema>>({
    resolver: zodResolver(brandingSchema),
    values: {
      appName: settings?.appName || 'Viral Magic OS',
      appSubtitle: settings?.appSubtitle || '',
      logoUrl: settings?.logoUrl || '',
      primaryAccentColor: settings?.primaryAccentColor || '#8b5cf6',
      secondaryAccentColor: settings?.secondaryAccentColor || '#3b82f6',
    },
  });

  const defaultsForm = useForm<z.infer<typeof projectDefaultsSchema>>({
    resolver: zodResolver(projectDefaultsSchema),
    values: {
      defaultCurrency: settings?.defaultCurrency || 'USD',
      defaultTimezone: settings?.defaultTimezone || 'UTC',
      defaultProjectStatus: settings?.defaultProjectStatus || 'Draft',
      defaultTaskPriority: settings?.defaultTaskPriority || 'Medium',
      defaultEstimatedTimelineDays: settings?.defaultEstimatedTimelineDays || 30,
      defaultProjectOwnerName: settings?.defaultProjectOwnerName || '',
    },
  });

  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    values: {
      fullName: user.fullName,
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSettingsSubmit = (values: any) => {
    updateSettings.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Settings Updated", description: "Changes saved successfully." });
      },
      onError: (err: any) => {
        // ApiError carries the real backend message at `err.data.error`.
        toast({ title: "Update Failed", description: err?.data?.error || "Failed to save settings.", variant: "destructive" });
      }
    });
  };

  const onAccountSubmit = (values: z.infer<typeof accountSchema>) => {
    updateAccount.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        toast({ title: "Profile Updated", description: "Your profile has been updated." });
      },
      onError: (err: any) => {
        toast({ title: "Update Failed", description: err?.data?.error || "Failed to update profile.", variant: "destructive" });
      }
    });
  };

  const onPasswordSubmit = (values: z.infer<typeof passwordSchema>) => {
    changePassword.mutate({ data: { currentPassword: values.currentPassword, newPassword: values.newPassword } }, {
      onSuccess: () => {
        toast({ title: "Password Changed", description: "Your password has been updated and other sessions invalidated." });
        passwordForm.reset();
      },
      onError: (err: any) => {
        toast({ title: "Update Failed", description: err?.data?.error || "Failed to change password.", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
        <p className="text-muted-foreground mt-1 text-sm">Manage application configuration, defaults, and your administrator profile.</p>
      </div>

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="bg-card border border-border/50 h-auto p-1 grid grid-cols-2 md:grid-cols-4 w-full lg:w-[600px]">
          <TabsTrigger value="business" className="py-2.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Building className="h-4 w-4 mr-2" /> Business</TabsTrigger>
          <TabsTrigger value="branding" className="py-2.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Palette className="h-4 w-4 mr-2" /> Branding</TabsTrigger>
          <TabsTrigger value="defaults" className="py-2.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Settings2 className="h-4 w-4 mr-2" /> Defaults</TabsTrigger>
          <TabsTrigger value="account" className="py-2.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><User className="h-4 w-4 mr-2" /> Account</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="focus-visible:outline-none">
          <Card className="border-border/50 shadow-md">
            <CardHeader className="border-b border-border/50 bg-muted/10">
              <CardTitle>Business Profile</CardTitle>
              <CardDescription>Public-facing details for reports and invoices.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...businessForm}>
                <form onSubmit={businessForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={businessForm.control} name="businessName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Name</FormLabel>
                        <FormControl><Input placeholder="Acme Software" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={businessForm.control} name="ownerName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Owner Name</FormLabel>
                        <FormControl><Input placeholder="Jane Doe" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={businessForm.control} name="businessEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Email</FormLabel>
                        <FormControl><Input type="email" placeholder="contact@example.com" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={businessForm.control} name="businessPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Phone</FormLabel>
                        <FormControl><Input type="tel" placeholder="+1 (555) 000-0000" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={businessForm.control} name="website" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website URL</FormLabel>
                        <FormControl><Input type="url" placeholder="https://example.com" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={businessForm.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Physical Address</FormLabel>
                      <FormControl><Input placeholder="123 Main St, City, Country" {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={updateSettings.isPending} className="min-w-[120px]">
                      {updateSettings.isPending && businessForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Profile
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="focus-visible:outline-none">
          <Card className="border-border/50 shadow-md">
            <CardHeader className="border-b border-border/50 bg-muted/10">
              <CardTitle>Platform Branding</CardTitle>
              <CardDescription>Customize the appearance of your installation.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...brandingForm}>
                <form onSubmit={brandingForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={brandingForm.control} name="appName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Application Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={brandingForm.control} name="appSubtitle" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Application Subtitle</FormLabel>
                        <FormControl><Input placeholder="Command Center" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={brandingForm.control} name="primaryAccentColor" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Accent Color (Hex)</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input {...field} />
                            <div className="w-10 h-10 rounded border border-border shrink-0" style={{ backgroundColor: field.value }} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={brandingForm.control} name="secondaryAccentColor" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Accent Color (Hex)</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input {...field} />
                            <div className="w-10 h-10 rounded border border-border shrink-0" style={{ backgroundColor: field.value }} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={brandingForm.control} name="logoUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl><Input placeholder="https://example.com/logo.png" {...field} value={field.value || ''} /></FormControl>
                      <FormDescription>Must be a publicly accessible image URL.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={updateSettings.isPending} className="min-w-[120px]">
                      {updateSettings.isPending && brandingForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Branding
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defaults" className="focus-visible:outline-none">
          <Card className="border-border/50 shadow-md">
            <CardHeader className="border-b border-border/50 bg-muted/10">
              <CardTitle>Project Defaults</CardTitle>
              <CardDescription>Default values applied to new projects and tasks.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...defaultsForm}>
                <form onSubmit={defaultsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={defaultsForm.control} name="defaultCurrency" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Currency</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={defaultsForm.control} name="defaultTimezone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Timezone</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={defaultsForm.control} name="defaultProjectStatus" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Project Status</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={defaultsForm.control} name="defaultTaskPriority" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Task Priority</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={defaultsForm.control} name="defaultEstimatedTimelineDays" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Timeline (Days)</FormLabel>
                        <FormControl><Input type="number" min="1" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={defaultsForm.control} name="defaultProjectOwnerName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Project Owner</FormLabel>
                        <FormControl><Input placeholder="Leave blank to use creator" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={updateSettings.isPending} className="min-w-[120px]">
                      {updateSettings.isPending && defaultsForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Defaults
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="focus-visible:outline-none space-y-6">
          <Card className="border-border/50 shadow-md">
            <CardHeader className="border-b border-border/50 bg-muted/10">
              <CardTitle>Administrator Profile</CardTitle>
              <CardDescription>Update your personal account details.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...accountForm}>
                <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-6 max-w-xl">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <FormLabel>Email Address</FormLabel>
                      <Input value={user.email} disabled className="bg-muted/50 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1 mt-1">
                        <Shield className="h-3 w-3" /> Master Administrator
                      </p>
                    </div>
                    <FormField control={accountForm.control} name="fullName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <Button type="submit" disabled={updateAccount.isPending}>
                    {updateAccount.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Update Profile
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="border-border/50 border-destructive/20 shadow-md">
            <CardHeader className="border-b border-border/50 bg-destructive/5">
              <CardTitle className="text-destructive flex items-center gap-2">
                <Key className="h-5 w-5" /> Security
              </CardTitle>
              <CardDescription>Update your master password. This will invalidate all other active sessions.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6 max-w-xl">
                  <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormDescription>Must be at least 10 characters long.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" variant="destructive" disabled={changePassword.isPending}>
                    {changePassword.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Change Password
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
