import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetClient, useListClientNotes, useListClientActivity,
  useArchiveClient, useRestoreClient, useDeleteClient,
  useCreateClientNote, useUpdateClientNote, useToggleClientNotePin,
  useArchiveClientNote, useRestoreClientNote, useDeleteClientNote,
  getGetClientQueryKey, getListClientNotesQueryKey, getListClientsQueryKey,
  getListClientActivityQueryKey,
  ClientRecord, ClientNoteRecord,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft, Pencil, Archive, RotateCcw, Trash2, Plus, Pin, PinOff,
  Mail, Phone, Globe, Copy, Check, Loader2, MoreHorizontal, ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { ClientStatusBadge } from '@/components/clients/status-badge';
import { NoteEditor } from '@/components/clients/note-editor';
import { ActivityTimeline } from '@/components/clients/activity-timeline';
import { ArchiveClientDialog, RestoreClientDialog, DeleteClientDialog } from '@/components/clients/confirm-dialogs';
import {
  getClientDisplayName, getBusinessTypeLabel, getCustomerMarketLabel,
  getCompanySizeLabel, getRevenueLabel, getBudgetLabel, getNoteTypeLabel,
} from '@/lib/client-constants';

interface ClientDetailPageProps { clientId: string; }

type Tab = 'overview' | 'notes' | 'activity';

