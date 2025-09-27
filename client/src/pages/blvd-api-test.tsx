import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChartScatter, Link, Circle, Loader2 } from "lucide-react";
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

  const handleTestReportExport = async () => {
    try {
      toast({
        title: "Generating Report",
        description: "Fetching utilization data for all locations...",
      });

      // Get availability data from our service
      const availabilityData = await getBlvdAvailability(serverConfig?.hasApiKey ? undefined : config);
      
      if (!availabilityData.success) {
        throw new Error("Failed to fetch availability data");
      }

      // Get all locations data
      const locationsData = await queryBlvdLocations(serverConfig?.hasApiKey ? undefined : config);
      
      if (!locationsData.data?.locations?.edges) {
        throw new Error("Failed to fetch locations data");
      }

      // Use allLocations if available (includes all locations), otherwise fall back to availableLocations
      const allLocationData = availabilityData.allLocations || availabilityData.availableLocations;
      
      // Create utilization report for ALL locations using the backend data
      const reportData = allLocationData.map((locationData: any) => {
        const utilizationPercent = 100 - locationData.availabilityPercent;
        return {
          locationName: locationData.locationName,
          locationId: locationData.locationId,
          availabilityPercent: locationData.availabilityPercent.toFixed(2),
          utilizationPercent: utilizationPercent.toFixed(2),
          totalAppointments: locationData.totalAppointments,
          bookedAppointments: locationData.bookedAppointments,
          status: locationData.availabilityPercent >= 25 ? "Available" : "High Utilization"
        };
      });

      // Sort by utilization percentage (highest first)
      reportData.sort((a: any, b: any) => parseFloat(b.utilizationPercent) - parseFloat(a.utilizationPercent));

      // Generate CSV report
      const headers = ["Location Name", "Availability %", "Utilization %", "Total Slots", "Booked Slots", "Status"];
      const csvContent = [
        headers.join(","),
        ...reportData.map((row: any) => [
          `"${row.locationName}"`,
          row.availabilityPercent,
          row.utilizationPercent,
          row.totalAppointments,
          row.bookedAppointments,
          `"${row.status}"`
        ].join(","))
      ].join("\n");

      // Generate summary report
      const totalLocations = reportData.length;
      const availableLocations = reportData.filter((loc: any) => parseFloat(loc.availabilityPercent) >= 25).length;
      const avgUtilization = reportData.reduce((sum: number, loc: any) => sum + parseFloat(loc.utilizationPercent), 0) / totalLocations;

      const summaryReport = `BOULEVARD UTILIZATION REPORT
Generated: ${new Date().toLocaleString()}
Report Date: ${availabilityData.date}

SUMMARY:
- Total Locations: ${totalLocations}
- Available Locations (≥25% availability): ${availableLocations}
- High Utilization Locations: ${totalLocations - availableLocations}
- Average Utilization: ${avgUtilization.toFixed(2)}%

LOCATION DETAILS:
${headers.join(" | ")}
${reportData.map((row: any) => 
  `${row.locationName.padEnd(20)} | ${row.availabilityPercent.padStart(12)} | ${row.utilizationPercent.padStart(13)} | ${String(row.totalAppointments).padStart(11)} | ${String(row.bookedAppointments).padStart(12)} | ${row.status}`
).join("\n")}

NOTES:
- Availability % = Available appointment slots / Total appointment slots * 100
- Utilization % = 100 - Availability %
- Status "Available" = ≥25% availability threshold
- Data source: Boulevard Admin API with simulated appointment data
`;

      // Create and download the report
      const blob = new Blob([summaryReport], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boulevard-utilization-report-${availabilityData.date}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Report Generated",
        description: `Utilization report for ${totalLocations} locations downloaded successfully`,
      });

    } catch (error) {
      console.error("Report generation error:", error);
      toast({
        title: "Report Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate utilization report",
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

        {/* Quick Actions */}
        <div className="mt-8">
          <QuickActions
            config={config}
            onTestLocations={handleTestLocations}
            onTestReportExport={handleTestReportExport}
            onGenerateCode={handleGenerateCode}
          />
        </div>
      </div>
    </div>
  );
}
