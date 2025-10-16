import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronLeft, Package, CreditCard, Gift, Check } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type BookingStep = 
  | 'product-type'
  | 'plan'
  | 'location'
  | 'service'
  | 'datetime'
  | 'waitlist'
  | 'contact'
  | 'payment'
  | 'confirmation';

interface BookingState {
  step: BookingStep;
  productType?: 'Treatment' | 'Product' | 'Gift Card';
  plan?: 'member' | 'non-member';
  locationId?: string;
  locationName?: string;
  cartId?: string;
  categories?: any[];
  serviceId?: string;
  serviceName?: string;
  selectedDate?: Date;
  selectedTime?: any;
  contactInfo?: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  paymentToken?: string;
  appointmentId?: string;
}

interface Location {
  id: string;
  name: string;
  address?: {
    city: string;
    state: string;
    line1?: string;
  };
}

export default function BookingWidget() {
  const { toast } = useToast();
  const [bookingState, setBookingState] = useState<BookingState>({
    step: 'product-type',
  });

  // Fetch locations
  const { data: locationsData, isLoading: locationsLoading } = useQuery({
    queryKey: ['/api/booking/locations'],
  });

  // Create cart mutation
  const createCartMutation = useMutation({
    mutationFn: async (data: { locationId: string; productType: string; plan?: string }) => {
      const res = await apiRequest('POST', '/api/cart/create', data);
      return await res.json();
    },
    onSuccess: (data) => {
      setBookingState(prev => ({
        ...prev,
        cartId: data.cart.cartId,
        categories: data.categories || [],
        step: 'service'
      }));
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create cart",
        variant: "destructive",
      });
    },
  });

  // Add service to cart mutation
  const addServiceMutation = useMutation({
    mutationFn: async (data: { cartId: string; itemId: string; itemName: string }) => {
      const res = await apiRequest('POST', `/api/cart/${data.cartId}/add-item`, {
        itemId: data.itemId,
        itemName: data.itemName
      });
      return await res.json();
    },
    onSuccess: (_, variables) => {
      setBookingState(prev => ({
        ...prev,
        serviceId: variables.itemId,
        serviceName: variables.itemName,
        step: 'datetime'
      }));
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add service",
        variant: "destructive",
      });
    },
  });

  // Fetch available dates
  const { data: datesData, isLoading: datesLoading } = useQuery({
    queryKey: ['/api/cart', bookingState.cartId, 'dates'],
    enabled: !!bookingState.cartId && bookingState.step === 'datetime',
  });

  // Fetch available times for selected date
  const { data: timesData, isLoading: timesLoading } = useQuery({
    queryKey: ['/api/cart', bookingState.cartId, 'times', bookingState.selectedDate],
    enabled: !!bookingState.cartId && !!bookingState.selectedDate && bookingState.step === 'datetime',
  });

  // Reserve time slot mutation
  const reserveSlotMutation = useMutation({
    mutationFn: async (data: { cartId: string; bookableTimeId: string }) => {
      const res = await apiRequest('POST', `/api/cart/${data.cartId}/reserve`, {
        bookableTimeId: data.bookableTimeId
      });
      return await res.json();
    },
    onSuccess: () => {
      setBookingState(prev => ({ ...prev, step: 'contact' }));
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reserve time slot",
        variant: "destructive",
      });
    },
  });

  // Submit waitlist mutation
  const submitWaitlistMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/waitlist', data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "You've been added to the waitlist. We'll contact you when a slot opens up.",
      });
      setBookingState({ step: 'product-type' });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join waitlist",
        variant: "destructive",
      });
    },
  });

  // Update contact info mutation
  const updateContactMutation = useMutation({
    mutationFn: async (data: { cartId: string; firstName: string; lastName: string; email: string; phoneNumber: string }) => {
      const res = await apiRequest('POST', `/api/cart/${data.cartId}/client-info`, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber
      });
      return await res.json();
    },
    onSuccess: (_, variables) => {
      setBookingState(prev => ({
        ...prev,
        firstName: variables.firstName,
        lastName: variables.lastName,
        email: variables.email,
        phone: variables.phoneNumber,
        step: 'payment'
      }));
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact information",
        variant: "destructive",
      });
    },
  });

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (cartId: string) => {
      const res = await apiRequest('POST', `/api/cart/${cartId}/checkout`, {});
      return await res.json();
    },
    onSuccess: () => {
      setBookingState(prev => ({ ...prev, step: 'confirmation' }));
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete checkout",
        variant: "destructive",
      });
    },
  });

  const handleBack = () => {
    // Dynamic navigation based on current step
    const navigationMap: Record<BookingStep, BookingStep> = {
      'product-type': 'product-type', // Can't go back from start
      'plan': 'product-type',
      'location': 'plan',
      'service': 'location',
      'datetime': 'service',
      'waitlist': 'datetime', // Go back to datetime to try again
      'contact': 'datetime', // Always go back to datetime (whether from datetime or waitlist)
      'payment': 'contact',
      'confirmation': 'payment'
    };
    
    const previousStep = navigationMap[bookingState.step];
    if (previousStep !== bookingState.step) {
      setBookingState(prev => ({ ...prev, step: previousStep }));
    }
  };

  const handleProductTypeSelect = (productType: 'Treatment' | 'Product' | 'Gift Card') => {
    setBookingState(prev => ({
      ...prev,
      productType,
      step: 'plan'
    }));
  };

  const handlePlanSelect = (plan: 'member' | 'non-member') => {
    setBookingState(prev => ({
      ...prev,
      plan,
      step: 'location'
    }));
  };

  const handleLocationSelect = (locationId: string, locationName: string) => {
    setBookingState(prev => ({
      ...prev,
      locationId,
      locationName,
    }));
    
    // Create cart for this location
    createCartMutation.mutate({
      locationId,
      productType: bookingState.productType || 'Treatment',
      plan: bookingState.plan,
    });
  };

  // Step 1: Product Type Selection
  if (bookingState.step === 'product-type') {
    return (
      <>
        <div className="h-[10px] bg-primary" />
        <div className="min-h-screen bg-background p-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" data-testid="text-title">What are you booking?</h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">Select the type of service you'd like</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card
                className="cursor-pointer hover:border-primary transition-all hover:shadow-lg"
                onClick={() => handleProductTypeSelect('Treatment')}
                data-testid="card-product-treatment"
              >
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle>Treatment</CardTitle>
                  <CardDescription>Book a facial or spa service</CardDescription>
                </CardHeader>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary transition-all hover:shadow-lg"
                onClick={() => handleProductTypeSelect('Product')}
                data-testid="card-product-product"
              >
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <CreditCard className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle>Product</CardTitle>
                  <CardDescription>Purchase skincare products</CardDescription>
                </CardHeader>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary transition-all hover:shadow-lg"
                onClick={() => handleProductTypeSelect('Gift Card')}
                data-testid="card-product-giftcard"
              >
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Gift className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle>Gift Card</CardTitle>
                  <CardDescription>Give the gift of glowing skin</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Step 2: Plan Selection
  if (bookingState.step === 'plan') {
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
              Back
            </Button>

            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Choose Your Plan</h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                {bookingState.productType} - Select member or non-member pricing
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card
                className="cursor-pointer hover:border-primary transition-all hover:shadow-lg"
                onClick={() => handlePlanSelect('member')}
                data-testid="card-plan-member"
              >
                <CardHeader>
                  <CardTitle className="text-2xl">Member</CardTitle>
                  <CardDescription className="text-lg mt-2">
                    Save with membership pricing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Discounted treatment prices
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Priority booking access
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Exclusive member perks
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary transition-all hover:shadow-lg"
                onClick={() => handlePlanSelect('non-member')}
                data-testid="card-plan-nonmember"
              >
                <CardHeader>
                  <CardTitle className="text-2xl">Non-Member</CardTitle>
                  <CardDescription className="text-lg mt-2">
                    Book without membership
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      No commitment required
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Standard pricing
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      Book anytime
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Step 3: Location Selection
  if (bookingState.step === 'location') {
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
              Back
            </Button>

            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Choose Your Location</h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                {bookingState.productType} - {bookingState.plan === 'member' ? 'Member' : 'Non-Member'}
              </p>
            </div>

            {locationsLoading ? (
              <div className="text-center py-12" data-testid="text-loading">Loading locations...</div>
            ) : createCartMutation.isPending ? (
              <div className="text-center py-12" data-testid="text-creating-cart">Creating your booking...</div>
            ) : (
              <div className="space-y-6">
                {Boolean(locationsData) && Object.entries(locationsData as Record<string, any>).map(([state, cities]) => (
                  <div key={state} className="space-y-4">
                    <h2 className="text-2xl font-semibold" data-testid={`text-state-${state}`}>{state}</h2>
                    {Object.entries(cities as Record<string, any>).map(([city, locations]) => (
                      <div key={city} className="space-y-2">
                        <h3 className="text-lg font-medium text-muted-foreground" data-testid={`text-city-${city}`}>{city}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {(locations as Location[]).map((location: Location) => (
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
                              </CardHeader>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Step 4: Service Selection
  if (bookingState.step === 'service') {
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
              Back
            </Button>

            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Choose Your Service</h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                {bookingState.locationName}
              </p>
            </div>

            {addServiceMutation.isPending ? (
              <div className="text-center py-12" data-testid="text-loading">Adding service...</div>
            ) : (
              <div className="space-y-6">
                {bookingState.categories && bookingState.categories.map((category: any, idx: number) => (
                  <div key={idx} className="space-y-4">
                    <h2 className="text-2xl font-semibold" data-testid={`text-category-${idx}`}>{category.name}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {category.availableItems?.map((item: any) => (
                        <Card
                          key={item.id}
                          className="cursor-pointer hover:border-primary transition-colors"
                          onClick={() => {
                            if (bookingState.cartId) {
                              addServiceMutation.mutate({
                                cartId: bookingState.cartId,
                                itemId: item.id,
                                itemName: item.name
                              });
                            }
                          }}
                          data-testid={`card-service-${item.id}`}
                        >
                          <CardHeader>
                            <CardTitle>{item.name}</CardTitle>
                            {item.listDuration && (
                              <CardDescription>{item.listDuration} minutes</CardDescription>
                            )}
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Check for no slots and redirect to waitlist
  const availableDates = bookingState.step === 'datetime' ? (datesData as any)?.dates || [] : [];
  const hasNoSlots = bookingState.step === 'datetime' && !datesLoading && availableDates.length === 0;
  
  if (hasNoSlots && bookingState.step === 'datetime') {
    return (
      <>
        <div className="h-[10px] bg-primary" />
        <div className="min-h-screen bg-background p-4">
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" data-testid="text-title">No Available Slots</h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                We're fully booked right now. Would you like to join our waitlist?
              </p>
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <Button 
                    onClick={() => setBookingState(prev => ({ ...prev, step: 'waitlist' }))}
                    data-testid="button-join-waitlist"
                  >
                    Join Waitlist
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleBack}
                    data-testid="button-back-no-slots"
                  >
                    Go Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  // Step 5: Date/Time Selection
  if (bookingState.step === 'datetime') {
    const availableTimes = (timesData as any)?.times || [];

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
              Back
            </Button>

            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Choose Date & Time</h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                {bookingState.serviceName} at {bookingState.locationName}
              </p>
            </div>

            {datesLoading ? (
              <div className="text-center py-12" data-testid="text-loading">Loading available dates...</div>
            ) : reserveSlotMutation.isPending ? (
              <div className="text-center py-12" data-testid="text-reserving">Reserving your time slot...</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Date Selection */}
                <div>
                  <h2 className="text-xl font-semibold mb-4" data-testid="text-date-header">Select a Date</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {availableDates.map((date: any) => (
                      <Button
                        key={date.date}
                        variant={bookingState.selectedDate === date.date ? "default" : "outline"}
                        className="h-auto py-3 flex flex-col items-start"
                        onClick={() => setBookingState(prev => ({ ...prev, selectedDate: date.date, selectedTime: undefined }))}
                        data-testid={`button-date-${date.date}`}
                      >
                        <span className="font-semibold">{new Date(date.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Time Selection */}
                <div>
                  <h2 className="text-xl font-semibold mb-4" data-testid="text-time-header">Select a Time</h2>
                  {!bookingState.selectedDate ? (
                    <p className="text-muted-foreground" data-testid="text-select-date">Please select a date first</p>
                  ) : timesLoading ? (
                    <div className="text-center py-4" data-testid="text-loading-times">Loading times...</div>
                  ) : availableTimes.length === 0 ? (
                    <p className="text-muted-foreground" data-testid="text-no-times">No available times for this date</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                      {availableTimes.map((time: any) => {
                        const timeDate = new Date(time.startTime);
                        const timeStr = timeDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                        return (
                          <Button
                            key={time.id}
                            variant={bookingState.selectedTime === time.id ? "default" : "outline"}
                            onClick={() => {
                              setBookingState(prev => ({ ...prev, selectedTime: time.id }));
                              if (bookingState.cartId) {
                                reserveSlotMutation.mutate({ cartId: bookingState.cartId, bookableTimeId: time.id });
                              }
                            }}
                            data-testid={`button-time-${time.id}`}
                          >
                            {timeStr}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Step 6: Waitlist Form
  if (bookingState.step === 'waitlist') {
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
              Back
            </Button>

            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Join Our Waitlist</h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                We're fully booked right now, but we'll notify you when slots open up
              </p>
            </div>

            {submitWaitlistMutation.isPending ? (
              <div className="text-center py-12" data-testid="text-submitting">Joining waitlist...</div>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    submitWaitlistMutation.mutate({
                      locationId: bookingState.locationId,
                      serviceId: bookingState.serviceId,
                      productType: bookingState.productType,
                      plan: bookingState.plan,
                      firstName: formData.get('firstName') as string,
                      lastName: formData.get('lastName') as string,
                      email: formData.get('email') as string,
                      phone: formData.get('phone') as string,
                      notes: formData.get('notes') as string
                    });
                  }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="waitlist-firstName" className="text-sm font-medium">First Name</label>
                        <Input 
                          id="waitlist-firstName" 
                          name="firstName" 
                          required 
                          data-testid="input-waitlist-first-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="waitlist-lastName" className="text-sm font-medium">Last Name</label>
                        <Input 
                          id="waitlist-lastName" 
                          name="lastName" 
                          required 
                          data-testid="input-waitlist-last-name"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="waitlist-email" className="text-sm font-medium">Email</label>
                      <Input 
                        id="waitlist-email" 
                        name="email" 
                        type="email" 
                        required 
                        data-testid="input-waitlist-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="waitlist-phone" className="text-sm font-medium">Phone Number</label>
                      <Input 
                        id="waitlist-phone" 
                        name="phone" 
                        type="tel" 
                        required 
                        placeholder="(555) 123-4567"
                        data-testid="input-waitlist-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="waitlist-notes" className="text-sm font-medium">Additional Notes (Optional)</label>
                      <textarea 
                        id="waitlist-notes" 
                        name="notes" 
                        className="w-full min-h-[100px] px-3 py-2 border border-input bg-background rounded-md"
                        placeholder="Any specific preferences or requests..."
                        data-testid="input-waitlist-notes"
                      />
                    </div>
                    <div className="flex gap-4">
                      <Button type="submit" className="flex-1" data-testid="button-submit-waitlist">
                        Join Waitlist
                      </Button>
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={() => setBookingState(initialBookingState)}
                        data-testid="button-cancel-waitlist"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </>
    );
  }

  // Step 7: Contact Information
  if (bookingState.step === 'contact') {
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
              Back
            </Button>

            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Contact Information</h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                We'll use this to confirm your appointment
              </p>
            </div>

            {updateContactMutation.isPending ? (
              <div className="text-center py-12" data-testid="text-updating">Updating contact information...</div>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    if (bookingState.cartId) {
                      updateContactMutation.mutate({
                        cartId: bookingState.cartId,
                        firstName: formData.get('firstName') as string,
                        lastName: formData.get('lastName') as string,
                        email: formData.get('email') as string,
                        phoneNumber: formData.get('phone') as string
                      });
                    }
                  }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="firstName" className="text-sm font-medium">First Name</label>
                        <Input 
                          id="firstName" 
                          name="firstName" 
                          required 
                          defaultValue={bookingState.firstName}
                          data-testid="input-first-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="lastName" className="text-sm font-medium">Last Name</label>
                        <Input 
                          id="lastName" 
                          name="lastName" 
                          required 
                          defaultValue={bookingState.lastName}
                          data-testid="input-last-name"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">Email</label>
                      <Input 
                        id="email" 
                        name="email" 
                        type="email" 
                        required 
                        defaultValue={bookingState.email}
                        data-testid="input-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="phone" className="text-sm font-medium">Phone Number</label>
                      <Input 
                        id="phone" 
                        name="phone" 
                        type="tel" 
                        required 
                        defaultValue={bookingState.phone}
                        placeholder="(555) 123-4567"
                        data-testid="input-phone"
                      />
                    </div>
                    <Button type="submit" className="w-full" data-testid="button-submit-contact">
                      Continue to Payment
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </>
    );
  }

  // Step 8: Payment
  if (bookingState.step === 'payment') {
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
              Back
            </Button>

            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Payment</h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                Complete your booking
              </p>
            </div>

            {checkoutMutation.isPending ? (
              <div className="text-center py-12" data-testid="text-processing">Processing payment...</div>
            ) : (
              <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-semibold">Booking Summary</h3>
                    <div className="text-sm space-y-1">
                      <p data-testid="text-summary-service">{bookingState.serviceName}</p>
                      <p data-testid="text-summary-location">{bookingState.locationName}</p>
                      <p data-testid="text-summary-datetime">
                        {bookingState.selectedDate && new Date(bookingState.selectedDate).toLocaleDateString('en-US', { 
                          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
                        })}
                      </p>
                      <p data-testid="text-summary-contact">{bookingState.email}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-4">
                      Payment will be processed through Boulevard's secure checkout
                    </p>
                    <Button 
                      onClick={() => {
                        if (bookingState.cartId) {
                          checkoutMutation.mutate(bookingState.cartId);
                        }
                      }}
                      className="w-full" 
                      data-testid="button-complete-booking"
                    >
                      Complete Booking
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </>
    );
  }

  // Step 9: Confirmation
  if (bookingState.step === 'confirmation') {
    return (
      <>
        <div className="h-[10px] bg-primary" />
        <div className="min-h-screen bg-background p-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-8 pt-12">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold mb-2" data-testid="text-title">Booking Confirmed!</h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                We've sent a confirmation email to {bookingState.email}
              </p>
            </div>

            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2 text-left">
                  <h3 className="font-semibold">Appointment Details</h3>
                  <div className="text-sm space-y-1">
                    <p data-testid="text-confirmed-service"><strong>Service:</strong> {bookingState.serviceName}</p>
                    <p data-testid="text-confirmed-location"><strong>Location:</strong> {bookingState.locationName}</p>
                    <p data-testid="text-confirmed-datetime">
                      <strong>Date & Time:</strong> {bookingState.selectedDate && new Date(bookingState.selectedDate).toLocaleDateString('en-US', { 
                        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
                      })}
                    </p>
                    <p data-testid="text-confirmed-contact"><strong>Contact:</strong> {bookingState.firstName} {bookingState.lastName}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => setBookingState(initialBookingState)}
                  className="w-full" 
                  data-testid="button-book-another"
                >
                  Book Another Appointment
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  // Fallback
  return null;
}
