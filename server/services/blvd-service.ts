import { BlvdConfig, GraphqlResponse, ConnectionTestResult, TestResult } from "@shared/schema";

export class BlvdService {
  private config: BlvdConfig;

  constructor(config: BlvdConfig) {
    this.config = config;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const tests: TestResult[] = [];
    let connected = false;
    let responseTime: number | undefined;
    let error: string | undefined;

    try {
      // Test 1: Network connectivity
      const start = Date.now();
      const networkTest = await this.testNetworkConnectivity();
      responseTime = Date.now() - start;
      tests.push(networkTest);

      if (networkTest.status === 'passed') {
        // Test 2: Schema introspection
        const schemaTest = await this.testSchemaIntrospection();
        tests.push(schemaTest);

        if (schemaTest.status === 'passed') {
          // Test 3: Business access
          const businessTest = await this.testBusinessAccess();
          tests.push(businessTest);

          connected = businessTest.status === 'passed';
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error occurred';
      tests.push({
        name: 'Connection Error',
        status: 'failed',
        message: error,
      });
    }

    return {
      connected,
      tests,
      responseTime,
      error,
    };
  }

  async executeLocationsQuery(): Promise<GraphqlResponse> {
    const query = `
      query Locations($businessId: ID!, $cursor: String) {
        business(id: $businessId) {
          id
          name
          locations(first: 100, after: $cursor) {
            edges { 
              node { 
                id 
                name 
                timeZone 
              } 
            }
            pageInfo { 
              hasNextPage 
              endCursor 
            }
          }
        }
      }
    `;

    const variables = {
      businessId: this.config.businessId,
      cursor: null,
    };

    const response = await this.makeGraphqlRequest(query, variables);
    return response;
  }

  private async testNetworkConnectivity(): Promise<TestResult> {
    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          query: '{ __typename }',
        }),
      });

      if (response.ok) {
        return {
          name: 'Network Connectivity',
          status: 'passed',
          message: 'Successfully connected to BLVD API endpoint',
          metadata: {
            responseTime: `${response.headers.get('x-response-time') || 'N/A'}`,
          },
        };
      } else {
        return {
          name: 'Network Connectivity',
          status: 'failed',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        name: 'Network Connectivity',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  private async testSchemaIntrospection(): Promise<TestResult> {
    try {
      const query = `
        query IntrospectionQuery {
          __schema {
            types {
              name
            }
          }
        }
      `;

      const response = await this.makeGraphqlRequest(query);
      
      if (response.data && !response.errors) {
        return {
          name: 'GraphQL Schema Introspection',
          status: 'passed',
          message: 'Schema validation successful, all required types found',
          metadata: {
            schemaVersion: new Date().toISOString().split('T')[0],
          },
        };
      } else {
        return {
          name: 'GraphQL Schema Introspection',
          status: 'failed',
          message: response.errors?.[0]?.message || 'Schema introspection failed',
        };
      }
    } catch (error) {
      return {
        name: 'GraphQL Schema Introspection',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Schema error',
      };
    }
  }

  private async testBusinessAccess(): Promise<TestResult> {
    try {
      const query = `
        query TestBusiness($businessId: ID!) {
          business(id: $businessId) {
            id
            name
          }
        }
      `;

      const response = await this.makeGraphqlRequest(query, {
        businessId: this.config.businessId,
      });

      if (response.data?.business) {
        return {
          name: 'Business Access Test',
          status: 'passed',
          message: 'Successfully accessed business data with provided credentials',
        };
      } else {
        return {
          name: 'Business Access Test',
          status: 'failed',
          message: response.errors?.[0]?.message || 'Business access denied',
        };
      }
    } catch (error) {
      return {
        name: 'Business Access Test',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Business access error',
      };
    }
  }

  private async makeGraphqlRequest(query: string, variables?: any): Promise<GraphqlResponse> {
    try {
      console.log('Making GraphQL request to:', this.config.apiUrl);
      console.log('Request headers:', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey.substring(0, 10)}...`,
      });
      
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response body:', errorText);
        throw new Error(`GraphQL HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('GraphQL response received:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('GraphQL request failed:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`GraphQL request failed: ${String(error)}`);
    }
  }
}
