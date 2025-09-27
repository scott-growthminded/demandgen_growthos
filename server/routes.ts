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

  const httpServer = createServer(app);
  return httpServer;
}
