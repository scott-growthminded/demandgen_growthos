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
      
      console.log(`Checking availability for locations with ${minAvailabilityPercent}% or more availability`);
      
      const result = await blvdService.getAvailableLocations(minAvailabilityPercent);
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


  const httpServer = createServer(app);
  return httpServer;
}
