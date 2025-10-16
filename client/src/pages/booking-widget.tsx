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

  const handleBack = () => {
    const stepOrder: BookingStep[] = [
      'product-type', 'plan', 'location', 'service', 'datetime', 
      'waitlist', 'contact', 'payment', 'confirmation'
    ];
    const currentIndex = stepOrder.indexOf(bookingState.step);
    if (currentIndex > 0) {
      setBookingState(prev => ({ ...prev, step: stepOrder[currentIndex - 1] }));
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

  // Placeholder for remaining steps (datetime, waitlist, contact, payment, confirmation)
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
            <h1 className="text-3xl font-bold mb-2" data-testid="text-title">
              Step: {bookingState.step}
            </h1>
            <p className="text-muted-foreground">This step is under development</p>
            <p className="text-sm text-muted-foreground mt-4">
              Product: {bookingState.productType} | Plan: {bookingState.plan} | Service: {bookingState.serviceName}
            </p>
          </div>

          <Card>
            <CardContent className="p-8">
              <p className="text-muted-foreground">
                Use the Continue button below to proceed to the next step
              </p>
              <Button 
                className="mt-4" 
                onClick={() => {
                  const nextSteps: Record<BookingStep, BookingStep> = {
                    'product-type': 'plan',
                    'plan': 'location',
                    'location': 'service',
                    'service': 'datetime',
                    'datetime': 'contact',
                    'waitlist': 'contact',
                    'contact': 'payment',
                    'payment': 'confirmation',
                    'confirmation': 'product-type'
                  };
                  setBookingState(prev => ({ ...prev, step: nextSteps[prev.step] }));
                }}
                data-testid="button-continue"
              >
                Continue (Development)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
