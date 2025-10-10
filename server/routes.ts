import type { Express } from "express";
import { createServer, type Server } from "http";
import { BlvdService } from "./services/blvd-service";
import { blvdConfigSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get server-side BLVD configuration
  const getServerConfig = () => {
    return {
      apiUrl: process.env.BLVD_ADMIN_API_URL || "",
      apiKey: process.env.BLVD_API_KEY || "",
      secretKey: process.env.BLVD_SECRET_KEY || "",
      businessId: process.env.BLVD_BUSINESS_ID || "",
    };
  };

  // Get BLVD configuration from server environment
  app.get("/api/blvd/config", (req, res) => {
    const config = getServerConfig();
    res.json({
      apiUrl: config.apiUrl,
      businessId: config.businessId,
      hasApiKey: !!config.apiKey, // Don't expose the actual key
    });
  });

  // Test BLVD API connection
  app.post("/api/blvd/test-connection", async (req, res) => {
    try {
      // Use server-side config if available, otherwise fall back to request body
      const serverConfig = getServerConfig();
      const hasServerConfig = serverConfig.apiUrl && serverConfig.apiKey && serverConfig.secretKey && serverConfig.businessId;
      
      console.log('Server config available:', hasServerConfig);
      console.log('Server config:', {
        apiUrl: serverConfig.apiUrl,
        hasApiKey: !!serverConfig.apiKey,
        hasBusinessId: !!serverConfig.businessId,
      });
      
      const config = hasServerConfig 
        ? blvdConfigSchema.parse(serverConfig)
        : blvdConfigSchema.parse(req.body);
        
      console.log('Using config:', {
        apiUrl: config.apiUrl,
        hasApiKey: !!config.apiKey,
        businessId: config.businessId,
      });
      
      const blvdService = new BlvdService(config);
      const result = await blvdService.testConnection();
      res.json(result);
    } catch (error) {
      console.error('Test connection error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid configuration",
      });
    }
  });

  // Execute locations query
  app.post("/api/blvd/query-locations", async (req, res) => {
    try {
      // Use server-side config if available, otherwise fall back to request body
      const serverConfig = getServerConfig();
      const hasServerConfig = serverConfig.apiUrl && serverConfig.apiKey && serverConfig.secretKey && serverConfig.businessId;
      
      console.log('Query locations - server config available:', hasServerConfig);
      
      const config = hasServerConfig 
        ? blvdConfigSchema.parse(serverConfig)
        : blvdConfigSchema.parse(req.body);
        
      console.log('Query locations - using config:', {
        apiUrl: config.apiUrl,
        hasApiKey: !!config.apiKey,
        businessId: config.businessId,
      });
        
      const blvdService = new BlvdService(config);
      const result = await blvdService.executeLocationsQuery();
      res.json(result);
    } catch (error) {
      console.error('Query locations error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Query execution failed",
      });
    }
  });

  // Test endpoint for raw GraphQL query execution
  app.post("/api/blvd/test-query", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { query, variables } = req.body;
      const result = await blvdService.makeGraphqlRequest(query, variables);
      res.json(result);
    } catch (error) {
      console.error('Test query error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Query execution failed",
      });
    }
  });

  // Test alternative data sources for callout information
  app.post("/api/blvd/test-callout-sources", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { locationId, startDate, endDate } = req.body;
      const result = await blvdService.testCalloutDataSources(locationId, startDate, endDate);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Test callout sources error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Testing failed",
      });
    }
  });

  // Get environment info
  app.get("/api/env-info", (req, res) => {
    res.json({
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    });
  });

  // Webhook endpoint for Boulevard events
  app.post("/api/blvd/webhook", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const hasServerConfig = serverConfig.apiKey && serverConfig.secretKey;
      
      if (!hasServerConfig) {
        console.error('Webhook endpoint: Missing server configuration');
        return res.status(500).json({
          error: "Server configuration missing"
        });
      }
      
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      // Parse webhook headers
      const headers = blvdService.parseWebhookHeaders(req.headers as Record<string, string>);
      
      if (!headers.isValid) {
        console.error('Webhook: Missing required headers');
        return res.status(400).json({
          error: "Missing required webhook headers"
        });
      }
      
      // Get raw body as string for verification
      const rawBody = JSON.stringify(req.body);
      
      // Verify webhook signature
      const isValidSignature = blvdService.verifyWebhookSignature(
        headers.hmacSalt!,
        headers.hmacSha256!,
        rawBody
      );
      
      if (!isValidSignature) {
        console.error('Webhook: Invalid signature');
        return res.status(401).json({
          error: "Invalid webhook signature"
        });
      }
      
      // Log successful webhook receipt
      console.log('Webhook received and verified:', {
        eventType: req.body.eventType,
        event: req.body.event,
        businessId: req.body.businessId,
        webhookId: req.body.webhookId,
        timestamp: new Date().toISOString()
      });
      
      // Handle different webhook events
      switch (req.body.eventType) {
        case 'PING':
          console.log('Received PING webhook');
          break;
        case 'APPOINTMENT_CREATED':
        case 'APPOINTMENT_UPDATED':
        case 'APPOINTMENT_CANCELLED':
          console.log(`Received appointment event: ${req.body.eventType}`);
          // Here you would process appointment-related events
          break;
        default:
          console.log(`Received unknown event type: ${req.body.eventType}`);
      }
      
      // Respond quickly to avoid retries (as per Boulevard best practices)
      res.status(200).json({
        success: true,
        received: true,
        eventType: req.body.eventType
      });
      
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({
        error: "Webhook processing failed"
      });
    }
  });

  // Test webhook verification endpoint
  app.post("/api/blvd/test-webhook-verification", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const hasServerConfig = serverConfig.apiKey && serverConfig.secretKey;
      
      if (!hasServerConfig) {
        return res.status(500).json({
          error: "Server configuration missing"
        });
      }
      
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { hmacSalt, hmacSha256, rawBody } = req.body;
      
      if (!hmacSalt || !hmacSha256 || !rawBody) {
        return res.status(400).json({
          error: "Missing required fields: hmacSalt, hmacSha256, rawBody"
        });
      }
      
      const isValid = blvdService.verifyWebhookSignature(hmacSalt, hmacSha256, rawBody);
      
      res.json({
        valid: isValid,
        message: isValid ? "Webhook signature is valid" : "Webhook signature is invalid"
      });
      
    } catch (error) {
      console.error('Test webhook verification error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Verification test failed"
      });
    }
  });

  // Generic GraphQL query endpoint for exploration and testing
  app.post("/api/blvd/graphql-query", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const hasServerConfig = serverConfig.apiUrl && serverConfig.apiKey && serverConfig.secretKey && serverConfig.businessId;
      
      if (!hasServerConfig) {
        return res.status(500).json({
          error: "Server configuration missing"
        });
      }
      
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { query, variables } = req.body;
      
      if (!query) {
        return res.status(400).json({
          error: "Missing required field: query"
        });
      }
      
      const result = await blvdService.makeGraphqlRequest(query, variables || {});
      res.json(result);
      
    } catch (error) {
      console.error('GraphQL query error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "GraphQL query failed"
      });
    }
  });

  // Test endpoint: Query shifts and timeblocks for a specific location and date
  app.post("/api/blvd/test-shifts-and-timeblocks", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const hasServerConfig = serverConfig.apiUrl && serverConfig.apiKey && serverConfig.secretKey && serverConfig.businessId;
      
      if (!hasServerConfig) {
        return res.status(500).json({
          error: "Server configuration missing"
        });
      }
      
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { locationId, date } = req.body;
      
      if (!locationId || !date) {
        return res.status(400).json({
          error: "Missing required fields: locationId, date"
        });
      }
      
      // Parse date and create date range
      const targetDate = new Date(date);
      const startDate = new Date(targetDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);
      
      console.log(`\n========== TESTING SHIFTS & TIMEBLOCKS ==========`);
      console.log(`Location: ${locationId}`);
      console.log(`Date: ${date}`);
      console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      // Query shifts
      const shifts = await blvdService.getStaffShifts(locationId, startDate.toISOString(), endDate.toISOString());
      
      // Query timeblocks
      const timeblocks = await blvdService.getTimeblocks(locationId, startDate.toISOString(), endDate.toISOString());
      
      console.log(`\n✅ SHIFTS FOUND: ${shifts.length}`);
      console.log(`✅ TIMEBLOCKS FOUND: ${timeblocks.length}`);
      console.log(`================================================\n`);
      
      res.json({
        locationId,
        date,
        shifts: shifts,
        timeblocks: timeblocks,
        shiftsCount: shifts.length,
        timeblocksCount: timeblocks.length
      });
      
    } catch (error) {
      console.error('Test shifts/timeblocks error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Test failed"
      });
    }
  });

  // Test Client API availability for a specific location
  app.post("/api/blvd/test-client-availability", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const hasServerConfig = serverConfig.apiUrl && serverConfig.apiKey && serverConfig.secretKey && serverConfig.businessId;
      
      if (!hasServerConfig) {
        return res.status(500).json({
          error: "Server configuration missing"
        });
      }
      
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { locationId, date } = req.body;
      
      if (!locationId || !date) {
        return res.status(400).json({
          error: "Missing required fields: locationId, date (YYYY-MM-DD)"
        });
      }
      
      console.log(`\n========== TESTING CLIENT API AVAILABILITY ==========`);
      console.log(`Location: ${locationId}`);
      console.log(`Date: ${date}`);
      
      const result = await blvdService.getLocationAvailabilityFromClientAPI(locationId, date);
      
      if (!result) {
        return res.status(500).json({
          error: "Failed to get availability from Client API"
        });
      }
      
      console.log(`\n✅ AVAILABLE SLOTS: ${result.totalSlots}`);
      console.log(`================================================\n`);
      
      res.json({
        locationId,
        date,
        availableSlots: result.totalSlots,
        slots: result.availableSlots,
        cached: result.totalSlots > 0 // Simple indicator if result came from cache
      });
      
    } catch (error) {
      console.error('Test Client API availability error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Test failed"
      });
    }
  });

  // Get available locations with 25% or more availability for tomorrow
  app.post("/api/blvd/availability", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const hasServerConfig = serverConfig.apiUrl && serverConfig.apiKey && serverConfig.secretKey && serverConfig.businessId;
      
      if (!hasServerConfig) {
        return res.status(500).json({
          error: "Server configuration missing"
        });
      }
      
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      // Parse request body for parameters
      const minAvailabilityPercent = req.body.minAvailability || 25;
      const date = req.body.date; // Optional date parameter
      const locationId = req.body.locationId; // Optional locationId to filter single location
      
      console.log(`Checking availability for locations with ${minAvailabilityPercent}% or more availability${date ? ` for date ${date}` : ' for tomorrow'}${locationId ? ` (single location: ${locationId})` : ''}`);
      
      const result = await blvdService.getAvailableLocations(minAvailabilityPercent, date, locationId);
      res.json(result);
      
    } catch (error) {
      console.error('Availability check error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Availability check failed"
      });
    }
  });

  // Generate Glowbar-style CSV report
  app.post("/api/blvd/availability-csv", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const hasServerConfig = serverConfig.apiUrl && serverConfig.apiKey && serverConfig.secretKey && serverConfig.businessId;
      
      if (!hasServerConfig) {
        return res.status(500).json({
          error: "Server configuration missing"
        });
      }
      
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      // Parse request body for parameters
      const minAvailabilityPercent = req.body.minAvailability || 0; // Include all locations for CSV
      
      console.log('Generating Glowbar-style CSV report with real appointment data');
      
      const result = await blvdService.getAvailableLocations(minAvailabilityPercent);
      
      // Generate CSV using real appointment data
      const csvData = blvdService.generateGlowbarCSVReport(result.allLocations || []);
      
      // Set appropriate headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="glowbar-availability-report.csv"');
      
      res.send(csvData);
      
    } catch (error) {
      console.error('CSV generation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "CSV generation failed"
      });
    }
  });


  // Booking Widget API Routes
  
  // Get staff/estheticians for a location
  app.get("/api/booking/staff/:locationId", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { locationId } = req.params;
      const staff = await blvdService.getLocationStaff(locationId);
      
      res.json({ 
        success: true, 
        staff: staff.map(s => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          displayName: s.displayName,
          avatar: s.avatar
        }))
      });
    } catch (error) {
      console.error('Get staff error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get staff"
      });
    }
  });

  // Get available time slots for a location on a specific date
  app.get("/api/booking/timeslots/:locationId/:date", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { locationId, date } = req.params;
      const timeSlots = await blvdService.getBookableTimeSlots(locationId, date);
      
      res.json({ 
        success: true, 
        timeSlots 
      });
    } catch (error) {
      console.error('Get time slots error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get time slots"
      });
    }
  });

  // Get booking availability with smart location fallback
  app.post("/api/booking/availability", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { locationId, date, maxDistance = 5 } = req.body;
      
      if (!locationId || !date) {
        return res.status(400).json({
          error: "Missing required fields: locationId, date"
        });
      }

      // Get primary location details
      const locationsResponse = await blvdService.executeLocationsQuery();
      const allLocations = (locationsResponse.data as any)?.locations?.edges?.map((edge: any) => edge.node) || [];
      const primaryLocation = allLocations.find((loc: any) => loc.id === locationId);

      if (!primaryLocation) {
        return res.status(404).json({
          error: "Location not found"
        });
      }

      // Get time slots and staff for primary location
      const [timeSlots, staff] = await Promise.all([
        blvdService.getBookableTimeSlots(locationId, date),
        blvdService.getLocationStaff(locationId)
      ]);

      // If no availability, find nearby alternatives
      let alternativeLocations: any[] = [];
      if (timeSlots.length === 0) {
        console.log(`No availability at ${primaryLocation.name}, finding alternatives...`);
        const nearby = await blvdService.getNearbyLocations(locationId, maxDistance);
        
        // Get availability for nearby locations
        for (const nearbyLoc of nearby.slice(0, 3)) { // Limit to top 3 nearest
          const nearbySlots = await blvdService.getBookableTimeSlots(nearbyLoc.id, date);
          if (nearbySlots.length > 0) {
            alternativeLocations.push({
              ...nearbyLoc,
              availableSlots: nearbySlots.length
            });
          }
        }
      }

      res.json({
        success: true,
        location: {
          id: primaryLocation.id,
          name: primaryLocation.name,
          address: primaryLocation.address,
        },
        date,
        timeSlots,
        estheticians: staff.map((s: any) => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          displayName: s.displayName,
          avatar: s.avatar
        })),
        alternativeLocations: alternativeLocations.length > 0 ? alternativeLocations : undefined
      });
    } catch (error) {
      console.error('Get availability error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get availability"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
