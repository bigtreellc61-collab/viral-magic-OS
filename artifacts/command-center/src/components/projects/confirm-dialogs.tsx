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
import { Checkbox } from '@/components/ui/checkbox';
import { PROJECT_RESTORE_STATUSES } from '@/lib/project-constants';
import { AlertTriangle } from 'lucide-react';

// ─── Archive Project ─────────────────────────────────────────
interface ArchiveProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  projectName: string;
  isPending: boolean;
}

export function ArchiveProjectDialog({ open, onClose, onConfirm, projectName, isPending }: ArchiveProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle>Archive Project</DialogTitle>
          <DialogDescription>
            Archive <strong>{projectName}</strong>? It will be hidden from the default view but tasks will be preserved. You can restore it later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending} className="border-border/50">Cancel</Button>
          <Button variant="default" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Archiving…' : 'Archive Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Restore Project ─────────────────────────────────────────
interface RestoreProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (status: string, restoreTasks: boolean) => void;
  projectName: string;
  isPending: boolean;
}

export function RestoreProjectDialog({ open, onClose, onConfirm, projectName, isPending }: RestoreProjectDialogProps) {
  const [status, setStatus] = useState('planning');
  const [restoreTasks, setRestoreTasks] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle>Restore Project</DialogTitle>
          <DialogDescription>Restore <strong>{projectName}</strong> and set its status.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Restored Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_RESTORE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="restoreTasks"
              checked={restoreTasks}
              onCheckedChange={(c) => setRestoreTasks(c === true)}
            />
            <Label htmlFor="restoreTasks" className="text-sm cursor-pointer">Also restore archived tasks</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending} className="border-border/50">Cancel</Button>
          <Button onClick={() => onConfirm(status, restoreTasks)} disabled={isPending || !status}>
            {isPending ? 'Restoring…' : 'Restore Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Project ───────────────────────────────────────────
interface DeleteProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  projectName: string;
  isPending: boolean;
}

export function DeleteProjectDialog({ open, onClose, onConfirm, projectName, isPending }: DeleteProjectDialogProps) {
  const [confirm, setConfirm] = useState('');
  const isMatch = confirm.trim().toLowerCase() === projectName.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setConfirm(''); onClose(); } }}>
      <DialogContent className="sm:max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Permanently Delete Project
          </DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{projectName}</strong> and all its linked tasks. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Type the project name to confirm</Label>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={projectName}
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
