# Glowbar UtilizationOS — Booking & Incentivization Platform

## Overview

A full-stack booking platform integrated with the Boulevard (BLVD) API that implements **UtilizationOS**, a data-driven incentivization engine. The system shifts customer booking demand from peak to off-peak times by combining customer propensity scoring with real-time studio utilization analysis to deliver personalized "nudges" — targeted offers and provider-based incentives surfaced during the booking flow.

The application serves three purposes:
1. **Personalized Booking Flow** — A multi-step customer booking experience with interstitial personalization
2. **Administrative Dashboard** — Studio utilization monitoring and tactics configuration
3. **BLVD API Testing Tool** — Credential validation and GraphQL connectivity testing

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React with TypeScript**: Functional components and hooks for state management
- **Vite Build System**: Fast development server with hot module replacement
- **Wouter Routing**: Lightweight client-side routing for SPA navigation
- **Tailwind CSS + shadcn/ui**: Utility-first CSS with Radix UI component primitives
- **TanStack Query**: Data fetching/caching with automatic background refetching
- **Leaflet**: Map integration for studio location display and distance calculations

### Backend Architecture
- **Express.js Server**: RESTful API proxying requests to the Boulevard GraphQL API
- **TypeScript**: Full type safety with shared type definitions across frontend and backend
- **BlvdService** (`server/services/blvd-service.ts`): Core Boulevard integration (~2,900 lines) handling Admin and Client API GraphQL requests, HMAC webhook verification, and timezone conversions
- **RecommendationService** (`server/services/recommendation.ts`): Computes incentive factors from utilization data and maps customer segments to personalized nudges
- **SegmentationService** (`server/services/segmentation.ts`): Resolves effective propensity tiers using NPS, visit recency, membership status, and configurable thresholds

### Data Access Layer (DAL)
- **Factory Pattern** (`server/dal/factory.ts`): Switches between mock and live data sources via `DATA_MODE` environment variable
- **Static Repositories** (`server/dal/static.ts`): Mock data from JSON files for POC development
- **Repository Interfaces** (`server/dal/base.ts`): `LocationRepository`, `CustomerRepository`, `AvailabilityRepository`, `TacticsRepository`, `DiscountCodeRepository`
- **Live Boulevard Integration**: Planned but not yet implemented; factory falls back to mock

### Data Storage
- **Static JSON Data** (`server/data/`): Pre-computed customer profiles, availability patterns, discount codes, and tactics configuration
- **In-Memory Storage** (`server/storage.ts`): Runtime storage using `MemStorage` for booking carts and waitlist requests
- **Drizzle ORM + Neon PostgreSQL**: Configured but not actively used for application data

### Authentication
- **Static API Key Authentication**: Bearer token authentication for Boulevard Admin API access
- **Session-based Configuration**: Temporary storage of API credentials during testing sessions
- **Environment Variable Support**: Deployment configuration via environment variables

## Data-Driven Incentivization (UtilizationOS)

### Customer Segmentation (`server/services/segmentation.ts`)
Customers are classified into propensity tiers based on configurable thresholds:
- **High Tier (Loyalists)**: NPS ≥ 8 and visited within 60 days
- **Mid Tier (At-Risk)**: NPS 6–7 or visited 60–90 days ago
- **Low Tier (Lapsed)**: NPS < 6 or visited > 90 days ago
- **Member Bonus**: Active members with NPS one point below high threshold still qualify as high tier
- Lapsed status overrides NPS — a lapsed high-NPS customer still gets re-engagement treatment

### Supply-Side Intelligence (`server/services/recommendation.ts`)
Analyzes location-level utilization to identify demand gaps:
- **Low-Demand Days**: Days where >70% of slots are under-utilized (configurable via `lowDemandDayThreshold`)
- **Low-Demand Time Windows**: Persistent off-peak hours appearing across multiple days (configurable via `lowDemandTimeMinDays`)
- **Provider Signal**: Checks if a customer's preferred provider is available at a given location

