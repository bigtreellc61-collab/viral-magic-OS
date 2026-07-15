import { Router, type IRouter } from "express";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  gte,
} from "drizzle-orm";
import {
  db,
  clientsTable,
  clientNotesTable,
  activityRecordsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateClientBody,
  UpdateClientBody,
  RestoreClientBody,
  CreateClientNoteBody,
  UpdateClientNoteBody,
  ToggleClientNotePinBody,
  ListClientsQueryParams,
  ListClientNotesQueryParams,
  ListClientActivityQueryParams,
  CheckClientDuplicateBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { logActivity } from "../lib/activity";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────

const VALID_STATUSES = [
  "prospect", "discovery", "qualified", "proposal_sent",
  "active", "paused", "completed", "archived",
];
const VALID_RESTORE_STATUSES = VALID_STATUSES.filter((s) => s !== "archived");

async function fetchClientOr404(clientId: string, res: any) {
  const rows = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, clientId))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "Client not found." });
    return null;
  }
  return rows[0];
}

async function fetchNoteOr404(clientId: string, noteId: string, res: any) {
  const rows = await db
    .select()
    .from(clientNotesTable)
    .where(
      and(
        eq(clientNotesTable.id, noteId),
        eq(clientNotesTable.clientId, clientId),
      ),
    )
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "Note not found." });
    return null;
  }
  return rows[0];
}

