import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, FileText, Code } from "lucide-react";
import { BlvdConfig } from "@shared/schema";

interface QuickActionsProps {
  config: BlvdConfig;
  onTestLocations: () => void;
  onTestReportExport: () => void;
  onGenerateCode: () => void;
}

export function QuickActions({ config, onTestLocations, onTestReportExport, onGenerateCode }: QuickActionsProps) {
  const isConfigValid = config.apiUrl && config.apiKey && config.businessId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="flex items-center gap-3 p-4 h-auto text-left justify-start"
            onClick={onTestLocations}
            disabled={!isConfigValid}
            data-testid="button-test-locations"
          >
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-medium">Test Locations Query</div>
              <div className="text-sm text-muted-foreground">Fetch all business locations</div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="flex items-center gap-3 p-4 h-auto text-left justify-start"
            onClick={onTestReportExport}
            disabled={!isConfigValid}
            data-testid="button-test-report-export"
          >
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="font-medium">Test Report Export</div>
              <div className="text-sm text-muted-foreground">Create availability report</div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="flex items-center gap-3 p-4 h-auto text-left justify-start"
            onClick={onGenerateCode}
            disabled={!isConfigValid}
            data-testid="button-generate-code"
          >
            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
              <Code className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="font-medium">Generate Sample Code</div>
              <div className="text-sm text-muted-foreground">Export Node.js implementation</div>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
