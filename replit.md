# Glowbar Booking & Dashboard — BLVD Availability Service

## Overview

A full-stack booking platform integrated with the Boulevard (BLVD) Admin and Client GraphQL APIs. The application provides a multi-step customer booking experience (the "Booking Widget"), an API testing/validation tool, and an administrative dashboard for monitoring studio utilization and availability. It includes basic discount flagging on appointment slots and webhook handling for Boulevard events.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React with TypeScript**: Functional components and hooks for state management
- **Vite Build System**: Fast development server with hot module replacement
- **Wouter Routing**: Lightweight client-side routing for SPA navigation
- **Tailwind CSS + shadcn/ui**: Utility-first CSS with a comprehensive component library (Radix UI primitives)
- **TanStack Query**: Data fetching/caching with automatic background refetching
- **Leaflet**: Map integration for displaying studio locations and distance calculations

### Backend Architecture
- **Express.js Server**: RESTful API proxying requests to the Boulevard GraphQL API
- **TypeScript**: Full type safety with shared type definitions
- **BlvdService** (`server/services/blvd-service.ts`, ~2,900 lines): Core integration engine for Boulevard Admin and Client APIs, including HMAC webhook signature verification and timezone conversions

### Data Storage
- **In-Memory Storage** (`server/storage.ts`): Runtime storage using `MemStorage` for API testing sessions and booking state — no persistent database in active use
- **Drizzle ORM + Neon PostgreSQL**: Configured but not actively used for application data in the current codebase

### Authentication
- **Static API Key Authentication**: Bearer token authentication for Boulevard Admin API access
- **Session-based Configuration**: Temporary storage of API credentials during testing sessions
- **Environment Variable Support**: Configuration via environment variables for deployment flexibility

## Key Features

### Booking Widget (`client/src/pages/booking-widget.tsx`)
- **Multi-step Booking Flow**: Location → Product → Date/Time → Checkout, with sub-pages in `client/src/pages/booking-flow/`
- **Real-time Availability**: Live appointment slots fetched from Boulevard API
- **Simple Discount Flagging**: Every 3rd slot is flagged as discounted (`isDiscounted`) with "$10 OFF" labels displayed in the UI; discounted slots are hidden when booking with credits or vouchers
- **Map Integration**: Studio locations shown on a Leaflet map with distance calculations

### BLVD API Testing Tool (`client/src/pages/blvd-api-test.tsx`)
- **Connection Testing**: Validate API credentials and test GraphQL connectivity
- **Location Data Retrieval**: Query business locations and appointment metrics
- **Schema Introspection**: Runtime schema validation and query structure verification

### Administrative Features
- **Developer Controls** (`client/src/components/DeveloperControls.tsx`): Scenario selector and developer controls for testing different configurations
- **Availability Reporting**: CSV reports with appointment data for utilization analysis
- **Webhook Handling**: Boulevard webhook endpoint with HMAC signature verification (`POST /api/blvd/webhook`)

## Key Files

| Path | Purpose |
|------|---------|
| `shared/schema.ts` | Shared types and Zod schemas for BLVD config, bookings, carts, waitlists |
| `client/src/pages/booking-widget.tsx` | Primary booking experience (multi-step flow) |
| `client/src/pages/booking-flow/` | Individual booking step pages (Location, Product, DateTime, Checkout, etc.) |
| `client/src/pages/blvd-api-test.tsx` | Boulevard API testing and validation tool |
| `client/src/components/DeveloperControls.tsx` | Developer/scenario testing controls |
| `client/src/components/configuration-panel.tsx` | API configuration management UI |
| `server/routes.ts` | Express API routes including booking, availability, and webhook endpoints |
| `server/services/blvd-service.ts` | Core Boulevard API integration (GraphQL queries, webhook verification) |
| `server/storage.ts` | In-memory storage interface and implementation |

## External Dependencies

### Boulevard Integration
- **Boulevard Admin GraphQL API**: Business location data, appointment metrics, and provider schedules
- **Boulevard Client API**: Customer-facing booking operations
- **HMAC Webhook Verification**: Secure webhook handling for Boulevard events

### UI Libraries
- **Radix UI Primitives**: Accessible UI components (dialogs, dropdowns, forms)
- **Lucide React Icons**: Icon library for visual elements
- **React Hook Form**: Form handling with validation

### Utility Libraries
- **Zod**: Runtime type validation and schema definition
- **date-fns**: Date manipulation and formatting for scheduling
- **clsx/tailwind-merge**: Conditional CSS class management
