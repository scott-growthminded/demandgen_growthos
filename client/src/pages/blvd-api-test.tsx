import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChartScatter, RefreshCw, Calendar } from "lucide-react";
import { BlvdConfig } from "@shared/schema";
import { getBlvdServerConfig, getBlvdAvailability } from "@/lib/blvd-api";

export default function BlvdApiTest() {
  const { toast } = useToast();

  // Load server configuration on startup
  const { data: serverConfig } = useQuery({
    queryKey: ["/api/blvd/config"],
    queryFn: getBlvdServerConfig,
  });


  const [availabilityResults, setAvailabilityResults] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const loadAvailabilityResults = async () => {
    try {
      setIsLoading(true);
      toast({
        title: "Loading Results",
        description: "Fetching real appointment data for all locations...",
      });

      // Get availability data with real appointment data
      const availabilityData = await getBlvdAvailability(undefined, selectedDate);
      
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
      console.error("Load error:", error);
      toast({
        title: "Failed to Load Results",
        description: error instanceof Error ? error.message : "Failed to fetch availability data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load results on component mount and when date changes
  useEffect(() => {
    if (serverConfig) {
      loadAvailabilityResults();
    }
  }, [serverConfig, selectedDate]);


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
                <h1 className="text-xl font-semibold">Boulevard Availability Service</h1>
                <p className="text-sm text-muted-foreground">Real-time studio availability for dashboard forecasting</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                onClick={loadAvailabilityResults}
                disabled={isLoading}
                data-testid="button-refresh-results"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Results
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Date Selector */}
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

        {/* Results Display */}
        {availabilityResults && (
          <div className="mt-8 space-y-6">
            {/* Summary Stats */}
            <div className="bg-card rounded-2xl border shadow-sm">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold mb-2">Location Overview</h3>
                <p className="text-sm text-muted-foreground">
                  Real appointment data for {availabilityResults.date} • {availabilityResults.totalLocationsChecked} locations checked
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
                        <th className="text-right p-2 font-medium">Available Openings</th>
                        <th className="text-right p-2 font-medium">Availability %</th>
                        <th className="text-center p-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availabilityResults.allLocations?.map((location: any, index: number) => (
                        <tr 
                          key={location.locationId} 
                          className={`cursor-pointer hover:bg-muted/50 ${
                            index % 2 === 0 ? "bg-muted/30" : ""
                          } ${selectedLocationId === location.locationId ? "bg-blue-100 dark:bg-blue-900" : ""}`}
                          onClick={() => setSelectedLocationId(location.locationId)}
                          data-testid={`row-location-${index}`}
                        >
                          <td className="p-2 font-medium" data-testid={`text-location-${index}`}>
                            {location.locationName}
                          </td>
                          <td className="p-2 text-right" data-testid={`text-schedule-${index}`}>
                            {(location.schedule || 0).toFixed(1)}
                          </td>
                          <td className="p-2 text-right" data-testid={`text-booked-${index}`}>
                            {location.bookedAppointments}
                          </td>
                          <td className="p-2 text-right" data-testid={`text-available-${index}`}>
                            {location.availableSlots || 0}
                          </td>
                          <td className="p-2 text-right" data-testid={`text-availability-${index}`}>
                            {Math.round(location.availabilityPercent)}%
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

            {/* Time Slot Details for Selected Location */}
            {selectedLocationId && (() => {
              const selectedLocation = availabilityResults.allLocations?.find((loc: any) => loc.locationId === selectedLocationId);
              if (!selectedLocation) return null;
              
              
              return (
                <div className="bg-card rounded-2xl border shadow-sm" data-testid="detail-panel">
                  <div className="p-6 border-b">
                    <h3 className="text-lg font-semibold mb-2" data-testid="detail-location-name">{selectedLocation.locationName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {(selectedLocation.schedule || 0).toFixed(1)} total schedule • {selectedLocation.bookedAppointments} booked • {Math.max(0, (selectedLocation.schedule || 0) - (selectedLocation.bookedAppointments || 0)).toFixed(1)} available openings
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Booked Time Slots */}
                      <div data-testid="booked-times-section">
                        <h4 className="font-medium mb-3 text-red-700 dark:text-red-400">Booked Times</h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {selectedLocation.bookedTimeSlots?.map((slot: any, slotIndex: number) => (
                            <div key={slot.id} className="p-3 bg-red-50 dark:bg-red-950 rounded border" data-testid={`time-slot-booked-${slotIndex}`}>
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-medium text-sm">
                                  {new Date(slot.startTime).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', timeZone: slot.locationTimeZone || 'America/New_York'})}
                                </span>
                                <Badge variant="destructive" className="text-xs">Booked</Badge>
                              </div>
                              {slot.staff && (
                                <p className="text-xs text-muted-foreground">
                                  {slot.staff.name} • {slot.service?.name}
                                </p>
                              )}
                            </div>
                          ))}
                          {(!selectedLocation.bookedTimeSlots || selectedLocation.bookedTimeSlots.length === 0) && (
                            <p className="text-sm text-muted-foreground italic" data-testid="no-booked-message">No booked appointments</p>
                          )}
                        </div>
                      </div>

                      {/* Available Time Slots */}
                      <div data-testid="available-times-section">
                        <h4 className="font-medium mb-3 text-green-700 dark:text-green-400">Available Openings</h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {selectedLocation.availableTimeSlots?.map((slot: any, slotIndex: number) => (
                            <div key={slotIndex} className="p-3 bg-green-50 dark:bg-green-950 rounded border" data-testid={`time-slot-available-${slotIndex}`}>
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-medium text-sm">
                                  {new Date(slot.startTime).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', timeZone: slot.locationTimeZone || 'America/New_York'})}
                                </span>
                                <Badge variant="outline" className="text-xs border-green-600 text-green-700">Open</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {slot.duration} min available
                              </p>
                            </div>
                          ))}
                          {(!selectedLocation.availableTimeSlots || selectedLocation.availableTimeSlots.length === 0) && (
                            <p className="text-sm text-muted-foreground italic" data-testid="no-available-message">No available openings</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Instruction Text */}
            {!selectedLocationId && (
              <div className="bg-card rounded-2xl border shadow-sm p-6 text-center" data-testid="instruction-panel">
                <p className="text-muted-foreground">Click on a studio row above to view detailed time slot information</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
