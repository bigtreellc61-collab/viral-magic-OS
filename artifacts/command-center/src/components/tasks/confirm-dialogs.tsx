import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TASK_RESTORE_STATUSES } from '@/lib/project-constants';
import { AlertTriangle } from 'lucide-react';

// ─── Archive Task ────────────────────────────────────────────
interface ArchiveTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  taskTitle: string;
  isPending: boolean;
}

export function ArchiveTaskDialog({ open, onClose, onConfirm, taskTitle, isPending }: ArchiveTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle>Archive Task</DialogTitle>
          <DialogDescription>
            Archive <strong>{taskTitle}</strong>? It will be hidden from default views and can be restored later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending} className="border-border/50">Cancel</Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Archiving…' : 'Archive Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Restore Task ─────────────────────────────────────────────
interface RestoreTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (status: string) => void;
  taskTitle: string;
  isPending: boolean;
}

export function RestoreTaskDialog({ open, onClose, onConfirm, taskTitle, isPending }: RestoreTaskDialogProps) {
  const [status, setStatus] = useState('not_started');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle>Restore Task</DialogTitle>
          <DialogDescription>Restore <strong>{taskTitle}</strong> and set its status.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Restored Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_RESTORE_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending} className="border-border/50">Cancel</Button>
          <Button onClick={() => onConfirm(status)} disabled={!status || isPending}>
            {isPending ? 'Restoring…' : 'Restore Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Task ──────────────────────────────────────────────
interface DeleteTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  taskTitle: string;
  isPending: boolean;
}

export function DeleteTaskDialog({ open, onClose, onConfirm, taskTitle, isPending }: DeleteTaskDialogProps) {
  const [confirm, setConfirm] = useState('');
  const isMatch = confirm.trim().toLowerCase() === taskTitle.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setConfirm(''); onClose(); } }}>
      <DialogContent className="sm:max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Permanently Delete Task
          </DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{taskTitle}</strong>. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Type the task title to confirm</Label>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={taskTitle}
            className="border-border/50"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending} className="border-border/50">Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!isMatch || isPending}>
            {isPending ? 'Deleting…' : 'Delete Permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
