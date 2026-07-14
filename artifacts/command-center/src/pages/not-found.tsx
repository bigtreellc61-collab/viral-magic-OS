import { Card, CardContent } from '@/components/ui/card';
import { FileQuestion } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] w-full flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-500">
      <Card className="w-full max-w-md bg-card/50 backdrop-blur border-border/50 shadow-2xl">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center">
          <div className="p-4 bg-muted/50 rounded-full mb-6 ring-1 ring-border/50">
            <FileQuestion className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            System Route Not Found
          </h1>
          <p className="text-sm text-muted-foreground mb-8 max-w-[280px]">
            The requested module does not exist in the current Phase 1A deployment.
          </p>
          <Link href="/">
            <Button variant="default" className="w-full sm:w-auto px-8">Return to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
