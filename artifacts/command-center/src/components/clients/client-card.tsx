import { Link } from 'wouter';
import { Building2, Mail, Phone, Globe, MoreHorizontal, Eye, Pencil, Archive, RotateCcw, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ClientStatusBadge } from './status-badge';
import { ClientRecord } from '@workspace/api-client-react';
import { getClientDisplayName, getCustomerMarketLabel } from '@/lib/client-constants';

interface ClientCardProps {
  client: ClientRecord;
  onArchive: (client: ClientRecord) => void;
  onRestore: (client: ClientRecord) => void;
  onDelete: (client: ClientRecord) => void;
}

export function ClientCard({ client, onArchive, onRestore, onDelete }: ClientCardProps) {
  const displayName = getClientDisplayName(client);
  const isArchived = Boolean(client.archivedAt);

  return (
    <Card
      className="border-border/50 bg-card/80 hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
      onMouseEnter={() => import('@/pages/client-detail')}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate group-hover:text-primary transition-colors">{displayName}</h3>
            {client.companyName && (client.contactFirstName || client.contactLastName) && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {[client.contactFirstName, client.contactLastName].filter(Boolean).join(' ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ClientStatusBadge status={client.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-border/50">
                <DropdownMenuItem asChild>
                  <Link href={`/clients/${client.id}`} className="flex items-center gap-2 cursor-pointer">
                    <Eye className="h-4 w-4" /> View
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/clients/${client.id}/edit`} className="flex items-center gap-2 cursor-pointer">
                    <Pencil className="h-4 w-4" /> Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isArchived ? (
                  <>
                    <DropdownMenuItem onClick={() => onRestore(client)} className="gap-2">
                      <RotateCcw className="h-4 w-4" /> Restore
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(client)} className="gap-2 text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => onArchive(client)} className="gap-2">
                    <Archive className="h-4 w-4" /> Archive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          {client.industry && (
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{client.industry}</span>
              {client.customerMarket && (
                <span className="ml-auto text-[10px] uppercase font-medium text-primary/70 shrink-0">
                  {getCustomerMarketLabel(client.customerMarket)}
                </span>
              )}
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{client.phone}</span>
            </div>
          )}
          {client.website && (
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{client.website.replace(/^https?:\/\//, '')}</span>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
          <Link href={`/clients/${client.id}`}>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-primary">
              <Eye className="h-3 w-3" /> View
            </Button>
          </Link>
          <Link href={`/clients/${client.id}/edit`}>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-primary">
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
