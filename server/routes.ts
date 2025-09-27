import type { Express } from "express";
import { createServer, type Server } from "http";
import { BlvdService } from "./services/blvd-service";
import { blvdConfigSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Test BLVD API connection
  app.post("/api/blvd/test-connection", async (req, res) => {
    try {
      const config = blvdConfigSchema.parse(req.body);
      const blvdService = new BlvdService(config);
      const result = await blvdService.testConnection();
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid configuration",
      });
    }
  });

  // Execute locations query
  app.post("/api/blvd/query-locations", async (req, res) => {
    try {
      const config = blvdConfigSchema.parse(req.body);
      const blvdService = new BlvdService(config);
      const result = await blvdService.executeLocationsQuery();
      res.json(result);
    } catch (error) {
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
