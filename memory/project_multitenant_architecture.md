---
name: Multi-tenant architecture (Company/Module)
description: wticket multi-tenancy model — Company owns data, Module gates feature access
type: project
---

wticket is being converted from single-tenant to multi-tenant. Architecture:

- **Company** is the tenant boundary. All business data (Customer, Contact, Lead, Ticket, Product, ServiceOrder, Appointment, BotConfig, AiAgent, Session, AutoResponse, Schedule, Message) carries `companyId` and is filtered by it in repositories.
- **Module** is a fixed catalog of feature bundles: `attendance` (contacts, appointments, tickets), `service_order` (products, customers, service-orders), `auto_attendance` (bots + AI; complement of attendance — requires attendance active).
- **User roles**: `super_admin` (no companyId, manages platform/companies/modules — only sales.go@gmail.com), `company_admin` (admin of one company), `default` (regular company user).
- **Auth flow**: signup creates Company (status `pending_payment`) + owner User (`company_admin`) + selected modules. JWT carries `companyId` and active module codes. Login is blocked unless company is `active`.
- **Module gating**: middleware `requireModule(code)` blocks routes when the company doesn't own that module. Frontend sidebar is rendered dynamically from active modules.

**Why:** User wants to sell wticket as a SaaS where companies pick which modules they pay for. Current single-tenant code (no `companyId` anywhere, only `default`/`administrator` roles) needs to be retrofitted before payments are wired.

**How to apply:** When adding any new business entity model, include `companyId` (required, indexed) and filter by `req.user.companyId` in its repository. When adding a new route, decide which module it belongs to and apply the `requireModule` middleware.
