# DealFlow360 — B1 Sales Core Backend

DealFlow360 is a sales pipeline and deal management platform. This repository implements the **B1 – Sales Core** backend module built with NestJS 12, TypeScript, and Prisma 8 ORM for PostgreSQL.

---

## 🚀 B1 – Sales Core Overview

The **B1 – Sales Core** module handles the complete end-to-end sales lifecycle:
```
CUSTOMER
   ↓
LEAD / PROSPECT
   ↓
OPPORTUNITY / DEAL
   ↓
SALES PIPELINE
   ↓
DEAL STAGE / STATUS
   ↓
ACTIVITY / FOLLOW-UP
   ↓
CONVERSION / CLOSURE
```

### Core Features
- **Customers**: Manage customer profiles, contact info, companies, and relationship history.
- **Leads**: Capture prospects, track acquisition sources, manage qualification statuses (`NEW`, `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`, `CONVERTED`).
- **Lead Conversion**: Automatically convert qualified leads into active Opportunities/Deals, creating or associating customers seamlessly.
- **Deals / Opportunities**: Track deal value, sales pipeline, stage transitions (`PROSPECTING`, `QUALIFICATION`, `PROPOSAL`, `NEGOTIATION`, `CLOSED_WON`, `CLOSED_LOST`), and automatic win/loss closure handling.
- **Pipeline Stages**: Customizable sales pipeline stages with probability weights and ordering.
- **Activities & Follow-ups**: Schedule and track sales activities (`CALL`, `EMAIL`, `MEETING`, `NOTE`, `TASK`) linked directly to Customers, Leads, and Deals.

---

## 🏗 Architecture

- **Framework**: [NestJS 12](https://nestjs.com/) (Node.js ESM module architecture)
- **Data Layer**: [Prisma 8](https://prisma.io/) (`@prisma/orm-postgres`) with contract-first data modeling (`contract.prisma`, `contract.json`, `contract.d.ts`)
- **Database**: PostgreSQL with strict foreign keys and cascading relations
- **Validation**: Global `ValidationPipe` with `class-validator` and `class-transformer` DTOs
- **Temporal Handling**: `temporal-polyfill` for ISO-compliant PostgreSQL `timestamptz` timestamp management

---

## 🗄 Database Entities

| Entity | Primary Key | Key Relations | Notes |
|---|---|---|---|
| **Customer** | `id` (Int, Auto) | Linked to Leads, Deals, Activities | Uniqueness on `email` |
| **Lead** | `id` (Int, Auto) | Optional link to `Customer` (SetNull), `convertedDealId` | Status: `NEW`, `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`, `CONVERTED` |
| **Deal** | `id` (Int, Auto) | Belongs to `Customer` (Cascade), optional link to `Lead` (SetNull) | Stages: `PROSPECTING` to `CLOSED_WON`/`CLOSED_LOST` |
| **Activity** | `id` (Int, Auto) | Polymorphic links to `Customer`, `Lead`, or `Deal` (Cascade) | Types: `CALL`, `EMAIL`, `MEETING`, `NOTE`, `TASK` |
| **PipelineStage** | `id` (Int, Auto) | Standalone pipeline stages | Unique stage `name`, `order`, `probability` |

---

## 📡 REST API Endpoints

### Customers (`/customers`)
- `GET /customers` — List all customers
- `GET /customers/:id` — Retrieve a single customer by ID
- `POST /customers` — Create a customer
- `PATCH /customers/:id` — Update customer details
- `DELETE /customers/:id` — Remove a customer

### Leads (`/leads`)
- `GET /leads?status=...&customerId=...` — Filter and list leads
- `GET /leads/:id` — Retrieve a single lead by ID
- `POST /leads` — Create a new lead
- `PATCH /leads/:id` — Update lead details or status
- `POST /leads/:id/convert` — Convert qualified lead into a Deal + Customer
- `DELETE /leads/:id` — Remove a lead

### Deals / Opportunities (`/deals` & `/opportunities`)
- `GET /deals?stage=...&status=...&customerId=...` — Filter and list deals
- `GET /deals/:id` — Retrieve deal details
- `POST /deals` — Create a deal
- `PATCH /deals/:id` — Update deal details
- `PATCH /deals/:id/stage` — Advance deal stage (auto-updates `status` and `closedAt`)
- `DELETE /deals/:id` — Remove a deal
- *Note*: `/opportunities` is an active alias routing to the same handlers.

### Activities / Follow-ups (`/activities`)
- `GET /activities?customerId=...&leadId=...&dealId=...&status=...` — Filter and list activities
- `GET /activities/:id` — Retrieve an activity by ID
- `POST /activities` — Create an activity linked to a customer/lead/deal
- `PATCH /activities/:id` — Update activity status or details
- `DELETE /activities/:id` — Remove an activity

### Pipeline Stages (`/stages`)
- `GET /stages` — List pipeline stages sorted by `order`
- `GET /stages/:id` — Retrieve stage by ID
- `POST /stages` — Create a new stage
- `PATCH /stages/:id` — Update stage order, name, or probability
- `DELETE /stages/:id` — Remove a stage

---

## ⚙️ Setup and Configuration

### 1. Configure DATABASE_URL
Create a `.env` file in the project root:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/dealflow360"
PORT=3000
```
> *.env is git-ignored to prevent credential exposure.*

### 2. Install Dependencies
```bash
npm install
```

### 3. Sync Database Contract
```bash
# Emit updated contract types
npx prisma contract emit

# Apply schema changes to your database
npx prisma db update
```

### 4. Run the Backend
```bash
# Development mode
npm run start:dev

# Production build and run
npm run build
npm run start:prod
```

---

## 🧪 Testing

```bash
# Run unit tests (73 tests across all modules)
npm run test

# Run end-to-end sales workflow tests
npm run test:e2e
```
