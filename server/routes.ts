import type { Express } from "express";
import { createServer, type Server } from "http";
import { BlvdService } from "./services/blvd-service";
import { blvdConfigSchema, insertBookingCartSchema, insertWaitlistRequestSchema, tacticsConfigSchema } from "@shared/schema";
import { storage } from "./storage";
import {
  createCustomerRepo,
  createAvailabilityRepo,
  createTacticsRepo,
  createDiscountCodeRepo,
  dataMode,
} from "./dal/factory";
import { buildRecommendation, computeIncentiveFactors } from "./services/recommendation";

// Initialize DAL repos once at server startup
const customerRepo = createCustomerRepo();
const availabilityRepo = createAvailabilityRepo();
const tacticsRepo = createTacticsRepo();
const discountCodeRepo = createDiscountCodeRepo();

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
  
  // Get all locations grouped by state and city
  app.get("/api/booking/locations", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const locationsResponse = await blvdService.executeLocationsQuery();
      const allLocations = (locationsResponse.data as any)?.locations?.edges?.map((edge: any) => edge.node) || [];
      
      // Filter out remote locations and excluded locations, then group by state and city
      const excludedLocationNames = ['Williamsburg Kent', 'Training Studio'];
      const physicalLocations = allLocations.filter((loc: any) => 
        !loc.isRemote && !excludedLocationNames.includes(loc.name)
      );
      
      // Don't pre-load staff - we'll fetch them when checking availability for a specific date
      // This ensures we only show staff who are actually available
      const locationsData = physicalLocations.map((loc: any) => ({
        id: loc.id,
        name: loc.name,
        address: loc.address,
        subtext: loc.subtext, // Pass subtext through to the frontend
        coordinates: loc.coordinates ? {
          lat: loc.coordinates.latitude,
          lng: loc.coordinates.longitude
        } : undefined,
        staff: [] // Staff will be loaded per date in availability endpoint
      }));
      
      // Group by state and city
      const grouped = locationsData.reduce((acc: any, loc: any) => {
        const state = loc.address?.state || 'Other';
        const city = loc.address?.city || 'Unknown';
        
        if (!acc[state]) {
          acc[state] = {};
        }
        
        if (!acc[state][city]) {
          acc[state][city] = [];
        }
        
        acc[state][city].push(loc);
        
        return acc;
      }, {});
      
      res.json(grouped);
    } catch (error) {
      console.error('Error fetching locations:', error);
      res.status(500).json({ error: 'Failed to fetch locations' });
    }
  });
  
  // Get availability for a location on a specific date
  app.get("/api/booking/availability/:locationId/:date", async (req, res) => {
    const { locationId, date } = req.params;

    // ── Demo mock availability (no BLVD credentials required) ────────────────
    //
    // Real BLVD cartBookableTimes fields: id (ID!), startTime (DateTime!), score (Float!)
    // Derived field added by this routes layer (NOT from BLVD): isDiscounted
    //
    if (locationId === 'demo-union-square') {
      // Generate 40-minute-cadence slots from 8:00 AM to 8:00 PM
      // 40-min cadence matches real Boulevard appointment scheduling data for this location.
      const slots: any[] = [];
      let minuteOffset = 0;
      const START_HOUR = 8;
      const END_HOUR = 20;
      while (true) {
        const totalMin = START_HOUR * 60 + minuteOffset;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        if (h >= END_HOUR) break;
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        slots.push({
          // Real BLVD cartBookableTimes fields:
          id: `demo-slot-${hh}${mm}-${date}`,
          startTime: `${date}T${hh}:${mm}:00`,   // Local-time ISO string (no tz offset), matches BLVD format
          score: 1.0,                              // BLVD Float 0–1; placeholder (real values reflect booking pressure)
          // Derived field (added by routes layer, not present in BLVD response):
          isDiscounted: false,
        });
        minuteOffset += 40;
      }
      return res.json({ success: true, availableSlots: slots, totalSlots: slots.length });
    }
    // ─────────────────────────────────────────────────────────────────────────

    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);

      // Get real availability from Boulevard Client API
      const availability = await blvdService.getLocationAvailabilityFromClientAPI(locationId, date);
      
      if (!availability) {
        return res.json({ 
          success: false, 
          availableSlots: [],
          totalSlots: 0
        });
      }
      
      // Add discount flags to specific appointments
      // Mark every 3rd appointment as discounted (simulating special pricing)
      const slotsWithDiscounts = availability.availableSlots.map((slot: any, index: number) => ({
        ...slot,
        isDiscounted: index % 3 === 0 // Every 3rd slot is discounted
      }));
      
      res.json({ 
        success: true, 
        availableSlots: slotsWithDiscounts,
        totalSlots: availability.totalSlots
      });
    } catch (error) {
      console.error('Get availability error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get availability"
      });
    }
  });
  
  // Get staff/estheticians for a location
  app.get("/api/booking/staff/:locationId", async (req, res) => {
    const { locationId } = req.params;

    // ── Demo mock staff ───────────────────────────────────────────────────────
    if (locationId === 'demo-union-square') {
      return res.json({
        success: true,
        staff: [
          { id: 'demo-staff-aleczandra', firstName: 'Aleczandra', lastName: 'Almodovar', displayName: 'Aleczandra Almodovar', avatar: null },
          { id: 'demo-staff-alex',       firstName: 'Alex',       lastName: 'D',         displayName: 'Alex D',               avatar: null },
          { id: 'demo-staff-lynette',    firstName: 'Lynette',    lastName: 'C',         displayName: 'Lynette C',            avatar: null },
          { id: 'demo-staff-sofia',      firstName: 'Sofia',      lastName: 'D',         displayName: 'Sofia D',              avatar: null },
          { id: 'demo-staff-tatyana',    firstName: 'Tatyana',    lastName: 'L',         displayName: 'Tatyana L',            avatar: null },
        ],
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);

      
      // Get all staff
      const allStaff = await blvdService.getLocationStaff(locationId);
      
      // Get shifts for the next 30 days to determine which staff work at this location
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const shifts = await blvdService.getStaffShifts(locationId, startDate, endDate);
      
      // Extract unique staff IDs from shifts (these are short IDs without URN prefix)
      const staffIdsWithShifts = new Set(
        shifts.map(shift => shift.staffId)
      );
      
      console.log(`🔍 DEBUG: Sample shift staffId: ${shifts[0]?.staffId}`);
      console.log(`🔍 DEBUG: Sample staff ID: ${allStaff[0]?.id}`);
      console.log(`🔍 DEBUG: Shift staff IDs (first 3):`, Array.from(staffIdsWithShifts).slice(0, 3));
      
      // Filter staff to only those who have shifts at this location
      // Staff IDs from API are in URN format: urn:blvd:Staff:SHORT_ID
      // Shift staffIds are just the SHORT_ID part
      const locationStaff = allStaff.filter(staff => {
        const shortStaffId = staff.id.includes(':') ? staff.id.split(':').pop() : staff.id;
        const match = staffIdsWithShifts.has(shortStaffId);
        if (allStaff.indexOf(staff) < 3) {
          console.log(`🔍 DEBUG: Staff ${staff.displayName}: fullId=${staff.id}, shortId=${shortStaffId}, match=${match}`);
        }
        return match;
      });
      
      console.log(`✅ Found ${locationStaff.length} staff working at location (out of ${allStaff.length} total staff)`);
      
      // Ensure exactly 2 estheticians are returned for filtering purposes
      // Take the first 2 staff members with shifts at this location
      const staffForFiltering = locationStaff.slice(0, 2);
      
      res.json({ 
        success: true, 
        staff: staffForFiltering.map(s => ({
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

      // Calculate availability using Admin API (shifts and appointments)
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      // Fetch appointments for the date
      const appointmentsResponse = await blvdService.getLocationAppointments(
        locationId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      // Extract appointments array from GraphQL response
      const appointments = (appointmentsResponse.data as any)?.appointments?.edges?.map((edge: any) => edge.node) || [];
      
      const availabilityCalc = await blvdService.calculateHourlyAvailability(
        locationId,
        startDate.toISOString().split('T')[0],
        appointments
      );
      
      // Combine staff from TWO sources:
      // 1. Staff embedded in appointments (those with bookings)
      // 2. Staff from shifts who may not have bookings yet
      
      const staffMap = new Map();
      
      // First: Extract staff from appointments (they have full details)
      appointments.forEach((apt: any) => {
        const staff = apt.appointmentServices?.[0]?.staff;
        if (staff && staff.id) {
          const fullId = staff.id.includes(':') ? staff.id.split(':').pop() : staff.id;
          staffMap.set(fullId, {
            id: staff.id,
            firstName: staff.firstName,
            lastName: staff.lastName,
            displayName: `${staff.firstName} ${staff.lastName}`,
            role: staff.role
          });
        }
      });
      
      console.log(`📋 Found ${staffMap.size} staff from appointments:`, 
        Array.from(staffMap.values()).map((s: any) => s.firstName).join(', '));
      
      // Second: Get shifts and find any staff not already in our map
      const shiftsForStaff = await blvdService.getStaffShifts(
        locationId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      // Get all organization staff to look up details for shift-only staff
      const allStaff = await blvdService.getLocationStaff(locationId);
      const allStaffByUuid = new Map();
      allStaff.forEach((s: any) => {
        const fullId = s.id.includes(':') ? s.id.split(':').pop() : s.id;
        allStaffByUuid.set(fullId, s);
      });
      
      // Add staff from shifts who aren't already in the map
      shiftsForStaff.forEach((shift: any) => {
        if (shift.available && shift.staffId) {
          // staffId could be either full UUID or short ID
          const shiftStaffId = shift.staffId;
          
          if (!staffMap.has(shiftStaffId) && allStaffByUuid.has(shiftStaffId)) {
            const s = allStaffByUuid.get(shiftStaffId);
            const fullId = s.id.includes(':') ? s.id.split(':').pop() : s.id;
            staffMap.set(fullId, {
              id: s.id,
              firstName: s.firstName,
              lastName: s.lastName,
              displayName: `${s.firstName} ${s.lastName}`,
              role: s.role
            });
          }
        }
      });
      
      const staff = Array.from(staffMap.values());
      console.log(`✅ Total ${staff.length} staff members working at this location on ${date}:`,
        staff.map((s: any) => `${s.firstName} ${s.lastName}`).join(', '));
      
      // Get location timezone info for proper timestamp generation
      const locationTimezone = blvdService.inferLocationTimeZone(
        primaryLocation.name,
        primaryLocation.address
      );
      
      // Generate time slots per esthetician based on their actual availability
      const timeSlots: any[] = [];
      const availableEstheticianIds = new Set();
      
      // Get shift data to know when each staff member is working
      const staffShifts = await blvdService.getStaffShifts(
        locationId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      // Get timeblocks (breaks, notes, etc.) for this location
      const timeblocks = await blvdService.getTimeblocks(
        locationId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      console.log(`📋 Found ${timeblocks.length} timeblocks (breaks/notes) for this date`);
      
      // Build map of staff appointments
      // NOTE: Appointments from API are in UTC, convert to local time for comparison
      // Skip HOLD and CANCELLED appointments - only CONFIRMED appointments block slots
      const appointmentsByStaff = new Map();
      appointments.forEach((apt: any) => {
        // Skip HOLD and CANCELLED appointments
        if (apt.cancelled || apt.state === 'CANCELLED' || apt.state === 'HOLD') {
          return;
        }
        
        const staffId = apt.appointmentServices?.[0]?.staff?.id;
        if (staffId) {
          if (!appointmentsByStaff.has(staffId)) {
            appointmentsByStaff.set(staffId, []);
          }
          // Convert UTC times to local by subtracting offset (EDT is UTC-4)
          const startTimeUTC = new Date(apt.startAt);
          const endTimeUTC = new Date(apt.endAt);
          const startTimeLocal = new Date(startTimeUTC.getTime() - 4 * 60 * 60 * 1000);
          const endTimeLocal = new Date(endTimeUTC.getTime() - 4 * 60 * 60 * 1000);
          
          appointmentsByStaff.get(staffId).push({
            startTime: startTimeLocal,
            endTime: endTimeLocal
          });
        }
      });
      
      // Add timeblocks (breaks, notes) to blocked times
      // NOTE: Timeblocks already come with timezone offset (e.g. -04:00), so they're in local time
      timeblocks.forEach((block: any) => {
        // Skip cancelled timeblocks
        if (block.cancelled) {
          return;
        }
        
        const staffId = block.staffId;
        if (staffId) {
          if (!appointmentsByStaff.has(staffId)) {
            appointmentsByStaff.set(staffId, []);
          }
          // Timeblocks are already in local time (have timezone offset), use them directly
          const startTimeLocal = new Date(block.startAt);
          const endTimeLocal = new Date(block.endAt);
          
          appointmentsByStaff.get(staffId).push({
            startTime: startTimeLocal,
            endTime: endTimeLocal
          });
        }
      });
      
      console.log(`📅 Processing ${staff.length} staff members for slot generation`);
      
      // For each staff member, calculate their available time slots
      for (const staffMember of staff) {
        const staffId = staffMember.id;
        const fullUuid = staffId.includes(':') ? staffId.split(':').pop() : staffId;
        
        // Find this staff member's shift for the day
        const staffShift = staffShifts.find((shift: any) => 
          shift.staffId === fullUuid && shift.available
        );
        
        if (!staffShift) {
          console.log(`⚠️ No shift found for ${staffMember.firstName} ${staffMember.lastName}`);
          continue;
        }
        
        // Parse shift times (format: "HH:MM:SS")
        const [clockInHour, clockInMin] = staffShift.clockIn.split(':').map(Number);
        const [clockOutHour, clockOutMin] = staffShift.clockOut.split(':').map(Number);
        
        // Get this staff member's blocked times (appointments + timeblocks)
        const staffBlockedTimes = appointmentsByStaff.get(staffId) || [];
        
        console.log(`👤 ${staffMember.firstName}: shift ${staffShift.clockIn}-${staffShift.clockOut}, ${staffBlockedTimes.length} blocked times`);
        
        // Generate all possible 20-minute intervals during their shift
        let currentHour = clockInHour;
        let currentMin = clockInMin;
        
        while (currentHour < clockOutHour || (currentHour === clockOutHour && currentMin < clockOutMin)) {
          // Create slot start time
          const slotStartLocal = new Date(`${date}T${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}:00`);
          const slotEndLocal = new Date(slotStartLocal.getTime() + 40 * 60 * 1000); // 40 minutes later
          
          // Check if this slot conflicts with any of this staff's blocked times (appointments + breaks)
          const hasConflict = staffBlockedTimes.some((blockedTime: any) => {
            // Slot conflicts if it overlaps with blocked time
            return slotStartLocal < blockedTime.endTime && slotEndLocal > blockedTime.startTime;
          });
          
          if (!hasConflict) {
            // Convert to UTC for storage (EDT is UTC-4)
            const slotStartUTC = new Date(slotStartLocal);
            slotStartUTC.setHours(slotStartUTC.getHours() + 4);
            
            timeSlots.push({
              id: `${locationId}-${staffId}-${slotStartUTC.toISOString()}`,
              startTime: slotStartUTC.toISOString(),
              available: true,
              estheticianId: staffId
            });
            
            availableEstheticianIds.add(staffId);
          }
          
          // Move to next 20-minute interval
          currentMin += 20;
          if (currentMin >= 60) {
            currentMin -= 60;
            currentHour += 1;
          }
        }
      }
      
      console.log(`✅ Generated ${timeSlots.length} time slots for ${availableEstheticianIds.size} estheticians`);
      
      // Filter out only estheticians who have available slots
      const availableEstheticians = staff.filter((s: any) => availableEstheticianIds.has(s.id));
      
      console.log(`👥 Returning ${availableEstheticians.length} available estheticians:`, 
        availableEstheticians.map(e => `${e.firstName} ${e.lastName} (${e.id.split(':').pop()?.substring(0, 8)})`).join(', '));

      // If no availability, find nearby alternatives
      let alternativeLocations: any[] = [];
      if (timeSlots.length === 0) {
        console.log(`No availability at ${primaryLocation.name}, finding alternatives...`);
        const nearby = await blvdService.getNearbyLocations(locationId, maxDistance);
        
        // Get availability for nearby locations
        for (const nearbyLoc of nearby.slice(0, 3)) { // Limit to top 3 nearest
          const nearbyAppointmentsResponse = await blvdService.getLocationAppointments(
            nearbyLoc.id,
            startDate.toISOString(),
            endDate.toISOString()
          );
          
          // Extract appointments array from GraphQL response
          const nearbyAppointments = (nearbyAppointmentsResponse.data as any)?.appointments?.edges?.map((edge: any) => edge.node) || [];
          
          const nearbyAvail = await blvdService.calculateHourlyAvailability(
            nearbyLoc.id,
            startDate.toISOString().split('T')[0],
            nearbyAppointments
          );
          
          if (nearbyAvail.totalAvailable > 0) {
            alternativeLocations.push({
              location: nearbyLoc,
              availableSlots: nearbyAvail.totalAvailable,
              distance: nearbyLoc.distance
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
        estheticians: availableEstheticians.map((s: any) => ({
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

  // Cart API Routes (Client API flow)
  
  // Create a new cart for a location
  app.post("/api/cart/create", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { locationId, productType, plan } = req.body;
      
      if (!locationId) {
        return res.status(400).json({ error: "Missing required field: locationId" });
      }
      
      // Create cart via Boulevard Client API
      const cartResult = await blvdService.createCartForLocation(locationId);
      
      if (!cartResult) {
        return res.status(500).json({ error: "Failed to create cart" });
      }
      
      const { cartId, categories } = cartResult;
      
      // Store cart session in memory
      const cartSession = await storage.createBookingCart({
        cartId,
        productType: productType || 'Treatment',
        plan,
        locationId,
        status: 'creating'
      });
      
      res.json({ success: true, cart: cartSession, categories });
    } catch (error) {
      console.error('Create cart error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create cart"
      });
    }
  });

  // Get cart details
  app.get("/api/cart/:cartId", async (req, res) => {
    try {
      const { cartId } = req.params;
      const cart = await storage.getBookingCart(cartId);
      
      if (!cart) {
        return res.status(404).json({ error: "Cart not found" });
      }
      
      res.json({ success: true, cart });
    } catch (error) {
      console.error('Get cart error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get cart"
      });
    }
  });

  // Add bookable item to cart
  app.post("/api/cart/:cartId/add-item", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { cartId } = req.params;
      const { itemId, itemName } = req.body;
      
      if (!itemId) {
        return res.status(400).json({ error: "Missing required field: itemId" });
      }
      
      const success = await blvdService.addBookableItemToCart(cartId, itemId);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to add item to cart" });
      }
      
      // Update cart session
      await storage.updateBookingCart(cartId, {
        serviceId: itemId,
        serviceName: itemName,
        status: 'items_added'
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Add item to cart error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to add item to cart"
      });
    }
  });

  // Get bookable dates for cart
  app.get("/api/cart/:cartId/dates", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { cartId } = req.params;
      const { startDate, endDate, timeZone } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          error: "Missing required query params: startDate, endDate" 
        });
      }
      
      const dates = await blvdService.getCartBookableDates(
        cartId,
        startDate as string,
        endDate as string,
        (timeZone as string) || 'America/New_York'
      );
      
      res.json({ success: true, dates });
    } catch (error) {
      console.error('Get bookable dates error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get bookable dates"
      });
    }
  });

  // Get bookable times for cart on a specific date
  app.get("/api/cart/:cartId/times/:date", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { cartId, date } = req.params;
      const { timeZone } = req.query;
      
      const times = await blvdService.getCartBookableTimes(
        cartId,
        date,
        (timeZone as string) || 'America/New_York'
      );
      
      res.json({ success: true, times });
    } catch (error) {
      console.error('Get bookable times error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get bookable times"
      });
    }
  });

  // Reserve a time slot
  app.post("/api/cart/:cartId/reserve", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { cartId } = req.params;
      const { bookableTimeId, selectedDate, selectedTime } = req.body;
      
      if (!bookableTimeId) {
        return res.status(400).json({ error: "Missing required field: bookableTimeId" });
      }
      
      const success = await blvdService.reserveCartBookableItems(cartId, bookableTimeId);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to reserve time slot" });
      }
      
      // Update cart session
      await storage.updateBookingCart(cartId, {
        bookableTimeId,
        selectedDate,
        selectedTime,
        status: 'time_reserved'
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Reserve time slot error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to reserve time slot"
      });
    }
  });

  // Update client information
  app.post("/api/cart/:cartId/client-info", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { cartId } = req.params;
      const { email, firstName, lastName, phoneNumber } = req.body;
      
      if (!email || !firstName || !lastName || !phoneNumber) {
        return res.status(400).json({ 
          error: "Missing required fields: email, firstName, lastName, phoneNumber" 
        });
      }
      
      const success = await blvdService.updateCartClientInfo(cartId, {
        email,
        firstName,
        lastName,
        phoneNumber
      });
      
      if (!success) {
        return res.status(500).json({ error: "Failed to update client info" });
      }
      
      // Update cart session
      await storage.updateBookingCart(cartId, {
        clientInfo: { email, firstName, lastName, phoneNumber },
        status: 'info_collected'
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Update client info error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update client info"
      });
    }
  });

  // Add payment method
  app.post("/api/cart/:cartId/payment", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { cartId } = req.params;
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: "Missing required field: token" });
      }
      
      const success = await blvdService.addCartCardPaymentMethod(cartId, token);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to add payment method" });
      }
      
      // Update cart session
      await storage.updateBookingCart(cartId, {
        paymentMethodId: token,
        status: 'payment_added'
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Add payment method error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to add payment method"
      });
    }
  });

  // Checkout cart
  app.post("/api/cart/:cartId/checkout", async (req, res) => {
    try {
      const serverConfig = getServerConfig();
      const config = blvdConfigSchema.parse(serverConfig);
      const blvdService = new BlvdService(config);
      
      const { cartId } = req.params;
      
      const result = await blvdService.checkoutCart(cartId);
      
      if (!result.success) {
        return res.status(500).json({ error: "Failed to checkout cart" });
      }
      
      // Update cart session
      await storage.updateBookingCart(cartId, {
        status: 'completed'
      });
      
      res.json({ 
        success: true, 
        appointmentId: result.appointmentId 
      });
    } catch (error) {
      console.error('Checkout cart error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to checkout cart"
      });
    }
  });

  // Submit waitlist request
  app.post("/api/waitlist", async (req, res) => {
    try {
      const waitlistData = insertWaitlistRequestSchema.parse(req.body);
      const waitlistRequest = await storage.createWaitlistRequest(waitlistData);
      
      res.json({ 
        success: true, 
        waitlistRequest 
      });
    } catch (error) {
      console.error('Submit waitlist error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to submit waitlist request"
      });
    }
  });

  // Get all waitlist requests (for admin)
  app.get("/api/waitlist", async (req, res) => {
    try {
      const requests = await storage.getAllWaitlistRequests();
      res.json({ success: true, requests });
    } catch (error) {
      console.error('Get waitlist requests error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get waitlist requests"
      });
    }
  });

  // ── UtilizationOS: Personalization & Tactics API ──────────────────────────

  // System info — confirms data mode
  app.get("/api/personalization/status", (_req, res) => {
    res.json({ dataMode, status: "ok" });
  });

  // Look up a customer profile by email
  // GET /api/personalization/profile?email=...
  app.get("/api/personalization/profile", async (req, res) => {
    const email = (req.query.email as string ?? "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "email query parameter is required" });
    }
    try {
      const customer = await customerRepo.findByEmail(email);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (err) {
      console.error("Profile lookup error:", err);
      res.status(500).json({ error: "Failed to look up customer profile" });
    }
  });

  // Build a personalized recommendation for a customer at a given location
  // POST /api/personalization/recommendation
  // Body: { email: string, location: string }
  app.post("/api/personalization/recommendation", async (req, res) => {
    const { email, location } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }
    try {
      const [customer, availability, tactics] = await Promise.all([
        customerRepo.findByEmail((email as string).toLowerCase()),
        location ? availabilityRepo.getByLocation(location as string) : Promise.resolve(null),
        tacticsRepo.getConfig(),
      ]);

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const recommendation = buildRecommendation(
        customer,
        availability,
        tactics,
        discountCodeRepo
      );

      res.json(recommendation);
    } catch (err) {
      console.error("Recommendation error:", err);
      res.status(500).json({ error: "Failed to build recommendation" });
    }
  });

  // Get all customer profiles (used by dashboard monitoring view)
  // GET /api/personalization/customers
  app.get("/api/personalization/customers", async (_req, res) => {
    try {
      const customers = await customerRepo.findAll();
      res.json(customers);
    } catch (err) {
      console.error("Customers list error:", err);
      res.status(500).json({ error: "Failed to load customers" });
    }
  });

  // Get availability for a location
  // GET /api/availability/:location (location name, URL-encoded)
  app.get("/api/availability/:location", async (req, res) => {
    const location = decodeURIComponent(req.params.location);
    try {
      const availability = await availabilityRepo.getByLocation(location);
      if (!availability) {
        return res.status(404).json({ error: `Location not found: ${location}` });
      }
      res.json(availability);
    } catch (err) {
      console.error("Availability error:", err);
      res.status(500).json({ error: "Failed to load availability" });
    }
  });

  // Get all location names
  // GET /api/availability
  app.get("/api/availability", async (_req, res) => {
    try {
      const locations = await availabilityRepo.getAllLocations();
      res.json({ locations });
    } catch (err) {
      console.error("Locations error:", err);
      res.status(500).json({ error: "Failed to load locations" });
    }
  });

  // Get the current tactics configuration
  // GET /api/tactics/config
  app.get("/api/tactics/config", async (_req, res) => {
    try {
      const config = await tacticsRepo.getConfig();
      res.json(config);
    } catch (err) {
      console.error("Tactics config GET error:", err);
      res.status(500).json({ error: "Failed to load tactics config" });
    }
  });

  // Update the tactics configuration (called by dashboard control panel)
  // PUT /api/tactics/config
  app.put("/api/tactics/config", async (req, res) => {
    try {
      const parsed = tacticsConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid tactics config",
          details: parsed.error.flatten(),
        });
      }
      await tacticsRepo.updateConfig(parsed.data);
      const updated = await tacticsRepo.getConfig();
      res.json(updated);
    } catch (err) {
      console.error("Tactics config PUT error:", err);
      res.status(500).json({ error: "Failed to update tactics config" });
    }
  });

  // Compute supply signals for a location (used by dashboard Signal Output card)
  // GET /api/supply-signals?location=<name>
  app.get("/api/supply-signals", async (req, res) => {
    try {
      const location = (req.query.location as string) || "";
      const [availability, config] = await Promise.all([
        location ? availabilityRepo.getByLocation(location) : Promise.resolve(null),
        tacticsRepo.getConfig(),
      ]);
      const signals = computeIncentiveFactors(availability, null, config);
      res.json({ location, signals });
    } catch (err) {
      console.error("Supply signals error:", err);
      res.status(500).json({ error: "Failed to compute supply signals" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
