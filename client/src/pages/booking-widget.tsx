import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, MapPin, List } from "lucide-react";
import { format } from "date-fns";
import 'leaflet/dist/leaflet.css';

interface TimeSlot {
  id: string;
  startTime: string;
  available: boolean;
  estheticianId?: string;
}

interface Esthetician {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatar?: string;
}

interface Location {
  id: string;
  name: string;
  address?: {
    city: string;
    state: string;
    line1?: string;
    line2?: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
  staff?: Esthetician[];
}

interface BookingState {
  locationId?: string;
  locationName?: string;
  date?: Date;
  timeSlot?: TimeSlot;
  estheticianId?: string;
  step: 'location' | 'date' | 'time' | 'review' | 'account';
}

export default function BookingWidget() {
  const [, setLocation] = useLocation();

  const [bookingState, setBookingState] = useState<BookingState>({
    step: 'location',
  });

  // Track esthetician selection separately during time selection
  const [tempEstheticianId, setTempEstheticianId] = useState<string>('any');
  
  // Check for URL parameters on mount to support deep linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locationId = params.get('location');
    const dateParam = params.get('date');
    const estheticianId = params.get('esthetician');
    
    if (locationId || dateParam || estheticianId) {
      const newState: BookingState = {
        step: 'location'
      };
      
      // If location is provided
      if (locationId) {
        newState.locationId = locationId;
        newState.locationName = params.get('locationName') || 'Selected Location';
        newState.step = 'date';
      }
      
      // If date is provided (requires location)
      if (dateParam && locationId) {
        try {
          const parsedDate = new Date(dateParam);
          if (!isNaN(parsedDate.getTime())) {
            newState.date = parsedDate;
            newState.step = 'time';
          }
        } catch (e) {
          console.error('Invalid date parameter:', e);
        }
      }
      
      // If esthetician is provided, set it
      if (estheticianId) {
        setTempEstheticianId(estheticianId);
      }
      
      setBookingState(newState);
    }
  }, []);

  // Fetch all locations grouped by state and city
  const { data: locationsData, isLoading: locationsLoading } = useQuery({
    queryKey: ['/api/booking/locations'],
  });

  // Fetch availability data (only when location and date are selected)
  const { data: availabilityData, isLoading: availabilityLoading } = useQuery({
    queryKey: ['/api/booking/availability', bookingState.locationId, bookingState.date ? format(bookingState.date, 'yyyy-MM-dd') : ''],
    enabled: !!bookingState.locationId && !!bookingState.date,
    queryFn: async () => {
      const response = await fetch('/api/booking/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: bookingState.locationId,
          date: format(bookingState.date!, 'yyyy-MM-dd'),
          maxDistance: 10
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch availability');
      }
      
      return response.json();
    }
  });

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

  const allTimeSlots = availabilityData?.timeSlots || [];
  const estheticians = availabilityData?.estheticians || [];
  const alternativeLocations = availabilityData?.alternativeLocations || [];
  
  // Filter time slots by selected esthetician
  const filteredTimeSlots = tempEstheticianId === 'any' 
    ? allTimeSlots 
    : allTimeSlots.filter(slot => slot.estheticianId === tempEstheticianId);
  
  const { morning, afternoon, evening } = groupTimeSlotsByPeriod(filteredTimeSlots);

  const handleLocationSelect = (locationId: string, locationName: string) => {
    setBookingState({
      locationId,
      locationName,
      step: 'date',
    });
    // Reset esthetician when location changes
    setTempEstheticianId('any');
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setBookingState(prev => ({
        ...prev,
        date,
        step: 'time',
        timeSlot: undefined,
        estheticianId: undefined
      }));
      // Reset esthetician selection when date changes
      setTempEstheticianId('any');
    }
  };

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    setBookingState(prev => ({
      ...prev,
      timeSlot: slot,
      estheticianId: tempEstheticianId === 'any' ? undefined : tempEstheticianId,
      step: 'review'
    }));
  };

  const handleProceedToAccount = () => {
    setBookingState(prev => ({
      ...prev,
      step: 'account'
    }));
  };

  const handleBack = () => {
    if (bookingState.step === 'date') {
      setBookingState(prev => ({ ...prev, step: 'location', locationId: undefined, locationName: undefined }));
    } else if (bookingState.step === 'time') {
      setBookingState(prev => ({ ...prev, step: 'date', date: undefined }));
    } else if (bookingState.step === 'review') {
      setBookingState(prev => ({ ...prev, step: 'time', timeSlot: undefined }));
    } else if (bookingState.step === 'account') {
      setBookingState(prev => ({ ...prev, step: 'review' }));
    }
  };

  // Location Selection Step
  if (bookingState.step === 'location') {
    return (
      <>
        <div className="h-[10px] bg-primary" />
        <div className="min-h-screen bg-background p-4">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Choose Your Location</h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">Select a Glowbar location to start booking</p>
            </div>

            {locationsLoading ? (
              <div className="text-center py-12" data-testid="text-loading">Loading locations...</div>
            ) : (
              <Tabs defaultValue="list" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                <TabsTrigger value="list" data-testid="button-view-list">
                  <List className="w-4 h-4 mr-2" />
                  List View
                </TabsTrigger>
                <TabsTrigger value="map" data-testid="button-view-map">
                  <MapPin className="w-4 h-4 mr-2" />
                  Map View
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="space-y-6">
                {locationsData && (Object.entries(locationsData) as [string, any][]).map(([state, cities]: [string, any]) => (
                  <div key={state} className="space-y-4">
                    <h2 className="text-2xl font-semibold" data-testid={`text-state-${state}`}>{state}</h2>
                    {(Object.entries(cities) as [string, any][]).map(([city, locations]: [string, any]) => (
                      <div key={city} className="space-y-2">
                        <h3 className="text-lg font-medium text-muted-foreground" data-testid={`text-city-${city}`}>{city}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {locations.map((location: Location) => (
                            <Card
                              key={location.id}
                              className="cursor-pointer hover:border-primary transition-colors"
                              onClick={() => handleLocationSelect(location.id, location.name)}
                              data-testid={`card-location-${location.id}`}
                            >
                              <CardHeader>
                                <CardTitle className="text-lg">{location.name}</CardTitle>
                                {location.address && (
                                  <CardDescription>
                                    {location.address.line1 && <div>{location.address.line1}</div>}
                                    <div>{location.address.city}, {location.address.state}</div>
                                  </CardDescription>
                                )}
                                {location.staff && location.staff.length > 0 && (
                                  <div className="mt-4 pt-4 border-t">
                                    <div className="text-xs font-medium text-muted-foreground mb-2">
                                      Estheticians ({location.staff.length})
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {location.staff.slice(0, 6).map((esthetician) => (
                                        <div
                                          key={esthetician.id}
                                          className="flex items-center gap-2 bg-secondary/50 rounded-full px-3 py-1"
                                          data-testid={`staff-${esthetician.id}`}
                                        >
                                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium">
                                            {esthetician.firstName?.[0]}{esthetician.lastName?.[0]}
                                          </div>
                                          <span className="text-xs">{esthetician.displayName}</span>
                                        </div>
                                      ))}
                                      {location.staff.length > 6 && (
                                        <div className="flex items-center text-xs text-muted-foreground">
                                          +{location.staff.length - 6} more
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </CardHeader>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="map">
                <div className="h-[600px] w-full rounded-lg overflow-hidden border">
                  {(() => {
                    const allLocations: Location[] = [];
                    if (locationsData) {
                      Object.values(locationsData).forEach((cities: any) => {
                        Object.values(cities).forEach((locations: any) => {
                          allLocations.push(...locations);
                        });
                      });
                    }
                    
                    const locationsWithCoords = allLocations.filter(loc => loc.coordinates);
                    
                    if (locationsWithCoords.length === 0) {
                      return (
                        <div className="h-full flex items-center justify-center bg-secondary/20">
                          <div className="text-center">
                            <MapPin className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-muted-foreground">No location coordinates available</p>
                          </div>
                        </div>
                      );
                    }
                    
                    const centerLat = locationsWithCoords.reduce((sum, loc) => sum + loc.coordinates!.lat, 0) / locationsWithCoords.length;
                    const centerLng = locationsWithCoords.reduce((sum, loc) => sum + loc.coordinates!.lng, 0) / locationsWithCoords.length;
                    
                    return (
                      <MapContainer
                        center={[centerLat, centerLng]}
                        zoom={6}
                        style={{ height: '100%', width: '100%' }}
                        data-testid="map-container"
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {locationsWithCoords.map((location) => (
                          <Marker
                            key={location.id}
                            position={[location.coordinates!.lat, location.coordinates!.lng]}
                            eventHandlers={{
                              click: () => handleLocationSelect(location.id, location.name)
                            }}
                          >
                            <Popup>
                              <div className="p-2">
                                <h3 className="font-semibold mb-1">{location.name}</h3>
                                {location.address && (
                                  <p className="text-sm text-muted-foreground">
                                    {location.address.line1 && <>{location.address.line1}<br /></>}
                                    {location.address.city}, {location.address.state}
                                  </p>
                                )}
                                {location.staff && location.staff.length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    {location.staff.length} esthetician{location.staff.length !== 1 ? 's' : ''} available
                                  </p>
                                )}
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    );
                  })()}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
      </>
    );
  }

  // Date Selection Step
  if (bookingState.step === 'date') {
    return (
      <>
        <div className="h-[10px] bg-primary" />
        <div className="min-h-screen bg-background p-4">
          <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Locations
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Select a Date</h1>
            <p className="text-muted-foreground" data-testid="text-subtitle">
              Booking at {bookingState.locationName}
            </p>
          </div>

          <Card>
            <CardContent className="p-6">
              <Calendar
                mode="single"
                selected={bookingState.date}
                onSelect={handleDateSelect}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return date < today;
                }}
                className="rounded-md border"
                data-testid="calendar-date-picker"
              />
            </CardContent>
          </Card>
        </div>
      </div>
      </>
    );
  }

  // Time Selection Step
  if (bookingState.step === 'time') {
    const hasAvailability = filteredTimeSlots.length > 0;

    return (
      <>
        <div className="h-[10px] bg-primary" />
        <div className="min-h-screen bg-background p-4">
          <div className="max-w-6xl mx-auto">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Date Selection
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Choose Your Time</h1>
            <p className="text-muted-foreground" data-testid="text-subtitle">
              {bookingState.locationName} - {bookingState.date && format(bookingState.date, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          {/* Esthetician Filter */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Select Esthetician (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={tempEstheticianId}
                onValueChange={setTempEstheticianId}
                data-testid="select-esthetician"
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {tempEstheticianId === 'any' 
                      ? 'Any esthetician' 
                      : estheticians.find(e => e.id === tempEstheticianId)?.displayName || 'Select esthetician'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any esthetician</SelectItem>
                  {estheticians.map((esthetician: Esthetician) => (
                    <SelectItem key={esthetician.id} value={esthetician.id}>
                      {esthetician.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {availabilityLoading ? (
            <div className="text-center py-12" data-testid="text-loading">Loading availability...</div>
          ) : hasAvailability ? (
            <div className="space-y-6">
              {morning.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4" data-testid="text-period-morning">Morning</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {morning.map((slot) => (
                      <Button
                        key={slot.id}
                        variant="outline"
                        onClick={() => handleTimeSlotSelect(slot)}
                        disabled={!slot.available}
                        className="h-auto py-3"
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
                  <h2 className="text-xl font-semibold mb-4" data-testid="text-period-afternoon">Afternoon</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {afternoon.map((slot) => (
                      <Button
                        key={slot.id}
                        variant="outline"
                        onClick={() => handleTimeSlotSelect(slot)}
                        disabled={!slot.available}
                        className="h-auto py-3"
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
                  <h2 className="text-xl font-semibold mb-4" data-testid="text-period-evening">Evening</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {evening.map((slot) => (
                      <Button
                        key={slot.id}
                        variant="outline"
                        onClick={() => handleTimeSlotSelect(slot)}
                        disabled={!slot.available}
                        className="h-auto py-3"
                        data-testid={`button-timeslot-${slot.id}`}
                      >
                        {format(new Date(slot.startTime), 'h:mm a')}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8">
                <h3 className="text-xl font-semibold mb-4" data-testid="text-no-availability">
                  No availability at {bookingState.locationName}
                </h3>
                {alternativeLocations.length > 0 && (
                  <div>
                    <p className="mb-4 text-muted-foreground">Try these nearby locations:</p>
                    <div className="space-y-2">
                      {alternativeLocations.map((loc: any) => (
                        <Button
                          key={loc.location.id}
                          variant="outline"
                          className="w-full justify-between"
                          onClick={() => {
                            setBookingState({
                              locationId: loc.location.id,
                              locationName: loc.location.name,
                              date: bookingState.date,
                              step: 'time'
                            });
                          }}
                          data-testid={`button-alternative-${loc.location.id}`}
                        >
                          <span>{loc.location.name}</span>
                          <span className="text-muted-foreground">
                            {loc.distance.toFixed(1)} mi • {loc.availableSlots} slots
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </>
    );
  }

  // Review Step
  if (bookingState.step === 'review') {
    return (
      <>
        <div className="h-[10px] bg-primary" />
        <div className="min-h-screen bg-background p-4">
          <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Time Selection
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Review Your Booking</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Location</Label>
                <p className="text-lg" data-testid="text-review-location">{bookingState.locationName}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Date & Time</Label>
                <p className="text-lg" data-testid="text-review-datetime">
                  {bookingState.date && format(bookingState.date, 'EEEE, MMMM d, yyyy')} at{' '}
                  {bookingState.timeSlot && format(new Date(bookingState.timeSlot.startTime), 'h:mm a')}
                </p>
              </div>
              {bookingState.estheticianId && (
                <div>
                  <Label className="text-muted-foreground">Esthetician</Label>
                  <p className="text-lg" data-testid="text-review-esthetician">
                    {estheticians.find((e: Esthetician) => e.id === bookingState.estheticianId)?.displayName || 'Selected esthetician'}
                  </p>
                </div>
              )}
              <Button
                className="w-full mt-6"
                onClick={handleProceedToAccount}
                data-testid="button-proceed"
              >
                Continue to Account
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      </>
    );
  }

  // Account Creation/Login Step
  if (bookingState.step === 'account') {
    return (
      <>
        <div className="h-[10px] bg-primary" />
        <div className="min-h-screen bg-background p-4">
          <div className="max-w-md mx-auto">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Review
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Create Account or Sign In</h1>
            <p className="text-muted-foreground" data-testid="text-subtitle">
              Complete your booking by creating an account or signing in
            </p>
          </div>

          <Tabs defaultValue="signup" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
              <TabsTrigger value="signin" data-testid="tab-signin">Sign In</TabsTrigger>
            </TabsList>

            <TabsContent value="signup" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="Enter your first name" data-testid="input-firstname" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Enter your last name" data-testid="input-lastname" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="Enter your email" data-testid="input-email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" type="tel" placeholder="Enter your phone number" data-testid="input-phone" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="Create a password" data-testid="input-password" />
                  </div>
                  <Button className="w-full" data-testid="button-signup">
                    Create Account & Complete Booking
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="signin" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input id="signin-email" type="email" placeholder="Enter your email" data-testid="input-signin-email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input id="signin-password" type="password" placeholder="Enter your password" data-testid="input-signin-password" />
                  </div>
                  <Button className="w-full" data-testid="button-signin">
                    Sign In & Complete Booking
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      </>
    );
  }

  return null;
}
