import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import { format, addDays } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type BookingStep = 
  | 'location'
  | 'auth'
  | 'service-type'
  | 'treatment'
  | 'questionnaire'
  | 'datetime'
  | 'checkout';

interface Location {
  id: string;
  name: string;
  address?: {
    city: string;
    state: string;
    line1?: string;
  };
}

interface BookingState {
  step: BookingStep;
  selectedLocation?: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
  userPhone?: string;
  userName?: string;
  serviceType?: 'treatment' | 'membership' | 'package' | 'giftcard';
  selectedTreatment?: {
    id: string;
    name: string;
    price: number;
    memberPrice: number;
    duration: number;
  };
  questionnaireComplete?: boolean;
  selectedDate?: Date;
  selectedTime?: {
    id: string;
    time: string;
  };
  selectedEsthetician?: string;
  cartId?: string;
}

export default function BookingWidget() {
  const { toast } = useToast();
  const [bookingState, setBookingState] = useState<BookingState>({
    step: 'location',
  });
  const [expandedState, setExpandedState] = useState<string | null>(null);

  // Fetch locations
  const { data: locationsData, isLoading: locationsLoading } = useQuery({
    queryKey: ['/api/booking/locations'],
  });

  const handleBack = () => {
    const stepOrder: BookingStep[] = ['location', 'auth', 'service-type', 'treatment', 'questionnaire', 'datetime', 'checkout'];
    const currentIndex = stepOrder.indexOf(bookingState.step);
    if (currentIndex > 0) {
      setBookingState(prev => ({ ...prev, step: stepOrder[currentIndex - 1] }));
    }
  };

  // Step 1: Location Selection
  if (bookingState.step === 'location') {
    const locationsByState: Record<string, Location[]> = {};
    
    if (locationsData) {
      Object.entries(locationsData as Record<string, any>).forEach(([state, cities]) => {
        Object.entries(cities as Record<string, any>).forEach(([city, locations]) => {
          if (!locationsByState[state]) {
            locationsByState[state] = [];
          }
          locationsByState[state].push(...(locations as Location[]));
        });
      });
    }

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Select a Glowbar Location</h1>
            <p className="text-gray-600" data-testid="text-subtitle">Choose your preferred studio</p>
          </div>

          {locationsLoading ? (
            <div className="text-center py-12" data-testid="text-loading">Loading locations...</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(locationsByState).map(([state, locations]) => (
                <div key={state} className="border rounded-lg">
                  <button
                    onClick={() => setExpandedState(expandedState === state ? null : state)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    data-testid={`accordion-state-${state}`}
                  >
                    <span className="text-xl font-semibold">{state}</span>
                    {expandedState === state ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </button>
                  {expandedState === state && (
                    <div className="px-6 pb-6 space-y-4">
                      {locations.map((location) => (
                        <div
                          key={location.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:border-gray-400 transition-colors"
                          data-testid={`card-location-${location.id}`}
                        >
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{location.name}</h3>
                            {location.address && (
                              <p className="text-gray-600 text-sm">
                                {location.address.line1 && `${location.address.line1}, `}
                                {location.address.city}, {location.address.state}
                              </p>
                            )}
                            <p className="text-gray-500 text-sm mt-1">0.5 mi</p>
                          </div>
                          <Button
                            onClick={() => {
                              setBookingState(prev => ({
                                ...prev,
                                selectedLocation: {
                                  id: location.id,
                                  name: location.name,
                                  city: location.address?.city || '',
                                  state: location.address?.state || '',
                                },
                                step: 'auth'
                              }));
                            }}
                            className="bg-black text-white hover:bg-gray-800 px-8"
                            data-testid={`button-select-${location.id}`}
                          >
                            SELECT STUDIO
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Mock Authentication
  if (bookingState.step === 'auth') {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-6"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Login or Create Account</h1>
            <p className="text-gray-600" data-testid="text-subtitle">
              Enter your phone number to continue
            </p>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={bookingState.userPhone || ''}
                    onChange={(e) => setBookingState(prev => ({ ...prev, userPhone: e.target.value }))}
                    data-testid="input-phone"
                  />
                </div>
                <Button
                  onClick={() => {
                    if (!bookingState.userPhone) {
                      toast({
                        title: "Phone Required",
                        description: "Please enter your phone number",
                        variant: "destructive"
                      });
                      return;
                    }
                    setBookingState(prev => ({ 
                      ...prev, 
                      userName: 'Guest',
                      step: 'service-type' 
                    }));
                  }}
                  className="w-full bg-black text-white hover:bg-gray-800"
                  data-testid="button-continue"
                >
                  CONTINUE
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 3: Service Type Menu
  if (bookingState.step === 'service-type') {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-6"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2" data-testid="text-title">
              Welcome back, {bookingState.userName}!
            </h1>
            <p className="text-gray-600" data-testid="text-subtitle">What would you like to do today?</p>
          </div>

          <div className="space-y-4">
            <Card
              className="cursor-pointer hover:border-orange-500 transition-colors"
              onClick={() => setBookingState(prev => ({ ...prev, serviceType: 'treatment', step: 'treatment' }))}
              data-testid="card-service-treatment"
            >
              <CardHeader className="p-6">
                <CardTitle className="text-xl">Book a Treatment</CardTitle>
                <CardDescription>Schedule your next facial or skincare service</CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:border-orange-500 transition-colors"
              onClick={() => {
                toast({
                  title: "Coming Soon",
                  description: "Membership options will be available soon"
                });
              }}
              data-testid="card-service-membership"
            >
              <CardHeader className="p-6">
                <CardTitle className="text-xl">Get a Membership Deal</CardTitle>
                <CardDescription>Save with monthly membership pricing</CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:border-orange-500 transition-colors"
              onClick={() => {
                toast({
                  title: "Coming Soon",
                  description: "Package options will be available soon"
                });
              }}
              data-testid="card-service-package"
            >
              <CardHeader className="p-6">
                <CardTitle className="text-xl">Purchase a Package</CardTitle>
                <CardDescription>Buy multiple treatments at a discounted rate</CardDescription>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer hover:border-orange-500 transition-colors"
              onClick={() => {
                toast({
                  title: "Coming Soon",
                  description: "Gift cards will be available soon"
                });
              }}
              data-testid="card-service-giftcard"
            >
              <CardHeader className="p-6">
                <CardTitle className="text-xl">Purchase a Gift Card</CardTitle>
                <CardDescription>Give the gift of glowing skin</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Treatment Selection
  if (bookingState.step === 'treatment') {
    const mockTreatments = [
      {
        id: '1',
        name: 'The Glow Facial',
        description: 'Our signature treatment combining deep cleansing, extractions, and hydration',
        price: 80,
        memberPrice: 65,
        duration: 50,
        image: null
      },
      {
        id: '2',
        name: 'Acne Clarifying',
        description: 'Targeted treatment for acne-prone skin with specialized extractions',
        price: 80,
        memberPrice: 65,
        duration: 50,
        image: null
      },
      {
        id: '3',
        name: 'Vitamin C Brightening',
        description: 'Brighten and even skin tone with vitamin C infusion',
        price: 80,
        memberPrice: 65,
        duration: 50,
        image: null
      },
    ];

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-6"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Select Your Treatment</h1>
            <p className="text-gray-600" data-testid="text-subtitle">
              {bookingState.selectedLocation?.name}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mockTreatments.map((treatment) => (
              <Card key={treatment.id} className="overflow-hidden" data-testid={`card-treatment-${treatment.id}`}>
                <div className="aspect-video bg-gradient-to-br from-orange-100 to-pink-100" />
                <CardHeader>
                  <CardTitle>{treatment.name}</CardTitle>
                  <CardDescription>{treatment.description}</CardDescription>
                  <div className="mt-4 space-y-2">
                    <p className="text-2xl font-bold">${treatment.price}</p>
                    <p className="text-sm text-orange-600 font-semibold">
                      Members save! Only ${treatment.memberPrice}
                    </p>
                    <p className="text-sm text-gray-600">{treatment.duration} minutes</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => {
                      setBookingState(prev => ({
                        ...prev,
                        selectedTreatment: treatment,
                        step: 'questionnaire'
                      }));
                    }}
                    className="w-full bg-black text-white hover:bg-gray-800"
                    data-testid={`button-select-treatment-${treatment.id}`}
                  >
                    SELECT
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 5: Pre-Treatment Questionnaire
  if (bookingState.step === 'questionnaire') {
    const [accutane, setAccutane] = useState(false);
    const [injections, setInjections] = useState(false);
    const [waxing, setWaxing] = useState(false);

    const allChecked = accutane && injections && waxing;

    return (
      <div className="min-h-screen bg-white">
        <div className="flex">
          {/* Main Content */}
          <div className="flex-1 px-6 py-8">
            <div className="max-w-2xl mx-auto">
              <Button
                variant="ghost"
                onClick={handleBack}
                className="mb-6"
                data-testid="button-back"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Before You Glow</h1>
                <p className="text-gray-600" data-testid="text-subtitle">
                  Please confirm the following for your safety
                </p>
              </div>

              <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="accutane"
                      checked={accutane}
                      onCheckedChange={(checked) => setAccutane(checked as boolean)}
                      data-testid="checkbox-accutane"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="accutane"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        I confirm I am not currently taking Accutane or have not taken it in the last 6 months
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="injections"
                      checked={injections}
                      onCheckedChange={(checked) => setInjections(checked as boolean)}
                      data-testid="checkbox-injections"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="injections"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        I confirm I have not had any injections or laser treatments in the last 2 weeks
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="waxing"
                      checked={waxing}
                      onCheckedChange={(checked) => setWaxing(checked as boolean)}
                      data-testid="checkbox-waxing"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="waxing"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        I confirm I have not had any waxing or threading on my face in the last 48 hours
                      </label>
                    </div>
                  </div>

                  {allChecked && (
                    <Button
                      onClick={() => {
                        setBookingState(prev => ({
                          ...prev,
                          questionnaireComplete: true,
                          step: 'datetime'
                        }));
                      }}
                      className="w-full bg-black text-white hover:bg-gray-800 mt-4"
                      data-testid="button-continue"
                    >
                      CONTINUE
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="w-80 bg-gray-50 p-6 border-l">
            <h2 className="text-xl font-bold mb-4">Your Cart</h2>
            {bookingState.selectedTreatment && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{bookingState.selectedTreatment.name}</p>
                      <p className="text-sm text-gray-600">{bookingState.selectedLocation?.name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBookingState(prev => ({ ...prev, step: 'treatment' }))}
                      data-testid="button-remove"
                    >
                      Remove
                    </Button>
                  </div>
                  <p className="text-lg font-bold">${bookingState.selectedTreatment.price}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 6: Date/Time Selection
  if (bookingState.step === 'datetime') {
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | undefined>(undefined);
    const [esthetician, setEsthetician] = useState('any');

    // Mock time slots (40-minute intervals)
    const generateTimeSlots = () => {
      const slots: string[] = [];
      for (let hour = 8; hour < 20; hour++) {
        slots.push(`${hour}:00`);
        slots.push(`${hour}:20`);
        slots.push(`${hour}:40`);
      }
      return slots.map(time => {
        const [h, m] = time.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return {
          value: time,
          display: `${displayHour}:${m} ${ampm}`,
          available: Math.random() > 0.3
        };
      });
    };

    const timeSlots = generateTimeSlots();

    return (
      <div className="min-h-screen bg-white">
        <div className="flex">
          {/* Main Content */}
          <div className="flex-1 px-6 py-8">
            <div className="max-w-3xl mx-auto">
              <Button
                variant="ghost"
                onClick={handleBack}
                className="mb-6"
                data-testid="button-back"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Select Date & Time</h1>
                <p className="text-gray-600" data-testid="text-subtitle">
                  {bookingState.selectedTreatment?.name} at {bookingState.selectedLocation?.name}
                </p>
              </div>

              {/* Esthetician Filter */}
              <div className="mb-6">
                <Label>Esthetician Preference</Label>
                <Select value={esthetician} onValueChange={setEsthetician}>
                  <SelectTrigger className="w-full" data-testid="select-esthetician">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Esthetician</SelectItem>
                    <SelectItem value="sarah">Sarah Johnson</SelectItem>
                    <SelectItem value="emily">Emily Chen</SelectItem>
                    <SelectItem value="maria">Maria Rodriguez</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Simple Calendar */}
              <div className="mb-6">
                <Label className="mb-4 block">Select a Date</Label>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 14 }, (_, i) => {
                    const date = addDays(new Date(), i);
                    const isSelected = selectedDate && format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(date)}
                        className={`p-3 border rounded-lg text-center transition-colors ${
                          isSelected
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'hover:border-orange-500'
                        }`}
                        data-testid={`button-date-${i}`}
                      >
                        <div className="text-xs">{format(date, 'EEE')}</div>
                        <div className="text-lg font-semibold">{format(date, 'd')}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots */}
              {selectedDate && (
                <div>
                  <Label className="mb-4 block">Available Times</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.value}
                        onClick={() => {
                          if (slot.available) {
                            setSelectedTimeSlot(slot.value);
                          }
                        }}
                        disabled={!slot.available}
                        className={`p-3 border rounded-lg text-center transition-colors ${
                          selectedTimeSlot === slot.value
                            ? 'bg-orange-500 text-white border-orange-500'
                            : slot.available
                            ? 'hover:border-orange-500'
                            : 'opacity-40 cursor-not-allowed'
                        }`}
                        data-testid={`button-time-${slot.value}`}
                      >
                        {slot.display}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedTimeSlot && (
                <Button
                  onClick={() => {
                    setBookingState(prev => ({
                      ...prev,
                      selectedDate,
                      selectedTime: { id: selectedTimeSlot, time: selectedTimeSlot },
                      selectedEsthetician: esthetician,
                      step: 'checkout'
                    }));
                  }}
                  className="w-full bg-black text-white hover:bg-gray-800 mt-6"
                  data-testid="button-continue"
                >
                  CONTINUE TO CHECKOUT
                </Button>
              )}

              {/* Nearby Locations */}
              {selectedDate && timeSlots.filter(s => s.available).length < 5 && (
                <div className="mt-8 p-4 border rounded-lg bg-orange-50">
                  <p className="font-semibold mb-2">Limited availability at this location</p>
                  <p className="text-sm text-gray-600 mb-3">Check nearby studios for more options:</p>
                  <Button variant="outline" size="sm" data-testid="button-nearby-locations">
                    View Nearby Locations
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="w-80 bg-gray-50 p-6 border-l">
            <h2 className="text-xl font-bold mb-4">Your Cart</h2>
            {bookingState.selectedTreatment && (
              <Card>
                <CardContent className="p-4">
                  <p className="font-semibold">{bookingState.selectedTreatment.name}</p>
                  <p className="text-sm text-gray-600">{bookingState.selectedLocation?.name}</p>
                  {selectedDate && selectedTimeSlot && (
                    <p className="text-sm text-gray-600 mt-2">
                      {format(selectedDate, 'MMM d, yyyy')} at {selectedTimeSlot}
                    </p>
                  )}
                  <p className="text-lg font-bold mt-2">${bookingState.selectedTreatment.price}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 7: Checkout Summary
  if (bookingState.step === 'checkout') {
    const [promoCode, setPromoCode] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-6"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Checkout</h1>
            <p className="text-gray-600" data-testid="text-subtitle">Review your appointment details</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column - Appointment Summary */}
            <div>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Appointment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Treatment</p>
                    <p className="font-semibold">{bookingState.selectedTreatment?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="font-semibold">{bookingState.selectedLocation?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date & Time</p>
                    <p className="font-semibold">
                      {bookingState.selectedDate && format(bookingState.selectedDate, 'EEEE, MMMM d, yyyy')}
                      {' at '}
                      {bookingState.selectedTime?.time}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Duration</p>
                    <p className="font-semibold">{bookingState.selectedTreatment?.duration} minutes</p>
                  </div>
                </CardContent>
              </Card>

              {/* Cancellation Policy */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cancellation Policy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    Please cancel or reschedule at least 24 hours before your appointment to avoid a cancellation fee.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Payment */}
            <div>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Payment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Promo Code */}
                  <div>
                    <Label htmlFor="promo">Promo Code</Label>
                    <div className="flex gap-2">
                      <Input
                        id="promo"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Enter code"
                        data-testid="input-promo"
                      />
                      <Button variant="outline" data-testid="button-apply-promo">
                        APPLY
                      </Button>
                    </div>
                  </div>

                  {/* Price Breakdown */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between mb-2">
                      <span>Subtotal</span>
                      <span>${bookingState.selectedTreatment?.price}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span>Tax</span>
                      <span>$0.00</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total</span>
                      <span data-testid="text-total">${bookingState.selectedTreatment?.price}</span>
                    </div>
                  </div>

                  {/* Terms */}
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="terms"
                      checked={acceptTerms}
                      onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                      data-testid="checkbox-terms"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="terms"
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        I agree to the{' '}
                        <a href="#" className="text-orange-600 underline">
                          Terms of Service
                        </a>{' '}
                        and cancellation policy
                      </label>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      if (!acceptTerms) {
                        toast({
                          title: "Terms Required",
                          description: "Please accept the terms to continue",
                          variant: "destructive"
                        });
                        return;
                      }
                      toast({
                        title: "Booking Confirmed!",
                        description: "Your appointment has been scheduled successfully"
                      });
                      // Reset to start
                      setBookingState({ step: 'location' });
                    }}
                    disabled={!acceptTerms}
                    className="w-full bg-orange-500 text-white hover:bg-orange-600 text-lg py-6"
                    data-testid="button-book-now"
                  >
                    BOOK NOW
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
