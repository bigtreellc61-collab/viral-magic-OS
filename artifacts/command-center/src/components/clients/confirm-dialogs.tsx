import { useState } from 'react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle } from 'lucide-react';
import { RESTORE_STATUSES } from '@/lib/client-constants';
import { ClientRecord } from '@workspace/api-client-react';

// ─── Archive Dialog ───────────────────────────────────────────

interface ArchiveDialogProps {
  open: boolean;
  client: ClientRecord | null;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function ArchiveClientDialog({ open, client, onConfirm, onCancel, isPending }: ArchiveDialogProps) {
  const displayName = client?.companyName || [client?.contactFirstName, client?.contactLastName].filter(Boolean).join(' ') || 'this client';
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent className="border-border/50">
        <AlertDialogHeader>
          <AlertDialogTitle>Archive Client</AlertDialogTitle>
          <AlertDialogDescription>
            Archive <strong className="text-foreground">"{displayName}"</strong>? They will be removed from the active client list but can be restored at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isPending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Archive Client
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Restore Dialog ───────────────────────────────────────────

interface RestoreDialogProps {
  open: boolean;
  client: ClientRecord | null;
  onConfirm: (status: string) => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function RestoreClientDialog({ open, client, onConfirm, onCancel, isPending }: RestoreDialogProps) {
  const [status, setStatus] = useState('prospect');
  const displayName = client?.companyName || [client?.contactFirstName, client?.contactLastName].filter(Boolean).join(' ') || 'this client';

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent className="border-border/50">
        <AlertDialogHeader>
          <AlertDialogTitle>Restore Client</AlertDialogTitle>
          <AlertDialogDescription>
            Restore <strong className="text-foreground">"{displayName}"</strong> to the active list. Select a status for the restored client.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="px-1 pb-2">
          <Label className="text-sm font-medium mb-2 block">Restored Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESTORE_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isPending}>Cancel</AlertDialogCancel>
          <Button onClick={() => onConfirm(status)} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Restore Client
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Permanent Delete Dialog ──────────────────────────────────

interface DeleteDialogProps {
  open: boolean;
  client: ClientRecord | null;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function DeleteClientDialog({ open, client, onConfirm, onCancel, isPending }: DeleteDialogProps) {
  const [typed, setTyped] = useState('');
  const displayName = client?.companyName || [client?.contactFirstName, client?.contactLastName].filter(Boolean).join(' ') || 'DELETE';
  const confirmText = displayName.toUpperCase() === 'DELETE' ? 'DELETE' : displayName;
  const isValid = typed.trim() === confirmText;

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) { setTyped(''); onCancel(); } }}>
      <AlertDialogContent className="border-destructive/30">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-destructive">Permanently Delete Client</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2">
            <span className="block">This will permanently remove <strong className="text-foreground">"{displayName}"</strong> and <strong className="text-foreground">all associated notes</strong>. This action cannot be undone.</span>
            <span className="block text-destructive/80 font-medium">Type <strong>{confirmText}</strong> below to confirm:</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="px-1 pb-2">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmText}
            className="border-destructive/30 focus-visible:ring-destructive/50 font-mono"
            disabled={isPending}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => { setTyped(''); onCancel(); }} disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!isValid || isPending}
            className="gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete Permanently
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Duplicate Warning Dialog ─────────────────────────────────

interface DuplicateWarningProps {
  open: boolean;
  matches: ClientRecord[];
  onProceed: () => void;
  onCancel: () => void;
}

export function DuplicateWarningDialog({ open, matches, onProceed, onCancel }: DuplicateWarningProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent className="border-yellow-500/30 max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-full bg-yellow-500/10">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <AlertDialogTitle className="text-yellow-500">Possible Duplicate</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            {matches.length} existing client{matches.length > 1 ? 's' : ''} may match. Review before continuing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-48 overflow-y-auto space-y-2 px-1 pb-2">
          {matches.map((m) => (
            <div key={m.id} className="rounded-lg border border-border/50 p-3 bg-muted/30 text-sm">
              <p className="font-semibold">
                {m.companyName || [m.contactFirstName, m.contactLastName].filter(Boolean).join(' ') || 'Unnamed'}
              </p>
              {m.email && <p className="text-muted-foreground text-xs">{m.email}</p>}
            </div>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <Button variant="outline" onClick={onProceed} className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10">
            Create Anyway
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
