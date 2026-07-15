import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateClient, useUpdateClient, useGetClient, useCheckClientDuplicate,
  getListClientsQueryKey, getGetClientQueryKey,
  ClientRecord,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, Save, Eye } from 'lucide-react';
import { DuplicateWarningDialog } from '@/components/clients/confirm-dialogs';
import {
  CLIENT_STATUSES, BUSINESS_TYPES, CUSTOMER_MARKETS, COMPANY_SIZES,
  ANNUAL_REVENUE_RANGES, BUDGET_RANGES, getClientDisplayName,
} from '@/lib/client-constants';
import { useState } from 'react';

const clientFormSchema = z.object({
  contactFirstName: z.string().optional(),
  contactLastName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email('Must be a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  industry: z.string().optional(),
  businessType: z.string().optional(),
  customerMarket: z.string().optional(),
  companySize: z.string().optional(),
  annualRevenueRange: z.string().optional(),
  primaryLocation: z.string().optional(),
  currentTechnologyStack: z.string().optional(),
  primaryBusinessConcern: z.string().optional(),
  desiredOutcome: z.string().optional(),
  budgetRange: z.string().optional(),
  leadSource: z.string().optional(),
  status: z.string().default('prospect'),
  internalNotes: z.string().optional(),
}).refine((d) => d.contactFirstName?.trim() || d.companyName?.trim(), {
  message: 'Contact first name or company name is required.',
  path: ['contactFirstName'],
});

type FormValues = z.infer<typeof clientFormSchema>;

type FormField = {
  name: keyof FormValues;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  span?: 'half' | 'full';
};

function toNullable(v: string | undefined) {
  return v?.trim() || null;
}

interface ClientFormPageProps {
  clientId?: string; // undefined = create mode
}

export function ClientFormPage({ clientId }: ClientFormPageProps) {
  const isEditing = Boolean(clientId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existingClient, isLoading: isLoadingClient } = useGetClient(clientId!, {
    query: { enabled: isEditing, queryKey: getGetClientQueryKey(clientId ?? '') },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      contactFirstName: '', contactLastName: '', companyName: '',
      email: '', phone: '', website: '', industry: '', businessType: '',
      customerMarket: '', companySize: '', annualRevenueRange: '', primaryLocation: '',
      currentTechnologyStack: '', primaryBusinessConcern: '', desiredOutcome: '',
      budgetRange: '', leadSource: '', status: 'prospect', internalNotes: '',
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (existingClient) {
      form.reset({
        contactFirstName: existingClient.contactFirstName ?? '',
        contactLastName: existingClient.contactLastName ?? '',
        companyName: existingClient.companyName ?? '',
        email: existingClient.email ?? '',
        phone: existingClient.phone ?? '',
        website: existingClient.website ?? '',
        industry: existingClient.industry ?? '',
        businessType: existingClient.businessType ?? '',
        customerMarket: existingClient.customerMarket ?? '',
        companySize: existingClient.companySize ?? '',
        annualRevenueRange: existingClient.annualRevenueRange ?? '',
        primaryLocation: existingClient.primaryLocation ?? '',
        currentTechnologyStack: existingClient.currentTechnologyStack ?? '',
        primaryBusinessConcern: existingClient.primaryBusinessConcern ?? '',
        desiredOutcome: existingClient.desiredOutcome ?? '',
        budgetRange: existingClient.budgetRange ?? '',
        leadSource: existingClient.leadSource ?? '',
        status: existingClient.status ?? 'prospect',
        internalNotes: existingClient.internalNotes ?? '',
      });
    }
  }, [existingClient]);

  const [dupMatches, setDupMatches] = useState<ClientRecord[]>([]);
  const [showDupDialog, setShowDupDialog] = useState(false);
  const pendingSubmit = useRef<{ values: FormValues; navigate: 'list' | 'detail' } | null>(null);

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const checkDuplicate = useCheckClientDuplicate();

  const isSaving = createClient.isPending || updateClient.isPending;

  const doSave = (values: FormValues, navigate: 'list' | 'detail') => {
    const data = {
      contactFirstName: toNullable(values.contactFirstName),
      contactLastName: toNullable(values.contactLastName),
      companyName: toNullable(values.companyName),
      email: toNullable(values.email),
      phone: toNullable(values.phone),
      website: toNullable(values.website),
      industry: toNullable(values.industry),
      businessType: toNullable(values.businessType),
      customerMarket: toNullable(values.customerMarket),
      companySize: toNullable(values.companySize),
      annualRevenueRange: toNullable(values.annualRevenueRange),
      primaryLocation: toNullable(values.primaryLocation),
      currentTechnologyStack: toNullable(values.currentTechnologyStack),
      primaryBusinessConcern: toNullable(values.primaryBusinessConcern),
      desiredOutcome: toNullable(values.desiredOutcome),
      budgetRange: toNullable(values.budgetRange),
      leadSource: toNullable(values.leadSource),
      status: values.status ?? 'prospect',
      internalNotes: toNullable(values.internalNotes),
    };

    if (isEditing) {
      updateClient.mutate({ clientId: clientId!, data }, {
        onSuccess: (updated) => {
          toast({ title: 'Client updated', description: `${getClientDisplayName(updated)} was saved.` });
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId!) });
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          if (navigate === 'detail') setLocation(`/clients/${clientId}`);
          else setLocation('/clients');
        },
        onError: (err: any) => toast({ title: 'Save failed', description: err?.data?.error ?? 'Could not save client.', variant: 'destructive' }),
      });
    } else {
      createClient.mutate({ data }, {
        onSuccess: (created) => {
          toast({ title: 'Client created', description: `${getClientDisplayName(created)} was added.` });
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          if (navigate === 'detail') setLocation(`/clients/${created.id}`);
          else setLocation('/clients');
        },
        onError: (err: any) => toast({ title: 'Save failed', description: err?.data?.error ?? 'Could not create client.', variant: 'destructive' }),
      });
    }
  };

  const handleSubmit = (navigate: 'list' | 'detail') => {
    form.handleSubmit(async (values) => {
      // Only check duplicates on create
      if (!isEditing && (values.email?.trim() || values.companyName?.trim())) {
        const result = await checkDuplicate.mutateAsync({
          data: { email: toNullable(values.email), companyName: toNullable(values.companyName) },
        }).catch(() => ({ isDuplicate: false, matches: [] }));

        if (result.isDuplicate && result.matches.length > 0) {
          setDupMatches(result.matches);
          pendingSubmit.current = { values, navigate };
          setShowDupDialog(true);
          return;
        }
      }
      doSave(values, navigate);
    })();
  };

  // Unsaved changes guard
  const isDirty = form.formState.isDirty;
  const handleCancel = () => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    if (isEditing) setLocation(`/clients/${clientId}`);
    else setLocation('/clients');
  };

  if (isEditing && isLoadingClient) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isEditing && !existingClient) {
    return <div className="p-6 text-destructive text-sm font-medium">Client not found.</div>;
  }

  const NONE_VALUE = '__none__';

  const renderField = (f: FormField) => (
    <FormField
      key={f.name}
      control={form.control}
      name={f.name}
      render={({ field }) => (
        <FormItem className={f.span === 'full' ? 'sm:col-span-2' : ''}>
          <FormLabel>{f.label}</FormLabel>
          <FormControl>
            {f.type === 'textarea' ? (
              <Textarea {...field} value={field.value as string ?? ''} placeholder={f.placeholder} className="border-border/50 resize-y min-h-[80px]" />
            ) : f.type === 'select' && f.options ? (
              <Select
                value={(field.value as string) || NONE_VALUE}
                onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)}
              >
                <SelectTrigger className="border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>— Select —</SelectItem>
                  {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                {...field}
                value={field.value as string ?? ''}
                type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'url' ? 'url' : 'text'}
                placeholder={f.placeholder}
                className="border-border/50"
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{isEditing ? 'Edit Client' : 'Add Client'}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isEditing ? `Editing ${existingClient ? getClientDisplayName(existingClient) : '…'}` : 'Fill in the details below to add a new client.'}
          </p>
        </div>
      </div>

      <Form {...form}>
        <div className="space-y-6">

          {/* Contact Information */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Contact Information</CardTitle>
              <CardDescription>Primary contact details for this client.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderField({ name: 'contactFirstName', label: 'First Name', placeholder: 'Jane' })}
                {renderField({ name: 'contactLastName', label: 'Last Name', placeholder: 'Smith' })}
                {renderField({ name: 'email', label: 'Email Address', type: 'email', placeholder: 'jane@example.com' })}
                {renderField({ name: 'phone', label: 'Phone', type: 'tel', placeholder: '+1 (555) 000-0000' })}
              </div>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Company Information</CardTitle>
              <CardDescription>Details about the client's business.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderField({ name: 'companyName', label: 'Company Name', placeholder: 'Acme Corp', span: 'full' })}
                {renderField({ name: 'website', label: 'Website', type: 'url', placeholder: 'https://example.com' })}
                {renderField({ name: 'industry', label: 'Industry', placeholder: 'e.g. Healthcare, Marketing' })}
                {renderField({ name: 'businessType', label: 'Business Type', type: 'select', options: [...BUSINESS_TYPES] })}
                {renderField({ name: 'customerMarket', label: 'Customer Market', type: 'select', options: [...CUSTOMER_MARKETS] })}
                {renderField({ name: 'companySize', label: 'Company Size', type: 'select', options: [...COMPANY_SIZES] })}
                {renderField({ name: 'annualRevenueRange', label: 'Annual Revenue', type: 'select', options: [...ANNUAL_REVENUE_RANGES] })}
                {renderField({ name: 'primaryLocation', label: 'Primary Location', placeholder: 'City, State or Country' })}
              </div>
            </CardContent>
          </Card>

          {/* Business Context */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Business Context</CardTitle>
              <CardDescription>Engagement details and client background.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderField({ name: 'currentTechnologyStack', label: 'Current Technology Stack', type: 'textarea', placeholder: 'WordPress, Salesforce, Mailchimp…', span: 'full' })}
                {renderField({ name: 'primaryBusinessConcern', label: 'Primary Business Concern', type: 'textarea', placeholder: 'What is their biggest challenge?', span: 'full' })}
                {renderField({ name: 'desiredOutcome', label: 'Desired Outcome', type: 'textarea', placeholder: 'What do they want to achieve?', span: 'full' })}
                {renderField({ name: 'budgetRange', label: 'Budget Range', type: 'select', options: [...BUDGET_RANGES] })}
                {renderField({ name: 'leadSource', label: 'Lead Source', placeholder: 'e.g. Referral, Website, LinkedIn' })}
                {renderField({ name: 'status', label: 'Client Status', type: 'select', options: CLIENT_STATUSES.filter((s) => s.value !== 'archived').map((s) => ({ value: s.value, label: s.label })) })}
                {renderField({ name: 'internalNotes', label: 'Internal Notes', type: 'textarea', placeholder: 'Private notes visible only to the team…', span: 'full' })}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 py-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSubmit('list')}
                disabled={isSaving}
                className="flex-1 sm:flex-none gap-2"
              >
                {isSaving && createClient.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Client
              </Button>
              <Button
                type="button"
                onClick={() => handleSubmit('detail')}
                disabled={isSaving}
                className="flex-1 sm:flex-none gap-2"
              >
                {isSaving && updateClient.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Save & View
              </Button>
            </div>
          </div>
        </div>
      </Form>

      <DuplicateWarningDialog
        open={showDupDialog}
        matches={dupMatches}
        onProceed={() => {
          setShowDupDialog(false);
          if (pendingSubmit.current) {
            doSave(pendingSubmit.current.values, pendingSubmit.current.navigate);
            pendingSubmit.current = null;
          }
        }}
        onCancel={() => {
          setShowDupDialog(false);
          pendingSubmit.current = null;
        }}
      />
    </div>
  );
}
