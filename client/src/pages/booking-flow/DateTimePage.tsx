import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBookingFlow } from "@/contexts/BookingFlowContext";
import { Calendar } from "@/components/ui/calendar";
import { Clock } from "lucide-react";
import { getDay } from "date-fns";

const MOCK_TIME_SLOTS = [
  "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
];

const DAYS_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

interface AvailabilitySlot {
  dayOfWeek: string;
  displayTime: string;
  isLowDemand: boolean;
  utilizationRate: number;
}

export function DateTimePage() {
  const { state, setCurrentStep, updateUserData } = useBookingFlow();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(state.selectedDate);
  const [selectedTime, setSelectedTime] = useState(state.selectedTime || "");
  const [locationSlots, setLocationSlots] = useState<AvailabilitySlot[]>([]);
  const isMember = state.userType === "member";

  // Fetch availability slots for the selected location to mark low-demand times
  useEffect(() => {
    const locationName = state.selectedLocation?.name;
    if (!locationName) return;

    fetch(`/api/availability/${encodeURIComponent(locationName)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { slots?: AvailabilitySlot[] } | null) => {
        if (data?.slots) setLocationSlots(data.slots);
      })
      .catch(() => {
        // Graceful degradation — slots simply won't show low-demand indicators
      });
  }, [state.selectedLocation?.name]);

  // Compute which time strings are low-demand for the selected day
  const lowDemandTimes = new Set<string>();
  if (selectedDate) {
    const dayName = DAYS_OF_WEEK[getDay(selectedDate)];
    locationSlots
      .filter((s) => s.dayOfWeek === dayName && s.isLowDemand)
      .forEach((s) => lowDemandTimes.add(s.displayTime));
  }

  const hasLowDemandSlots = selectedDate && lowDemandTimes.size > 0;

  const handleContinue = () => {
    updateUserData({ selectedDate, selectedTime });
    // Identity gate deferred — go to customer-type after service selection
    setCurrentStep("customer-type");
  };

  const isValid = selectedDate && selectedTime;

  return (
    <div className="min-h-screen bg-gray-50">
      {isMember && (
        <div className="bg-green-500 text-white px-4 py-2" data-testid="banner-member-status">
          <span className="font-semibold">Members</span>
        </div>
      )}

      <div className="bg-[#D4E157] h-16" data-testid="banner-progress">
        <div className="flex justify-end items-center h-full px-4">
          <div
            className="bg-gray-700 text-white rounded-full w-10 h-10 flex items-center justify-center"
            data-testid="avatar-initial"
          >
            <span className="font-semibold">
              {state.firstName ? state.firstName[0].toUpperCase() : "G"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        <h1
          className="text-2xl font-semibold text-gray-600 mb-6"
          data-testid="text-page-title"
        >
          Date and Time
        </h1>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 bg-gray-300" data-testid="calendar-container">
            <div className="font-semibold mb-4">Calendar Date Select</div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              disabled={(date) => date < new Date()}
            />
          </Card>

          <div className="space-y-4">
            <Card className="p-6 bg-gray-300" data-testid="timeslot-container">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-semibold">Select time</span>
                {hasLowDemandSlots && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs font-normal">
                    <Clock className="h-3 w-3 mr-1" />
                    Less busy times available
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {MOCK_TIME_SLOTS.map((time) => {
                  const isLowDemand = lowDemandTimes.has(time);
                  const isSelected = selectedTime === time;
                  return (
                    <Button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      variant={isSelected ? "default" : "outline"}
                      className={`flex flex-col h-auto py-2 gap-0.5 ${
                        isSelected
                          ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                          : isLowDemand
                          ? "bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100"
                          : "bg-white hover:bg-gray-50"
                      }`}
                      data-testid={`button-time-${time.replace(/[:\s]/g, "-")}`}
                      data-low-demand={isLowDemand || undefined}
                    >
                      <span className="text-sm font-medium">{time}</span>
                      {isLowDemand && !isSelected && (
                        <span className="text-xs opacity-75 font-normal">Less busy</span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </Card>

            <Button
              onClick={handleContinue}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
              disabled={!isValid}
              data-testid="button-continue"
            >
              Continue
            </Button>
          </div>
        </div>

        <Card className="mt-6 p-6 bg-gray-300" data-testid="section-nearby-studios">
          <div className="font-semibold text-center">Nearby studios</div>
          <div className="text-sm text-gray-600 text-center mt-2">
            Check availability at nearby locations
          </div>
        </Card>
      </div>
    </div>
  );
}
