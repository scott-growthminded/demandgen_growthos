import { z } from "zod";

// BLVD API Configuration
export const blvdConfigSchema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
  secretKey: z.string().min(1),
  businessId: z.string().min(1),
});

export type BlvdConfig = z.infer<typeof blvdConfigSchema>;

// GraphQL Response Types
export const locationSchema = z.object({
  id: z.string(),
  name: z.string(),
  timeZone: z.string(),
});

export const businessSchema = z.object({
  id: z.string(),
  name: z.string(),
  locations: z.object({
    edges: z.array(z.object({
      node: locationSchema,
    })),
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      endCursor: z.string().nullable(),
    }),
  }),
});

export const graphqlResponseSchema = z.object({
  data: z.object({
    business: businessSchema,
  }).nullable(),
  errors: z.array(z.object({
    message: z.string(),
    path: z.array(z.string()).optional(),
  })).optional(),
});

// Test Result Types
export const testResultSchema = z.object({
  name: z.string(),
  status: z.enum(['passed', 'failed', 'testing']),
  message: z.string(),
  metadata: z.record(z.string()).optional(),
});

export const connectionTestResultSchema = z.object({
  connected: z.boolean(),
  tests: z.array(testResultSchema),
  responseTime: z.number().optional(),
  error: z.string().optional(),
});

export type Location = z.infer<typeof locationSchema>;
export type Business = z.infer<typeof businessSchema>;
export type GraphqlResponse = z.infer<typeof graphqlResponseSchema>;
export type TestResult = z.infer<typeof testResultSchema>;
export type ConnectionTestResult = z.infer<typeof connectionTestResultSchema>;

// Booking Widget Types
export const bookingLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.object({
    street: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string().optional(),
  }).optional(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  timeZone: z.string().default('America/New_York'),
});

export const estheticianSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string(),
  avatar: z.string().optional(),
});

export const timeSlotSchema = z.object({
  id: z.string(),
  startTime: z.string(), // ISO string
  endTime: z.string().optional(),
  available: z.boolean(),
  staffId: z.string().optional(),
});

export const bookingStateSchema = z.object({
  locationId: z.string(),
  date: z.string(), // YYYY-MM-DD format
  timeSlot: timeSlotSchema.optional(),
  estheticianId: z.string().optional(),
  serviceId: z.string().optional(),
});

export const availabilityResponseSchema = z.object({
  location: bookingLocationSchema,
  date: z.string(),
  timeSlots: z.array(timeSlotSchema),
  estheticians: z.array(estheticianSchema),
  alternativeLocations: z.array(bookingLocationSchema).optional(),
});

export type BookingLocation = z.infer<typeof bookingLocationSchema>;
export type Esthetician = z.infer<typeof estheticianSchema>;
export type TimeSlot = z.infer<typeof timeSlotSchema>;
export type BookingState = z.infer<typeof bookingStateSchema>;
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;

// Booking Cart Schema (for Client API flow)
export const bookingCartSchema = z.object({
  id: z.string(),
  cartId: z.string(),
  productType: z.enum(['Treatment', 'Product', 'GiftCard']).default('Treatment'),
  plan: z.enum(['Member', 'NonMember']).optional(),
  locationId: z.string().optional(),
  locationName: z.string().optional(),
  serviceId: z.string().optional(),
  serviceName: z.string().optional(),
  bookableTimeId: z.string().optional(),
  selectedDate: z.string().optional(),
  selectedTime: z.string().optional(),
  clientInfo: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phoneNumber: z.string(),
  }).optional(),
  paymentMethodId: z.string().optional(),
  status: z.enum(['creating', 'items_added', 'time_reserved', 'info_collected', 'payment_added', 'completed']).default('creating'),
  createdAt: z.string(),
});

export const insertBookingCartSchema = bookingCartSchema.omit({ id: true, createdAt: true });

export type BookingCart = z.infer<typeof bookingCartSchema>;
export type InsertBookingCart = z.infer<typeof insertBookingCartSchema>;

// Waitlist Request Schema
export const waitlistRequestSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phoneNumber: z.string(),
  locationId: z.string(),
  locationName: z.string().optional(),
  serviceId: z.string().optional(),
  serviceName: z.string().optional(),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['pending', 'contacted', 'booked', 'cancelled']).default('pending'),
  createdAt: z.string(),
});

export const insertWaitlistRequestSchema = waitlistRequestSchema.omit({ id: true, createdAt: true });

export type WaitlistRequest = z.infer<typeof waitlistRequestSchema>;
export type InsertWaitlistRequest = z.infer<typeof insertWaitlistRequestSchema>;
