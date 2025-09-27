import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, Save, Eye, EyeOff } from "lucide-react";
import { BlvdConfig } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { getEnvironmentInfo } from "@/lib/blvd-api";

interface ConfigurationPanelProps {
  config: BlvdConfig;
  onConfigChange: (config: BlvdConfig) => void;
  onSave: () => void;
}

export function ConfigurationPanel({ config, onConfigChange, onSave }: ConfigurationPanelProps) {
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: envInfo } = useQuery({
    queryKey: ["/api/env-info"],
    queryFn: getEnvironmentInfo,
  });

  const handleInputChange = (field: keyof BlvdConfig, value: string) => {
    onConfigChange({
      ...config,
      [field]: value,
    });
  };

  return (
    <Card className="h-fit">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Configuration
        </CardTitle>
        <p className="text-sm text-muted-foreground">Set up your BLVD API credentials</p>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="apiUrl" className="text-sm font-medium">
              API Endpoint URL
            </Label>
            <Input
              id="apiUrl"
              type="url"
              placeholder="https://api.joinblvd.com/graphql-admin"
              value={config.apiUrl}
              onChange={(e) => handleInputChange("apiUrl", e.target.value)}
              className="mt-2"
              data-testid="input-api-url"
            />
          </div>
          
          <div>
            <Label htmlFor="apiKey" className="text-sm font-medium">
              API Key
            </Label>
            <div className="relative mt-2">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                placeholder="sk_test_..."
                value={config.apiKey}
                onChange={(e) => handleInputChange("apiKey", e.target.value)}
                className="pr-10"
                data-testid="input-api-key"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
                data-testid="button-toggle-api-key"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
          
          <div>
            <Label htmlFor="businessId" className="text-sm font-medium">
              Business ID
            </Label>
            <Input
              id="businessId"
              placeholder="business_abc123"
              value={config.businessId}
              onChange={(e) => handleInputChange("businessId", e.target.value)}
              className="mt-2"
              data-testid="input-business-id"
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button 
            onClick={onSave} 
            className="w-full"
            data-testid="button-save-config"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
        </div>

        {/* Environment Status */}
        <Card className="bg-muted">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Environment Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Node.js Version:</span>
                <span className="font-mono" data-testid="text-node-version">
                  {envInfo?.nodeVersion || "Loading..."}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GraphQL Client:</span>
                <span className="font-mono">Ready</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Environment:</span>
                <span className="font-mono capitalize" data-testid="text-environment">
                  {envInfo?.environment || "Loading..."}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
