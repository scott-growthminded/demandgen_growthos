import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronDown, ChevronUp, CheckCircle, User, MapPin } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, addDays } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import glowbarLogoPath from "@assets/image_1763999100752.png";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create custom black marker icon (Peachy style)
const blackIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path fill="#000000" stroke="#fff" stroke-width="1.5" d="M12 0C7.03 0 3 4.03 3 9c0 7.5 9 18 9 18s9-10.5 9-18c0-4.97-4.03-9-9-9z"/>
      <circle cx="12" cy="9" r="3" fill="#fff"/>
    </svg>
  `),
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -42],
});

type BookingStep = 
  | 'phone-verification'
  | 'otp'
  | 'customer-type'
  | 'login'
  | 'product'
  | 'location'
  | 'datetime'
  | 'personal-info'
  | 'checkout'
  | 'confirmation';

type UserFlow = 'lead' | 'non-member' | 'member';

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
  userFlow?: UserFlow;
  customerType?: 'new' | 'returning';
  isMember?: boolean;
  selectedRegion?: string;
  selectedLocation?: {
    id: string;
    name: string;
    address?: string;
    city: string;
    state: string;
  };
  selectedProduct?: {
    id: string;
    name: string;
    price: number;
    description: string;
  };
  userName?: string;
  userFirstName?: string;
  userLastName?: string;
  userEmail?: string;
  userPhone?: string;
  questionnaireComplete?: boolean;
  selectedDate?: Date;
  selectedTime?: any; // Store full Boulevard slot object
  selectedEsthetician?: string;
}

interface AvailabilityResponse {
  success: boolean;
  availableSlots: Array<any>; // Full Boulevard slot objects with all fields
  totalSlots: number;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatar?: string;
}

interface StaffResponse {
  success: boolean;
  staff: StaffMember[];
}

export default function BookingWidget() {
  const { toast } = useToast();
  const [bookingState, setBookingState] = useState<BookingState>({
    step: 'location',
  });
  const [expandedState, setExpandedState] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  
  // Questionnaire state
  const [accutane, setAccutane] = useState(false);
  const [injections, setInjections] = useState(false);
  const [waxing, setWaxing] = useState(false);
  
  // Confirmation dialog state (for product selection)
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<any>(null);
  const [confirmAccutane, setConfirmAccutane] = useState(false);
  const [confirmInjections, setConfirmInjections] = useState(false);
  const [confirmWaxing, setConfirmWaxing] = useState(false);
  
  // Date/Time state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<any>(undefined); // Store full Boulevard slot object
  const [esthetician, setEsthetician] = useState('any');
  const [expandedNearbyLocations, setExpandedNearbyLocations] = useState<Set<string>>(new Set());
  const [selectedNearbyLocation, setSelectedNearbyLocation] = useState<{locationId: string; locationName: string; time: string} | null>(null);
  
  // Checkout state
  const [promoCode, setPromoCode] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  
  // Membership purchase state
  const [membershipInCart, setMembershipInCart] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  
  // Auth/Sign-up state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [emailOptIn, setEmailOptIn] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Phone verification state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Fetch locations
  const { data: locationsData, isLoading: locationsLoading } = useQuery({
    queryKey: ['/api/booking/locations'],
  });

  // Fetch availability when a location and date are selected
  const { data: availabilityData, isLoading: availabilityLoading } = useQuery<AvailabilityResponse>({
    queryKey: ['/api/booking/availability', bookingState.selectedLocation?.id, selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''],
    enabled: !!bookingState.selectedLocation?.id && !!selectedDate,
  });

  // Fetch staff for the selected location
  const { data: staffData, isLoading: staffLoading } = useQuery<StaffResponse>({
    queryKey: ['/api/booking/staff', bookingState.selectedLocation?.id],
    enabled: !!bookingState.selectedLocation?.id,
  });

  // Get nearby locations (top 3 that are not the current location)
  const getNearbyLocations = () => {
    if (!locationsData) return [];
    
    const allLocations: Location[] = [];
    Object.entries(locationsData as Record<string, any>).forEach(([state, cities]) => {
      Object.entries(cities as Record<string, any>).forEach(([city, locations]) => {
        allLocations.push(...(locations as Location[]));
      });
    });
    
    // Filter out current location and return first 3
    return allLocations
      .filter(loc => loc.id !== bookingState.selectedLocation?.id)
      .slice(0, 3);
  };
  
  const nearbyLocations = getNearbyLocations();
  
  // Fetch availability for each nearby location (always call these hooks)
  const nearbyAvailability1 = useQuery<AvailabilityResponse>({
    queryKey: ['/api/booking/availability', nearbyLocations[0]?.id, selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''],
    enabled: !!nearbyLocations[0]?.id && !!selectedDate && bookingState.step === 'datetime',
  });
  
  const nearbyAvailability2 = useQuery<AvailabilityResponse>({
    queryKey: ['/api/booking/availability', nearbyLocations[1]?.id, selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''],
    enabled: !!nearbyLocations[1]?.id && !!selectedDate && bookingState.step === 'datetime',
  });
  
  const nearbyAvailability3 = useQuery<AvailabilityResponse>({
    queryKey: ['/api/booking/availability', nearbyLocations[2]?.id, selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''],
    enabled: !!nearbyLocations[2]?.id && !!selectedDate && bookingState.step === 'datetime',
  });
  
  const nearbyAvailabilityData = [nearbyAvailability1, nearbyAvailability2, nearbyAvailability3];

  // Helper to format time slots for nearby locations
  const formatNearbyTimeSlots = (availData: AvailabilityResponse | undefined) => {
    if (!availData?.success || !availData.availableSlots) return [];
    
    const now = new Date();
    const isToday = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
    
    return availData.availableSlots
      .map((slot) => {
        const match = slot.startTime.match(/T(\d{2}):(\d{2}):/);
        if (!match) return null;
        
        const hour = parseInt(match[1]);
        const minute = parseInt(match[2]);
        const timeValue = `${hour}:${minute.toString().padStart(2, '0')}`;
        
        let isPast = false;
        if (isToday) {
          const slotTime = new Date();
          slotTime.setHours(hour, minute, 0, 0);
          isPast = slotTime < now;
        }
        
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        
        return {
          value: timeValue,
          display: `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`,
          available: !isPast
        };
      })
      .filter((slot): slot is { value: string; display: string; available: boolean } => slot !== null && slot.available);
  };

  // Auto-select date when entering datetime step
  useEffect(() => {
    if (bookingState.step === 'datetime' && !selectedDate) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Set today as default initially
      setSelectedDate(today);
    }
  }, [bookingState.step, selectedDate]);

  // Auto-switch to tomorrow if today has no available future slots
  useEffect(() => {
    if (bookingState.step === 'datetime' && selectedDate && !availabilityLoading && availabilityData) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const isToday = format(selectedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      
      if (isToday && availabilityData.success) {
        // Check if any slots are in the future
        const hasFutureSlots = availabilityData.availableSlots.some(slot => {
          const match = slot.startTime.match(/T(\d{2}):(\d{2}):/);
          if (!match) return false;
          
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          const slotTime = new Date();
          slotTime.setHours(hour, minute, 0, 0);
          
          return slotTime > now;
        });
        
        // If no future slots today, switch to tomorrow
        if (!hasFutureSlots) {
          setSelectedDate(addDays(today, 1));
        }
      }
    }
  }, [bookingState.step, selectedDate, availabilityData, availabilityLoading]);

  // Progress Bar Component
  const ProgressBar = () => (
    <div className="border-b border-gray-200 bg-gray-50">
      <div className="px-6 py-3">
        <div className="flex items-center justify-center gap-8 text-sm font-medium text-gray-600 mb-3">
          <span>LOCATION</span>
          <span className="text-gray-300">•</span>
          <span>WHO'S COMING</span>
          <span className="text-gray-300">•</span>
          <span>SERVICES</span>
          <span className="text-gray-300">•</span>
          <span>SCHEDULING</span>
          <span className="text-gray-300">•</span>
          <span>CHECKOUT</span>
        </div>
        <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden">
          <div 
            className="bg-orange-500 h-full rounded-full transition-all duration-300"
            style={{ 
              width: bookingState.step === 'location' ? '0%' 
                   : bookingState.step === 'phone-verification' || bookingState.step === 'otp' || bookingState.step === 'customer-type' || bookingState.step === 'login' ? '20%'
                   : bookingState.step === 'product' ? '40%'
                   : bookingState.step === 'datetime' || bookingState.step === 'personal-info' ? '60%'
                   : bookingState.step === 'checkout' ? '80%'
                   : bookingState.step === 'confirmation' ? '100%'
                   : '0%'
            }}
            data-testid="progress-bar"
          />
        </div>
      </div>
    </div>
  );

  const handleBack = () => {
    // Handle back navigation based on current step and booking state
    switch (bookingState.step) {
      case 'phone-verification':
        setBookingState(prev => ({ ...prev, step: 'location' }));
        break;
      case 'otp':
        setBookingState(prev => ({ ...prev, step: 'phone-verification' }));
        break;
      case 'customer-type':
        setBookingState(prev => ({ ...prev, step: 'location' }));
        break;
      case 'login':
        setBookingState(prev => ({ ...prev, step: 'customer-type' }));
        break;
      case 'product':
        // Route back based on user flow
        if (bookingState.userFlow === 'lead') {
          setBookingState(prev => ({ ...prev, step: 'phone-verification' }));
        } else if (bookingState.userFlow === 'non-member' || bookingState.userFlow === 'member') {
          setBookingState(prev => ({ ...prev, step: 'otp' }));
        } else if (bookingState.customerType === 'new') {
          setBookingState(prev => ({ ...prev, step: 'customer-type' }));
        } else {
          setBookingState(prev => ({ ...prev, step: 'login' }));
        }
        break;
      case 'datetime':
        setBookingState(prev => ({ ...prev, step: 'product' }));
        break;
      case 'personal-info':
        setBookingState(prev => ({ ...prev, step: 'datetime' }));
        break;
      case 'checkout':
        if (bookingState.customerType === 'new') {
          setBookingState(prev => ({ ...prev, step: 'personal-info' }));
        } else {
          setBookingState(prev => ({ ...prev, step: 'datetime' }));
        }
        break;
      case 'confirmation':
        setBookingState(prev => ({ ...prev, step: 'location' }));
        break;
      default:
        break;
    }
  };

  // Group locations by state (needs to be at component level)
  const groupedLocations: Record<string, any[]> = {};
  if (locationsData) {
    Object.entries(locationsData as Record<string, any>).forEach(([state, cities]) => {
      if (!groupedLocations[state]) {
        groupedLocations[state] = [];
      }
      Object.entries(cities as Record<string, any>).forEach(([city, locations]) => {
        groupedLocations[state].push(...(locations as any[]));
      });
    });
  }

  // Zoom to expanded state's locations - useEffect at component level
  useEffect(() => {
    if (bookingState.step === 'location' && expandedState && mapRef.current) {
      const stateLocations = groupedLocations[expandedState] || [];
      if (stateLocations.length > 0) {
        const coordinates = stateLocations
          .map((loc: any) => [
            loc.coordinates?.lat || loc.coordinates?.latitude,
            loc.coordinates?.lng || loc.coordinates?.longitude
          ])
          .filter((coord: any) => coord[0] && coord[1]);

        if (coordinates.length > 0) {
          const bounds = L.latLngBounds(coordinates as any);
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    }
  }, [expandedState, bookingState.step, groupedLocations]);

  // Step 1: Location Selection (NEW FIRST STEP)
  if (bookingState.step === 'location') {

    // Get all locations for the map
    const allLocations: any[] = [];
    if (locationsData) {
      Object.entries(locationsData as Record<string, any>).forEach(([state, cities]) => {
        Object.entries(cities as Record<string, any>).forEach(([city, locations]) => {
          allLocations.push(...(locations as any[]));
        });
      });
    }

    const stateOrder = ['NJ', 'NY', 'CT', 'PA', 'MA', 'DC', 'VA'];
    const stateNames: Record<string, string> = {
      'NJ': 'New Jersey',
      'NY': 'New York',
      'CT': 'Connecticut',
      'PA': 'Pennsylvania',
      'MA': 'Massachusetts',
      'DC': 'District Of Columbia',
      'VA': 'Virginia'
    };

    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <img src={glowbarLogoPath} alt="Glowbar" className="h-8" data-testid="img-logo" />
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />

        {/* Main Content */}
        <div className="flex-1 flex gap-8 px-6 py-8 max-h-[calc(100vh-180px)]">
          {/* Left side - Grouped locations with dropdowns - SCROLLABLE */}
          <div className="w-1/2 overflow-y-auto space-y-2 pr-4">
            {stateOrder.map((stateCode) => {
              const locations = groupedLocations[stateCode] || [];
              if (locations.length === 0) return null;
              
              const isExpanded = expandedState === stateCode;
              
              return (
                <div key={stateCode} className="border-b border-gray-200">
                  <button
                    onClick={() => setExpandedState(isExpanded ? null : stateCode)}
                    className="w-full py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                    data-testid={`button-state-${stateCode}`}
                  >
                    <span className="text-lg font-medium">{stateNames[stateCode]}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="pb-4 space-y-3 ml-4">
                      {locations.map((location: any) => (
                        <Card key={location.id} className="overflow-hidden">
                          <CardContent className="p-4">
                            <h3 className="font-semibold mb-1">{location.name}</h3>
                            <p className="text-sm text-gray-600 mb-3">
                              {location.address?.line1}, {location.address?.city}, {location.address?.state}
                            </p>
                            <Button
                              onClick={() => {
                                setSelectedDate(undefined);
                                setSelectedTimeSlot(undefined);
                                setBookingState(prev => ({
                                  ...prev,
                                  selectedLocation: {
                                    id: location.id,
                                    name: location.name,
                                    address: location.address?.line1 
                                      ? `${location.address.line1}, ${location.address?.city}, ${location.address?.state}`
                                      : `${location.address?.city}, ${location.address?.state}`,
                                    city: location.address?.city || '',
                                    state: location.address?.state || '',
                                  },
                                  selectedDate: undefined,
                                  selectedTime: undefined,
                                  selectedProduct: undefined,
                                  step: 'phone-verification'
                                }));
                              }}
                              className="w-full bg-black text-white hover:bg-gray-800"
                              data-testid={`button-select-studio-${location.id}`}
                            >
                              SELECT STUDIO
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right side - Map - FIXED */}
          <div className="w-1/2 sticky top-8 self-start">
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 shadow-lg">
              {allLocations.length > 0 && allLocations[0].coordinates ? (
                <MapContainer
                  ref={mapRef}
                  key="location-map"
                  center={[
                    allLocations.reduce((sum: number, loc: any) => sum + ((loc.coordinates?.lat || loc.coordinates?.latitude) || 0), 0) / allLocations.length,
                    allLocations.reduce((sum: number, loc: any) => sum + ((loc.coordinates?.lng || loc.coordinates?.longitude) || 0), 0) / allLocations.length
                  ]}
                  zoom={7}
                  style={{ height: '100%', width: '100%', filter: 'grayscale(100%)' }}
                  scrollWheelZoom={true}
                >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {allLocations.map((location: any, index: number) => {
                  const lat = location.coordinates?.lat || location.coordinates?.latitude;
                  const lng = location.coordinates?.lng || location.coordinates?.longitude;
                  
                  if (lat && lng) {
                    return (
                      <Marker
                        key={location.id || index}
                        position={[lat, lng]}
                        icon={blackIcon}
                      >
                        <Popup closeButton={true} className="custom-popup">
                          <div style={{ padding: '8px 4px', minWidth: '200px' }}>
                            <h3 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
                              {location.name}
                            </h3>
                            <p style={{ margin: '0 0 4px 0', color: '#333', fontSize: '14px' }}>
                              {location.address?.line1}
                            </p>
                            <p style={{ margin: '0 0 20px 0', color: '#333', fontSize: '14px' }}>
                              {location.address?.city}, {location.address?.state} {location.address?.zip || ''}
                            </p>
                            <button
                              onClick={() => {
                                setSelectedDate(undefined);
                                setSelectedTimeSlot(undefined);
                                setBookingState(prev => ({
                                  ...prev,
                                  selectedLocation: {
                                    id: location.id,
                                    name: location.name,
                                    address: location.address?.line1 
                                      ? `${location.address.line1}, ${location.address?.city}, ${location.address?.state}`
                                      : `${location.address?.city}, ${location.address?.state}`,
                                    city: location.address?.city || '',
                                    state: location.address?.state || '',
                                  },
                                  selectedDate: undefined,
                                  selectedTime: undefined,
                                  selectedProduct: undefined,
                                  step: 'phone-verification'
                                }));
                              }}
                              style={{
                                width: '100%',
                                padding: '14px',
                                backgroundColor: '#000',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#333'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#000'}
                              data-testid={`button-select-studio-popup-${location.id}`}
                            >
                              SELECT STUDIO
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  }
                  return null;
                })}
                </MapContainer>
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <p className="text-lg font-semibold mb-2">📍 Loading locations...</p>
                    <p className="text-sm">Glowbar Studios</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Phone Verification
  if (bookingState.step === 'phone-verification') {
    const handlePhoneSubmit = () => {
      // Remove all non-digit characters
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Determine flow based on phone number pattern
      if (/^1+$/.test(cleanPhone)) {
        // All 1's - Lead flow
        setBookingState(prev => ({
          ...prev,
          userFlow: 'lead',
          userPhone: phoneNumber,
          customerType: 'new',
          isMember: false,
          step: 'product'
        }));
      } else if (/^2+$/.test(cleanPhone)) {
        // All 2's - Non-member flow
        setBookingState(prev => ({
          ...prev,
          userFlow: 'non-member',
          userPhone: phoneNumber,
          customerType: 'returning',
          isMember: false,
          step: 'otp'
        }));
      } else if (/^3+$/.test(cleanPhone)) {
        // All 3's - Member flow
        setBookingState(prev => ({
          ...prev,
          userFlow: 'member',
          userPhone: phoneNumber,
          customerType: 'returning',
          isMember: true,
          step: 'otp'
        }));
      } else {
        toast({
          title: "Invalid Phone Number",
          description: "Please enter a valid phone number (all 1's, all 2's, or all 3's for testing)",
          variant: "destructive"
        });
      }
    };

    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <img src={glowbarLogoPath} alt="Glowbar" className="h-8" data-testid="img-logo" />
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md px-6 py-8">
            <button
              onClick={handleBack}
              className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back
            </button>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Enter Your Phone Number</CardTitle>
                <CardDescription>
                  We'll use this to verify your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 555-5555"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    data-testid="input-phone"
                  />
                  <p className="text-sm text-gray-500">
                    For testing: Use all 1's for new customers, all 2's for returning non-members, or all 3's for members
                  </p>
                </div>

                <Button
                  onClick={handlePhoneSubmit}
                  className="w-full bg-black text-white hover:bg-gray-800"
                  disabled={!phoneNumber}
                  data-testid="button-submit-phone"
                >
                  Continue
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: OTP Verification
  if (bookingState.step === 'otp') {
    const handleOtpSubmit = () => {
      // Accept any OTP code
      if (otpCode.length >= 4) {
        setBookingState(prev => ({
          ...prev,
          step: 'product'
        }));
      } else {
        toast({
          title: "Invalid OTP",
          description: "Please enter a valid OTP code",
          variant: "destructive"
        });
      }
    };

    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <img src={glowbarLogoPath} alt="Glowbar" className="h-8" data-testid="img-logo" />
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md px-6 py-8">
            <button
              onClick={handleBack}
              className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back
            </button>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Verify Your Phone Number</CardTitle>
                <CardDescription>
                  We've sent a code to {bookingState.userPhone}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Enter OTP Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={6}
                    data-testid="input-otp"
                  />
                  <p className="text-sm text-gray-500">
                    For testing: Any code with 4 or more characters will be accepted
                  </p>
                </div>

                <Button
                  onClick={handleOtpSubmit}
                  className="w-full bg-black text-white hover:bg-gray-800"
                  disabled={!otpCode}
                  data-testid="button-submit-otp"
                >
                  Verify & Continue
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Customer Type Selection
  if (bookingState.step === 'customer-type') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <img src={glowbarLogoPath} alt="Glowbar" className="h-8" data-testid="img-logo" />
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 gap-12">
          <div className="flex flex-col justify-center">
            <h1 className="text-5xl font-bold mb-4" data-testid="text-title">How can we help?</h1>
            
            <div className="space-y-4 mt-8">
              <button
                onClick={() => setBookingState(prev => ({ ...prev, customerType: 'new', isMember: false, step: 'product' }))}
                className="w-full p-6 border-2 rounded-lg hover:border-gray-400 transition-colors text-left group"
                data-testid="button-new-customer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">I'm new to Glowbar</h3>
                    <p className="text-gray-600 text-sm">Schedule your first facial</p>
                  </div>
                  <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </button>

              <button
                onClick={() => setBookingState(prev => ({ ...prev, customerType: 'returning', step: 'login' }))}
                className="w-full p-6 border-2 rounded-lg hover:border-gray-400 transition-colors text-left group"
                data-testid="button-returning-customer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">I already have a Glowbar Account</h3>
                    <p className="text-gray-600 text-sm">Log in to book</p>
                  </div>
                  <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </button>
            </div>
          </div>

            <div className="relative rounded-lg overflow-hidden bg-gray-100 h-[600px]">
              <img 
                src="https://glowbar.com/cdn/shop/files/glowbar_estheticians_certified_985ba0ae-536e-48ac-832d-d86b6a70c1c6.jpg?v=1675461347&width=1500" 
                alt="Glowbar certified estheticians"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Login (for returning users)
  if (bookingState.step === 'login') {
    const handleLogin = () => {
      // Mock login - set member status based on email for demo
      const isMember = loginEmail.includes('member');
      setBookingState(prev => ({ 
        ...prev, 
        isMember,
        userEmail: loginEmail,
        step: 'product'
      }));
    };

    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <img src={glowbarLogoPath} alt="Glowbar" className="h-8" data-testid="img-logo" />
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-lg mx-auto px-6 py-8">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="mb-6"
              data-testid="button-back"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <h1 className="text-4xl font-bold mb-8" data-testid="text-title">Log in</h1>
          
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-base mb-2 block">Email</Label>
              <Input
                id="email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="h-12"
                placeholder="your@email.com"
                data-testid="input-email"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-base mb-2 block">Password</Label>
              <Input
                id="password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="h-12"
                placeholder="••••••••"
                data-testid="input-password"
              />
            </div>

            <Button
              onClick={handleLogin}
              className="w-full h-12 mt-6"
              disabled={!loginEmail || !loginPassword}
              data-testid="button-login"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
    );
  }

  // Step 3: Product Selection (replaces old 'service' step)  
  if (bookingState.step === 'product') {
    const handleProductSelect = (product: any) => {
      setPendingProduct(product);
      setConfirmAccutane(false);
      setConfirmInjections(false);
      setConfirmWaxing(false);
      setIsConfirmationDialogOpen(true);
    };

    const handleConfirmationContinue = () => {
      if (confirmAccutane && confirmInjections && confirmWaxing && pendingProduct) {
        setSelectedDate(undefined);
        setSelectedTimeSlot(undefined);
        setBookingState(prev => ({ 
          ...prev, 
          selectedProduct: pendingProduct,
          selectedDate: undefined,
          selectedTime: undefined,
          step: 'datetime' 
        }));
        setIsConfirmationDialogOpen(false);
        setPendingProduct(null);
      }
    };

    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <img src={glowbarLogoPath} alt="Glowbar" className="h-8" data-testid="img-logo" />
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        <div className="flex-1 overflow-y-auto">
          <div className="w-full max-w-4xl mx-auto px-6 py-8">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="mb-6"
              data-testid="button-back"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {/* Selected Studio Display */}
            {bookingState.selectedLocation && (
              <div className="mb-6 flex items-center gap-2 text-gray-700">
                <MapPin className="w-5 h-5" />
                <span className="font-medium">{bookingState.selectedLocation.name}</span>
                <span className="text-gray-500">•</span>
                <span className="text-sm">{bookingState.selectedLocation.city}, {bookingState.selectedLocation.state}</span>
              </div>
            )}

            <h1 className="text-4xl font-bold mb-8" data-testid="text-title">Select A Service</h1>
            
            <Accordion type="single" collapsible className="space-y-4">
              {/* Book a Treatment */}
              <AccordionItem value="treatment" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50" data-testid="accordion-treatment">
                  <span className="text-xl font-semibold">Book a Treatment</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="space-y-4">
                    {/* First Time Treatment */}
                    <Card className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">(Non-Member) First Time Treatment <span className="text-gray-600">30min</span></h3>
                            <p className="text-sm text-gray-700 mb-3">
                              If you're a new client and haven't purchased a membership, book this treatment.<br />
                              Please note, your card will *not* be charged now; it will be charged after your first appointment.
                            </p>
                            <p className="text-2xl font-bold mb-1">$80.00</p>
                            <p className="text-sm text-orange-600">Black Friday Members pay $60 - become a member and save $20/month</p>
                          </div>
                          <Button
                            onClick={() => handleProductSelect({ id: 'first-time-treatment', name: '(Non-Member) First Time Treatment', price: 80, description: '30min facial' })}
                            className="ml-4 bg-black text-white hover:bg-gray-800"
                            data-testid="button-select-first-time"
                          >
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* First Time Treatment Under 17 */}
                    <Card className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">(Non-Member) First Time Treatment: 17 and under <span className="text-gray-600">30min</span></h3>
                            <p className="text-sm text-gray-700 mb-3">
                              All clients under 17 will need to be accompanied by a parent or guardian at their first appointment to sign a waiver in-person.<br />
                              Please note, your card will *not* be charged now; it will be charged after your first appointment.
                            </p>
                            <p className="text-2xl font-bold mb-1">$80.00</p>
                            <p className="text-sm text-orange-600">Black Friday Members pay $60 - become a member and save $20/month</p>
                          </div>
                          <Button
                            onClick={() => handleProductSelect({ id: 'first-time-treatment-17', name: '(Non-Member) First Time Treatment: 17 and under', price: 80, description: '30min facial' })}
                            className="ml-4 bg-black text-white hover:bg-gray-800"
                            data-testid="button-select-first-time-17"
                          >
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Buy a Membership */}
              <AccordionItem value="membership" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50" data-testid="accordion-membership">
                  <span className="text-xl font-semibold">Buy a Membership</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="space-y-4">
                    {/* Black Friday Membership $60 */}
                    <Card className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">2025 Black Friday Membership Deal ($60)</h3>
                            <p className="text-sm text-gray-700 mb-3">You'll receive the following:</p>
                            <ul className="text-sm text-gray-700 space-y-1 mb-3 list-disc list-inside">
                              <li>1 facial vouchers per month redeemable at any Glowbar studio for 3 months</li>
                              <li>15% off retail products (25% off products in-studio for all of November)</li>
                              <li>Additional facials priced at your membership rate</li>
                              <li>1 free guest pass per year</li>
                              <li>Access to our loyalty program</li>
                              <li>6 month minimum commitment</li>
                            </ul>
                            <p className="text-2xl font-bold">$60.00</p>
                          </div>
                          <Button
                            onClick={() => handleProductSelect({ id: 'membership-60', name: '2025 Black Friday Membership Deal', price: 60, description: 'Monthly membership' })}
                            className="ml-4 bg-black text-white hover:bg-gray-800"
                            data-testid="button-select-membership-60"
                          >
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Black Friday Membership $110 */}
                    <Card className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">Black Friday Glowbar Membership+ ($110)</h3>
                            <p className="text-sm text-gray-700 mb-3">You'll receive the following:</p>
                            <ul className="text-sm text-gray-700 space-y-1 mb-3 list-disc list-inside">
                              <li>2 facial vouchers per month redeemable at any Glowbar studio for 3 months</li>
                              <li>15% off retail products (25% off products in-studio for all of November)</li>
                              <li>1 free guest pass per year</li>
                              <li>Access to our loyalty program</li>
                              <li>6 month minimum commitment</li>
                            </ul>
                            <p className="text-2xl font-bold">$110.00</p>
                          </div>
                          <Button
                            onClick={() => handleProductSelect({ id: 'membership-110', name: 'Black Friday Glowbar Membership+', price: 110, description: 'Monthly membership' })}
                            className="ml-4 bg-black text-white hover:bg-gray-800"
                            data-testid="button-select-membership-110"
                          >
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Purchase a Package */}
              <AccordionItem value="package" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50" data-testid="accordion-package">
                  <span className="text-xl font-semibold">Purchase a Package</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="space-y-4">
                    {/* 3 Facials */}
                    <Card className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">1. Three (3) Facials</h3>
                            <p className="text-sm text-gray-700 mb-3">
                              Ready for consistent facials without the membership commitment? Purchase a 3-pack and save 5% off the price of the non-member facial: $76 per facial vs. $80 per facial.
                              <br /><br />
                              All 3 vouchers will be available immediately, expire after 6 months, and can be used whenever you need a pro touch.
                              <br /><br />
                              Packages are non-transferrable.
                            </p>
                            <p className="text-2xl font-bold">$228.00</p>
                          </div>
                          <Button
                            onClick={() => handleProductSelect({ id: 'package-3', name: 'Three (3) Facials Package', price: 228, description: '3 facial package' })}
                            className="ml-4 bg-black text-white hover:bg-gray-800"
                            data-testid="button-select-package-3"
                          >
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* 6 Facials */}
                    <Card className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">2. Six (6) Facials</h3>
                            <p className="text-sm text-gray-700 mb-3">
                              Ready for consistent facials without the membership commitment? Purchase a 6-pack and save 10% off the price of the non-member facial: $72 per facial vs. $80 per facial.
                              <br /><br />
                              All 6 vouchers will be available immediately, expire after 9 months, and can be used whenever you need a pro touch.
                              <br /><br />
                              Packages are non-transferrable.
                            </p>
                            <p className="text-2xl font-bold">$432.00</p>
                          </div>
                          <Button
                            onClick={() => handleProductSelect({ id: 'package-6', name: 'Six (6) Facials Package', price: 432, description: '6 facial package' })}
                            className="ml-4 bg-black text-white hover:bg-gray-800"
                            data-testid="button-select-package-6"
                          >
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* 9 Facials */}
                    <Card className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">3. Nine (9) Facials</h3>
                            <p className="text-sm text-gray-700 mb-3">
                              Ready for consistent facials without the membership commitment? Purchase a 9-pack and save 15% off the price of the non-member facial: $68 per facial vs. $80 per facial.
                              <br /><br />
                              All 9 vouchers will be available immediately, expire after 12 months, and can be used whenever you need a pro touch.
                              <br /><br />
                              Packages are non-transferrable.
                            </p>
                            <p className="text-2xl font-bold">$612.00</p>
                          </div>
                          <Button
                            onClick={() => handleProductSelect({ id: 'package-9', name: 'Nine (9) Facials Package', price: 612, description: '9 facial package' })}
                            className="ml-4 bg-black text-white hover:bg-gray-800"
                            data-testid="button-select-package-9"
                          >
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* 12 Facials */}
                    <Card className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2">4. Twelve (12) Facials</h3>
                            <p className="text-sm text-gray-700 mb-3">
                              Ready for consistent facials without the membership commitment? Purchase a 12-pack and save 20% off the price of the non-member facial: $65 per facial vs. $80 per facial.
                              <br /><br />
                              All 12 vouchers will be available immediately, expire after 15 months, and can be used whenever you need a pro touch.
                              <br /><br />
                              Packages are non-transferrable.
                            </p>
                            <p className="text-2xl font-bold">$780.00</p>
                          </div>
                          <Button
                            onClick={() => handleProductSelect({ id: 'package-12', name: 'Twelve (12) Facials Package', price: 780, description: '12 facial package' })}
                            className="ml-4 bg-black text-white hover:bg-gray-800"
                            data-testid="button-select-package-12"
                          >
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Purchase a Gift Card */}
              <AccordionItem value="giftcard" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50" data-testid="accordion-giftcard">
                  <span className="text-xl font-semibold">Purchase a Gift Card</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="space-y-3">
                    {[80, 100, 150, 200, 250].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleProductSelect({ id: `giftcard-${amount}`, name: `Gift Card $${amount}`, price: amount, description: 'Gift card' })}
                        className="w-full p-4 border rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                        data-testid={`button-giftcard-${amount}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                          <span className="text-lg">${amount}.00</span>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => handleProductSelect({ id: 'giftcard-custom', name: 'Custom Gift Card', price: 100, description: 'Custom amount gift card' })}
                      className="w-full p-4 border rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                      data-testid="button-giftcard-custom"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                        <span className="text-lg">Custom</span>
                      </div>
                    </button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* Confirmation Dialog */}
        <Dialog open={isConfirmationDialogOpen} onOpenChange={setIsConfirmationDialogOpen}>
          <DialogContent className="sm:max-w-[600px]" data-testid="dialog-confirmation">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Please check the following boxes to confirm you have not:</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="confirm-accutane"
                  checked={confirmAccutane}
                  onCheckedChange={(checked) => setConfirmAccutane(checked as boolean)}
                  className="mt-1 h-6 w-6 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  data-testid="checkbox-accutane"
                />
                <label
                  htmlFor="confirm-accutane"
                  className="text-lg leading-relaxed cursor-pointer"
                >
                  Taken Accutane in the last six (6) months
                </label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="confirm-injections"
                  checked={confirmInjections}
                  onCheckedChange={(checked) => setConfirmInjections(checked as boolean)}
                  className="mt-1 h-6 w-6 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  data-testid="checkbox-injections"
                />
                <label
                  htmlFor="confirm-injections"
                  className="text-lg leading-relaxed cursor-pointer"
                >
                  Received injections (Botox, fillers, etc.) or laser/electrolysis hair removal in the last two (2) weeks
                </label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="confirm-waxing"
                  checked={confirmWaxing}
                  onCheckedChange={(checked) => setConfirmWaxing(checked as boolean)}
                  className="mt-1 h-6 w-6 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  data-testid="checkbox-waxing"
                />
                <label
                  htmlFor="confirm-waxing"
                  className="text-lg leading-relaxed cursor-pointer"
                >
                  Received waxing or threading facial hair removal in the last three (3) days
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleConfirmationContinue}
                disabled={!confirmAccutane || !confirmInjections || !confirmWaxing}
                className="w-full h-12 bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                data-testid="button-confirm-continue"
              >
                Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Step 4: DateTime Selection
  if (bookingState.step === 'datetime') {
    // Generate time slots from Boulevard availability data
    const generateTimeSlots = () => {
      if (!availabilityData || !availabilityData.availableSlots) {
        return [];
      }
      
      return availabilityData.availableSlots.map((slot: any) => ({
        ...slot, // Keep all Boulevard fields
        time: format(new Date(slot.startTime), 'h:mm a') // Add formatted time for display
      }));
    };

    const timeSlots = generateTimeSlots();
    const hasAvailability = timeSlots.length > 0;

    const nextDays = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(new Date(), i);
      return {
        date: date,
        display: format(date, 'EEE, MMM d')
      };
    });

    const isValid = selectedDate && selectedTimeSlot;

    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <img src={glowbarLogoPath} alt="Glowbar" className="h-8" data-testid="img-logo" />
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        <div className="flex-1">
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
            <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Select Date & Time</h1>
            <p className="text-gray-600" data-testid="text-subtitle">
              Choose your appointment time at {bookingState.selectedLocation?.name || 'the selected location'}
            </p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Select Date</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-2">
                {nextDays.map((day) => (
                  <button
                    key={format(day.date, 'yyyy-MM-dd')}
                    onClick={() => {
                      setSelectedDate(day.date);
                      setSelectedTimeSlot(undefined); // Reset time when date changes
                    }}
                    className={`p-4 border rounded-lg text-left transition-colors ${
                      selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(day.date, 'yyyy-MM-dd')
                        ? 'border-black bg-black text-white'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid={`button-date-${format(day.date, 'yyyy-MM-dd')}`}
                  >
                    {day.display}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedDate && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Select Time</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {availabilityLoading ? (
                  <p className="text-center text-gray-500">Loading available times...</p>
                ) : hasAvailability ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedTimeSlot(slot)} // Store entire Boulevard slot
                        className={`p-3 border rounded-lg text-sm transition-colors ${
                          selectedTimeSlot?.id === slot.id
                            ? 'border-black bg-black text-white'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        data-testid={`button-time-${slot.time.replace(/[:\s]/g, '-')}`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No availability for this date. Please select another date.</p>
                )}
              </CardContent>
            </Card>
          )}

          {isValid && (
            <Button
              onClick={() => {
                // Determine next step based on customer type
                const nextStep = bookingState.customerType === 'new' ? 'personal-info' : 'checkout';
                setBookingState(prev => ({
                  ...prev,
                  selectedDate: selectedDate,
                  selectedTime: selectedTimeSlot,
                  step: nextStep
                }));
              }}
              className="w-full bg-black text-white hover:bg-gray-800"
              data-testid="button-continue"
            >
              Continue
            </Button>
          )}
          </div>
        </div>
      </div>
    );
  }

  // Step 5: Personal Info (for new users)
  if (bookingState.step === 'personal-info') {
    const isValid = firstName && lastName && email && authPhone;

    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <img src={glowbarLogoPath} alt="Glowbar" className="h-8" data-testid="img-logo" />
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        <div className="flex-1">
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
              <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Personal Information</h1>
            <p className="text-gray-600">Please provide your contact information</p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-2"
                  data-testid="input-first-name"
                />
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-2"
                  data-testid="input-last-name"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2"
                  data-testid="input-email"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                  className="mt-2"
                  data-testid="input-phone"
                />
              </div>

              <Button
                onClick={() => {
                  setBookingState(prev => ({
                    ...prev,
                    userFirstName: firstName,
                    userLastName: lastName,
                    userEmail: email,
                    userPhone: authPhone,
                    userName: `${firstName} ${lastName}`,
                    step: 'checkout'
                  }));
                }}
                className="w-full bg-black text-white hover:bg-gray-800 mt-6"
                disabled={!isValid}
                data-testid="button-continue"
              >
                Continue to Checkout
              </Button>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    );
  }

  // Step 6: Checkout
  if (bookingState.step === 'checkout') {
    // Early return while redirecting
    if (!bookingState.selectedProduct || !bookingState.selectedLocation || !bookingState.selectedTime) {
      return null;
    }

    const productPrice = bookingState.selectedProduct.price;
    const tax = productPrice * 0.09;
    const total = bookingState.isMember ? 0 : productPrice + tax;

    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <img src={glowbarLogoPath} alt="Glowbar" className="h-8" data-testid="img-logo" />
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        <div className="flex-1">
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
                    <p className="text-sm text-gray-600">Service</p>
                    <p className="font-semibold">{bookingState.selectedProduct?.name || 'Facial Treatment'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="font-semibold">{bookingState.selectedLocation?.name}</p>
                    <p className="text-sm text-gray-500">{bookingState.selectedLocation?.city}, {bookingState.selectedLocation?.state}</p>
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
                    <p className="text-sm text-gray-600">Esthetician</p>
                    <p className="font-semibold">
                      {bookingState.selectedEsthetician === 'any' 
                        ? 'No preference' 
                        : staffData?.staff?.find(s => s.id === bookingState.selectedEsthetician)?.displayName 
                          || staffData?.staff?.find(s => s.id === bookingState.selectedEsthetician)?.firstName 
                          || 'No preference'}
                    </p>
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
                    {bookingState.isMember ? (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Treatment</span>
                          <span>${productPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-green-600">
                          <span>Voucher Applied</span>
                          <span>-${productPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg border-t pt-2">
                          <span>Total</span>
                          <span data-testid="text-total">$0.00</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between mb-2">
                          <span>Treatment</span>
                          <span>${productPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                          <span>Tax</span>
                          <span>${tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg border-t pt-2">
                          <span>Total</span>
                          <span data-testid="text-total">${total.toFixed(2)}</span>
                        </div>
                      </>
                    )}
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
                      setBookingState(prev => ({ ...prev, step: 'confirmation' }));
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
    </div>
    );
  }

  // Step 7: Confirmation
  if (bookingState.step === 'confirmation') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <img src={glowbarLogoPath} alt="Glowbar" className="h-8" data-testid="img-logo" />
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        <div className="flex-1">
          <div className="max-w-2xl mx-auto px-6 py-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Booking Confirmed!</h1>
            <p className="text-gray-600" data-testid="text-subtitle">
              Your appointment has been successfully scheduled
            </p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Appointment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Service</p>
                <p className="font-semibold">{bookingState.selectedProduct?.name || 'Glowbar Signature Facial'}</p>
              </div>
              {bookingState.selectedLocation && (
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="font-semibold">{bookingState.selectedLocation.name}</p>
                  <p className="text-sm text-gray-500">
                    {bookingState.selectedLocation.city}, {bookingState.selectedLocation.state}
                  </p>
                </div>
              )}
              {bookingState.selectedDate && (
                <div>
                  <p className="text-sm text-gray-600">Date & Time</p>
                  <p className="font-semibold">{format(bookingState.selectedDate, 'EEE, MMM d, yyyy')}</p>
                  <p className="text-sm text-gray-500">{bookingState.selectedTime?.time || 'Time TBD'}</p>
                </div>
              )}
              {bookingState.userName && (
                <div>
                  <p className="text-sm text-gray-600">Guest</p>
                  <p className="font-semibold">{bookingState.userName}</p>
                  <p className="text-sm text-gray-500">{bookingState.userEmail}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Button
              onClick={() => {
                setBookingState({ step: 'location' });
                setAcceptTerms(false);
              }}
              className="w-full bg-black text-white hover:bg-gray-800"
              data-testid="button-new-booking"
            >
              Book Another Appointment
            </Button>
            <p className="text-sm text-gray-500 text-center">
              A confirmation email has been sent to {bookingState.userEmail || 'your email'}
            </p>
          </div>
        </div>
      </div>
    </div>
    );
  }

  return null;
}
