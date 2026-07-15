import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useForm, Controller } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetProject, useCreateProject, useUpdateProject, useListClients,
  getGetProjectQueryKey, getListProjectsQueryKey,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import {
  PROJECT_TYPES, PROJECT_STATUSES, PRIORITIES, PLATFORMS,
} from '@/lib/project-constants';

interface FormValues {
  clientId: string;
  projectName: string;
  projectType: string;
  projectDescription: string;
  businessProblem: string;
  desiredBusinessOutcome: string;
  recommendedSolution: string;
  selectedPlatform: string;
  projectStatus: string;
  priority: string;
  estimatedProjectValue: string;
  estimatedMonthlyRecurringRevenue: string;
  startDate: string;
  targetCompletionDate: string;
  projectOwner: string;
  internalNotes: string;
}

interface ProjectFormPageProps { projectId?: string; defaultClientId?: string; }

const NONE_VALUE = '__none__';

export function ProjectFormPage({ projectId, defaultClientId }: ProjectFormPageProps) {
  const isEdit = Boolean(projectId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saveAndView, setSaveAndView] = useState(false);

  const { data: project, isLoading: isLoadingProject } = useGetProject(projectId!, {
    query: { enabled: isEdit, queryKey: getGetProjectQueryKey(projectId!) },
  });

  const { data: clientsData } = useListClients(undefined, { query: { queryKey: ['listClients'] } });
  const clients = clientsData?.clients ?? [];

  const { register, handleSubmit, control, watch, reset, formState: { errors, isDirty } } = useForm<FormValues>({
    defaultValues: {
      clientId: defaultClientId ?? '',
      projectName: '',
      projectType: 'website',
      projectDescription: '',
      businessProblem: '',
      desiredBusinessOutcome: '',
      recommendedSolution: '',
      selectedPlatform: 'not_yet_determined',
      projectStatus: 'discovery',
      priority: 'normal',
      estimatedProjectValue: '',
      estimatedMonthlyRecurringRevenue: '',
      startDate: '',
      targetCompletionDate: '',
      projectOwner: '',
      internalNotes: '',
    },
  });

  useEffect(() => {
    if (project) {
      reset({
        clientId: project.clientId ?? '',
        projectName: project.projectName ?? '',
        projectType: project.projectType ?? 'website',
        projectDescription: project.projectDescription ?? '',
        businessProblem: project.businessProblem ?? '',
        desiredBusinessOutcome: project.desiredBusinessOutcome ?? '',
        recommendedSolution: project.recommendedSolution ?? '',
        selectedPlatform: project.selectedPlatform ?? 'not_yet_determined',
        projectStatus: project.projectStatus ?? 'discovery',
        priority: project.priority ?? 'normal',
        estimatedProjectValue: project.estimatedProjectValue ?? '',
        estimatedMonthlyRecurringRevenue: project.estimatedMonthlyRecurringRevenue ?? '',
        startDate: project.startDate ?? '',
        targetCompletionDate: project.targetCompletionDate ?? '',
        projectOwner: project.projectOwner ?? '',
        internalNotes: project.internalNotes ?? '',
      });
    }
  }, [project, reset]);

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const isSubmitting = createProject.isPending || updateProject.isPending;

  const onSubmit = (values: FormValues, andView: boolean) => {
    const payload = {
      clientId: values.clientId,
      projectName: values.projectName,
      projectType: values.projectType,
      projectDescription: values.projectDescription || null,
      businessProblem: values.businessProblem || null,
      desiredBusinessOutcome: values.desiredBusinessOutcome || null,
      recommendedSolution: values.recommendedSolution || null,
      selectedPlatform: values.selectedPlatform === NONE_VALUE ? null : values.selectedPlatform || null,
      projectStatus: values.projectStatus,
      priority: values.priority,
      estimatedProjectValue: values.estimatedProjectValue ? parseFloat(values.estimatedProjectValue) : null,
      estimatedMonthlyRecurringRevenue: values.estimatedMonthlyRecurringRevenue ? parseFloat(values.estimatedMonthlyRecurringRevenue) : null,
      startDate: values.startDate || null,
      targetCompletionDate: values.targetCompletionDate || null,
      projectOwner: values.projectOwner || null,
      internalNotes: values.internalNotes || null,
    };

    if (isEdit && projectId) {
      updateProject.mutate({ projectId, data: payload }, {
        onSuccess: (_updated) => {
          toast({ title: 'Project saved' });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          if (andView) setLocation(`/projects/${projectId}`);
          else setLocation('/projects');
        },
        onError: (err: any) => toast({ title: 'Error', description: err?.data?.error ?? 'Failed to save.', variant: 'destructive' }),
      });
    } else {
      createProject.mutate({ data: payload }, {
        onSuccess: (created: any) => {
          toast({ title: 'Project created' });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          if (andView) setLocation(`/projects/${created.id}`);
          else setLocation('/projects');
        },
        onError: (err: any) => toast({ title: 'Error', description: err?.data?.error ?? 'Failed to create.', variant: 'destructive' }),
      });
    }
  };

  if (isEdit && isLoadingProject) {
    return <div className="flex items-center justify-center h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Button variant="ghost" size="sm" onClick={() => setLocation(isEdit ? `/projects/${projectId}` : '/projects')} className="gap-2 -ml-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> {isEdit ? 'Back to Project' : 'Back to Projects'}
      </Button>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">{isEdit ? 'Edit Project' : 'Add Project'}</h2>
        <p className="text-muted-foreground text-sm mt-1">{isEdit ? 'Update project details.' : 'Create a new project linked to a client.'}</p>
      </div>

      <form onSubmit={handleSubmit((v) => onSubmit(v, saveAndView))} className="space-y-6">
        {/* Section 1: Client and Project */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Client &amp; Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client <span className="text-destructive">*</span></Label>
                <Controller
                  name="clientId"
                  control={control}
                  rules={{ required: 'Client is required' }}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={Boolean(defaultClientId && !isEdit)}>
                      <SelectTrigger className="border-border/50">
                        <SelectValue placeholder="Select client…" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.companyName || [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ') || 'Unnamed'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Project Name <span className="text-destructive">*</span></Label>
                <Input
                  {...register('projectName', { required: 'Project name is required', minLength: { value: 1, message: 'Required' } })}
                  placeholder="My Project"
                  className="border-border/50"
                />
                {errors.projectName && <p className="text-xs text-destructive">{errors.projectName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Project Type <span className="text-destructive">*</span></Label>
                <Controller
                  name="projectType"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="border-border/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROJECT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Project Description</Label>
              <Textarea {...register('projectDescription')} placeholder="What is this project?" rows={3} className="border-border/50 resize-none" />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Business Context */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Business Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Business Problem</Label>
              <Textarea {...register('businessProblem')} placeholder="What problem is this solving?" rows={2} className="border-border/50 resize-none" />
            </div>
            <div className="space-y-2">
              <Label>Desired Business Outcome</Label>
              <Textarea {...register('desiredBusinessOutcome')} placeholder="What does success look like?" rows={2} className="border-border/50 resize-none" />
            </div>
            <div className="space-y-2">
              <Label>Recommended Solution</Label>
              <Textarea {...register('recommendedSolution')} placeholder="What approach is recommended?" rows={2} className="border-border/50 resize-none" />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Planning */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Planning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Controller
                  name="selectedPlatform"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || NONE_VALUE} onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)}>
                      <SelectTrigger className="border-border/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Not Yet Determined</SelectItem>
                        {PLATFORMS.filter((p) => p.value !== 'not_yet_determined').map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Status <span className="text-destructive">*</span></Label>
                <Controller
                  name="projectStatus"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="border-border/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROJECT_STATUSES.filter((s) => s.value !== 'archived').map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Priority <span className="text-destructive">*</span></Label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="border-border/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Est. Project Value ($)</Label>
                <Input type="number" min="0" step="0.01" {...register('estimatedProjectValue')} placeholder="0.00" className="border-border/50" />
              </div>

              <div className="space-y-2">
                <Label>Est. Monthly Recurring ($)</Label>
                <Input type="number" min="0" step="0.01" {...register('estimatedMonthlyRecurringRevenue')} placeholder="0.00" className="border-border/50" />
              </div>

              <div className="space-y-2">
                <Label>Project Owner</Label>
                <Input {...register('projectOwner')} placeholder="Owner name" className="border-border/50" />
              </div>

              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" {...register('startDate')} className="border-border/50" />
              </div>

              <div className="space-y-2">
                <Label>Target Completion</Label>
                <Input type="date" {...register('targetCompletionDate')} className="border-border/50" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea {...register('internalNotes')} placeholder="Internal notes for this project…" rows={3} className="border-border/50 resize-none" />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => setLocation(isEdit ? `/projects/${projectId}` : '/projects')} disabled={isSubmitting} className="border-border/50">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => setSaveAndView(false)}
            className="gap-2 border-border/50"
          >
            <Save className="h-4 w-4" />
            {isSubmitting && !saveAndView ? 'Saving…' : 'Save Project'}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            onClick={() => setSaveAndView(true)}
          >
            {isSubmitting && saveAndView ? 'Saving…' : 'Save & View'}
          </Button>
        </div>
      </form>
    </div>
  );
}
