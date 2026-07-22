# Viral Magic OS — Command Center

**Version:** 1.0.0  
**Status:** Production Ready  
**Released:** 22 July 2026

---

## Overview

Viral Magic OS Command Center is a full-stack consulting operations platform for growth consultants. It manages the complete client engagement lifecycle — from intake and diagnostic scoring through structured recommendation planning, growth blueprint authoring, and multi-format document export — within a single authenticated web application.

---

## Current Capabilities

| Area | Features |
|------|----------|
| **Client Management** | Full CRUD, contact details, industry classification, engagement status, notes, duplicate-check guard |
| **Project Tracking** | Projects linked to clients, status lifecycle, kanban board, task management with priority and due dates |
| **Growth Diagnostic** | Multi-version diagnostic scoring across 12 business categories; computed performance gap, priority score, and severity; version comparison view |
| **Recommendation Planning** | Automated plan generation from diagnostics; full plan lifecycle (draft → submitted → awaiting review → approved → reopened / archived); per-recommendation actions and dependencies; concurrency-safe write locks |
| **Growth Blueprint** | Multi-chapter blueprint generated from approved plans; section and initiative CRUD; polished document layout |
| **Document Export** | PDF (pdfmake), Word / .docx (docx), PowerPoint / .pptx (pptxgenjs) |
| **Executive Dashboard** | Live system health, recent activity feed, KPI summary; graceful degraded mode if DB is unreachable |
| **Authentication** | Session-based auth with bcrypt, PostgreSQL-backed sessions, role-aware user records |
| **Settings** | Runtime-editable application settings, admin password change |

---

## Architecture

```
viral-magic-os/
├── artifacts/
│   ├── api-server/          # Express 5 REST API
│   │   └── src/
│   │       ├── routes/      # All API route handlers
│   │       ├── middlewares/ # Auth, error handling
│   │       └── lib/         # Logger, utilities
│   └── command-center/      # React + Vite frontend
│       └── src/
│           ├── pages/       # Page-level components
│           ├── components/  # Shared UI components
│           └── lib/         # API hooks, utilities
├── lib/
│   ├── db/                  # Drizzle ORM schema + migrations
│   ├── api-zod/             # OpenAPI spec + generated Zod schemas
│   └── api-client-react/    # Generated TanStack Query hooks (Orval)
└── pnpm-workspace.yaml
```

### Technology Stack

**Backend**
- **Runtime:** Node.js 24
- **Framework:** Express 5
- **ORM:** Drizzle ORM
- **Database:** PostgreSQL
- **Sessions:** connect-pg-simple
- **Logging:** Pino (structured JSON)
- **Document generation:** pdfmake, docx, pptxgenjs
- **Auth:** bcryptjs

**Frontend**
- **Framework:** React 18
- **Build:** Vite
- **Routing:** wouter
- **Server state:** TanStack Query v5
- **UI components:** shadcn/ui + Radix UI primitives
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Validation:** Zod

**Tooling**
- **Package manager:** pnpm (workspaces)
- **API codegen:** Orval (OpenAPI → Zod + React Query)
- **Testing:** Vitest
- **E2E testing:** Playwright
- **Type checking:** TypeScript (project references)

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Authenticated user accounts |
| `roles` | Role definitions |
| `application_settings` | Runtime-editable app configuration |
| `activity_records` | System activity audit log |
| `clients` | Client organisation records |
| `client_notes` | Per-client notes with author attribution |
| `projects` | Projects linked to clients |
| `tasks` | Tasks within projects |
| `diagnostics` | Diagnostic assessments per client-project |
| `growth_assessments` | Versioned category score records |
| `solution_recommendations` | Recommendation plans and per-recommendation items |
| `growth_blueprints` | Blueprint documents linked to approved plans |
| `growth_blueprint_sections` | Chapters within a blueprint |
| `growth_blueprint_initiatives` | Action initiatives within sections |

---

## Core Workflow

```
New Client
    │
    ▼
Client Record Created ──► Duplicate Check Guard
    │
    ▼
Project Created & Linked to Client
    │
    ▼
Diagnostic Created ──► Category Scores Saved (atomic transaction)
    │                       │
    │                       └── Computed: performance gap, priority score, severity
    ▼
Growth Assessment Completed ──► Version Comparison Available
    │
    ▼
Solution Recommendation Plan Generated
    │
    ├── Draft ──► Submitted ──► Awaiting Review ──► Approved
    │                                                    │
    │                                               (write-locked)
    │                                                    │
    └── Reopened ◄──────────────────────────────────────┘
    │
    ▼
Growth Blueprint Generated from Approved Plan
    │
    ├── Sections authored
    ├── Initiatives added to sections
    │
    ▼
Document Export
    ├── PDF  (.pdf)
    ├── Word (.docx)
    └── PowerPoint (.pptx)
```

---

## Installation

### Prerequisites

- Node.js 24+
- pnpm 9+
- PostgreSQL 15+

### Setup

```bash
# Install dependencies
pnpm install

# Set environment variables
# DATABASE_URL=postgresql://user:password@host:5432/dbname
# SESSION_SECRET=<random 64-char string>

# Run database migrations
pnpm --filter @workspace/db run migrate

# Start development servers
pnpm --filter @workspace/api-server run dev     # API on $PORT
pnpm --filter @workspace/command-center run dev  # Frontend on $PORT
```

### Running Tests

```bash
pnpm --filter @workspace/api-server test
```

### Production Build

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/command-center run build
```

---

## Test Status

| Metric | Value |
|--------|-------|
| Tests | **162 passing** |
| Test files | 4 |
| Framework | Vitest |
| E2E | Playwright (26 scenarios) |

---

## Roadmap

### Version 1.1 — Near-term
- One-click diagnostic initiation from client profile
- Inline recommendation editing without formal reopen
- Client-delivery PDF with branded cover page and section dividers
- Tablet and mobile responsive improvements for blueprint view
- Blueprint hover-prefetch for instant open
- Recommendation rule library seeded into database

### Version 2.0 — Strategic
- Multi-tenant architecture with isolated agency workspaces
- AI-assisted diagnostic scoring and recommendation generation
- Client-facing read-only portal
- Real-time collaborative blueprint authoring
- CRM and webhook integrations (HubSpot, Salesforce)
- Advanced pipeline analytics

---

## Documentation

| File | Contents |
|------|----------|
| `CHANGELOG.md` | Full version history, phase completion records, audit results |
| `RELEASE_NOTES_v1.0.md` | Client-facing release notes for v1.0 |
| `AUDIT_REPORT.md` | Pre-release quality audit results (UI + code) |

---

*Viral Magic OS — Command Center — v1.0.0 — Production Ready*
