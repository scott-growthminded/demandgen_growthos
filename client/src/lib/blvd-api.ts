import { apiRequest } from "./queryClient";
import { BlvdConfig, ConnectionTestResult, GraphqlResponse } from "@shared/schema";

export async function testBlvdConnection(config: BlvdConfig): Promise<ConnectionTestResult> {
  const response = await apiRequest("POST", "/api/blvd/test-connection", config);
  return response.json();
}

export async function queryBlvdLocations(config: BlvdConfig): Promise<GraphqlResponse> {
  const response = await apiRequest("POST", "/api/blvd/query-locations", config);
  return response.json();
}

export async function getEnvironmentInfo() {
  const response = await apiRequest("GET", "/api/env-info");
  return response.json();
}
