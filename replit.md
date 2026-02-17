# Glowbar Booking Widget

## Overview

A comprehensive booking widget for Glowbar spa/facial treatment services, integrated with the Boulevard (BLVD) Admin and Client GraphQL APIs. The widget supports multiple user flows (leads, non-members, members), gift card purchases, membership sign-ups, facial treatment bookings, location search with maps, phone verification, date/time selection, esthetician filtering, and checkout with payment processing.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- Implemented complete multi-step booking flow with 11 distinct page states
- Built location selection with interactive Leaflet map, address search (Nominatim geocoding), and distance-based sorting
- Created phone verification system with test patterns for simulating user types
- Implemented conditional treatment logic based on location and user type
- Designed checkout page with Member Perks section featuring icons and benefit descriptions
- Implemented esthetician filtering with visual coral-themed highlighting when active
- Enhanced UI with progress bar, spacing refinements, and Glowbar brand color (#FF502D) theming

## Booking Flow & User Types

### User Flows
- **Lead** (userFlow = 'lead'): New user with 0 visits. Identified via phone verification (test: 1111111111).
- **Non-member** (userFlow = 'non-member'): Returning user with 1+ visits, not a member. (test: 2222222222).
- **Member** (userFlow = 'member'): Active member with any visit count. (test: 3333333333 for returning member, 4444444444 for first-time member with 0 visits).

### Booking Steps (BookingStep type)
1. `location` - Location selection with map, search, state grouping
2. `phone-verification` - Phone number entry for user identification
3. `otp` - OTP code verification
4. `customer-type` - New vs returning customer selection (legacy flow)
5. `login` - Login page (legacy flow)
6. `personal-info` - First/last name, email, phone for leads
7. `product` - Treatment/product selection with conditional options
8. `gift-recipient` - Gift card recipient details (name, email, delivery date, message)
9. `datetime` - Calendar date picker + time slot selection + esthetician filter
10. `checkout` - Order summary, payment, promo codes, Member Perks section
11. `confirmation` - Booking confirmation

### Conditional Treatment Logic
- **Murray Hill location**: Shows 40-minute first-time treatments
- **All other locations**: Shows 30-minute treatments
- **Members with 0 visits**: See "17 and under" treatment options
- **Non-members**: See membership upsell links throughout treatment options
- **First-time non-members**: Pay $80
- **Returning non-members**: Pay $80
- **Members**: Use vouchers for treatment payment

### Location Filtering
- Excluded locations: "Williamsburg Kent" and "Training Studio"
- Locations grouped by state: NJ, NY, CT, PA, MA, DC, VA
- Address search uses Nominatim (OpenStreetMap) geocoding
- Distance calculation uses Haversine formula
- Nearby locations section on datetime page shows top 3 closest alternatives

## System Architecture

### Project Structure
```
client/src/
  App.tsx                          - Root app with routing (wouter)
  pages/
    booking-widget.tsx             - Main booking widget (~3400 lines, all steps)
    blvd-api-test.tsx              - API testing page (not routed)
    booking-flow/                  - Alternative booking flow components (not currently routed)
      index.tsx, CheckoutPage.tsx, ConfirmationPage.tsx, CustomerTypePage.tsx,
      DateTimePage.tsx, LocationPage.tsx, LoginPage.tsx, PersonalInfoPage.tsx,
      ProductSelectionPage.tsx
  components/
    ui/                            - shadcn/ui component library
    configuration-panel.tsx        - BLVD config panel
    DeveloperControls.tsx          - Dev tools
    quick-actions.tsx              - Quick action buttons
    testing-panel.tsx              - API testing panel
  contexts/
    BookingFlowContext.tsx          - Booking flow context provider
  lib/
    blvd-api.ts                    - BLVD API client helpers
    queryClient.ts                 - TanStack Query client setup
    utils.ts                       - Utility functions (cn, etc.)
  hooks/
    use-toast.ts                   - Toast notification hook
    use-mobile.tsx                 - Mobile detection hook

server/
  index.ts                         - Express server entry point
  routes.ts                        - All API route definitions (~1316 lines)
  storage.ts                       - In-memory storage for carts and waitlist
  services/
    blvd-service.ts                - Boulevard API service class
  vite.ts                          - Vite dev server integration

shared/
  schema.ts                        - Zod schemas and TypeScript types
```

### Frontend Architecture
- **React with TypeScript**: Single-page app using functional components and hooks
- **Vite Build System**: Dev server on port 5000, HMR enabled
- **Wouter Routing**: Single route `/` renders BookingWidget
- **Tailwind CSS + shadcn/ui**: Utility-first CSS with component library
- **TanStack Query v5**: Data fetching with object-form queries (`useQuery({ queryKey: [...] })`)
- **Leaflet Maps**: Interactive location map with custom Glowbar-styled markers (red pins)
- **date-fns**: Date formatting and manipulation

### Backend Architecture
- **Express.js**: RESTful API proxy to Boulevard GraphQL APIs
- **BlvdService class**: Handles all Boulevard Admin and Client API interactions
- **In-Memory Storage**: Runtime storage for booking carts and waitlist requests (no DB tables used for booking data)
- **Environment-based Configuration**: BLVD API credentials from environment variables

### Data Storage
- **Drizzle ORM + PostgreSQL (Neon)**: Configured but booking data uses in-memory storage
- **In-Memory Storage**: BookingCart sessions, WaitlistRequest records
- **Zod Schemas**: Shared type definitions in `shared/schema.ts`

## API Routes

### Booking Widget Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/booking/locations` | All locations grouped by state/city (excludes Williamsburg Kent, Training Studio) |
| GET | `/api/booking/availability/:locationId/:date` | Time slot availability from Boulevard Client API |
| GET | `/api/booking/staff/:locationId` | Staff/estheticians for a location (top 2 with shifts) |
| GET | `/api/booking/timeslots/:locationId/:date` | Bookable time slots |
| POST | `/api/booking/availability` | Detailed availability with esthetician-specific slots and nearby alternatives |

### Cart Routes (Boulevard Client API Flow)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/cart/create` | Create a new cart for a location |
| GET | `/api/cart/:cartId` | Get cart details |
| POST | `/api/cart/:cartId/add-item` | Add bookable item to cart |
| GET | `/api/cart/:cartId/dates` | Get bookable dates |
| GET | `/api/cart/:cartId/times/:date` | Get bookable times for a date |
| POST | `/api/cart/:cartId/reserve` | Reserve a time slot |
| POST | `/api/cart/:cartId/client-info` | Update client information |
| POST | `/api/cart/:cartId/payment` | Add payment method |
| POST | `/api/cart/:cartId/checkout` | Complete checkout |

### Waitlist Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/waitlist` | Submit waitlist request |
| GET | `/api/waitlist` | Get all waitlist requests |

### BLVD Admin/Testing Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/blvd/config` | Get server-side BLVD config (masked) |
| POST | `/api/blvd/test-connection` | Test API connectivity |
| POST | `/api/blvd/query-locations` | Execute locations query |
| POST | `/api/blvd/graphql-query` | Generic GraphQL query endpoint |
| POST | `/api/blvd/availability` | Check availability across locations |
| POST | `/api/blvd/availability-csv` | Generate CSV availability report |
| POST | `/api/blvd/test-client-availability` | Test Client API availability |
| POST | `/api/blvd/test-shifts-and-timeblocks` | Test shifts and timeblocks query |
| POST | `/api/blvd/test-callout-sources` | Test callout data sources |
| POST | `/api/blvd/webhook` | Boulevard webhook endpoint |
| POST | `/api/blvd/test-webhook-verification` | Test webhook signature verification |
| GET | `/api/env-info` | Environment info |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `BLVD_ADMIN_API_URL` | Boulevard Admin GraphQL API URL |
| `BLVD_API_KEY` | Boulevard API key |
| `BLVD_SECRET_KEY` | Boulevard secret key |
| `BLVD_BUSINESS_ID` | Boulevard business ID |
| `DATABASE_URL` | PostgreSQL connection string (Neon) |

## UI/UX Design Notes

### Brand Colors
- Primary action: `#FF502D` (Glowbar coral/red)
- Accent background: `#FFF0ED` (light coral tint)
- Map markers: Red SVG pins with white center dots

### Key UI Components
- **Progress Bar**: Visual step indicator with coral fill based on current booking step
- **Location Map**: Leaflet map with custom red markers, user location (black dot), popup cards
- **Calendar**: Custom month-view calendar with day selection, today indicator, trailing days
- **Time Slots**: Grouped by morning/afternoon/evening, pill-shaped buttons with "$10 OFF" discount badges
- **Esthetician Filter**: Dropdown with coral highlight border when specific esthetician selected
- **Member Perks Section**: Icons (Star, Shield, Gift, RotateCcw, Sparkles, Award) with benefit descriptions
- **Questionnaire Dialog**: Accutane, injections, waxing confirmation before treatment selection

### Member Perks (Checkout)
- 20% off all products
- Annual guest pass
- 3-month treatment rollover
- Loyalty rewards program
- Exclusive member events

## External Dependencies

### Boulevard Integration
- **Admin GraphQL API**: Location data, staff shifts, appointments, timeblocks
- **Client GraphQL API**: Cart management, availability, booking flow
- **Webhook Support**: HMAC-SHA256 signature verification for appointment events

### Mapping
- **Leaflet + react-leaflet**: Interactive maps with custom marker icons
- **Nominatim (OpenStreetMap)**: Address geocoding for location search

### Key Libraries
- `@tanstack/react-query` v5: Data fetching and caching
- `wouter`: Client-side routing
- `date-fns`: Date utilities
- `zod`: Runtime validation
- `lucide-react`: Icon library
- `drizzle-orm` + `@neondatabase/serverless`: Database toolkit (configured, minimal usage)

## Assets
- `attached_assets/image_1763999100752.png` - Glowbar logo
- `attached_assets/home_hero_flip_1764064272021.png` - Home hero image
- `attached_assets/Gift_Card_(9)_1767270260646.png` - Gift card mockup
- `attached_assets/stock_images/woman_receiving_faci_e972fbc7.jpg` - Facial treatment image
- `attached_assets/stock_images/woman_at_luxury_spa__a296b478.jpg` - Luxury spa image
