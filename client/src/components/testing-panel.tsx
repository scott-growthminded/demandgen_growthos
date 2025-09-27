import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Loader2, Search, FlaskConical, Shield, Play } from "lucide-react";
import { BlvdConfig, ConnectionTestResult, GraphqlResponse } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { testBlvdConnection, queryBlvdLocations } from "@/lib/blvd-api";

interface TestingPanelProps {
  config: BlvdConfig;
}

export function TestingPanel({ config }: TestingPanelProps) {
  const [connectionResult, setConnectionResult] = useState<ConnectionTestResult | null>(null);
  const [queryResult, setQueryResult] = useState<GraphqlResponse | null>(null);
  const [queryTime, setQueryTime] = useState<number | null>(null);

  const connectionTest = useMutation({
    mutationFn: () => testBlvdConnection(config),
    onSuccess: (data) => {
      setConnectionResult(data);
    },
    onError: (error) => {
      console.error("Connection test failed:", error);
    },
  });

  const locationsQuery = useMutation({
    mutationFn: () => {
      const start = Date.now();
      return queryBlvdLocations(config).then((result) => {
        setQueryTime(Date.now() - start);
        return result;
      });
    },
    onSuccess: (data) => {
      setQueryResult(data);
    },
    onError: (error) => {
      console.error("Query execution failed:", error);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Passed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'testing':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Testing...
          </Badge>
        );
      default:
        return null;
    }
  };

  const isConfigValid = config.apiUrl && config.apiKey && config.businessId;

  return (
    <Card>
      <Tabs defaultValue="query" className="w-full">
        <div className="border-b">
          <TabsList className="h-auto p-0 bg-transparent">
            <TabsTrigger 
              value="query" 
              className="flex items-center gap-2 px-6 py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              data-testid="tab-query"
            >
              <Search className="h-4 w-4" />
              GraphQL Query
            </TabsTrigger>
            <TabsTrigger 
              value="test" 
              className="flex items-center gap-2 px-6 py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              data-testid="tab-test"
            >
              <FlaskConical className="h-4 w-4" />
              Connection Test
            </TabsTrigger>
            <TabsTrigger 
              value="auth" 
              className="flex items-center gap-2 px-6 py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              data-testid="tab-auth"
            >
              <Shield className="h-4 w-4" />
              Authentication
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="query" className="p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Business Locations Query</h3>
              <Button 
                onClick={() => locationsQuery.mutate()}
                disabled={!isConfigValid || locationsQuery.isPending}
                data-testid="button-execute-query"
              >
                {locationsQuery.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Execute Query
              </Button>
            </div>
            
            {/* GraphQL Query Display */}
            <div className="bg-muted rounded-md p-4 mb-4">
              <pre className="text-sm font-mono overflow-x-auto">
{`query Locations($businessId: ID!, $cursor: String) {
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
}`}
              </pre>
            </div>

            {/* Variables */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Variables</h4>
              <div className="bg-muted rounded-md p-4">
                <pre className="text-sm font-mono">
{JSON.stringify({
  businessId: config.businessId || "business_abc123",
  cursor: null
}, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          {/* Response Section */}
          {(queryResult || locationsQuery.isPending) && (
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">Response</h4>
                <div className="text-xs text-muted-foreground">
                  Status: <span className="font-medium text-foreground" data-testid="text-response-status">
                    {queryResult ? "200 OK" : "Loading..."}
                  </span>
                  {queryTime && (
                    <>
                      {" | "}
                      Time: <span className="font-medium text-foreground" data-testid="text-response-time">
                        {queryTime}ms
                      </span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="bg-muted rounded-md p-4 max-h-96 overflow-y-auto">
                {locationsQuery.isPending ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Executing query...</span>
                  </div>
                ) : queryResult ? (
                  <pre className="text-sm font-mono" data-testid="text-query-response">
                    {JSON.stringify(queryResult, null, 2)}
                  </pre>
                ) : null}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="test" className="p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Connection Test Results</h3>
              <Button 
                onClick={() => connectionTest.mutate()}
                disabled={!isConfigValid || connectionTest.isPending}
                data-testid="button-test-connection"
              >
                {connectionTest.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FlaskConical className="h-4 w-4 mr-2" />
                )}
                Run Tests
              </Button>
            </div>
            
            {/* Test Results */}
            <div className="space-y-4">
              {connectionResult?.tests.map((test, index) => (
                <Card key={index} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium" data-testid={`text-test-name-${index}`}>
                        {test.name}
                      </h4>
                      <div data-testid={`badge-test-status-${index}`}>
                        {getStatusBadge(test.status)}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground" data-testid={`text-test-message-${index}`}>
                      {test.message}
                    </p>
                    {test.metadata && Object.entries(test.metadata).map(([key, value]) => (
                      <div key={key} className="mt-2 text-xs text-muted-foreground">
                        {key}: {value}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}

              {connectionTest.isPending && (
                <Card className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2">Running connection tests...</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {connectionResult?.error && (
                <Card className="border border-destructive/20 bg-destructive/10">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-destructive mb-1">Connection Error</h4>
                        <p className="text-sm text-destructive/80" data-testid="text-connection-error">
                          {connectionResult.error}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="auth" className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-3">Authentication Verification</h3>
            
            {/* Auth Status */}
            <Card className="bg-muted mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium">Current Authentication Status</h4>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => connectionTest.mutate()}
                    disabled={!isConfigValid || connectionTest.isPending}
                    data-testid="button-verify-auth"
                  >
                    <Shield className="h-4 w-4 mr-1" />
                    Verify
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">API Key Status:</span>
                    <div className="font-medium mt-1" data-testid="text-api-key-status">
                      {connectionResult?.connected ? "Valid" : "Not verified"}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Permissions:</span>
                    <div className="font-medium mt-1" data-testid="text-permissions">
                      {connectionResult?.connected ? "Admin Access" : "Unknown"}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Response Time:</span>
                    <div className="font-medium mt-1" data-testid="text-response-time-auth">
                      {connectionResult?.responseTime ? `${connectionResult.responseTime}ms` : "N/A"}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Verified:</span>
                    <div className="font-medium mt-1" data-testid="text-last-verified">
                      {connectionResult ? "Just now" : "Never"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sample Request */}
            <div>
              <h4 className="text-sm font-medium mb-3">Sample Authentication Request</h4>
              <div className="bg-muted rounded-md p-4">
                <pre className="text-sm font-mono overflow-x-auto">
{`curl -X POST \\
  ${config.apiUrl || 'https://api.joinblvd.com/graphql-admin'} \\
  -H "Authorization: Bearer ${config.apiKey ? config.apiKey.substring(0, 12) + '...' : 'sk_test_abc123...'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "{ __schema { types { name } } }"
  }'`}
                </pre>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
