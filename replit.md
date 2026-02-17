# BLVD Availability Service Testing Tool

## Overview

This is a web-based testing tool for the BLVD (Boulevard) Admin GraphQL API, designed to test and validate API connectivity for the Boulevard Availability Service. The application provides a comprehensive interface for testing GraphQL queries against the Boulevard Admin API, specifically focusing on location data retrieval and appointment metrics.

The tool serves as both a validation utility and a development aid for building services that integrate with Boulevard's scheduling platform. It allows developers to test API credentials, query business locations, and validate GraphQL schema access before implementing production integrations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React with TypeScript**: Modern React application using functional components and hooks for state management
- **Vite Build System**: Fast development server and optimized production builds with hot module replacement
- **Wouter Routing**: Lightweight client-side routing solution for single-page application navigation
- **Tailwind CSS + shadcn/ui**: Utility-first CSS framework combined with a comprehensive component library for consistent UI design
- **TanStack Query**: Sophisticated data fetching and caching solution with automatic background refetching and error handling

### Backend Architecture
- **Express.js Server**: RESTful API server providing proxy endpoints for Boulevard GraphQL API communication
- **TypeScript**: Full type safety across the entire backend codebase with shared type definitions
- **Modular Service Layer**: Dedicated `BlvdService` class handling all Boulevard API interactions with proper error handling and response validation

### Data Storage Solutions
- **Drizzle ORM**: Type-safe database toolkit configured for PostgreSQL with schema-first approach
- **PostgreSQL Database**: Primary database using Neon serverless PostgreSQL for scalability
- **In-Memory Storage**: Runtime configuration storage for API testing sessions without persistence requirements

### Authentication and Authorization
- **Static API Key Authentication**: Simple bearer token authentication for Boulevard Admin API access
- **Session-based Configuration**: Temporary storage of API credentials during testing sessions without long-term persistence
- **Environment Variable Support**: Configuration via environment variables for deployment flexibility

### API Design Patterns
- **GraphQL Proxy Pattern**: Backend serves as a secure proxy to Boulevard's GraphQL API, handling authentication and request validation
- **RESTful Endpoints**: Simple REST API for frontend-backend communication with clear resource-based URLs
- **Validation Layer**: Zod schema validation for all API requests and responses ensuring type safety and data integrity
- **Error Handling**: Comprehensive error handling with structured error responses and proper HTTP status codes

### UI/UX Architecture
- **Component-Driven Design**: Modular React components using shadcn/ui design system for consistency
- **Responsive Layout**: Mobile-first responsive design with adaptive layouts for different screen sizes
- **Real-time Feedback**: Live connection testing with visual status indicators and detailed error reporting
- **Configuration Management**: User-friendly forms for API credential management with validation and testing capabilities

## External Dependencies

### Boulevard Integration
- **Boulevard Admin GraphQL API**: Primary integration point for accessing business location data and appointment metrics
- **GraphQL Schema Introspection**: Runtime schema validation and query structure verification
- **Bearer Token Authentication**: API key-based authentication for secure Boulevard API access

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL database hosting with connection pooling and automatic scaling
- **Connection Pooling**: Efficient database connection management using `@neondatabase/serverless` driver

### Development and Build Tools
- **Vite Development Server**: Fast development experience with hot module replacement and optimized bundling
- **TypeScript Compiler**: Static type checking across frontend, backend, and shared code
- **Replit Integration**: Specialized Replit plugins for development environment integration and error handling

### UI Component Libraries
- **Radix UI Primitives**: Accessible, unstyled UI components for complex interactions (dialogs, dropdowns, forms)
- **Lucide React Icons**: Comprehensive icon library for consistent visual elements
- **React Hook Form**: Performant form handling with validation and error management

### Utility Libraries
- **Zod**: Runtime type validation and schema definition for API contracts and data validation
- **date-fns**: Date manipulation and formatting utilities for appointment scheduling features
- **clsx/tailwind-merge**: Conditional CSS class management for dynamic styling