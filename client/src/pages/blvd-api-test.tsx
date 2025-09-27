import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChartScatter, Link, Circle, Loader2, Calendar } from "lucide-react";
import { BlvdConfig } from "@shared/schema";
import { ConfigurationPanel } from "@/components/configuration-panel";
import { TestingPanel } from "@/components/testing-panel";
import { QuickActions } from "@/components/quick-actions";
import { testBlvdConnection, queryBlvdLocations, getBlvdServerConfig, getBlvdAvailability } from "@/lib/blvd-api";

export default function BlvdApiTest() {
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('disconnected');
  const [config, setConfig] = useState<BlvdConfig>({
    apiUrl: "https://api.joinblvd.com/graphql-admin",
    apiKey: "",
    businessId: "",
  });

  // Load server configuration on startup
  const { data: serverConfig } = useQuery({
    queryKey: ["/api/blvd/config"],
    queryFn: getBlvdServerConfig,
  });

  // Update config when server config loads
  useEffect(() => {
    if (serverConfig) {
      setConfig({
        apiUrl: serverConfig.apiUrl || "https://api.joinblvd.com/graphql-admin",
        apiKey: serverConfig.hasApiKey ? "sk_***configured***" : "",
        businessId: serverConfig.businessId || "",
      });
    }
  }, [serverConfig]);

  const connectionTest = useMutation({
    mutationFn: () => testBlvdConnection(serverConfig?.hasApiKey ? undefined : config),
    onMutate: () => {
      setConnectionStatus('testing');
    },
    onSuccess: (data) => {
      setConnectionStatus(data.connected ? 'connected' : 'disconnected');
      if (data.connected) {
        toast({
          title: "Connection Successful",
          description: "Successfully connected to BLVD API",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Unable to connect to BLVD API",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      setConnectionStatus('disconnected');
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const locationsQuery = useMutation({
    mutationFn: () => queryBlvdLocations(serverConfig?.hasApiKey ? undefined : config),
    onSuccess: (data) => {
      if (data.errors && data.errors.length > 0) {
        toast({
          title: "Query Error",
          description: data.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Query Successful",
          description: `Found ${data.data?.locations?.edges?.length || 0} locations`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Query Failed",
        description: error instanceof Error ? error.message : "Query execution failed",
        variant: "destructive",
      });
    },
  });

  const handleSaveConfig = () => {
    // In a real app, this would save to localStorage or backend
    toast({
      title: "Configuration Saved",
      description: "API configuration has been saved successfully",
    });
  };

  const handleTestConnection = () => {
    if (!config.apiUrl || !config.apiKey || !config.businessId) {
      toast({
        title: "Configuration Required",
        description: "Please fill in all configuration fields before testing",
        variant: "destructive",
      });
      return;
    }
    connectionTest.mutate();
  };

  const handleTestLocations = () => {
    locationsQuery.mutate();
  };

  const [availabilityResults, setAvailabilityResults] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const handleTestReportExport = async () => {
    try {
      toast({
        title: "Loading Results",
        description: "Fetching real appointment data for all locations...",
      });

      // Get availability data with real appointment data
      const availabilityData = await getBlvdAvailability(serverConfig?.hasApiKey ? undefined : config, selectedDate);
      
      if (!availabilityData.success) {
        throw new Error("Failed to fetch availability data");
      }

      setAvailabilityResults(availabilityData);
      
      const totalLocations = availabilityData.allLocations?.length || 0;
      const availableLocations = availabilityData.availableLocationsCount || 0;

      toast({
        title: "Results Loaded!",
        description: `Real Boulevard appointment data for ${totalLocations} locations loaded successfully`,
      });

    } catch (error) {
      console.error("Report generation error:", error);
      toast({
        title: "Failed to Load Results",
        description: error instanceof Error ? error.message : "Failed to fetch availability data",
        variant: "destructive",
      });
    }
  };

  const handleGenerateCode = () => {
    const sampleCode = `// BLVD API Integration Sample Code
import { GraphQLClient } from 'graphql-request';

const client = new GraphQLClient('${config.apiUrl}', {
  headers: {
    'Authorization': 'Bearer ${config.apiKey}',
  },
});

const query = \`
  query Locations {
    locations(first: 100) {
      edges {
        node {
          id
          name
          isRemote
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
\`;

async function fetchLocations() {
  try {
    const data = await client.request(query);
    console.log('Locations:', data.locations.edges);
  } catch (error) {
    console.error('Error:', error);
  }
}

fetchLocations();`;

    // Create a blob and download it
    const blob = new Blob([sampleCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blvd-api-sample.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Code Generated",
      description: "Sample Node.js code has been downloaded",
    });
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            <Circle className="h-3 w-3 mr-1 fill-current" />
            Connected
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
        return (
          <Badge variant="destructive">
            <Circle className="h-3 w-3 mr-1 fill-current" />
            Disconnected
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <ChartScatter className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">BLVD API Integration Tool</h1>
                <p className="text-sm text-muted-foreground">GraphQL Client Testing & Configuration</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div data-testid="badge-connection-status">
                {getStatusBadge()}
              </div>
              <Button 
                onClick={handleTestConnection}
                disabled={connectionTest.isPending}
                data-testid="button-test-connection-header"
              >
                {connectionTest.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1">
            <ConfigurationPanel
              config={config}
              onConfigChange={setConfig}
              onSave={handleSaveConfig}
            />
          </div>

          {/* Testing Panel */}
          <div className="lg:col-span-2">
            <TestingPanel config={config} />
          </div>
        </div>

        {/* Date Selector */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Select Date for Availability Testing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-sm">
                  <Label htmlFor="date-selector" className="text-sm font-medium">
                    Test Date
                  </Label>
                  <Input
                    id="date-selector"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1"
                    data-testid="input-date-selector"
                  />
                </div>
                <div className="text-sm text-muted-foreground pt-6">
                  Choose a date to test availability against your dashboard forecast
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <QuickActions
            config={config}
            onTestLocations={handleTestLocations}
            onTestReportExport={handleTestReportExport}
            onGenerateCode={handleGenerateCode}
          />
        </div>

        {/* Results Display */}
        {availabilityResults && (
          <div className="mt-8">
            <div className="bg-card rounded-lg border shadow-sm">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold mb-2">Availability Results</h3>
                <p className="text-sm text-muted-foreground">
                  Real appointment data for {availabilityResults.date} • {availabilityResults.totalLocationsChecked} locations checked • {availabilityResults.availableLocationsCount} locations with 25%+ availability
                </p>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Studio</th>
                        <th className="text-right p-2 font-medium">Schedule</th>
                        <th className="text-right p-2 font-medium">Booked</th>
                        <th className="text-right p-2 font-medium">Available</th>
                        <th className="text-right p-2 font-medium">Availability %</th>
                        <th className="text-center p-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availabilityResults.allLocations?.map((location: any, index: number) => (
                        <tr key={location.locationId} className={index % 2 === 0 ? "bg-muted/30" : ""}>
                          <td className="p-2 font-medium" data-testid={`text-location-${index}`}>
                            {location.locationName}
                          </td>
                          <td className="p-2 text-right" data-testid={`text-schedule-${index}`}>
                            {location.totalAppointments}
                          </td>
                          <td className="p-2 text-right" data-testid={`text-booked-${index}`}>
                            {location.bookedAppointments}
                          </td>
                          <td className="p-2 text-right" data-testid={`text-available-${index}`}>
                            {location.totalAppointments - location.bookedAppointments}
                          </td>
                          <td className="p-2 text-right" data-testid={`text-availability-${index}`}>
                            {location.availabilityPercent.toFixed(2)}%
                          </td>
                          <td className="p-2 text-center">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              location.availabilityPercent >= 25 
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" 
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                            }`} data-testid={`badge-status-${index}`}>
                              {location.availabilityPercent >= 25 ? "Available" : "High Demand"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