export function ClientDetailPage({ clientId }: ClientDetailPageProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [showArchived, setShowArchived] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ClientNoteRecord | null>(null);
  const [actionType, setActionType] = useState<'archive' | 'restore' | 'delete' | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: client, isLoading, error } = useGetClient(clientId);
  const { data: notes = [], isLoading: notesLoading } = useListClientNotes(clientId, { showArchived });
  const { data: activity = [], isLoading: activityLoading } = useListClientActivity(clientId, undefined, {
    query: { enabled: tab === 'activity', queryKey: getListClientActivityQueryKey(clientId) },
  });

  const archiveClient = useArchiveClient();
  const restoreClient = useRestoreClient();
  const deleteClient = useDeleteClient();
  const createNote = useCreateClientNote();
  const updateNote = useUpdateClientNote();
  const pinNote = useToggleClientNotePin();
  const archiveNote = useArchiveClientNote();
  const restoreNote = useRestoreClientNote();
  const deleteNote = useDeleteClientNote();

  const invalidateClient = () => queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
  const invalidateNotes = () => queryClient.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });

  const copy = (value: string, field: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  const doArchive = () => {
    if (!client) return;
    archiveClient.mutate({ clientId }, {
      onSuccess: () => {
        toast({ title: 'Client archived' });
        setActionType(null);
        invalidateClient(); invalidateList();
      },
      onError: (err: any) => toast({ title: 'Error', description: err?.data?.error ?? 'Could not archive.', variant: 'destructive' }),
    });
  };
  const doRestore = (status: string) => {
    restoreClient.mutate({ clientId, data: { status } }, {
      onSuccess: () => {
        toast({ title: 'Client restored' });
        setActionType(null);
        invalidateClient(); invalidateList();
      },
      onError: (err: any) => toast({ title: 'Error', description: err?.data?.error ?? 'Could not restore.', variant: 'destructive' }),
    });
  };
  const doDelete = () => {
    deleteClient.mutate({ clientId }, {
      onSuccess: () => {
        toast({ title: 'Client deleted permanently' });
        setLocation('/clients');
        invalidateList();
      },
      onError: (err: any) => toast({ title: 'Error', description: err?.data?.error ?? 'Could not delete.', variant: 'destructive' }),
    });
  };

  const saveNote = (values: { noteType: string; title: string; body: string }) => {
    if (editingNote) {
      updateNote.mutate({ clientId, noteId: editingNote.id, data: values }, {
        onSuccess: () => {
          toast({ title: 'Note updated' });
          setNoteDialogOpen(false);
          setEditingNote(null);
          invalidateNotes();
        },
        onError: (err: any) => toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }),
      });
    } else {
      createNote.mutate({ clientId, data: values }, {
        onSuccess: () => {
          toast({ title: 'Note added' });
          setNoteDialogOpen(false);
          invalidateNotes();
        },
        onError: (err: any) => toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }),
      });
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error || !client) return <div className="p-6 text-destructive text-sm">Client not found.</div>;

  const displayName = getClientDisplayName(client);
  const isArchived = Boolean(client.archivedAt);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'notes', label: `Notes${notes.length ? ` (${notes.length})` : ''}` },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => setLocation('/clients')} className="gap-2 -ml-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight">{displayName}</h2>
            <ClientStatusBadge status={client.status} />
            {isArchived && <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">Archived</Badge>}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {client.contactFirstName && client.companyName && (
              <span>{[client.contactFirstName, client.contactLastName].filter(Boolean).join(' ')}</span>
            )}
            {client.industry && <span>{client.industry}</span>}
            {client.customerMarket && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border/50">
                {getCustomerMarketLabel(client.customerMarket)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button variant="outline" size="sm" onClick={() => { setNoteDialogOpen(true); setEditingNote(null); }} className="gap-2 border-border/50">
            <Plus className="h-4 w-4" /> Add Note
          </Button>
          <Link href={`/clients/${clientId}/edit`}>
            <Button variant="outline" size="sm" className="gap-2 border-border/50">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 border-border/50">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-border/50">
              {isArchived ? (
                <>
                  <DropdownMenuItem onClick={() => setActionType('restore')} className="gap-2">
                    <RotateCcw className="h-4 w-4" /> Restore
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActionType('delete')} className="gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" /> Delete Permanently
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => setActionType('archive')} className="gap-2">
                  <Archive className="h-4 w-4" /> Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border/50">
        <div className="flex gap-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab client={client} copy={copy} copiedField={copiedField} />}
      {tab === 'notes' && (
        <NotesTab
          notes={notes}
          isLoading={notesLoading}
          showArchived={showArchived}
          setShowArchived={setShowArchived}
          onAdd={() => { setEditingNote(null); setNoteDialogOpen(true); }}
          onEdit={(note) => { setEditingNote(note); setNoteDialogOpen(true); }}
          onPin={(note) => pinNote.mutate({ clientId, noteId: note.id, data: { isPinned: !note.isPinned } }, {
            onSuccess: invalidateNotes,
          })}
          onArchive={(note) => archiveNote.mutate({ clientId, noteId: note.id }, {
            onSuccess: () => { toast({ title: 'Note archived' }); invalidateNotes(); },
            onError: (err: any) => toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }),
          })}
          onRestore={(note) => restoreNote.mutate({ clientId, noteId: note.id }, {
            onSuccess: () => { toast({ title: 'Note restored' }); invalidateNotes(); },
          })}
          onDelete={(note) => {
            if (!window.confirm('Permanently delete this archived note?')) return;
            deleteNote.mutate({ clientId, noteId: note.id }, {
              onSuccess: () => { toast({ title: 'Note deleted' }); invalidateNotes(); },
              onError: (err: any) => toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }),
            });
          }}
        />
      )}
      {tab === 'activity' && (
        <ActivityTab items={activity as any[]} isLoading={activityLoading} />
      )}

      {/* Dialogs */}
      <NoteEditor
        open={noteDialogOpen}
        existingNote={editingNote}
        onSave={saveNote}
        onCancel={() => { setNoteDialogOpen(false); setEditingNote(null); }}
        isPending={createNote.isPending || updateNote.isPending}
      />
      <ArchiveClientDialog open={actionType === 'archive'} client={client} onConfirm={doArchive} onCancel={() => setActionType(null)} isPending={archiveClient.isPending} />
      <RestoreClientDialog open={actionType === 'restore'} client={client} onConfirm={doRestore} onCancel={() => setActionType(null)} isPending={restoreClient.isPending} />
      <DeleteClientDialog open={actionType === 'delete'} client={client} onConfirm={doDelete} onCancel={() => setActionType(null)} isPending={deleteClient.isPending} />
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────
function OverviewTab({ client, copy, copiedField }: { client: ClientRecord; copy: (v: string, f: string) => void; copiedField: string | null }) {
  const CopyBtn = ({ value, field }: { value: string; field: string }) => (
    <button onClick={() => copy(value, field)} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {copiedField === field ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
  );

  const Row = ({ label, value, copyValue, field }: { label: string; value: string | null | undefined; copyValue?: string; field?: string }) => {
    if (!value) return null;
    return (
      <div className="flex gap-4 py-2.5 border-b border-border/30 last:border-0 group">
        <dt className="text-sm text-muted-foreground shrink-0 w-40">{label}</dt>
        <dd className="text-sm font-medium flex-1 flex items-center gap-1">
          {value}
          {copyValue && field && <CopyBtn value={copyValue} field={field} />}
        </dd>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Contact */}
      <Card className="border-border/50">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contact Details</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <dl>
            <Row label="Full Name" value={[client.contactFirstName, client.contactLastName].filter(Boolean).join(' ') || null} />
            <Row label="Email" value={client.email} copyValue={client.email ?? undefined} field="email" />
            <Row label="Phone" value={client.phone} copyValue={client.phone ?? undefined} field="phone" />
          </dl>
          {!client.email && !client.phone && !client.contactFirstName && <p className="text-sm text-muted-foreground">No contact details recorded.</p>}
        </CardContent>
      </Card>

      {/* Company */}
      <Card className="border-border/50">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Company Details</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <dl>
            <Row label="Company" value={client.companyName} />
            <Row label="Website" value={client.website} copyValue={client.website ?? undefined} field="website" />
            <Row label="Industry" value={client.industry} />
            <Row label="Business Type" value={getBusinessTypeLabel(client.businessType)} />
            <Row label="Customer Market" value={getCustomerMarketLabel(client.customerMarket)} />
            <Row label="Company Size" value={getCompanySizeLabel(client.companySize)} />
            <Row label="Annual Revenue" value={getRevenueLabel(client.annualRevenueRange)} />
            <Row label="Location" value={client.primaryLocation} />
          </dl>
        </CardContent>
      </Card>

      {/* Business Profile */}
      <Card className="border-border/50 lg:col-span-2">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Business Profile</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-4">
          {client.currentTechnologyStack && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Technology Stack</p>
              <p className="text-sm whitespace-pre-wrap">{client.currentTechnologyStack}</p>
            </div>
          )}
          {client.primaryBusinessConcern && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Primary Business Concern</p>
              <p className="text-sm whitespace-pre-wrap">{client.primaryBusinessConcern}</p>
            </div>
          )}
          {client.desiredOutcome && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Desired Outcome</p>
              <p className="text-sm whitespace-pre-wrap">{client.desiredOutcome}</p>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
            {client.budgetRange && <div><p className="text-xs text-muted-foreground">Budget</p><p className="text-sm font-medium mt-0.5">{getBudgetLabel(client.budgetRange)}</p></div>}
            {client.leadSource && <div><p className="text-xs text-muted-foreground">Lead Source</p><p className="text-sm font-medium mt-0.5">{client.leadSource}</p></div>}
            <div><p className="text-xs text-muted-foreground">Added</p><p className="text-sm font-medium mt-0.5">{format(new Date(client.createdAt), 'MMM d, yyyy')}</p></div>
            <div><p className="text-xs text-muted-foreground">Last Updated</p><p className="text-sm font-medium mt-0.5">{format(new Date(client.updatedAt), 'MMM d, yyyy')}</p></div>
          </div>
          {client.internalNotes && (
            <div className="border-t border-border/30 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Internal Notes</p>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{client.internalNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────
function NotesTab({ notes, isLoading, showArchived, setShowArchived, onAdd, onEdit, onPin, onArchive, onRestore, onDelete }: {
  notes: ClientNoteRecord[];
  isLoading: boolean;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  onAdd: () => void;
  onEdit: (n: ClientNoteRecord) => void;
  onPin: (n: ClientNoteRecord) => void;
  onArchive: (n: ClientNoteRecord) => void;
  onRestore: (n: ClientNoteRecord) => void;
  onDelete: (n: ClientNoteRecord) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${showArchived ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground hover:border-primary/20'}`}
        >
          {showArchived ? '✓ Showing Archived' : 'Show Archived'}
        </button>
        <Button size="sm" onClick={onAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Add Note
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <p className="text-sm">{showArchived ? 'No archived notes.' : 'No notes yet.'}</p>
          {!showArchived && <Button variant="ghost" size="sm" onClick={onAdd} className="mt-2 gap-2"><Plus className="h-4 w-4" /> Add First Note</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const isNoteArchived = Boolean(note.archivedAt);
            return (
              <Card key={note.id} className={`border-border/50 transition-opacity ${isNoteArchived ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {note.isPinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                        <span className="font-semibold text-sm truncate">{note.title}</span>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border/50 shrink-0">
                          {getNoteTypeLabel(note.noteType)}
                        </Badge>
                        {isNoteArchived && <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-400 shrink-0">Archived</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.body}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(note.createdAt), 'MMM d, yyyy HH:mm')}
                        {note.updatedAt !== note.createdAt && ` · edited ${format(new Date(note.updatedAt), 'MMM d')}`}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="border-border/50">
                        {!isNoteArchived && <>
                          <DropdownMenuItem onClick={() => onEdit(note)} className="gap-2"><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onPin(note)} className="gap-2">
                            {note.isPinned ? <><PinOff className="h-4 w-4" /> Unpin</> : <><Pin className="h-4 w-4" /> Pin</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onArchive(note)} className="gap-2"><Archive className="h-4 w-4" /> Archive</DropdownMenuItem>
                        </>}
                        {isNoteArchived && <>
                          <DropdownMenuItem onClick={() => onRestore(note)} className="gap-2"><RotateCcw className="h-4 w-4" /> Restore</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onDelete(note)} className="gap-2 text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                        </>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Activity Tab ─────────────────────────────────────────────
function ActivityTab({ items, isLoading }: { items: any[]; isLoading: boolean }) {
  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  return <ActivityTimeline items={items} emptyMessage="No activity recorded for this client yet." />;
}
