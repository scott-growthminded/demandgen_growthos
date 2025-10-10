import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { format } from "date-fns";

interface TimeSlot {
  id: string;
  startTime: string;
  available: boolean;
}

interface Esthetician {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatar?: string;
}

interface BookingState {
  locationId: string;
  locationName: string;
  date: Date;
  timeSlot?: TimeSlot;
  estheticianId?: string;
  step: 'date' | 'time' | 'review' | 'account';
}

export default function BookingWidget() {
  const [, setLocation] = useLocation();
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const initialLocationId = urlParams.get('location') || '';
  const initialDate = urlParams.get('date') ? new Date(urlParams.get('date')!) : new Date();

  const [bookingState, setBookingState] = useState<BookingState>({
    locationId: initialLocationId,
    locationName: '',
    date: initialDate,
    step: 'date',
  });

  const [selectedEstheticianId, setSelectedEstheticianId] = useState<string>('any');

  // Fetch availability data
  const { data: availabilityData, isLoading } = useQuery({
    queryKey: ['/api/booking/availability', bookingState.locationId, format(bookingState.date, 'yyyy-MM-dd')],
    enabled: !!bookingState.locationId && !!bookingState.date,
    queryFn: async () => {
      const response = await fetch('/api/booking/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: bookingState.locationId,
          date: format(bookingState.date, 'yyyy-MM-dd'),
          maxDistance: 5
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch availability');
      }
      
      return response.json();
    }
  });

  // Update location name when availability data is loaded
  useEffect(() => {
    if (availabilityData?.location?.name && !bookingState.locationName) {
      setBookingState(prev => ({
        ...prev,
        locationName: availabilityData.location.name
      }));
    }
  }, [availabilityData, bookingState.locationName]);

  // Group time slots by time of day
  const groupTimeSlotsByPeriod = (slots: TimeSlot[]) => {
    const morning: TimeSlot[] = [];
    const afternoon: TimeSlot[] = [];
    const evening: TimeSlot[] = [];

    slots.forEach(slot => {
      const hour = new Date(slot.startTime).getHours();
      if (hour < 12) {
        morning.push(slot);
      } else if (hour < 17) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    });

    return { morning, afternoon, evening };
  };

  const timeSlots = availabilityData?.timeSlots || [];
  const { morning, afternoon, evening } = groupTimeSlotsByPeriod(timeSlots);
  const estheticians = availabilityData?.estheticians || [];
  const alternativeLocations = availabilityData?.alternativeLocations || [];

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setBookingState(prev => ({
        ...prev,
        date,
        step: 'time',
        timeSlot: undefined
      }));
    }
  };

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    setBookingState(prev => ({
      ...prev,
      timeSlot: slot,
      step: 'review',
      estheticianId: selectedEstheticianId === 'any' ? undefined : selectedEstheticianId
    }));
  };

  const handleConfirmBooking = () => {
    setBookingState(prev => ({
      ...prev,
      step: 'account'
    }));
  };

  const handleBack = () => {
    if (bookingState.step === 'time') {
      setBookingState(prev => ({ ...prev, step: 'date' }));
    } else if (bookingState.step === 'review') {
      setBookingState(prev => ({ ...prev, step: 'time' }));
    } else if (bookingState.step === 'account') {
      setBookingState(prev => ({ ...prev, step: 'review' }));
    }
  };

  if (!bookingState.locationId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No location specified. Please provide a location parameter in the URL.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Date selection step
  if (bookingState.step === 'date') {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              {format(bookingState.date, 'EEEE, MMM d')}
            </h1>
            {bookingState.locationName && (
              <p className="text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-4 w-4" />
                {bookingState.locationName}
              </p>
            )}
          </div>

          <Card>
            <CardContent className="pt-6">
              <Calendar
                mode="single"
                selected={bookingState.date}
                onSelect={handleDateSelect}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
                data-testid="calendar-date-select"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Time selection step
  if (bookingState.step === 'time') {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto">
          <Button 
            variant="ghost" 
            onClick={handleBack} 
            className="mb-4"
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold" data-testid="text-selected-date">
              {format(bookingState.date, 'EEEE, MMM d')}
            </h1>
            {bookingState.locationName && (
              <p className="text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-4 w-4" />
                {bookingState.locationName}
              </p>
            )}
          </div>

          {/* Esthetician selector */}
          <div className="mb-6">
            <Label htmlFor="esthetician-select">Select Esthetician</Label>
            <Select
              value={selectedEstheticianId}
              onValueChange={setSelectedEstheticianId}
            >
              <SelectTrigger 
                id="esthetician-select" 
                className="w-full mt-2"
                data-testid="select-esthetician"
              >
                <SelectValue placeholder="Any Esthetician" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any" data-testid="option-any-esthetician">
                  Any Esthetician
                </SelectItem>
                {estheticians.map((est: Esthetician) => (
                  <SelectItem 
                    key={est.id} 
                    value={est.id}
                    data-testid={`option-esthetician-${est.id}`}
                  >
                    {est.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading available times...</p>
            </div>
          )}

          {!isLoading && timeSlots.length === 0 && alternativeLocations.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No availability for this date. Please try another date.
                </p>
              </CardContent>
            </Card>
          )}

          {!isLoading && timeSlots.length === 0 && alternativeLocations.length > 0 && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground mb-4">
                    No availability at {bookingState.locationName}
                  </p>
                  <p className="text-sm font-medium text-center mb-2">
                    Available at nearby locations:
                  </p>
                </CardContent>
              </Card>

              {alternativeLocations.map((loc: any) => (
                <Card key={loc.id} className="cursor-pointer hover:border-primary transition-colors">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{loc.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {loc.distance} miles away • {loc.availableSlots} slots available
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          setBookingState(prev => ({
                            ...prev,
                            locationId: loc.id,
                            locationName: loc.name,
                            step: 'date'
                          }));
                        }}
                        data-testid={`button-select-location-${loc.id}`}
                      >
                        Select
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && timeSlots.length > 0 && (
            <div className="space-y-6">
              {morning.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3" data-testid="text-morning-header">Morning</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {morning.map(slot => (
                      <Button
                        key={slot.id}
                        variant="outline"
                        className="h-12 text-base font-medium"
                        onClick={() => handleTimeSlotSelect(slot)}
                        data-testid={`button-timeslot-${slot.id}`}
                      >
                        {format(new Date(slot.startTime), 'h:mm a')}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {afternoon.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3" data-testid="text-afternoon-header">Afternoon</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {afternoon.map(slot => (
                      <Button
                        key={slot.id}
                        variant="outline"
                        className="h-12 text-base font-medium"
                        onClick={() => handleTimeSlotSelect(slot)}
                        data-testid={`button-timeslot-${slot.id}`}
                      >
                        {format(new Date(slot.startTime), 'h:mm a')}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {evening.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3" data-testid="text-evening-header">Evening</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {evening.map(slot => (
                      <Button
                        key={slot.id}
                        variant="outline"
                        className="h-12 text-base font-medium"
                        onClick={() => handleTimeSlotSelect(slot)}
                        data-testid={`button-timeslot-${slot.id}`}
                      >
                        {format(new Date(slot.startTime), 'h:mm a')}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Review step
  if (bookingState.step === 'review') {
    const selectedEsthetician = estheticians.find(
      (e: Esthetician) => e.id === bookingState.estheticianId
    );

    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto">
          <Button 
            variant="ghost" 
            onClick={handleBack} 
            className="mb-4"
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <h1 className="text-2xl font-bold mb-6" data-testid="text-review-title">
            Review Your Booking
          </h1>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Booking Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium" data-testid="text-review-location">
                  {bookingState.locationName}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Date & Time</p>
                <p className="font-medium" data-testid="text-review-datetime">
                  {format(bookingState.date, 'EEEE, MMMM d, yyyy')}
                  {bookingState.timeSlot && (
                    <> at {format(new Date(bookingState.timeSlot.startTime), 'h:mm a')}</>
                  )}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Esthetician</p>
                <p className="font-medium" data-testid="text-review-esthetician">
                  {selectedEsthetician ? selectedEsthetician.displayName : 'Any Available Esthetician'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Button 
            className="w-full h-12 text-base"
            onClick={handleConfirmBooking}
            data-testid="button-continue-to-account"
          >
            Continue to Account
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // Account creation/login step (stopping point)
  if (bookingState.step === 'account') {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto">
          <Button 
            variant="ghost" 
            onClick={handleBack} 
            className="mb-4"
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <h1 className="text-2xl font-bold mb-2" data-testid="text-account-title">
            Create Account or Sign In
          </h1>
          <p className="text-muted-foreground mb-6">
            You're almost done! Create an account or sign in to complete your booking.
          </p>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="first-name">First Name</Label>
                <Input 
                  id="first-name" 
                  type="text" 
                  className="mt-1"
                  data-testid="input-first-name"
                />
              </div>

              <div>
                <Label htmlFor="last-name">Last Name</Label>
                <Input 
                  id="last-name" 
                  type="text" 
                  className="mt-1"
                  data-testid="input-last-name"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  className="mt-1"
                  data-testid="input-email"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  className="mt-1"
                  data-testid="input-phone"
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  className="mt-1"
                  data-testid="input-password"
                />
              </div>

              <Button 
                className="w-full"
                data-testid="button-create-account"
                disabled
              >
                Create Account & Complete Booking
              </Button>
            </CardContent>
          </Card>

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Already have an account?
            </p>
            <Button 
              variant="outline" 
              className="w-full"
              data-testid="button-sign-in"
              disabled
            >
              Sign In
            </Button>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              <strong>Stopping Point:</strong> This is where the booking flow ends for testing. 
              Account creation and payment will be implemented next.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