// ─────────────────────────────────────────────────────────────
// GET /clients  — list with search, filter, sort, pagination
// ─────────────────────────────────────────────────────────────
router.get("/clients", requireAuth, async (req, res) => {
  try {
    const params = ListClientsQueryParams.parse(req.query);
    const { q, status, industry, businessType, customerMarket, showArchived, sortBy, page, pageSize } = params;

    const conditions: ReturnType<typeof eq>[] = [];

    if (!showArchived) {
      conditions.push(isNull(clientsTable.archivedAt) as any);
    }

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      conditions.push(
        or(
          ilike(clientsTable.contactFirstName, term),
          ilike(clientsTable.contactLastName, term),
          ilike(clientsTable.companyName, term),
          ilike(clientsTable.email, term),
          ilike(clientsTable.phone, term),
          ilike(clientsTable.industry, term),
          ilike(clientsTable.primaryLocation, term),
        ) as any,
      );
    }

    if (status && status !== "all") {
      conditions.push(eq(clientsTable.status, status) as any);
    }

    if (industry) {
      conditions.push(ilike(clientsTable.industry, `%${industry}%`) as any);
    }

    if (businessType) {
      conditions.push(eq(clientsTable.businessType, businessType) as any);
    }

    if (customerMarket) {
      conditions.push(eq(clientsTable.customerMarket, customerMarket) as any);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: sql<string>`count(*)` })
      .from(clientsTable)
      .where(where);

    let orderBy;
    switch (sortBy) {
      case "oldest":          orderBy = asc(clientsTable.createdAt); break;
      case "company_az":      orderBy = asc(clientsTable.companyName); break;
      case "company_za":      orderBy = desc(clientsTable.companyName); break;
      case "contact_az":      orderBy = asc(clientsTable.contactFirstName); break;
      case "recently_updated": orderBy = desc(clientsTable.updatedAt); break;
      default:                orderBy = desc(clientsTable.createdAt);
    }

    const clients = await db
      .select()
      .from(clientsTable)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize ?? 25)
      .offset(((page ?? 1) - 1) * (pageSize ?? 25));

    res.json({ clients, total: Number(total), page: page ?? 1, pageSize: pageSize ?? 25 });
  } catch (err) {
    logger.error({ err }, "listClients failed");
    res.status(500).json({ error: "Failed to retrieve clients." });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /clients/check-duplicate  (must be before /:clientId)
// ─────────────────────────────────────────────────────────────
router.post("/clients/check-duplicate", requireAuth, async (req, res) => {
  try {
    const body = ClientDuplicateCheckBody.parse(req.body);
    const { email, companyName } = body;

    if (!email && !companyName) {
      return res.json({ isDuplicate: false, matches: [] });
    }

    const conditions: any[] = [];
    if (email) conditions.push(ilike(clientsTable.email, email.trim()));
    if (companyName) conditions.push(ilike(clientsTable.companyName, companyName.trim()));

    const matches = await db
      .select()
      .from(clientsTable)
      .where(or(...conditions))
      .orderBy(desc(clientsTable.createdAt))
      .limit(10);

    res.json({ isDuplicate: matches.length > 0, matches });
  } catch (err) {
    logger.error({ err }, "checkClientDuplicate failed");
    res.status(500).json({ error: "Duplicate check failed." });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /clients  — create
// ─────────────────────────────────────────────────────────────
router.post("/clients", requireAuth, async (req, res) => {
  try {
    const body = CreateClientBody.parse(req.body);
    const user = req.authUser!;

    if (!body.contactFirstName?.trim() && !body.companyName?.trim()) {
      return res.status(400).json({ error: "A contact first name or company name is required." });
    }

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }

    if (body.customerMarket && !["b2b", "b2c", "both"].includes(body.customerMarket)) {
      return res.status(400).json({ error: "Invalid customer market value." });
    }

    if (body.email && body.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return res.status(400).json({ error: "Email address is not valid." });
    }

    const id = crypto.randomUUID();
    const now = new Date();

    const [client] = await db
      .insert(clientsTable)
      .values({
        id,
        contactFirstName: body.contactFirstName?.trim() || null,
        contactLastName: body.contactLastName?.trim() || null,
        companyName: body.companyName?.trim() || null,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        website: body.website?.trim() || null,
        industry: body.industry?.trim() || null,
        businessType: body.businessType || null,
        customerMarket: body.customerMarket || null,
        companySize: body.companySize || null,
        annualRevenueRange: body.annualRevenueRange || null,
        primaryLocation: body.primaryLocation?.trim() || null,
        currentTechnologyStack: body.currentTechnologyStack?.trim() || null,
        primaryBusinessConcern: body.primaryBusinessConcern?.trim() || null,
        desiredOutcome: body.desiredOutcome?.trim() || null,
        budgetRange: body.budgetRange || null,
        leadSource: body.leadSource?.trim() || null,
        status: body.status || "prospect",
        internalNotes: body.internalNotes?.trim() || null,
        createdAt: now,
        updatedAt: now,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    const displayName = client.companyName || `${client.contactFirstName || ""} ${client.contactLastName || ""}`.trim() || "Unknown";

    await logActivity({
      activityType: "client.created",
      description: `${user.fullName} added client "${displayName}".`,
      actorUserId: user.id,
      entityType: "client",
      entityId: client.id,
    });

    res.status(201).json(client);
  } catch (err) {
    logger.error({ err }, "createClient failed");
    res.status(500).json({ error: "Failed to create client." });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /clients/:clientId
// ─────────────────────────────────────────────────────────────
router.get("/clients/:clientId", requireAuth, async (req, res) => {
  try {
    const client = await fetchClientOr404(req.params.clientId, res);
    if (!client) return;
    res.json(client);
  } catch (err) {
    logger.error({ err }, "getClient failed");
    res.status(500).json({ error: "Failed to retrieve client." });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /clients/:clientId  — update
// ─────────────────────────────────────────────────────────────
router.patch("/clients/:clientId", requireAuth, async (req, res) => {
  try {
    const client = await fetchClientOr404(req.params.clientId, res);
    if (!client) return;

    const body = UpdateClientBody.parse(req.body);
    const user = req.authUser!;

    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }

    if (body.customerMarket !== undefined && body.customerMarket !== null &&
        !["b2b", "b2c", "both"].includes(body.customerMarket)) {
      return res.status(400).json({ error: "Invalid customer market value." });
    }

    if (body.email && body.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return res.status(400).json({ error: "Email address is not valid." });
    }

    const updates: Partial<typeof clientsTable.$inferInsert> = {
      updatedAt: new Date(),
      updatedBy: user.id,
    };

    if (body.contactFirstName !== undefined) updates.contactFirstName = body.contactFirstName?.trim() || null;
    if (body.contactLastName !== undefined) updates.contactLastName = body.contactLastName?.trim() || null;
    if (body.companyName !== undefined) updates.companyName = body.companyName?.trim() || null;
    if (body.email !== undefined) updates.email = body.email?.trim() || null;
    if (body.phone !== undefined) updates.phone = body.phone?.trim() || null;
    if (body.website !== undefined) updates.website = body.website?.trim() || null;
    if (body.industry !== undefined) updates.industry = body.industry?.trim() || null;
    if (body.businessType !== undefined) updates.businessType = body.businessType || null;
    if (body.customerMarket !== undefined) updates.customerMarket = body.customerMarket || null;
    if (body.companySize !== undefined) updates.companySize = body.companySize || null;
    if (body.annualRevenueRange !== undefined) updates.annualRevenueRange = body.annualRevenueRange || null;
    if (body.primaryLocation !== undefined) updates.primaryLocation = body.primaryLocation?.trim() || null;
    if (body.currentTechnologyStack !== undefined) updates.currentTechnologyStack = body.currentTechnologyStack?.trim() || null;
    if (body.primaryBusinessConcern !== undefined) updates.primaryBusinessConcern = body.primaryBusinessConcern?.trim() || null;
    if (body.desiredOutcome !== undefined) updates.desiredOutcome = body.desiredOutcome?.trim() || null;
    if (body.budgetRange !== undefined) updates.budgetRange = body.budgetRange || null;
    if (body.leadSource !== undefined) updates.leadSource = body.leadSource?.trim() || null;
    if (body.status !== undefined) updates.status = body.status;
    if (body.internalNotes !== undefined) updates.internalNotes = body.internalNotes?.trim() || null;

    const [updated] = await db
      .update(clientsTable)
      .set(updates)
      .where(eq(clientsTable.id, req.params.clientId))
      .returning();

    const displayName = updated.companyName || `${updated.contactFirstName || ""} ${updated.contactLastName || ""}`.trim() || "Unknown";

    await logActivity({
      activityType: "client.updated",
      description: `${user.fullName} updated client "${displayName}".`,
      actorUserId: user.id,
      entityType: "client",
      entityId: updated.id,
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "updateClient failed");
    res.status(500).json({ error: "Failed to update client." });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /clients/:clientId  — permanent delete (archived only)
// ─────────────────────────────────────────────────────────────
router.delete("/clients/:clientId", requireAuth, async (req, res) => {
  try {
    const client = await fetchClientOr404(req.params.clientId, res);
    if (!client) return;

    if (!client.archivedAt) {
      return res.status(400).json({ error: "Client must be archived before permanent deletion." });
    }

    const user = req.authUser!;
    const displayName = client.companyName || `${client.contactFirstName || ""} ${client.contactLastName || ""}`.trim() || "Unknown";

    // Log before deleting (cascade will remove notes)
    await logActivity({
      activityType: "client.deleted",
      description: `${user.fullName} permanently deleted client "${displayName}" and all associated notes.`,
      actorUserId: user.id,
      entityType: "client",
      entityId: client.id,
    });

    await db.delete(clientsTable).where(eq(clientsTable.id, req.params.clientId));

    res.status(204).end();
  } catch (err) {
    logger.error({ err }, "deleteClient failed");
    res.status(500).json({ error: "Failed to delete client." });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /clients/:clientId/archive
// ─────────────────────────────────────────────────────────────
router.post("/clients/:clientId/archive", requireAuth, async (req, res) => {
  try {
    const client = await fetchClientOr404(req.params.clientId, res);
    if (!client) return;

    if (client.archivedAt) {
      return res.status(400).json({ error: "Client is already archived." });
    }

    const user = req.authUser!;
    const now = new Date();

    const [updated] = await db
      .update(clientsTable)
      .set({ archivedAt: now, status: "archived", updatedAt: now, updatedBy: user.id })
      .where(eq(clientsTable.id, req.params.clientId))
      .returning();

    const displayName = updated.companyName || `${updated.contactFirstName || ""} ${updated.contactLastName || ""}`.trim() || "Unknown";

    await logActivity({
      activityType: "client.archived",
      description: `${user.fullName} archived client "${displayName}".`,
      actorUserId: user.id,
      entityType: "client",
      entityId: updated.id,
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "archiveClient failed");
    res.status(500).json({ error: "Failed to archive client." });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /clients/:clientId/restore
// ─────────────────────────────────────────────────────────────
router.post("/clients/:clientId/restore", requireAuth, async (req, res) => {
  try {
    const client = await fetchClientOr404(req.params.clientId, res);
    if (!client) return;

    if (!client.archivedAt) {
      return res.status(400).json({ error: "Client is not archived." });
    }

    const body = RestoreClientBody.parse(req.body);

    if (!VALID_RESTORE_STATUSES.includes(body.status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_RESTORE_STATUSES.join(", ")}.` });
    }

    const user = req.authUser!;
    const now = new Date();

    const [updated] = await db
      .update(clientsTable)
      .set({ archivedAt: null, status: body.status, updatedAt: now, updatedBy: user.id })
      .where(eq(clientsTable.id, req.params.clientId))
      .returning();

    const displayName = updated.companyName || `${updated.contactFirstName || ""} ${updated.contactLastName || ""}`.trim() || "Unknown";

    await logActivity({
      activityType: "client.restored",
      description: `${user.fullName} restored client "${displayName}" with status "${body.status}".`,
      actorUserId: user.id,
      entityType: "client",
      entityId: updated.id,
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "restoreClient failed");
    res.status(500).json({ error: "Failed to restore client." });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /clients/:clientId/notes
// ─────────────────────────────────────────────────────────────
router.get("/clients/:clientId/notes", requireAuth, async (req, res) => {
  try {
    const client = await fetchClientOr404(req.params.clientId, res);
    if (!client) return;

    const params = ListClientNotesQueryParams.parse(req.query);

    const conditions: any[] = [eq(clientNotesTable.clientId, req.params.clientId)];
    if (!params.showArchived) {
      conditions.push(isNull(clientNotesTable.archivedAt));
    }

    // Pinned first, then newest
    const notes = await db
      .select()
      .from(clientNotesTable)
      .where(and(...conditions))
      .orderBy(desc(clientNotesTable.isPinned), desc(clientNotesTable.createdAt));

    res.json(notes);
  } catch (err) {
    logger.error({ err }, "listClientNotes failed");
    res.status(500).json({ error: "Failed to retrieve notes." });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /clients/:clientId/notes
// ─────────────────────────────────────────────────────────────
router.post("/clients/:clientId/notes", requireAuth, async (req, res) => {
  try {
    const client = await fetchClientOr404(req.params.clientId, res);
    if (!client) return;

    const body = CreateClientNoteBody.parse(req.body);
    const user = req.authUser!;

    if (!body.title?.trim()) return res.status(400).json({ error: "Note title is required." });
    if (!body.body?.trim()) return res.status(400).json({ error: "Note body is required." });

    const id = crypto.randomUUID();
    const now = new Date();

    const [note] = await db
      .insert(clientNotesTable)
      .values({
        id,
        clientId: req.params.clientId,
        noteType: body.noteType || "general",
        title: body.title.trim(),
        body: body.body.trim(),
        isPinned: false,
        createdBy: user.id,
        updatedBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const displayName = client.companyName || `${client.contactFirstName || ""} ${client.contactLastName || ""}`.trim() || "Unknown";

    await logActivity({
      activityType: "client.note.created",
      description: `${user.fullName} added a note "${note.title}" to client "${displayName}".`,
      actorUserId: user.id,
      entityType: "client",
      entityId: client.id,
    });

    res.status(201).json(note);
  } catch (err) {
    logger.error({ err }, "createClientNote failed");
    res.status(500).json({ error: "Failed to create note." });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /clients/:clientId/notes/:noteId
// ─────────────────────────────────────────────────────────────
router.patch("/clients/:clientId/notes/:noteId", requireAuth, async (req, res) => {
  try {
    const note = await fetchNoteOr404(req.params.clientId, req.params.noteId, res);
    if (!note) return;

    const body = UpdateClientNoteBody.parse(req.body);
    const user = req.authUser!;
    const now = new Date();

    const updates: any = { updatedAt: now, updatedBy: user.id };
    if (body.noteType !== undefined) updates.noteType = body.noteType;
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.body !== undefined) updates.body = body.body.trim();

    const [updated] = await db
      .update(clientNotesTable)
      .set(updates)
      .where(eq(clientNotesTable.id, req.params.noteId))
      .returning();

    const client = (await db.select().from(clientsTable).where(eq(clientsTable.id, req.params.clientId)).limit(1))[0];
    const displayName = client?.companyName || `${client?.contactFirstName || ""} ${client?.contactLastName || ""}`.trim() || "Unknown";

    await logActivity({
      activityType: "client.note.updated",
      description: `${user.fullName} updated note "${updated.title}" on client "${displayName}".`,
      actorUserId: user.id,
      entityType: "client",
      entityId: req.params.clientId,
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "updateClientNote failed");
    res.status(500).json({ error: "Failed to update note." });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /clients/:clientId/notes/:noteId  (archived only)
// ─────────────────────────────────────────────────────────────
router.delete("/clients/:clientId/notes/:noteId", requireAuth, async (req, res) => {
  try {
    const note = await fetchNoteOr404(req.params.clientId, req.params.noteId, res);
    if (!note) return;

    if (!note.archivedAt) {
      return res.status(400).json({ error: "Note must be archived before permanent deletion." });
    }

    await db.delete(clientNotesTable).where(eq(clientNotesTable.id, req.params.noteId));
    res.status(204).end();
  } catch (err) {
    logger.error({ err }, "deleteClientNote failed");
    res.status(500).json({ error: "Failed to delete note." });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /clients/:clientId/notes/:noteId/pin
// ─────────────────────────────────────────────────────────────
router.post("/clients/:clientId/notes/:noteId/pin", requireAuth, async (req, res) => {
  try {
    const note = await fetchNoteOr404(req.params.clientId, req.params.noteId, res);
    if (!note) return;

    const body = ToggleClientNotePinBody.parse(req.body);

    const [updated] = await db
      .update(clientNotesTable)
      .set({ isPinned: body.isPinned, updatedAt: new Date() })
      .where(eq(clientNotesTable.id, req.params.noteId))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "toggleClientNotePin failed");
    res.status(500).json({ error: "Failed to update note pin." });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /clients/:clientId/notes/:noteId/archive
// ─────────────────────────────────────────────────────────────
router.post("/clients/:clientId/notes/:noteId/archive", requireAuth, async (req, res) => {
  try {
    const note = await fetchNoteOr404(req.params.clientId, req.params.noteId, res);
    if (!note) return;

    const now = new Date();
    const [updated] = await db
      .update(clientNotesTable)
      .set({ archivedAt: now, isPinned: false, updatedAt: now })
      .where(eq(clientNotesTable.id, req.params.noteId))
      .returning();

    const client = (await db.select().from(clientsTable).where(eq(clientsTable.id, req.params.clientId)).limit(1))[0];
    const displayName = client?.companyName || "Unknown";

    await logActivity({
      activityType: "client.note.archived",
      description: `${req.authUser!.fullName} archived note "${note.title}" on client "${displayName}".`,
      actorUserId: req.authUser!.id,
      entityType: "client",
      entityId: req.params.clientId,
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "archiveClientNote failed");
    res.status(500).json({ error: "Failed to archive note." });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /clients/:clientId/notes/:noteId/restore
// ─────────────────────────────────────────────────────────────
router.post("/clients/:clientId/notes/:noteId/restore", requireAuth, async (req, res) => {
  try {
    const note = await fetchNoteOr404(req.params.clientId, req.params.noteId, res);
    if (!note) return;

    const now = new Date();
    const [updated] = await db
      .update(clientNotesTable)
      .set({ archivedAt: null, updatedAt: now })
      .where(eq(clientNotesTable.id, req.params.noteId))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "restoreClientNote failed");
    res.status(500).json({ error: "Failed to restore note." });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /clients/:clientId/activity
// ─────────────────────────────────────────────────────────────
router.get("/clients/:clientId/activity", requireAuth, async (req, res) => {
  try {
    const client = await fetchClientOr404(req.params.clientId, res);
    if (!client) return;

    const params = ListClientActivityQueryParams.parse(req.query);

    const rows = await db
      .select({
        id: activityRecordsTable.id,
        activityType: activityRecordsTable.activityType,
        description: activityRecordsTable.description,
        entityType: activityRecordsTable.entityType,
        entityId: activityRecordsTable.entityId,
        createdAt: activityRecordsTable.createdAt,
        actorName: usersTable.fullName,
      })
      .from(activityRecordsTable)
      .leftJoin(usersTable, eq(activityRecordsTable.actorUserId, usersTable.id))
      .where(
        and(
          eq(activityRecordsTable.entityType, "client"),
          eq(activityRecordsTable.entityId, req.params.clientId),
        ),
      )
      .orderBy(desc(activityRecordsTable.createdAt))
      .limit(params.limit ?? 50);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "listClientActivity failed");
    res.status(500).json({ error: "Failed to retrieve activity." });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /dashboard/clients  — metrics
// ─────────────────────────────────────────────────────────────
router.get("/dashboard/clients", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      [{ total: totalClients }],
      [{ total: activeClients }],
      [{ total: prospects }],
      [{ total: archivedClients }],
      [{ total: addedThisMonth }],
    ] = await Promise.all([
      db.select({ total: sql<string>`count(*)` }).from(clientsTable),
      db.select({ total: sql<string>`count(*)` }).from(clientsTable)
        .where(and(eq(clientsTable.status, "active"), isNull(clientsTable.archivedAt))),
      db.select({ total: sql<string>`count(*)` }).from(clientsTable)
        .where(and(eq(clientsTable.status, "prospect"), isNull(clientsTable.archivedAt))),
      db.select({ total: sql<string>`count(*)` }).from(clientsTable)
        .where(isNotNull(clientsTable.archivedAt)),
      db.select({ total: sql<string>`count(*)` }).from(clientsTable)
        .where(gte(clientsTable.createdAt, startOfMonth)),
    ]);

    const recentClients = await db
      .select()
      .from(clientsTable)
      .where(isNull(clientsTable.archivedAt))
      .orderBy(desc(clientsTable.createdAt))
      .limit(5);

    const recentActivity = await db
      .select({
        id: activityRecordsTable.id,
        activityType: activityRecordsTable.activityType,
        description: activityRecordsTable.description,
        entityType: activityRecordsTable.entityType,
        entityId: activityRecordsTable.entityId,
        createdAt: activityRecordsTable.createdAt,
        actorName: usersTable.fullName,
      })
      .from(activityRecordsTable)
      .leftJoin(usersTable, eq(activityRecordsTable.actorUserId, usersTable.id))
      .where(eq(activityRecordsTable.entityType, "client"))
      .orderBy(desc(activityRecordsTable.createdAt))
      .limit(10);

    res.json({
      totalClients: Number(totalClients),
      activeClients: Number(activeClients),
      prospects: Number(prospects),
      archivedClients: Number(archivedClients),
      addedThisMonth: Number(addedThisMonth),
      recentClients,
      recentActivity,
    });
  } catch (err) {
    logger.error({ err }, "getClientMetrics failed");
    res.status(500).json({ error: "Failed to retrieve client metrics." });
  }
});

export default router;
