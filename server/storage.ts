// Storage interface for BLVD API testing tool
// Currently using in-memory storage for configuration if needed

export interface IStorage {
  // Add any storage methods here if needed for the BLVD testing tool
}

export class MemStorage implements IStorage {
  // Storage implementation would go here if needed
}

export const storage = new MemStorage();