### Incentive Tactics (`server/data/tactics_config.json`)
Four configurable tactics map data signals to specific offers:

| Tactic | Target | Incentive | Constraint |
|--------|--------|-----------|------------|
| Preferred Provider Nudge | High tier | Surfaces favorite staff availability (no discount) | Low-demand only |
| Mid-Tier Time Shift | Mid tier | 10% off (`MID10` code) | Low-demand only |
| Low-Tier Recovery | Low tier | $10 off (`BACK10` code) | Any time |
| Membership CTA | Non-members (all tiers) | Membership sign-up prompt | Post-booking |

### Frontend Personalization
- **PersonalizationStep** (`client/src/pages/booking-flow/PersonalizationStep.tsx`): Interstitial screen after customer identification; calls recommendation API and surfaces the appropriate nudge or auto-advances
- **IncentiveOffer** (`client/src/components/booking/IncentiveOffer.tsx`): Renders discount codes and suggested low-demand time slots
- **ProviderNudge** (`client/src/components/booking/ProviderNudge.tsx`): Highlights preferred staff member availability during off-peak times

## Key Features

### Booking Flow (`client/src/pages/booking-flow/`)
- **Context-Driven Step Navigation**: `BookingFlowContext` manages state across: Customer Type → Login → Product → Location → Date/Time → Personalization → Checkout → Confirmation
- **User Type Awareness**: Conditional routing based on new / member / non-member status
- **Personalization Interstitial**: Data-driven nudge surfaced between selection and checkout
- **Scenario Selector** (`client/src/components/ScenarioSelector.tsx`): Developer tool to simulate different customer personas (Loyalist, Lapsed, New) and test personalization logic

### Legacy Booking Widget (`client/src/pages/booking-widget.tsx`)
- **Monolithic Implementation**: Older single-file booking flow (~3,700 lines)
- **Real-time Availability**: Live appointment slots from Boulevard API
- **Map Integration**: Studio locations on Leaflet map with distance calculations

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
| `shared/schema.ts` | Shared Zod schemas: BLVD config, bookings, UtilizationOS types (CustomerProfile, IncentiveFactors, Nudge, Tactic, etc.) |
| `server/services/recommendation.ts` | Recommendation engine: computes incentive factors and generates nudges |
| `server/services/segmentation.ts` | Customer propensity tier classification |
| `server/services/blvd-service.ts` | Core Boulevard API integration (GraphQL, webhooks) |
| `server/dal/base.ts` | Repository interfaces for the data access layer |
| `server/dal/factory.ts` | DAL factory: mock vs live data source switching |
| `server/dal/static.ts` | Static JSON-backed repository implementations |
| `server/data/tactics_config.json` | Tactic definitions, thresholds, and offer parameters |
| `server/data/customers.json` | Pre-computed customer profiles (NPS, CLV, visit history) |
| `server/data/locations.json` | Mock location data (23 Glowbar studios) matching Boulevard GraphQL structure |
| `server/data/availability.json` | Historical utilization data for off-peak detection |
| `server/data/discount_codes.json` | Active promo codes linked to tactics |
| `server/routes.ts` | Express API routes (booking, personalization, tactics, webhooks) |
| `server/storage.ts` | In-memory storage for carts and waitlist requests |
| `client/src/pages/booking-flow/index.tsx` | Refactored booking flow entry point with step router |
| `client/src/pages/booking-flow/PersonalizationStep.tsx` | Nudge interstitial in the booking flow |
| `client/src/components/booking/IncentiveOffer.tsx` | Discount-based nudge UI component |
| `client/src/components/booking/ProviderNudge.tsx` | Staff-focused nudge UI component |
| `client/src/components/ScenarioSelector.tsx` | Developer tool for simulating customer personas |
| `client/src/contexts/BookingFlowContext.tsx` | Booking flow state management |
| `client/src/pages/booking-widget.tsx` | Legacy monolithic booking widget |

## External Dependencies

### Boulevard Integration
- **Boulevard Admin GraphQL API**: Business location data, appointment metrics, provider schedules
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
