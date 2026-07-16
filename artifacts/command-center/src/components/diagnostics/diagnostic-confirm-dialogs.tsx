import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ArchiveDialogProps {
  open: boolean;
  diagnosticName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ArchiveDiagnosticDialog({ open, diagnosticName, onConfirm, onCancel }: ArchiveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive Diagnostic?</AlertDialogTitle>
          <AlertDialogDescription>
            This will archive <strong>"{diagnosticName}"</strong>. It won't be visible in the main list but can be restored from the archived view.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-orange-600 hover:bg-orange-500">
            Archive
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteDialogProps {
  open: boolean;
  diagnosticName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteDiagnosticDialog({ open, diagnosticName, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently Delete Diagnostic?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>"{diagnosticName}"</strong> and all its versions, scores, and recommendations. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-500">
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface CompleteDialogProps {
  open: boolean;
  diagnosticName: string;
  missingCount?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CompleteDiagnosticDialog({ open, diagnosticName, missingCount, onConfirm, onCancel }: CompleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Complete Diagnostic?</AlertDialogTitle>
          <AlertDialogDescription>
            {missingCount && missingCount > 0 ? (
              <>
                <strong>{missingCount} categories</strong> have missing scores. All categories must be scored before completing.
              </>
            ) : (
              <>
                This will finalize <strong>"{diagnosticName}"</strong>, recalculate all scores server-side, generate system recommendations, and set the status to Completed. You can still create a new version after completion.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          {(!missingCount || missingCount === 0) && (
            <AlertDialogAction onClick={onConfirm} className="bg-green-600 hover:bg-green-500">
              Complete Diagnostic
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
