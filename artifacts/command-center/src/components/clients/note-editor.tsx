import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { NOTE_TYPES } from '@/lib/client-constants';
import { ClientNoteRecord } from '@workspace/api-client-react';
import { useEffect } from 'react';

const noteSchema = z.object({
  noteType: z.string().default('general'),
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
});

type NoteFormValues = z.infer<typeof noteSchema>;

interface NoteEditorProps {
  open: boolean;
  existingNote?: ClientNoteRecord | null;
  onSave: (values: NoteFormValues) => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function NoteEditor({ open, existingNote, onSave, onCancel, isPending }: NoteEditorProps) {
  const isEditing = Boolean(existingNote);

  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      noteType: existingNote?.noteType ?? 'general',
      title: existingNote?.title ?? '',
      body: existingNote?.body ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        noteType: existingNote?.noteType ?? 'general',
        title: existingNote?.title ?? '',
        body: existingNote?.body ?? '',
      });
    }
  }, [open, existingNote]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="border-border/50 max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Note' : 'Add Note'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update this note.' : 'Add a new note to this client.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="noteType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {NOTE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Note title" className="border-border/50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Write your note here..."
                      className="border-border/50 min-h-[120px] resize-y"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Add Note'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
