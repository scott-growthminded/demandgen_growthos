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
