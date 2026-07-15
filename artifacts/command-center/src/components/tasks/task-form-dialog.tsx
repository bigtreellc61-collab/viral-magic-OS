import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useListProjects, useListClients, TaskRecord } from '@workspace/api-client-react';
import {
  TASK_CATEGORIES, TASK_STATUSES, PRIORITIES, EFFORT_OPTIONS,
} from '@/lib/project-constants';

export interface TaskFormValues {
  clientId: string;
  projectId: string | null;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  startDate: string;
  dueDate: string;
  estimatedEffort: string;
  notes: string;
}

interface TaskFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => void;
  isPending: boolean;
  defaultTask?: Partial<TaskRecord> | null;
  defaultProjectId?: string | null;
  defaultClientId?: string | null;
  title?: string;
}

const NONE_VALUE = '__none__';

export function TaskFormDialog({
  open, onClose, onSubmit, isPending,
  defaultTask, defaultProjectId, defaultClientId, title = 'Add Task',
}: TaskFormDialogProps) {
  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<TaskFormValues>({
    defaultValues: {
      clientId: defaultTask?.clientId ?? defaultClientId ?? '',
      projectId: defaultTask?.projectId ?? defaultProjectId ?? '',
      title: defaultTask?.title ?? '',
      description: defaultTask?.description ?? '',
      category: defaultTask?.category ?? 'development',
      priority: defaultTask?.priority ?? 'normal',
      status: defaultTask?.status ?? 'not_started',
      startDate: defaultTask?.startDate ?? '',
      dueDate: defaultTask?.dueDate ?? '',
      estimatedEffort: defaultTask?.estimatedEffort ?? '',
      notes: defaultTask?.notes ?? '',
    },
  });

  const watchClientId = watch('clientId');
  const watchProjectId = watch('projectId');
  const watchStatus = watch('status');

  const { data: clientsData } = useListClients(undefined, { query: { queryKey: ['listClients'] } });
  const clients = clientsData?.clients ?? [];

  const { data: projectsData } = useListProjects(
    watchClientId ? { clientId: watchClientId } : undefined,
    { query: { enabled: Boolean(watchClientId), queryKey: ['listProjects', watchClientId] } },
  );
  const projects = projectsData?.data ?? [];

  // When project changes, sync client
  useEffect(() => {
    if (watchProjectId && watchProjectId !== NONE_VALUE) {
      const proj = projects.find((p) => p.id === watchProjectId);
      if (proj && proj.clientId && proj.clientId !== watchClientId) {
        setValue('clientId', proj.clientId);
      }
    }
  }, [watchProjectId, projects, watchClientId, setValue]);

  useEffect(() => {
    if (open) {
      reset({
        clientId: defaultTask?.clientId ?? defaultClientId ?? '',
        projectId: defaultTask?.projectId ?? defaultProjectId ?? '',
        title: defaultTask?.title ?? '',
        description: defaultTask?.description ?? '',
        category: defaultTask?.category ?? 'development',
        priority: defaultTask?.priority ?? 'normal',
        status: defaultTask?.status ?? 'not_started',
        startDate: defaultTask?.startDate ?? '',
        dueDate: defaultTask?.dueDate ?? '',
        estimatedEffort: defaultTask?.estimatedEffort ?? '',
        notes: defaultTask?.notes ?? '',
      });
    }
  }, [open, defaultTask, defaultProjectId, defaultClientId, reset]);

  const handleFormSubmit = (values: TaskFormValues) => {
    onSubmit({
      ...values,
      projectId: values.projectId === NONE_VALUE || !values.projectId ? null : values.projectId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border-border/50">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client */}
            <div className="space-y-2">
              <Label>Client <span className="text-destructive">*</span></Label>
              <Controller
                name="clientId"
                control={control}
                rules={{ required: 'Client is required' }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={Boolean(defaultClientId && !defaultTask)}>
                    <SelectTrigger className="border-border/50">
                      <SelectValue placeholder="Select client…" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.companyName || [c.contactFirstName, c.contactLastName].filter(Boolean).join(' ') || c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
            </div>

            {/* Project */}
            <div className="space-y-2">
              <Label>Project</Label>
              <Controller
                name="projectId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? NONE_VALUE}
                    onValueChange={field.onChange}
                    disabled={Boolean(defaultProjectId && !defaultTask)}
                  >
                    <SelectTrigger className="border-border/50">
                      <SelectValue placeholder="Select project…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>No project</SelectItem>
                      {projects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Task Title <span className="text-destructive">*</span></Label>
            <Input
              {...register('title', { required: 'Title is required' })}
              placeholder="What needs to be done?"
              className="border-border/50"
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea {...register('description')} placeholder="Details…" rows={2} className="border-border/50 resize-none" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {/* Category */}
            <div className="space-y-2">
              <Label>Category <span className="text-destructive">*</span></Label>
              <Controller
                name="category"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.filter((s) => s.value !== 'archived').map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Start date */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" {...register('startDate')} className="border-border/50" />
            </div>

            {/* Due date */}
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" {...register('dueDate')} className="border-border/50" />
            </div>

            {/* Effort */}
            <div className="space-y-2">
              <Label>Estimated Effort</Label>
              <Controller
                name="estimatedEffort"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || NONE_VALUE} onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)}>
                    <SelectTrigger className="border-border/50"><SelectValue placeholder="Not estimated" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Not Estimated</SelectItem>
                      {EFFORT_OPTIONS.filter((e) => e.value !== 'not_estimated').map((e) => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...register('notes')} placeholder="Internal notes…" rows={2} className="border-border/50 resize-none" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="border-border/50">Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
