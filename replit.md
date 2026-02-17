# Glowbar Booking Widget

## Overview

The Glowbar Booking Widget is a comprehensive system designed to streamline the booking of spa and facial treatment services. It integrates deeply with Boulevard (BLVD) Admin and Client GraphQL APIs to provide a seamless user experience. The project's vision is to offer a robust, user-friendly platform that caters to various customer segments—leads, non-members, and members—while supporting diverse functionalities like gift card purchases, membership sign-ups, and facial treatment bookings. Key capabilities include location-based search with mapping, phone verification, flexible date/time selection, esthetician filtering, and a complete checkout process with payment integration. The project aims to enhance Glowbar's market presence by simplifying access to its services and improving customer engagement through an intuitive digital booking journey.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The Glowbar Booking Widget is built as a single-page application using **React with TypeScript** and a **Vite build system**. It leverages **Wouter** for client-side routing, displaying the main booking widget on the `/` route. The UI/UX prioritizes the Glowbar brand, utilizing **Tailwind CSS** for utility-first styling combined with **shadcn/ui** components. A distinct color scheme features `#FF502D` (Glowbar coral/red) as the primary action color and `#FFF0ED` as an accent background, visible in elements like the progress bar and custom Leaflet map markers.

Data fetching is managed by **TanStack Query v5**, employing an object-form query approach for efficient caching and state management. Interactive location selection is powered by **Leaflet Maps** and `react-leaflet`, featuring custom coral-themed markers and address geocoding via **Nominatim (OpenStreetMap)**. Date and time manipulations are handled by `date-fns`.

The backend is an **Express.js** server acting as a RESTful API proxy to the Boulevard GraphQL APIs. A dedicated `BlvdService` class centralizes all interactions with the Boulevard Admin and Client APIs. Booking carts and waitlist requests are managed using **in-memory storage** for runtime data, with `Zod` schemas defining shared type definitions for robust data validation across the frontend and backend. The architecture supports a multi-step booking flow with distinct states, conditional treatment logic based on location and user type, and a detailed checkout process including Member Perks.

## External Dependencies

-   **Boulevard APIs**:
    -   **Admin GraphQL API**: Used for fetching location data, staff shifts, appointments, and timeblocks.
    -   **Client GraphQL API**: Handles cart management, availability lookups, and the core booking flow operations.
    -   **Webhooks**: Supports HMAC-SHA256 signature verification for receiving appointment events.
-   **Mapping Services**:
    -   **Leaflet** and `react-leaflet`: For interactive map functionalities and custom marker rendering.
    -   **Nominatim (OpenStreetMap)**: Provides address geocoding capabilities for location search.
-   **Key Libraries**:
    -   `@tanstack/react-query` v5: Essential for data fetching, caching, and state synchronization.
    -   `wouter`: Manages client-side routing within the single-page application.
    -   `date-fns`: Utilized for date formatting, parsing, and manipulation.
    -   `zod`: Enforces runtime validation for data schemas.
    -   `lucide-react`: Supplies a collection of icons used across the user interface.
-   **Database (Configured, Minimal Usage)**:
    -   `drizzle-orm` with `@neondatabase/serverless`: Configured for potential future database interactions, though current booking data relies on in-memory storage.