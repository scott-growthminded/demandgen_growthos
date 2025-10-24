import { useState, useEffect } from "react";
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
import { ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import { format, addDays } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  | 'customer-type'
  | 'region'
  | 'location'
  | 'service'
  | 'membership-purchase'
  | 'datetime'
  | 'auth'
  | 'questionnaire'
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
  customerType?: 'new' | 'returning';
  isMember?: boolean;
  selectedRegion?: string;
  selectedLocation?: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
  userFirstName?: string;
  userLastName?: string;
  userEmail?: string;
  userPhone?: string;
  questionnaireComplete?: boolean;
  selectedDate?: Date;
  selectedTime?: {
    id: string;
    time: string;
  };
  selectedEsthetician?: string;
}

interface AvailabilityResponse {
  success: boolean;
  availableSlots: Array<{
    startTime: string;
    id: string;
    score: number;
  }>;
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
    step: 'customer-type',
  });
  const [expandedState, setExpandedState] = useState<string | null>(null);
  
  // Questionnaire state
  const [accutane, setAccutane] = useState(false);
  const [injections, setInjections] = useState(false);
  const [waxing, setWaxing] = useState(false);
  
  // Date/Time state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | undefined>(undefined);
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

  const handleBack = () => {
    // Handle back navigation based on current step and booking state
    switch (bookingState.step) {
      case 'region':
        setBookingState(prev => ({ ...prev, step: 'customer-type' }));
        break;
      case 'location':
        setBookingState(prev => ({ ...prev, step: 'region' }));
        break;
      case 'service':
        setBookingState(prev => ({ ...prev, step: 'location' }));
        break;
      case 'membership-purchase':
        setBookingState(prev => ({ ...prev, step: 'service' }));
        break;
      case 'datetime':
        setBookingState(prev => ({ ...prev, step: 'auth' }));
        break;
      case 'auth':
        setBookingState(prev => ({ ...prev, step: 'service' }));
        break;
      case 'questionnaire':
        setBookingState(prev => ({ ...prev, step: 'service' }));
        break;
      case 'checkout':
        setBookingState(prev => ({ ...prev, step: 'questionnaire' }));
        break;
      default:
        break;
    }
  };

  // Step 1: Customer Type Selection
  if (bookingState.step === 'customer-type') {
    return (
      <div className="min-h-screen bg-white flex items-center">
        <div className="w-full max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 gap-12">
          <div className="flex flex-col justify-center">
            <h1 className="text-5xl font-bold mb-4" data-testid="text-title">How can we help?</h1>
            
            <div className="space-y-4 mt-8">
              <button
                onClick={() => setBookingState(prev => ({ ...prev, customerType: 'returning', isMember: true, step: 'region' }))}
                className="w-full p-6 border-2 rounded-lg hover:border-gray-400 transition-colors text-left group"
                data-testid="button-member"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">I'm a Glowbar Member</h3>
                    <p className="text-gray-600 text-sm">Book your member treatment</p>
                  </div>
                  <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </button>

              <button
                onClick={() => setBookingState(prev => ({ ...prev, customerType: 'returning', isMember: false, step: 'region' }))}
                className="w-full p-6 border-2 rounded-lg hover:border-gray-400 transition-colors text-left group"
                data-testid="button-returning-customer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">I'm a Returning Customer</h3>
                    <p className="text-gray-600 text-sm">Welcome back! Schedule a return visit</p>
                  </div>
                  <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </button>

              <button
                onClick={() => setBookingState(prev => ({ ...prev, customerType: 'new', isMember: false, step: 'region' }))}
                className="w-full p-6 border-2 rounded-lg hover:border-gray-400 transition-colors text-left group"
                data-testid="button-new-customer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">I'm New to Glowbar</h3>
                    <p className="text-gray-600 text-sm">Schedule your first facial</p>
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
    );
  }

  // Step 2: Region Selection
  if (bookingState.step === 'region') {
    const regionCounts: Record<string, number> = {};
    const allLocations: any[] = [];
    
    if (locationsData) {
      Object.entries(locationsData as Record<string, any>).forEach(([state, cities]) => {
        let count = 0;
        Object.entries(cities as Record<string, any>).forEach(([city, locations]) => {
          count += (locations as Location[]).length;
          allLocations.push(...(locations as any[]));
        });
        regionCounts[state] = count;
      });
    }

    return (
      <div className="min-h-screen bg-white flex items-center">
        <div className="w-full max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 gap-12">
          <div className="flex flex-col justify-center">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="mb-6 self-start"
              data-testid="button-back"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <h1 className="text-5xl font-bold mb-8" data-testid="text-title">Choose a region</h1>
            
            <div className="space-y-3">
              {Object.entries(regionCounts).map(([state, count]) => (
                <button
                  key={state}
                  onClick={() => setBookingState(prev => ({ ...prev, selectedRegion: state, step: 'location' }))}
                  className="w-full p-6 border-2 rounded-lg hover:border-gray-400 transition-colors text-left group"
                  data-testid={`button-region-${state}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{state}</h3>
                      <p className="text-gray-600 text-sm">{count} {count === 1 ? 'Location' : 'Locations'}</p>
                    </div>
                    <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="relative rounded-lg overflow-hidden bg-gray-100 h-[600px]">
            <MapContainer
              key="region-map"
              center={[40.7128, -74.0060]}
              zoom={11}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              {allLocations.length > 0 && allLocations.map((location: any, index: number) => {
                const lat = location.coordinates?.lat || location.coordinates?.latitude;
                const lng = location.coordinates?.lng || location.coordinates?.longitude;
                
                if (lat && lng) {
                  return (
                    <Marker
                      key={location.id || index}
                      position={[lat, lng]}
                      icon={blackIcon}
                    >
                      <Popup
                        closeButton={true}
                        className="custom-popup"
                      >
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
                              setEsthetician('any');
                              setBookingState(prev => ({
                                ...prev,
                                selectedLocation: {
                                  id: location.id,
                                  name: location.name,
                                  city: location.address?.city || '',
                                  state: location.address?.state || '',
                                },
                                selectedRegion: location.address?.state || prev.selectedRegion,
                                step: 'datetime'
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
                          >
                            Select
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                }
                return null;
              })}
            </MapContainer>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Location Selection (Studios in selected region)
  if (bookingState.step === 'location') {
    const locationsInRegion: any[] = [];
    
    if (locationsData && bookingState.selectedRegion) {
      const stateData = (locationsData as Record<string, any>)[bookingState.selectedRegion];
      if (stateData) {
        Object.values(stateData as Record<string, any>).forEach((locations) => {
          locationsInRegion.push(...(locations as any[]));
        });
      }
    }

    return (
      <div className="min-h-screen bg-white flex items-center">
        <div className="w-full max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 gap-12">
          <div className="flex flex-col justify-center">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="mb-6 self-start"
              data-testid="button-back"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <h1 className="text-5xl font-bold mb-8" data-testid="text-title">Choose a studio</h1>
            
            <div className="space-y-3">
              {locationsInRegion.map((location) => (
                <button
                  key={location.id}
                  onClick={() => {
                    setEsthetician('any');
                    setBookingState(prev => ({
                      ...prev,
                      selectedLocation: {
                        id: location.id,
                        name: location.name,
                        city: location.address?.city || '',
                        state: location.address?.state || '',
                      },
                      step: 'service'
                    }));
                  }}
                  className="w-full p-6 border-2 rounded-lg hover:border-gray-400 transition-colors text-left group"
                  data-testid={`button-location-${location.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{location.name}</h3>
                      <p className="text-gray-600 text-sm">
                        {location.address?.line1}, {location.address?.city}, {location.address?.state}
                      </p>
                    </div>
                    <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="relative rounded-lg overflow-hidden bg-gray-100 h-[600px]">
            {locationsInRegion.length > 0 && locationsInRegion[0].coordinates ? (
              <MapContainer
                key="location-map"
                center={[
                  locationsInRegion.reduce((sum, loc) => sum + ((loc.coordinates?.lat || loc.coordinates?.latitude) || 0), 0) / locationsInRegion.length,
                  locationsInRegion.reduce((sum, loc) => sum + ((loc.coordinates?.lng || loc.coordinates?.longitude) || 0), 0) / locationsInRegion.length
                ]}
                zoom={10}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                {locationsInRegion.map((location: any, index: number) => {
                  const lat = location.coordinates?.lat || location.coordinates?.latitude;
                  const lng = location.coordinates?.lng || location.coordinates?.longitude;
                  
                  if (lat && lng) {
                    return (
                      <Marker
                        key={location.id || index}
                        position={[lat, lng]}
                        icon={blackIcon}
                      >
                        <Popup
                          closeButton={true}
                          className="custom-popup"
                        >
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
                                setEsthetician('any');
                                setBookingState(prev => ({
                                  ...prev,
                                  selectedLocation: {
                                    id: location.id,
                                    name: location.name,
                                    city: location.address?.city || '',
                                    state: location.address?.state || '',
                                  },
                                  step: 'service'
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
                            >
                              Select
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
                  <p className="text-lg font-semibold mb-2">📍 {locationsInRegion.length} Studios</p>
                  <p className="text-sm">in {bookingState.selectedRegion}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Service Selection
  if (bookingState.step === 'service') {
    const isMember = bookingState.isMember === true;
    const isNew = bookingState.customerType === 'new';
    
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
              {isMember ? 'Welcome Back!' : 'Book a Treatment'}
            </h1>
            {isMember && (
              <p className="text-[#FF6B35] font-semibold" data-testid="text-member-status">
                Your membership is Active
              </p>
            )}
          </div>

          <div className="space-y-4">
            {/* Non-member upsell banner */}
            {!isMember && (
              <div 
                className="relative rounded-lg overflow-hidden mb-6"
                style={{
                  backgroundImage: 'url(https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=800)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  height: '200px'
                }}
              >
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white p-6">
                  <p className="text-xl font-semibold mb-4 text-center">
                    Sign up for the Glowbar Membership today and save $15/month
                  </p>
                  <button
                    onClick={() => setBookingState(prev => ({ ...prev, step: 'membership-purchase' }))}
                    className="px-8 py-3 bg-[#FF6B35] hover:bg-[#FF5520] rounded-lg font-semibold transition-colors"
                    data-testid="button-become-member-banner"
                  >
                    Become a member
                  </button>
                </div>
              </div>
            )}

            {/* Member service option */}
            {isMember && (
              <Card className="hover:border-gray-400 transition-colors cursor-pointer" data-testid="card-member-service">
                <CardHeader>
                  <CardTitle className="text-xl">
                    {isNew ? '(Member) First Time Treatment' : '(Member) First Time & Returning Treatment'} <span className="text-gray-500 text-lg font-normal">30min</span>
                  </CardTitle>
                  <CardDescription className="text-base mt-2">
                    {isNew 
                      ? "If you have purchased a membership online or in-studio, book this treatment."
                      : "If you have purchased a membership online or in-studio, book this treatment."
                    }
                  </CardDescription>
                  <p className="text-sm text-gray-600 mt-2 italic">
                    Please note, your card will *not* be charged now and your monthly voucher will be applied to your appointment upon checkout. We can't wait to see your face.
                  </p>
                  <p className="text-[#FF6B35] font-semibold mt-3">
                    Redeem with your voucher
                  </p>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setBookingState(prev => ({ ...prev, step: 'auth' }))}
                    className="w-full bg-black text-white hover:bg-gray-800"
                    data-testid="button-select-member-service"
                  >
                    Select
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Non-member service options */}
            {!isMember && (
              <Card className="hover:border-gray-400 transition-colors cursor-pointer" data-testid="card-non-member-service">
                  <CardHeader>
                    <CardTitle className="text-xl">
                      {isNew ? '(Non-Member) First Time Treatment' : '(Non-Member) Returning Treatment'} <span className="text-gray-500 text-lg font-normal">30min</span>
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                      {isNew
                        ? "If you've never been to Glowbar before and don't have a membership, book this treatment."
                        : "If you've been to Glowbar before and don't have a membership, book this treatment."
                      }
                    </CardDescription>
                    <p className="text-sm text-gray-600 mt-2 italic">
                      Please note, your card will *not* be charged now; it will be charged after your appointment at checkout. We can't wait to see your face.
                    </p>
                    <div className="mt-4">
                      <p className="text-2xl font-bold">$80.00</p>
                      <p className="text-sm text-[#FF6B35]">Members pay $65 - become a member and save $15</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => setBookingState(prev => ({ ...prev, step: 'auth' }))}
                      className="w-full bg-black text-white hover:bg-gray-800"
                      data-testid="button-select-non-member-service"
                    >
                      Select
                    </Button>
                  </CardContent>
                </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 5: Membership Purchase
  if (bookingState.step === 'membership-purchase') {
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

          {!membershipInCart ? (
            <>
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Purchase a Membership</h1>
              </div>

              <Card className="hover:border-gray-400 transition-colors" data-testid="card-membership-details">
                <CardHeader>
                  <CardTitle className="text-xl">
                    Online Purchase - Glowbar Membership
                  </CardTitle>
                  <CardDescription className="text-base mt-4 space-y-2">
                    <p>- 1 facial voucher per month, valid for 3 months</p>
                    <p>- Additional facials at member price</p>
                    <p>- 1 free guest pass per membership year</p>
                    <p>- 15% off skincare (20% off at your first facial)</p>
                  </CardDescription>
                  <p className="text-sm text-gray-600 mt-4">
                    Becoming a Glowbar member requires a four month minimum commitment. Memberships may be cancelled with 30 days notice. Memberships become active the day of purchase. Please note, gift cards are not applicable towards membership payments.
                  </p>
                  <p className="text-sm text-gray-600 mt-3">
                    After purchasing your membership, please separately book a "(Member) First Time & Returning Treatment" appointment.
                  </p>
                  <p className="text-2xl font-bold mt-6">$65.00</p>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setMembershipInCart(true)}
                    className="w-full bg-black text-white hover:bg-gray-800"
                    data-testid="button-add-membership-to-cart"
                  >
                    Select
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Before You Glow</h1>
              </div>

              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Online Purchase - Glowbar Membership</CardTitle>
                      <p className="text-2xl font-bold mt-2">$65.00</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setMembershipInCart(false)}
                      data-testid="button-remove-membership"
                    >
                      Remove
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-4">Order total: $69.13</h2>
                <p className="text-sm text-gray-600 mb-4">Tax: $4.13</p>
              </div>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Payment Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">Saved payment methods can only be deleted by a Glowbar staff member. Please call or visit a Glowbar location for assistance. Expired payment methods will automatically be removed.</p>
                  <Button variant="outline" className="mt-4" data-testid="button-add-payment">
                    ADD NEW PAYMENT METHOD
                  </Button>
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Communication</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    By purchasing this membership, you agree to receive texts and emails with account updates, news, and special offers. Texts will be sent via auto-SMS. Consent is optional. You can unsubscribe from an email anytime by clicking unsubscribe, and opt out of marketing texts anytime by replying NO PROMOS or all text communication by replying STOP. Text HELP for more info. Message frequency may vary. SMS and data rates may apply.
                  </p>
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Membership Agreement</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="membership-agreement"
                      checked={agreementChecked}
                      onCheckedChange={(checked) => setAgreementChecked(checked as boolean)}
                      data-testid="checkbox-membership-agreement"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="membership-agreement"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        By purchasing a membership, you agree to the <a href="#" className="text-[#FF6B35] underline">Glowbar Membership Terms & Conditions</a>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={() => {
                  if (!agreementChecked) {
                    toast({
                      title: "Agreement Required",
                      description: "Please agree to the membership terms and conditions",
                      variant: "destructive"
                    });
                    return;
                  }
                  toast({
                    title: "Membership Purchased!",
                    description: "You are now a Glowbar member. Please book your member treatment.",
                  });
                  // Update member status and go back to service selection
                  setBookingState(prev => ({ 
                    ...prev, 
                    isMember: true,
                    step: 'service'
                  }));
                }}
                disabled={!agreementChecked}
                className="w-full bg-black text-white hover:bg-gray-800"
                data-testid="button-complete-membership-purchase"
              >
                COMPLETE PURCHASE
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Step 6: Authentication / Sign Up
  if (bookingState.step === 'auth') {
    const isNewCustomer = bookingState.customerType === 'new';

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
              {isNewCustomer ? 'Create an Account' : 'Login'}
            </h1>
            <p className="text-gray-600" data-testid="text-subtitle">
              {isNewCustomer ? 'Enter your information to get started' : 'Enter your phone number to continue'}
            </p>
          </div>

          <Card>
            <CardContent className="p-6">
              {isNewCustomer ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-4">Basic Info</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          type="text"
                          placeholder="First Name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          data-testid="input-first-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          type="text"
                          placeholder="Last Name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          data-testid="input-last-name"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4">Contact Info</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          data-testid="input-email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="646-374-9666"
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                          data-testid="input-phone"
                        />
                      </div>

                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="email-opt-in"
                          checked={emailOptIn}
                          onCheckedChange={(checked) => setEmailOptIn(checked as boolean)}
                          data-testid="checkbox-email-opt-in"
                        />
                        <div className="flex-1">
                          <label
                            htmlFor="email-opt-in"
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            By sharing your email address you're signing up to receive news and special offers from Glowbar. You may unsubscribe at any time (but we hope you won't).
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      if (!firstName || !lastName || !email || !authPhone) {
                        toast({
                          title: "All Fields Required",
                          description: "Please fill in all fields to continue",
                          variant: "destructive"
                        });
                        return;
                      }
                      setBookingState(prev => ({ 
                        ...prev, 
                        userName: `${firstName} ${lastName}`,
                        userPhone: authPhone,
                        userEmail: email,
                        step: 'datetime' 
                      }));
                    }}
                    className="w-full bg-black text-white hover:bg-gray-800"
                    data-testid="button-continue"
                  >
                    CONTINUE
                  </Button>
                </div>
              ) : (
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
                        step: 'datetime' 
                      }));
                    }}
                    className="w-full bg-black text-white hover:bg-gray-800"
                    data-testid="button-continue"
                  >
                    CONTINUE
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 3: Date/Time Selection
  if (bookingState.step === 'datetime') {
    // Generate time slots directly from Boulevard availability data
    const generateTimeSlots = () => {
      // Get current time for filtering past slots
      const now = new Date();
      const isToday = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
      
      // If we have Boulevard availability data, use it to generate slots
      if (availabilityData?.success && availabilityData.availableSlots && availabilityData.availableSlots.length > 0) {
        const slots = availabilityData.availableSlots
          .map((slot) => {
            // Parse ISO time like "2025-10-18T20:00:00-04:00" to get hour and minute
            const match = slot.startTime.match(/T(\d{2}):(\d{2}):/);
            if (!match) return null;
            
            const hour = parseInt(match[1]);
            const minute = parseInt(match[2]);
            const timeValue = `${hour}:${minute.toString().padStart(2, '0')}`;
            
            // Check if this slot is in the past (for today only)
            let isPast = false;
            if (isToday) {
              const slotTime = new Date();
              slotTime.setHours(hour, minute, 0, 0);
              isPast = slotTime < now;
            }
            
            // Format for display
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
            
            return {
              value: timeValue,
              display: `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`,
              available: !isPast,
              hour: hour
            };
          })
          .filter((slot): slot is { value: string; display: string; available: boolean; hour: number } => slot !== null);
        
        return slots;
      }
      
      // Fallback: generate placeholder slots from 8 AM to 8 PM (40-minute intervals)
      // This shows while loading or when no availability data is returned
      const slots: string[] = [];
      for (let hour = 8; hour <= 20; hour++) {
        if (hour < 20) {
          slots.push(`${hour}:00`);
          slots.push(`${hour}:20`);
          slots.push(`${hour}:40`);
        } else {
          // Include 8:00 PM
          slots.push(`${hour}:00`);
        }
      }
      
      return slots.map(time => {
        const [h, m] = time.split(':');
        const hour = parseInt(h);
        const minute = parseInt(m);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        
        return {
          value: time,
          display: `${displayHour}:${m} ${ampm}`,
          available: false, // All unavailable until we get real data
          hour: hour
        };
      });
    };

    const timeSlots = generateTimeSlots();
    
    // Group time slots by period (morning, afternoon, evening)
    const morningSlots = timeSlots.filter(slot => slot.hour < 12);
    const afternoonSlots = timeSlots.filter(slot => slot.hour >= 12 && slot.hour < 17);
    const eveningSlots = timeSlots.filter(slot => slot.hour >= 17);

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
                  Book your appointment at {bookingState.selectedLocation?.name}
                </p>
              </div>

              {/* Esthetician Filter */}
              <div className="mb-6">
                <Label>
                  Esthetician Preference
                  {staffLoading && <span className="text-sm text-gray-500 ml-2">(Loading...)</span>}
                </Label>
                <Select value={esthetician} onValueChange={setEsthetician}>
                  <SelectTrigger className="w-full" data-testid="select-esthetician">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Esthetician</SelectItem>
                    {staffData?.staff?.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.displayName || `${staff.firstName} ${staff.lastName}`}
                      </SelectItem>
                    ))}
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

              {/* Time Slots - Grouped by Period */}
              {selectedDate && (
                <div className="space-y-6">
                  <Label className="mb-4 block">
                    Available Times
                    {availabilityLoading && <span className="text-sm text-gray-500 ml-2">(Loading...)</span>}
                  </Label>
                  
                  {/* Morning Slots */}
                  {morningSlots.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Morning (before 12pm)</h3>
                      {morningSlots.some(slot => slot.available) ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {morningSlots.map((slot) => (
                            <button
                              key={slot.value}
                              onClick={() => {
                                if (slot.available) {
                                  setSelectedTimeSlot(slot.value);
                                  setSelectedNearbyLocation(null);
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
                      ) : (
                        <button
                          onClick={() => {
                            toast({
                              title: "Added to Waitlist",
                              description: `You've been added to the morning waitlist for ${format(selectedDate!, 'MMM d, yyyy')}`,
                            });
                          }}
                          className="w-full p-4 border-2 border-[#FF6B35] text-[#FF6B35] rounded-lg font-semibold hover:bg-[#FF6B35] hover:text-white transition-colors"
                          data-testid="button-waitlist-morning"
                        >
                          Join Morning Waitlist
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Afternoon Slots */}
                  {afternoonSlots.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Afternoon (12pm - 5pm)</h3>
                      {afternoonSlots.some(slot => slot.available) ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {afternoonSlots.map((slot) => (
                            <button
                              key={slot.value}
                              onClick={() => {
                                if (slot.available) {
                                  setSelectedTimeSlot(slot.value);
                                  setSelectedNearbyLocation(null);
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
                      ) : (
                        <button
                          onClick={() => {
                            toast({
                              title: "Added to Waitlist",
                              description: `You've been added to the afternoon waitlist for ${format(selectedDate!, 'MMM d, yyyy')}`,
                            });
                          }}
                          className="w-full p-4 border-2 border-[#FF6B35] text-[#FF6B35] rounded-lg font-semibold hover:bg-[#FF6B35] hover:text-white transition-colors"
                          data-testid="button-waitlist-afternoon"
                        >
                          Join Afternoon Waitlist
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Evening Slots */}
                  {eveningSlots.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Evening (after 5pm)</h3>
                      {eveningSlots.some(slot => slot.available) ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {eveningSlots.map((slot) => (
                            <button
                              key={slot.value}
                              onClick={() => {
                                if (slot.available) {
                                  setSelectedTimeSlot(slot.value);
                                  setSelectedNearbyLocation(null);
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
                      ) : (
                        <button
                          onClick={() => {
                            toast({
                              title: "Added to Waitlist",
                              description: `You've been added to the evening waitlist for ${format(selectedDate!, 'MMM d, yyyy')}`,
                            });
                          }}
                          className="w-full p-4 border-2 border-[#FF6B35] text-[#FF6B35] rounded-lg font-semibold hover:bg-[#FF6B35] hover:text-white transition-colors"
                          data-testid="button-waitlist-evening"
                        >
                          Join Evening Waitlist
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}


              {/* Nearby Locations */}
              {nearbyLocations.length > 0 && selectedDate && (
                <div className="mt-12">
                  <p className="text-gray-600 mb-6">Don't see a time that works for you? Here are some other options nearby.</p>
                  <div className="space-y-6">
                    {nearbyLocations.map((location, index) => {
                      const availData = nearbyAvailabilityData[index]?.data;
                      const slots = formatNearbyTimeSlots(availData);
                      const isExpanded = expandedNearbyLocations.has(location.id);
                      const displaySlots = isExpanded ? slots : slots.slice(0, 5);
                      const hasMore = slots.length > 5;
                      
                      return (
                        <div key={location.id} data-testid={`card-nearby-location-${location.id}`}>
                          <div className="mb-3">
                            <h4 className="font-semibold text-lg">{location.name}</h4>
                            {location.address && (
                              <p className="text-sm text-gray-600">
                                {location.address.line1 && `${location.address.line1}, `}
                                {location.address.city}, {location.address.state}
                              </p>
                            )}
                          </div>
                          
                          {slots.length > 0 ? (
                            <div className="grid grid-cols-3 gap-3">
                              {displaySlots.map((slot) => (
                                <button
                                  key={slot.value}
                                  onClick={() => {
                                    setSelectedNearbyLocation({
                                      locationId: location.id,
                                      locationName: location.name,
                                      time: slot.display
                                    });
                                    setSelectedTimeSlot(undefined);
                                  }}
                                  className={`p-3 border rounded-full text-center transition-colors ${
                                    selectedNearbyLocation?.locationId === location.id && selectedNearbyLocation?.time === slot.display
                                      ? 'bg-black text-white border-black'
                                      : 'hover:border-gray-400'
                                  }`}
                                  data-testid={`button-nearby-time-${location.id}-${slot.value}`}
                                >
                                  {slot.display.toLowerCase()}
                                </button>
                              ))}
                              
                              {hasMore && (
                                <button
                                  onClick={() => {
                                    const newExpanded = new Set(expandedNearbyLocations);
                                    if (isExpanded) {
                                      newExpanded.delete(location.id);
                                    } else {
                                      newExpanded.add(location.id);
                                    }
                                    setExpandedNearbyLocations(newExpanded);
                                  }}
                                  className="p-3 border rounded-full text-center hover:border-gray-400 transition-colors"
                                  data-testid={`button-toggle-nearby-${location.id}`}
                                >
                                  {isExpanded ? 'View Less' : 'View More'}
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No availability for this date</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Sticky Bottom Continue Button */}
          {(selectedTimeSlot || selectedNearbyLocation) && (
            <div className="fixed bottom-0 left-0 right-0 bg-black text-white p-4 z-50">
              <div className="max-w-3xl mx-auto">
                <Button
                  onClick={() => {
                    if (selectedNearbyLocation) {
                      // Switch to the nearby location
                      const location = nearbyLocations.find(l => l.id === selectedNearbyLocation.locationId);
                      if (location) {
                        setBookingState(prev => ({
                          ...prev,
                          selectedLocation: {
                            id: location.id,
                            name: location.name,
                            city: location.address?.city || '',
                            state: location.address?.state || '',
                          },
                          selectedDate,
                          selectedTime: { id: selectedNearbyLocation.time, time: selectedNearbyLocation.time },
                          selectedEsthetician: esthetician,
                          step: 'questionnaire'
                        }));
                      }
                    } else {
                      setBookingState(prev => ({
                        ...prev,
                        selectedDate,
                        selectedTime: { id: selectedTimeSlot!, time: selectedTimeSlot! },
                        selectedEsthetician: esthetician,
                        step: 'questionnaire'
                      }));
                    }
                  }}
                  className="w-full bg-white text-black hover:bg-gray-100 text-lg py-6"
                  data-testid="button-continue-sticky"
                >
                  {selectedNearbyLocation 
                    ? `Continue with ${selectedNearbyLocation.time.toLowerCase()} at ${selectedNearbyLocation.locationName}`
                    : 'Continue to Checkout'
                  }
                </Button>
              </div>
            </div>
          )}

          {/* Booking Summary Sidebar */}
          <div className="w-80 bg-gray-50 p-6 border-l">
            <h2 className="text-xl font-bold mb-4">Your Booking</h2>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="font-semibold">{bookingState.selectedLocation?.name}</p>
                </div>
                {selectedDate && selectedTimeSlot && (
                  <div>
                    <p className="text-sm text-gray-600">Date & Time</p>
                    <p className="font-semibold">
                      {format(selectedDate, 'MMM d, yyyy')} at {selectedTimeSlot}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Pre-Treatment Questionnaire
  if (bookingState.step === 'questionnaire') {
    const allChecked = accutane && injections && waxing;

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
                      step: 'checkout'
                    }));
                  }}
                  className="w-full bg-black text-white hover:bg-gray-800 mt-4"
                  data-testid="button-continue"
                >
                  CONTINUE TO CHECKOUT
                </Button>
              )}

              {!allChecked && (
                <p className="text-sm text-gray-500 text-center mt-4">
                  Please check all boxes to continue
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 5: Checkout Summary
  if (bookingState.step === 'checkout') {
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
                    <p className="text-sm text-gray-600">Service</p>
                    <p className="font-semibold">Facial Treatment (50 minutes)</p>
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
                    <div className="flex justify-between mb-2">
                      <span>Treatment</span>
                      <span>$80.00</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span>Tax</span>
                      <span>$7.20</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total</span>
                      <span data-testid="text-total">$87.20</span>
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
