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
import { ChevronLeft, ChevronDown, ChevronUp, ChevronRight, CheckCircle, User, MapPin, Tag, Search, Navigation, Clock, X, Lock, CreditCard, Star, Sparkles, Award, Shield } from "lucide-react";
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
import facialTreatmentImage from "@assets/stock_images/woman_receiving_faci_e972fbc7.jpg";
import luxurySpaImage from "@assets/stock_images/woman_at_luxury_spa__a296b478.jpg";
import homeHeroImage from "@assets/home_hero_flip_1764064272021.png";
import giftCardMockupPath from "@assets/Gift_Card_(9)_1767270260646.png";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create custom red marker icon (Glowbar style)
const blackIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path fill="#FF502D" stroke="#fff" stroke-width="1.5" d="M12 0C7.03 0 3 4.03 3 9c0 7.5 9 18 9 18s9-10.5 9-18c0-4.97-4.03-9-9-9z"/>
      <circle cx="12" cy="9" r="3" fill="#fff"/>
    </svg>
  `),
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -42],
});

// Create custom orange marker icon for user's location
const userLocationIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <circle cx="12" cy="12" r="10" fill="#000000" stroke="#fff" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="#fff"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
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
  | 'gift-recipient'
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
  visitCount?: number; // Track number of visits (0 = first-time, 1+ = returning)
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
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<Date>(new Date()); // Track current month being viewed
  
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
  
  // Card details state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'saved-1' | 'saved-2' | 'new'>('saved-1');
  
  // Dummy saved cards data
  const savedCards = [
    { id: 'saved-1', brand: 'Visa', last4: '4242', expiry: '12/26' },
    { id: 'saved-2', brand: 'Mastercard', last4: '8888', expiry: '03/25' }
  ];


  // Gift card recipient info
  const [giftRecipientName, setGiftRecipientName] = useState('');
  const [giftRecipientEmail, setGiftRecipientEmail] = useState('');
  const [giftFrom, setGiftFrom] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [giftDeliveryDate, setGiftDeliveryDate] = useState<Date | undefined>(new Date());
  
  // Location finder state
  const [addressSearch, setAddressSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [userCoordinates, setUserCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [showNearbyResults, setShowNearbyResults] = useState(false);
  
  // Pre-fill phone number from verification when reaching personal info
  useEffect(() => {
    if (phoneNumber && !authPhone) {
      setAuthPhone(phoneNumber);
    }
  }, [phoneNumber, authPhone]);


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

  // Haversine formula to calculate distance between two points
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Get nearby locations (top 3 that are not the current location, sorted by distance)
  const getNearbyLocations = () => {
    if (!locationsData) return [];
    
    const allLocations: any[] = [];
    Object.entries(locationsData as Record<string, any>).forEach(([state, cities]) => {
      Object.entries(cities as Record<string, any>).forEach(([city, locations]) => {
        allLocations.push(...(locations as any[]));
      });
    });
    
    // Find the selected location to get its coordinates
    const selectedLoc = allLocations.find(loc => loc.id === bookingState.selectedLocation?.id);
    const selectedLat = selectedLoc?.coordinates?.lat || selectedLoc?.coordinates?.latitude;
    const selectedLng = selectedLoc?.coordinates?.lng || selectedLoc?.coordinates?.longitude;
    
    // Filter out current location and add distance
    const locationsWithDistance = allLocations
      .filter(loc => loc.id !== bookingState.selectedLocation?.id)
      .map(loc => {
        const lat = loc.coordinates?.lat || loc.coordinates?.latitude;
        const lng = loc.coordinates?.lng || loc.coordinates?.longitude;
        let distance: number | null = null;
        if (selectedLat && selectedLng && lat && lng) {
          distance = calculateDistance(selectedLat, selectedLng, lat, lng);
        }
        return { ...loc, distance };
      })
      .sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    
    return locationsWithDistance.slice(0, 3);
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

  // Geocode address using Nominatim (OpenStreetMap)
  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=us&limit=1`,
        {
          headers: {
            'User-Agent': 'GlowbarBookingWidget/1.0'
          }
        }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  // Handle address search
  const handleAddressSearch = async () => {
    if (!addressSearch.trim()) return;
    
    setIsSearching(true);
    const coords = await geocodeAddress(addressSearch);
    setIsSearching(false);
    
    if (coords) {
      setUserCoordinates(coords);
      setShowNearbyResults(true);
      setExpandedState(null); // Collapse state list when showing nearby results
      
      // Zoom map to user's location
      if (mapRef.current) {
        mapRef.current.setView([coords.lat, coords.lng], 10);
      }
    } else {
      toast({
        title: "Address not found",
        description: "Please try a different address or city name.",
        variant: "destructive"
      });
    }
  };

  // Get locations sorted by distance from user
  const getLocationsSortedByDistance = () => {
    if (!userCoordinates || !locationsData) return [];
    
    const allLocations: any[] = [];
    Object.entries(locationsData as Record<string, any>).forEach(([state, cities]) => {
      Object.entries(cities as Record<string, any>).forEach(([city, locations]) => {
        allLocations.push(...(locations as any[]));
      });
    });
    
    return allLocations
      .map(location => {
        const lat = location.coordinates?.lat || location.coordinates?.latitude;
        const lng = location.coordinates?.lng || location.coordinates?.longitude;
        const distance = lat && lng 
          ? calculateDistance(userCoordinates.lat, userCoordinates.lng, lat, lng)
          : Infinity;
        return { ...location, distance };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10); // Show top 10 nearest locations
  };

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
        <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-300"
            style={{ 
              backgroundColor: '#FF502D',
              width: bookingState.step === 'location' ? '0%' 
                   : bookingState.step === 'phone-verification' || bookingState.step === 'otp' || bookingState.step === 'customer-type' || bookingState.step === 'login' ? '20%'
                   : bookingState.step === 'product' ? '40%'
                   : bookingState.step === 'gift-recipient' ? '50%'
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
          setBookingState(prev => ({ ...prev, step: 'personal-info' }));
        } else if (bookingState.userFlow === 'non-member' || bookingState.userFlow === 'member') {
          setBookingState(prev => ({ ...prev, step: 'otp' }));
        } else if (bookingState.customerType === 'new') {
          setBookingState(prev => ({ ...prev, step: 'customer-type' }));
        } else {
          setBookingState(prev => ({ ...prev, step: 'login' }));
        }
        break;
      case 'personal-info':
        setBookingState(prev => ({ ...prev, step: 'phone-verification' }));
        break;
      case 'datetime':
        setBookingState(prev => ({ ...prev, step: 'product' }));
        break;
      case 'gift-recipient':
        setBookingState(prev => ({ ...prev, step: 'product' }));
        break;
      case 'checkout':
        // Check if this is a purchase-only flow (no appointment)
        const isMembership = bookingState.selectedProduct?.id.startsWith('membership-');
        const isPackage = bookingState.selectedProduct?.id.startsWith('package-');
        const isGiftCard = bookingState.selectedProduct?.id.startsWith('giftcard-');
        const isPurchaseOnly = isMembership || isPackage || isGiftCard;
        
        if (isGiftCard) {
          // For gift cards, go back to recipient info
          setBookingState(prev => ({ ...prev, step: 'gift-recipient' }));
        } else if (isPurchaseOnly) {
          // For other purchases, go back to product selection
          setBookingState(prev => ({ ...prev, step: 'product' }));
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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={() => setBookingState({ step: 'phone-verification' })} className="cursor-pointer" data-testid="button-logo"><img src={glowbarLogoPath} alt="Glowbar" className="h-8" /></button>
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>
        <ProgressBar />
        {/* Main Content */}
        <div className="flex-1 flex gap-8 px-6 py-8 max-h-[calc(100vh-180px)]">
          {/* Left side - Location finder and grouped locations - SCROLLABLE */}
          <div className="w-1/2 overflow-y-auto space-y-4 pr-4">
            {/* Location Finder Search */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
              <Label htmlFor="address-search" className="text-base font-semibold mb-2 block">
                Find studios near you
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="address-search"
                    value={addressSearch}
                    onChange={(e) => setAddressSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                    placeholder="Enter your address, city, or zip code"
                    className="pl-10"
                    data-testid="input-address-search"
                  />
                </div>
                <Button
                  onClick={handleAddressSearch}
                  disabled={isSearching || !addressSearch.trim()}
                  className="text-white hover:opacity-90" style={{ backgroundColor: "#000000" }}
                  data-testid="button-search-address"
                >
                  {isSearching ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    </span>
                  ) : (
                    <Navigation className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {showNearbyResults && userCoordinates && (
                <button
                  onClick={() => {
                    setShowNearbyResults(false);
                    setUserCoordinates(null);
                    setAddressSearch('');
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 mt-2 underline"
                  data-testid="button-clear-search"
                >
                  Clear search and browse by state
                </button>
              )}
            </div>

            {/* Nearby Results (when search is active) */}
            {showNearbyResults && userCoordinates ? (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="w-5 h-5" style={{ color: '#FF502D' }} />
                  Studios near you
                </h3>
                {getLocationsSortedByDistance().map((location: any) => (
                  <div key={location.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-4">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-semibold">{location.name}</h3>
                        <span className="text-sm font-medium px-2 py-1 bg-gray-100 rounded" style={{ color: '#FF502D' }}>
                          {location.distance < 1 
                            ? `${(location.distance * 5280).toFixed(0)} ft` 
                            : `${location.distance.toFixed(1)} mi`}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        {location.address?.line1}, {location.address?.city}, {location.address?.state}
                      </p>
                      {location.subtext && (
                        <p className="text-xs text-[#FF502D] font-medium mb-3">
                          {location.subtext}
                        </p>
                      )}
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
                        className="w-full text-white hover:opacity-90"
                        style={{ backgroundColor: '#FF502D' }}
                        data-testid={`button-select-studio-nearby-${location.id}`}
                      >
                        SELECT STUDIO
                      </Button>
                  </div>
                ))}
              </div>
            ) : (
              /* State-based list */
              (<div className="space-y-2">
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
                          {locations.map((location: any) => {
                            // Calculate distance if user has searched
                            let distanceDisplay = null;
                            if (userCoordinates) {
                              const lat = location.coordinates?.lat || location.coordinates?.latitude;
                              const lng = location.coordinates?.lng || location.coordinates?.longitude;
                              if (lat && lng) {
                                const dist = calculateDistance(userCoordinates.lat, userCoordinates.lng, lat, lng);
                                distanceDisplay = dist < 1 
                                  ? `${(dist * 5280).toFixed(0)} ft` 
                                  : `${dist.toFixed(1)} mi`;
                              }
                            }
                            
                            return (
                              <div key={location.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-4">
                                  <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-semibold">{location.name}</h3>
                                    {distanceDisplay && (
                                      <span className="text-sm font-medium px-2 py-1 bg-gray-100 rounded" style={{ color: '#FF502D' }}>
                                        {distanceDisplay}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 mb-1">
                                    {location.address?.line1}, {location.address?.city}, {location.address?.state}
                                  </p>
                                  {location.subtext && (
                                    <p className="text-xs text-[#FF502D] font-medium mb-3">
                                      {location.subtext}
                                    </p>
                                  )}
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
                                    className="w-full text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                                    data-testid={`button-select-studio-${location.id}`}
                                  >
                                    SELECT STUDIO
                                  </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>)
            )}
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
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* User location marker */}
                {userCoordinates && (
                  <Marker
                    position={[userCoordinates.lat, userCoordinates.lng]}
                    icon={userLocationIcon}
                  >
                    <Popup>
                      <div style={{ padding: '4px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontWeight: 'bold', color: '#FF502D' }}>Your Location</p>
                      </div>
                    </Popup>
                  </Marker>
                )}
                {allLocations.map((location: any, index: number) => {
                  const lat = location.coordinates?.lat || location.coordinates?.latitude;
                  const lng = location.coordinates?.lng || location.coordinates?.longitude;
                  
                  // Calculate distance if user has searched
                  let distanceText = '';
                  if (userCoordinates && lat && lng) {
                    const dist = calculateDistance(userCoordinates.lat, userCoordinates.lng, lat, lng);
                    distanceText = dist < 1 
                      ? `${(dist * 5280).toFixed(0)} ft away` 
                      : `${dist.toFixed(1)} mi away`;
                  }
                  
                  if (lat && lng) {
                    return (
                      <Marker
                        key={location.id || index}
                        position={[lat, lng]}
                        icon={blackIcon}
                      >
                        <Popup closeButton={true} className="custom-popup">
                          <div style={{ padding: '12px 16px', minWidth: '200px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
                              {location.name}
                            </h3>
                            {distanceText && (
                              <p style={{ margin: '0 0 8px 0', color: '#FF502D', fontSize: '13px', fontWeight: '600' }}>
                                {distanceText}
                              </p>
                            )}
                            <p style={{ margin: '0 0 2px 0', color: '#333', fontSize: '12px' }}>
                              {location.address?.line1}
                            </p>
                            <p style={{ margin: '0 0 12px 0', color: '#333', fontSize: '12px' }}>
                              {location.address?.city}, {location.address?.state} {location.address?.zip || ''}
                            </p>
                            {location.subtext && (
                              <p style={{ margin: '-8px 0 12px 0', color: '#FF502D', fontSize: '11px', fontWeight: '500' }}>
                                {location.subtext}
                              </p>
                            )}
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
                                padding: '10px',
                                backgroundColor: '#FF502D',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '0',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#E5452A'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#FF502D'}
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
        // All 1's - Lead flow (0 visits, first-time non-member)
        setBookingState(prev => ({
          ...prev,
          userFlow: 'lead',
          userPhone: phoneNumber,
          customerType: 'new',
          isMember: false,
          visitCount: 0,
          step: 'personal-info'
        }));
      } else if (/^2+$/.test(cleanPhone)) {
        // All 2's - Non-member flow (1+ visits, returning non-member)
        setBookingState(prev => ({
          ...prev,
          userFlow: 'non-member',
          userPhone: phoneNumber,
          customerType: 'returning',
          isMember: false,
          visitCount: 5,
          step: 'otp'
        }));
      } else if (/^3+$/.test(cleanPhone)) {
        // All 3's - Member flow (1+ visits, returning member)
        setBookingState(prev => ({
          ...prev,
          userFlow: 'member',
          userPhone: phoneNumber,
          customerType: 'returning',
          isMember: true,
          visitCount: 3,
          step: 'otp'
        }));
      } else if (/^4+$/.test(cleanPhone)) {
        // All 4's - First-time member flow (0 visits, new member)
        setBookingState(prev => ({
          ...prev,
          userFlow: 'member',
          userPhone: phoneNumber,
          customerType: 'new',
          isMember: true,
          visitCount: 0,
          step: 'otp'
        }));
      } else {
        toast({
          title: "Invalid Phone Number",
          description: "Please enter a valid phone number (all 1's, 2's, 3's, or 4's for testing)",
          variant: "destructive"
        });
      }
    };

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={() => setBookingState({ step: 'phone-verification' })} className="cursor-pointer" data-testid="button-logo"><img src={glowbarLogoPath} alt="Glowbar" className="h-8" /></button>
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        
        {/* Selected Studio Display */}
        {bookingState.selectedLocation && (
          <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
            <button
              onClick={() => setBookingState(prev => ({ ...prev, step: 'location' }))}
              className="flex items-center gap-2 text-gray-700 hover:text-black transition-colors"
              data-testid="button-change-studio"
            >
              <MapPin className="w-4 h-4" />
              <span className="font-medium">{bookingState.selectedLocation.name}</span>
              <span className="text-gray-500">•</span>
              <span className="text-sm">{bookingState.selectedLocation.city}, {bookingState.selectedLocation.state}</span>
              <span className="text-xs ml-2" style={{ color: '#FF502D' }}>Change</span>
            </button>
          </div>
        )}

        <div className="flex-1 grid md:grid-cols-2">
          {/* Image Section */}
          <div className="hidden md:block relative">
            <img 
              src={facialTreatmentImage} 
              alt="Facial treatment at Glowbar" 
              className="absolute inset-0 w-full h-full object-cover"
              data-testid="img-treatment"
            />
          </div>

          {/* Form Section */}
          <div className="flex items-center justify-center px-6 py-8">
            <div className="w-full max-w-md">
              <button
                onClick={handleBack}
                className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
                data-testid="button-back"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                Back
              </button>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-2xl font-bold mb-2">Enter your phone number</h2>
                <p className="text-gray-600 mb-6">We'll use this to verify your account</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex gap-2">
                      <div className="flex items-center justify-center px-3 bg-gray-100 border border-gray-200 rounded-md text-sm text-gray-600 font-medium">
                        +1
                      </div>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(555) 555-5555"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="flex-1"
                        data-testid="input-phone"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handlePhoneSubmit}
                    className="w-full text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                    disabled={!phoneNumber}
                    data-testid="button-submit-phone"
                  >
                    Continue
                  </Button>
                  
                  <p className="text-xs text-gray-400 text-center">
                    Do you have an international number?{' '}
                    <a 
                      href="https://glowbar.com/pages/locations" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:opacity-80"
                      style={{ color: '#FF502D' }}
                      data-testid="link-locations"
                    >
                      Call the studio
                    </a>{' '}
                    for assistance.
                  </p>
                </div>
              </div>
            </div>
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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={() => setBookingState({ step: 'phone-verification' })} className="cursor-pointer" data-testid="button-logo"><img src={glowbarLogoPath} alt="Glowbar" className="h-8" /></button>
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        
        {/* Selected Studio Display */}
        {bookingState.selectedLocation && (
          <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
            <button
              onClick={() => setBookingState(prev => ({ ...prev, step: 'location' }))}
              className="flex items-center gap-2 text-gray-700 hover:text-black transition-colors"
              data-testid="button-change-studio"
            >
              <MapPin className="w-4 h-4" />
              <span className="font-medium">{bookingState.selectedLocation.name}</span>
              <span className="text-gray-500">•</span>
              <span className="text-sm">{bookingState.selectedLocation.city}, {bookingState.selectedLocation.state}</span>
              <span className="text-xs ml-2" style={{ color: '#FF502D' }}>Change</span>
            </button>
          </div>
        )}

        <div className="flex-1 grid md:grid-cols-2">
          {/* Image Section */}
          <div className="hidden md:block relative">
            <img 
              src={facialTreatmentImage} 
              alt="Facial treatment at Glowbar" 
              className="absolute inset-0 w-full h-full object-cover"
              data-testid="img-treatment"
            />
          </div>

          {/* Form Section */}
          <div className="flex items-center justify-center px-6 py-8">
            <div className="w-full max-w-md">
              <button
                onClick={handleBack}
                className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
                data-testid="button-back"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                Back
              </button>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-2xl font-bold mb-2">Verify your phone number</h2>
                <p className="text-gray-600 mb-6">We've sent a code to {bookingState.userPhone}</p>
                <div className="space-y-4">
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
                  </div>

                  <Button
                    onClick={handleOtpSubmit}
                    className="w-full text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                    disabled={!otpCode}
                    data-testid="button-submit-otp"
                  >
                    Verify & Continue
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Customer Type Selection
  if (bookingState.step === 'customer-type') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={() => setBookingState({ step: 'phone-verification' })} className="cursor-pointer" data-testid="button-logo"><img src={glowbarLogoPath} alt="Glowbar" className="h-8" /></button>
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
                className="w-full p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-gray-300 transition-colors text-left group"
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
                className="w-full p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-gray-300 transition-colors text-left group"
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

            <div className="relative rounded-2xl overflow-hidden bg-gray-100 h-[600px] shadow-sm">
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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={() => setBookingState({ step: 'phone-verification' })} className="cursor-pointer" data-testid="button-logo"><img src={glowbarLogoPath} alt="Glowbar" className="h-8" /></button>
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        
        {/* Selected Studio Display */}
        {bookingState.selectedLocation && (
          <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
            <button
              onClick={() => setBookingState(prev => ({ ...prev, step: 'location' }))}
              className="flex items-center gap-2 text-gray-700 hover:text-black transition-colors"
              data-testid="button-change-studio"
            >
              <MapPin className="w-4 h-4" />
              <span className="font-medium">{bookingState.selectedLocation.name}</span>
              <span className="text-gray-500">•</span>
              <span className="text-sm">{bookingState.selectedLocation.city}, {bookingState.selectedLocation.state}</span>
              <span className="text-xs ml-2" style={{ color: '#FF502D' }}>Change</span>
            </button>
          </div>
        )}

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

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
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
                className="w-full h-12 mt-6 text-white hover:opacity-90"
                style={{ backgroundColor: '#FF502D' }}
                disabled={!loginEmail || !loginPassword}
                data-testid="button-login"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
    );
  }

  // Step 3: Product Selection (replaces old 'service' step)  
  if (bookingState.step === 'product') {
    const handleProductSelect = (product: any) => {
      // Check if this is a membership, package, or gift card - skip confirmation and go to checkout
      const isMembership = product.id.startsWith('membership-');
      const isPackage = product.id.startsWith('package-');
      const isGiftCard = product.id.startsWith('giftcard-');
      
      if (isGiftCard) {
        // For gift cards, go to recipient info page
        setBookingState(prev => ({ 
          ...prev, 
          selectedProduct: product,
          step: 'gift-recipient'
        }));
      } else if (isMembership || isPackage) {
        // Go directly to checkout for memberships and packages
        setBookingState(prev => ({ 
          ...prev, 
          selectedProduct: product,
          step: 'checkout'
        }));
      } else {
        // For treatments, show the confirmation dialog
        setPendingProduct(product);
        setConfirmAccutane(false);
        setConfirmInjections(false);
        setConfirmWaxing(false);
        setIsConfirmationDialogOpen(true);
      }
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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={() => setBookingState({ step: 'phone-verification' })} className="cursor-pointer" data-testid="button-logo"><img src={glowbarLogoPath} alt="Glowbar" className="h-8" /></button>
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>
        <ProgressBar />
        {/* Selected Studio Display */}
        {bookingState.selectedLocation && (
          <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
            <button
              onClick={() => setBookingState(prev => ({ ...prev, step: 'location' }))}
              className="flex items-center gap-2 text-gray-700 hover:text-black transition-colors"
              data-testid="button-change-studio"
            >
              <MapPin className="w-4 h-4" />
              <span className="font-medium">{bookingState.selectedLocation.name}</span>
              <span className="text-gray-500">•</span>
              <span className="text-sm">{bookingState.selectedLocation.city}, {bookingState.selectedLocation.state}</span>
              <span className="text-xs ml-2" style={{ color: '#FF502D' }}>Change</span>
            </button>
          </div>
        )}
        {/* Main Content */}
        <div className="flex-1 flex gap-8 px-6 py-8 max-h-[calc(100vh-180px)]">
          {/* Left side - Services - SCROLLABLE */}
          <div className="w-1/2 overflow-y-auto space-y-2 pr-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="mb-6"
              data-testid="button-back"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {(bookingState.userFlow === 'non-member' || bookingState.userFlow === 'member') && (
              <div className="mb-2">
                <p className="text-xl text-gray-600" data-testid="text-welcome">Welcome Back, Test User!</p>
                {bookingState.userFlow === 'non-member' && (
                  <p className="text-base text-gray-600" data-testid="text-credits-status">
                    You have <span style={{ fontWeight: '600', color: '#FF502D' }}>5 vouchers</span>.
                  </p>
                )}
                {bookingState.userFlow === 'member' && (
                  <p className="text-base text-gray-600" data-testid="text-membership-status">
                    Your membership is <span style={{ color: '#FF502D', fontWeight: '600' }}>Active</span>. You have <span style={{ fontWeight: '600', color: '#FF502D' }}>1 voucher</span> available.
                  </p>
                )}
              </div>
            )}
            <h1 className="text-2xl font-bold mb-4" data-testid="text-title">Select a service</h1>
            
            {/* Membership Promo Banner - only for leads and non-members */}
            {(bookingState.userFlow === 'lead' || bookingState.userFlow === 'non-member') && (
              <div 
                className="relative mb-6 shadow-sm"
                data-testid="banner-membership-promo"
                style={{ backgroundColor: '#FF502D' }}
              >
                <div className="flex items-center justify-center py-6">
                  <div className="text-center px-4">
                    <p className="font-bold text-base mb-0.5 text-white">Better as a member</p>
                    <p className="text-white text-xs mb-2">Sign up for the Glowbar Membership today and save $15/month</p>
                    <Button
                      onClick={() => {
                        const membershipAccordion = document.querySelector('[data-testid="accordion-membership"]') as HTMLElement;
                        if (membershipAccordion) {
                          membershipAccordion.click();
                          membershipAccordion.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      className="bg-white text-black px-5 py-1.5 text-sm hover:bg-gray-100"
                      data-testid="button-become-member"
                    >
                      Join now
                    </Button>
                  </div>
                </div>
              </div>
            )}
              
              <Accordion type="single" collapsible className="space-y-2">
              {/* Book a Treatment */}
              <AccordionItem value="treatment" className="border-b border-gray-200">
                <AccordionTrigger className="py-4 hover:no-underline hover:bg-gray-50 transition-colors" data-testid="accordion-treatment">
                  <span className="text-lg font-medium">Book a treatment</span>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
                    {/* Determine treatment options based on user flow and location */}
                    {(() => {
                      const isMurrayHill = bookingState.selectedLocation?.name === 'Murray Hill';
                      const isFirstTime = bookingState.userFlow === 'lead'; // 0 visits
                      const isReturningNonMember = bookingState.userFlow === 'non-member'; // 1+ visits, not member
                      const isMember = bookingState.userFlow === 'member';
                      
                      return (
                        <>
                          {/* NON-MEMBER: First Time Treatment (NOT Murray Hill) */}
                          {isFirstTime && !isMurrayHill && (
                            <>
                              <div className="pb-5 border-b border-gray-100">
                                <h3 className="text-base font-semibold mb-2">
                                  First Time Treatment <span className="text-gray-600 ml-2">30min</span>
                                </h3>
                                <p className="text-xl font-bold mb-1">$80.00</p>
                                <button 
                                  onClick={() => {
                                    const membershipAccordion = document.querySelector('[data-testid="accordion-membership"]') as HTMLElement;
                                    if (membershipAccordion) {
                                      membershipAccordion.click();
                                      membershipAccordion.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                  }}
                                  className="text-xs mb-3 underline cursor-pointer hover:opacity-80 text-left"
                                  style={{ color: '#FF502D' }}
                                  data-testid="link-become-member"
                                >
                                  Glowbar Members pay $65 - become a member and save $15/month
                                </button>
                                <Button
                                  onClick={() => handleProductSelect({ 
                                    id: 'first-time-treatment',
                                    name: 'First Time Treatment',
                                    price: 80,
                                    description: '30min facial'
                                  })}
                                  className="w-full h-11 text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                                  data-testid="button-select-first-time-treatment"
                                >
                                  Book your treatment
                                </Button>
                              </div>
                              <div>
                                <h3 className="text-base font-semibold mb-2">
                                  First Time Treatment: 17 and under <span className="text-gray-600 ml-2">30min</span>
                                </h3>
                                <p className="text-xs text-gray-600 mb-2">All clients under 17 will need to be accompanied by a parent or guardian at their first appointment to sign a waiver in-person.</p>
                                <p className="text-xl font-bold mb-1">$80.00</p>
                                <button 
                                  onClick={() => {
                                    const membershipAccordion = document.querySelector('[data-testid="accordion-membership"]') as HTMLElement;
                                    if (membershipAccordion) {
                                      membershipAccordion.click();
                                      membershipAccordion.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                  }}
                                  className="text-xs mb-3 underline cursor-pointer hover:opacity-80 text-left"
                                  style={{ color: '#FF502D' }}
                                  data-testid="link-become-member-minor"
                                >
                                  Glowbar Members pay $65 - become a member and save $15/month
                                </button>
                                <Button
                                  onClick={() => handleProductSelect({ 
                                    id: 'first-time-treatment-minor',
                                    name: 'First Time Treatment: 17 and under',
                                    price: 80,
                                    description: '30min facial'
                                  })}
                                  className="w-full h-11 text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                                  data-testid="button-select-first-time-treatment-minor"
                                >
                                  Book your treatment
                                </Button>
                              </div>
                            </>
                          )}

                          {/* NON-MEMBER: 40 Minute First Time Treatment (Murray Hill only) */}
                          {isFirstTime && isMurrayHill && (
                            <>
                              <div className="pb-5 border-b border-gray-100">
                                <h3 className="text-base font-semibold mb-2">
                                  40 Minute First-Time Treatment <span className="text-gray-600 ml-2">40min</span>
                                </h3>
                                <p className="text-xl font-bold mb-1">$80.00</p>
                                <button 
                                  onClick={() => {
                                    const membershipAccordion = document.querySelector('[data-testid="accordion-membership"]') as HTMLElement;
                                    if (membershipAccordion) {
                                      membershipAccordion.click();
                                      membershipAccordion.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                  }}
                                  className="text-xs mb-3 underline cursor-pointer hover:opacity-80 text-left"
                                  style={{ color: '#FF502D' }}
                                  data-testid="link-become-member"
                                >
                                  Glowbar Members pay $65 - become a member and save $15/month
                                </button>
                                <Button
                                  onClick={() => handleProductSelect({ 
                                    id: 'first-time-treatment-40min',
                                    name: '40 Minute First-Time Treatment',
                                    price: 80,
                                    description: '40min facial'
                                  })}
                                  className="w-full h-11 text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                                  data-testid="button-select-first-time-treatment-40min"
                                >
                                  Book your treatment
                                </Button>
                              </div>
                              <div>
                                <h3 className="text-base font-semibold mb-2">
                                  40 Minute First Time Treatment: 17 and Under <span className="text-gray-600 ml-2">40min</span>
                                </h3>
                                <p className="text-xs text-gray-600 mb-2">All clients under 17 will need to be accompanied by a parent or guardian at their first appointment to sign a waiver in-person.</p>
                                <p className="text-xl font-bold mb-1">$80.00</p>
                                <button 
                                  onClick={() => {
                                    const membershipAccordion = document.querySelector('[data-testid="accordion-membership"]') as HTMLElement;
                                    if (membershipAccordion) {
                                      membershipAccordion.click();
                                      membershipAccordion.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                  }}
                                  className="text-xs mb-3 underline cursor-pointer hover:opacity-80 text-left"
                                  style={{ color: '#FF502D' }}
                                  data-testid="link-become-member-minor-40min"
                                >
                                  Glowbar Members pay $65 - become a member and save $15/month
                                </button>
                                <Button
                                  onClick={() => handleProductSelect({ 
                                    id: 'first-time-treatment-40min-minor',
                                    name: '40 Minute First Time Treatment: 17 and Under',
                                    price: 80,
                                    description: '40min facial'
                                  })}
                                  className="w-full h-11 text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                                  data-testid="button-select-first-time-treatment-40min-minor"
                                >
                                  Book your treatment
                                </Button>
                              </div>
                            </>
                          )}

                          {/* NON-MEMBER: Returning Treatment (1+ visits) */}
                          {isReturningNonMember && (
                            <div>
                              <h3 className="text-base font-semibold mb-2">
                                Returning Treatment <span className="text-gray-600 ml-2">30min</span>
                              </h3>
                              <p className="text-xl font-bold mb-1">$80.00</p>
                              <button 
                                onClick={() => {
                                  const membershipAccordion = document.querySelector('[data-testid="accordion-membership"]') as HTMLElement;
                                  if (membershipAccordion) {
                                    membershipAccordion.click();
                                    membershipAccordion.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }
                                }}
                                className="text-xs mb-3 underline cursor-pointer hover:opacity-80 text-left"
                                style={{ color: '#FF502D' }}
                                data-testid="link-become-member"
                              >
                                Glowbar Members pay $65 - become a member and save $15/month
                              </button>
                              <Button
                                onClick={() => handleProductSelect({ 
                                  id: 'returning-treatment',
                                  name: 'Returning Treatment',
                                  price: 80,
                                  description: '30min facial'
                                })}
                                className="w-full h-11 text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                                data-testid="button-select-returning-treatment"
                              >
                                Book your treatment
                              </Button>
                            </div>
                          )}

                          {/* MEMBER: First Time & Returning Treatment */}
                          {isMember && (
                            <>
                              <div className={bookingState.visitCount === 0 ? "pb-5 border-b border-gray-100" : ""}>
                                <h3 className="text-base font-semibold mb-2">
                                  First Time & Returning Treatment <span className="text-gray-600 ml-2">30min</span>
                                </h3>
                                <p className="text-sm text-gray-600 mb-3">Use your membership voucher for this treatment</p>
                                <Button
                                  onClick={() => handleProductSelect({ 
                                    id: 'member-treatment',
                                    name: 'Member Treatment',
                                    price: 0,
                                    description: '30min facial'
                                  })}
                                  className="w-full h-11 text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                                  data-testid="button-select-member-treatment"
                                >
                                  Book your treatment
                                </Button>
                              </div>
                              {/* Only show 17 and under option for members with 0 visits */}
                              {bookingState.visitCount === 0 && (
                                <div>
                                  <h3 className="text-base font-semibold mb-2">
                                    First Time Treatment: 17 and under <span className="text-gray-600 ml-2">30min</span>
                                  </h3>
                                  <p className="text-xs text-gray-600 mb-2">All clients under 17 will need to be accompanied by a parent or guardian at their first appointment to sign a waiver in-person.</p>
                                  <p className="text-sm text-gray-600 mb-3">Use your membership voucher for this treatment</p>
                                  <Button
                                    onClick={() => handleProductSelect({ 
                                      id: 'member-treatment-minor',
                                      name: 'Member Treatment: 17 and under',
                                      price: 0,
                                      description: '30min facial'
                                    })}
                                    className="w-full h-11 text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                                    data-testid="button-select-member-treatment-minor"
                                  >
                                    Book your treatment
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Buy a Membership / Upgrade Membership */}
              <AccordionItem value="membership" className="border-b border-gray-200">
                <AccordionTrigger className="py-4 hover:no-underline hover:bg-gray-50 transition-colors" data-testid="accordion-membership">
                  <span className="text-lg font-medium">
                    {bookingState.userFlow === 'member' ? 'Upgrade your membership' : 'Buy a membership'}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
                    {/* Glowbar Membership $65 - only for non-members */}
                    {bookingState.userFlow !== 'member' && (
                      <div className="pb-5 border-b border-gray-100">
                          <h3 className="text-base font-semibold mb-2">Glowbar Membership ($65)</h3>
                          <p className="text-xs text-gray-700 mb-2">You'll receive the following:</p>
                          <ul className="text-xs text-gray-700 space-y-0.5 mb-2 list-disc list-inside">
                            <li>1 facial vouchers per month redeemable at any Glowbar studio for 3 months</li>
                            <li>15% off retail products (25% off products in-studio for all of November)</li>
                            <li>Additional facials priced at your membership rate</li>
                            <li>1 free guest pass per year</li>
                            <li>Access to our loyalty program</li>
                            <li>4 month minimum commitment</li>
                          </ul>
                          <p className="text-xl font-bold mb-3">$65.00</p>
                          <Button
                            onClick={() => handleProductSelect({ id: 'membership-65', name: 'Glowbar Membership', price: 65, description: 'Monthly membership' })}
                            className="w-full h-11 text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                            data-testid="button-select-membership-65"
                          >
                            Select
                          </Button>
                      </div>
                    )}

                    {/* Glowbar Membership+ $110 - shown for all, as upgrade option for members */}
                    <div>
                        <h3 className="text-base font-semibold mb-2">
                          {bookingState.userFlow === 'member' ? 'Glowbar Membership+' : 'Glowbar Membership+ ($110)'}
                        </h3>
                        <p className="text-xs text-gray-700 mb-2">You'll receive the following:</p>
                        <ul className="text-xs text-gray-700 space-y-0.5 mb-2 list-disc list-inside">
                          <li>2 facial vouchers per month redeemable at any Glowbar studio for 3 months</li>
                          <li>15% off retail products (25% off products in-studio for all of November)</li>
                          <li>1 free guest pass per year</li>
                          <li>Access to our loyalty program</li>
                          <li>4 month minimum commitment</li>
                        </ul>
                        <p className="text-xl font-bold mb-3">$110.00</p>
                        <Button
                          onClick={() => handleProductSelect({ id: 'membership-110', name: bookingState.userFlow === 'member' ? 'Glowbar Membership+' : 'Glowbar Membership+', price: 110, description: 'Monthly membership' })}
                          className="w-full h-11 text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                          data-testid="button-select-membership-110"
                        >
                          Select
                        </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Purchase a Package */}
              <AccordionItem value="package" className="border-b border-gray-200">
                <AccordionTrigger className="py-4 hover:no-underline hover:bg-gray-50 transition-colors" data-testid="accordion-package">
                  <span className="text-lg font-medium">Purchase a package</span>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
                    {/* 3 Facials */}
                    <div className="pb-5 border-b border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-base font-semibold">Three (3) Facials</h3>
                          <span className="text-xl font-bold">$228.00</span>
                        </div>
                        <p className="text-xs text-gray-700 mb-2">
                          Save 5% with a 3-pack of facials. All vouchers are available immediately and expire in 6 months. Non-transferrable.
                        </p>
                        <p className="text-sm font-medium text-gray-600 mb-3">$76 per facial</p>
                        <Button
                          onClick={() => handleProductSelect({ id: 'package-3', name: 'Three (3) Facials Package', price: 228, description: '3 facial package' })}
                          className="w-full h-11 text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                          data-testid="button-select-package-3"
                        >
                          Buy Now
                        </Button>
                    </div>

                    {/* 6 Facials */}
                    <div className="pb-5 border-b border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-base font-semibold">Six (6) Facials</h3>
                          <span className="text-xl font-bold">$432.00</span>
                        </div>
                        <p className="text-xs text-gray-700 mb-2">
                          Save 10% with a 6-pack of facials. All vouchers are available immediately and expire in 9 months. Non-transferrable.
                        </p>
                        <p className="text-sm font-medium text-gray-600 mb-3">$72 per facial</p>
                        <Button
                          onClick={() => handleProductSelect({ id: 'package-6', name: 'Six (6) Facials Package', price: 432, description: '6 facial package' })}
                          className="w-full h-11 text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                          data-testid="button-select-package-6"
                        >
                          Buy Now
                        </Button>
                    </div>

                    {/* 9 Facials */}
                    <div className="pb-5 border-b border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-base font-semibold">Nine (9) Facials</h3>
                          <span className="text-xl font-bold">$612.00</span>
                        </div>
                        <p className="text-xs text-gray-700 mb-2">
                          Save 15% with a 9-pack of facials. All vouchers are available immediately and expire in 12 months. Non-transferrable.
                        </p>
                        <p className="text-sm font-medium text-gray-600 mb-3">$68 per facial</p>
                        <Button
                          onClick={() => handleProductSelect({ id: 'package-9', name: 'Nine (9) Facials Package', price: 612, description: '9 facial package' })}
                          className="w-full h-11 text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                          data-testid="button-select-package-9"
                        >
                          Buy Now
                        </Button>
                    </div>

                    {/* 12 Facials */}
                    <div>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-base font-semibold">Twelve (12) Facials</h3>
                          <span className="text-xl font-bold">$780.00</span>
                        </div>
                        <p className="text-xs text-gray-700 mb-2">
                          Save 20% with a 12-pack of facials. All vouchers are available immediately and expire in 15 months. Non-transferrable.
                        </p>
                        <p className="text-sm font-medium text-gray-600 mb-3">$65 per facial</p>
                        <Button
                          onClick={() => handleProductSelect({ id: 'package-12', name: 'Twelve (12) Facials Package', price: 780, description: '12 facial package' })}
                          className="w-full h-11 text-white hover:opacity-90" style={{ backgroundColor: "#FF502D" }}
                          data-testid="button-select-package-12"
                        >
                          Buy Now
                        </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Purchase a Gift Card */}
              <AccordionItem value="giftcard" className="border-b border-gray-200">
                <AccordionTrigger className="py-4 hover:no-underline hover:bg-gray-50 transition-colors" data-testid="accordion-giftcard">
                  <span className="text-lg font-medium">Purchase a gift card</span>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <p className="text-sm text-gray-500 mb-4">Gift cards can't be used to pay for membership.</p>
                    <div className="space-y-3">
                      {[
                        { amount: 80, description: '1 facial' },
                        { amount: 100, description: '1 facial + gratuity' },
                        { amount: 160, description: '2 facials' },
                        { amount: 200, description: '2 facials + gratuity' },
                        { amount: 250, description: '3 facials + gratuity' },
                      ].map(({ amount, description }) => (
                        <button
                          key={amount}
                          onClick={() => handleProductSelect({ id: `giftcard-${amount}`, name: `Gift Card $${amount}`, price: amount, description })}
                          className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
                          data-testid={`button-giftcard-${amount}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-left">
                              <span className="text-lg font-medium">${amount}.00</span>
                              <p className="text-sm text-gray-500">{description}</p>
                            </div>
                          </div>
                          <div 
                            className="px-4 py-2 rounded-full text-sm font-semibold text-white transition-opacity opacity-0 group-hover:opacity-100"
                            style={{ backgroundColor: '#FF502D' }}
                          >
                            Buy now
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => handleProductSelect({ id: 'giftcard-custom', name: 'Custom Gift Card', price: 100, description: 'Custom amount gift card' })}
                        className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
                        data-testid="button-giftcard-custom"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">Custom</span>
                        </div>
                        <div 
                          className="px-4 py-2 rounded-full text-sm font-semibold text-white transition-opacity opacity-0 group-hover:opacity-100"
                          style={{ backgroundColor: '#FF502D' }}
                        >
                          Buy now
                        </div>
                      </button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Right side - Image - FIXED */}
          <div className="w-1/2 sticky top-8 self-start">
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 shadow-lg">
              <img 
                src={luxurySpaImage} 
                alt="Luxury spa facial treatment" 
                className="w-full h-full object-cover"
                data-testid="img-service"
              />
            </div>
          </div>
        </div>
        {/* Confirmation Dialog */}
        <Dialog open={isConfirmationDialogOpen} onOpenChange={setIsConfirmationDialogOpen}>
          <DialogContent className="sm:max-w-[450px]" data-testid="dialog-confirmation">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Please check the following boxes to confirm you have not:</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="confirm-accutane"
                  checked={confirmAccutane}
                  onCheckedChange={(checked) => setConfirmAccutane(checked as boolean)}
                  className="mt-0.5 h-5 w-5"
                  style={{ '--checkbox-checked-bg': '#FF502D', '--checkbox-checked-border': '#FF502D' } as any}
                  data-testid="checkbox-accutane"
                />
                <label
                  htmlFor="confirm-accutane"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  Taken Accutane in the last six (6) months
                </label>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="confirm-injections"
                  checked={confirmInjections}
                  onCheckedChange={(checked) => setConfirmInjections(checked as boolean)}
                  className="mt-0.5 h-5 w-5"
                  style={{ '--checkbox-checked-bg': '#FF502D', '--checkbox-checked-border': '#FF502D' } as any}
                  data-testid="checkbox-injections"
                />
                <label
                  htmlFor="confirm-injections"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  Received injections (Botox, fillers, etc.) or laser/electrolysis hair removal in the last two (2) weeks
                </label>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="confirm-waxing"
                  checked={confirmWaxing}
                  onCheckedChange={(checked) => setConfirmWaxing(checked as boolean)}
                  className="mt-0.5 h-5 w-5"
                  style={{ '--checkbox-checked-bg': '#FF502D', '--checkbox-checked-border': '#FF502D' } as any}
                  data-testid="checkbox-waxing"
                />
                <label
                  htmlFor="confirm-waxing"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  Received waxing or threading facial hair removal in the last three (3) days
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleConfirmationContinue}
                disabled={!confirmAccutane || !confirmInjections || !confirmWaxing}
                className="w-full h-10 text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#FF502D" }}
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

  // Step 3.5: Gift Card Recipient Information
  if (bookingState.step === 'gift-recipient') {
    const isValid = giftRecipientName && giftRecipientEmail && giftFrom && giftDeliveryDate;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={() => setBookingState({ step: 'phone-verification' })} className="cursor-pointer" data-testid="button-logo"><img src={glowbarLogoPath} alt="Glowbar" className="h-8" /></button>
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

            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Gift card recipient</h1>
                <p className="text-gray-600" data-testid="text-subtitle">
                  Who are you sending this gift card to?
                </p>
              </div>
              <div className="shrink-0">
                <img 
                  src={giftCardMockupPath} 
                  alt="Glowbar Gift Card" 
                  className="w-32 h-auto rounded-lg shadow-sm border border-gray-100"
                  data-testid="img-gift-card-mockup"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="recipientName">Recipient Name *</Label>
                  <Input
                    id="recipientName"
                    value={giftRecipientName}
                    onChange={(e) => setGiftRecipientName(e.target.value)}
                    placeholder="Enter recipient's name"
                    className="mt-2"
                    data-testid="input-recipient-name"
                  />
                </div>

                <div>
                  <Label htmlFor="recipientEmail">Recipient Email *</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    value={giftRecipientEmail}
                    onChange={(e) => setGiftRecipientEmail(e.target.value)}
                    placeholder="Enter recipient's email"
                    className="mt-2"
                    data-testid="input-recipient-email"
                  />
                </div>

                <div>
                  <Label htmlFor="giftFrom">From *</Label>
                  <Input
                    id="giftFrom"
                    value={giftFrom}
                    onChange={(e) => setGiftFrom(e.target.value)}
                    placeholder="Your name"
                    className="mt-2"
                    data-testid="input-gift-from"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="giftMessage">Personal Message (Optional)</Label>
                <textarea
                  id="giftMessage"
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  className="w-full mt-2 p-3 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={4}
                  placeholder="Add a special note..."
                  data-testid="textarea-gift-message"
                />
              </div>

              <div>
                <Label className="block mb-2">Delivery Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full h-12 justify-start text-left font-normal",
                        !giftDeliveryDate && "text-muted-foreground"
                      )}
                      data-testid="button-delivery-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {giftDeliveryDate ? format(giftDeliveryDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={giftDeliveryDate}
                      onSelect={setGiftDeliveryDate}
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="pt-4">
                <Button
                  onClick={() => setBookingState(prev => ({ ...prev, step: 'checkout' }))}
                  className="w-full h-12 text-base font-medium text-white hover:opacity-90"
                  style={{ backgroundColor: '#FF502D' }}
                  disabled={!isValid}
                  data-testid="button-continue"
                >
                  Continue to Checkout
                </Button>
              </div>
            </div>
          </div>
        </div>
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
        ...slot,
        time: format(new Date(slot.startTime), 'h:mm a'),
        hour: new Date(slot.startTime).getHours()
      }));
    };

    const allTimeSlots = generateTimeSlots();
    
    // Check if booking with credits or voucher (should hide discounted slots)
    const isUsingCreditsOrVoucher = bookingState.selectedProduct?.id === 'member-treatment' || 
                                     bookingState.selectedProduct?.id === 'returning-treatment-credits';
    
    // Filter time slots by selected esthetician and credits/voucher status
    let timeSlots = allTimeSlots;
    
    // If using credits or voucher, filter out discounted slots
    if (isUsingCreditsOrVoucher) {
      timeSlots = timeSlots.filter((slot: any) => !slot.isDiscounted);
    }
    
    if (esthetician !== 'any') {
      timeSlots = timeSlots.filter((slot: any) => 
        slot.staffVariantId === esthetician || slot.staffId === esthetician
      );
    }
    
    const hasAvailability = timeSlots.length > 0;

    // Group time slots by time of day
    const morningSlots = timeSlots.filter((slot: any) => slot.hour < 12);
    const afternoonSlots = timeSlots.filter((slot: any) => slot.hour >= 12 && slot.hour < 17);
    const eveningSlots = timeSlots.filter((slot: any) => slot.hour >= 17);

    const isValid = selectedDate && selectedTimeSlot;

    // Get selected esthetician name
    const selectedEstheticianName = esthetician === 'any' 
      ? 'Any Esthetician' 
      : staffData?.staff?.find((s) => s.id === esthetician)?.displayName || 'Selected Esthetician';

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={() => setBookingState({ step: 'phone-verification' })} className="cursor-pointer" data-testid="button-logo"><img src={glowbarLogoPath} alt="Glowbar" className="h-8" /></button>
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>
        <ProgressBar />
        {/* Hero Location & Esthetician Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-6 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Location Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFF0ED' }}>
                  <MapPin className="w-8 h-8" style={{ color: '#FF502D' }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{bookingState.selectedLocation?.name || 'Select Location'}</h2>
                  <p className="text-gray-600">{bookingState.selectedLocation?.city}, {bookingState.selectedLocation?.state}</p>
                  <button
                    onClick={() => setBookingState(prev => ({ ...prev, step: 'location' }))}
                    className="text-sm font-medium mt-1 hover:underline"
                    style={{ color: '#FF502D' }}
                    data-testid="button-change-studio"
                  >
                    Change Location
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="mb-6"
              data-testid="button-back"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left: Modern Calendar */}
              <div className="lg:col-span-5">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-8">
                  {(() => {
                    const today = new Date();
                    const monthStart = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth(), 1);
                    const monthName = format(monthStart, 'MMMM yyyy');
                    const firstDayOfWeek = monthStart.getDay();
                    const paddingDays = Array(firstDayOfWeek).fill(null);
                    const daysInMonth = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 0).getDate();
                    const totalCellsUsed = firstDayOfWeek + daysInMonth;
                    const trailingDays = totalCellsUsed % 7 === 0 ? 0 : 7 - (totalCellsUsed % 7);
                    
                    return (
                      <div>
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between mb-6">
                          <button
                            onClick={() => {
                              const newMonth = new Date(currentCalendarMonth);
                              newMonth.setMonth(newMonth.getMonth() - 1);
                              setCurrentCalendarMonth(newMonth);
                            }}
                            disabled={currentCalendarMonth.getMonth() === new Date().getMonth() && currentCalendarMonth.getFullYear() === new Date().getFullYear()}
                            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            data-testid="button-prev-month"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <h3 className="text-xl font-bold text-gray-900">{monthName}</h3>
                          <button
                            onClick={() => {
                              const newMonth = new Date(currentCalendarMonth);
                              newMonth.setMonth(newMonth.getMonth() + 1);
                              setCurrentCalendarMonth(newMonth);
                            }}
                            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                            data-testid="button-next-month"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                        
                        {/* Day labels */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                            <div key={idx} className="text-center text-xs font-semibold text-gray-400 py-2">
                              {day}
                            </div>
                          ))}
                        </div>
                        
                        {/* Calendar grid */}
                        <div className="grid grid-cols-7 gap-1">
                          {/* Padding cells */}
                          {paddingDays.map((_, idx) => (
                            <div key={`padding-${idx}`} className="aspect-square"></div>
                          ))}
                          
                          {/* Actual days */}
                          {Array.from({ length: daysInMonth }, (_, i) => {
                            const day = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth(), i + 1);
                            const isPast = day < today && format(day, 'yyyy-MM-dd') !== format(today, 'yyyy-MM-dd');
                            const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
                            const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                            
                            if (isPast) {
                              return (
                                <div key={i} className="aspect-square flex items-center justify-center text-gray-300 text-sm">
                                  {i + 1}
                                </div>
                              );
                            }
                            
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  setSelectedDate(day);
                                  setSelectedTimeSlot(undefined);
                                }}
                                className={`aspect-square flex items-center justify-center rounded-full text-sm font-medium transition-all ${
                                  isSelected
                                    ? 'text-white shadow-lg scale-110'
                                    : isToday
                                    ? 'ring-2 ring-offset-2 hover:bg-gray-100'
                                    : 'hover:bg-gray-100'
                                }`}
                                style={isSelected ? { backgroundColor: '#FF502D' } : isToday ? { '--tw-ring-color': '#FF502D' } as any : {}}
                                data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                              >
                                {i + 1}
                              </button>
                            );
                          })}
                          
                          {/* Trailing days from next month */}
                          {Array.from({ length: trailingDays }, (_, i) => {
                            const nextMonthDay = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, i + 1);
                            const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(nextMonthDay, 'yyyy-MM-dd');
                            
                            return (
                              <button
                                key={`next-${i}`}
                                onClick={() => {
                                  setSelectedDate(nextMonthDay);
                                  setSelectedTimeSlot(undefined);
                                }}
                                className={`aspect-square flex items-center justify-center rounded-full text-sm font-medium transition-all ${
                                  isSelected
                                    ? 'text-white shadow-lg scale-110'
                                    : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'
                                }`}
                                style={isSelected ? { backgroundColor: '#FF502D' } : {}}
                                data-testid={`calendar-day-${format(nextMonthDay, 'yyyy-MM-dd')}`}
                              >
                                {i + 1}
                              </button>
                            );
                          })}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF502D' }}></div>
                            <span className="text-xs text-gray-500">Selected</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#FF502D' }}></div>
                            <span className="text-xs text-gray-500">Today</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Right: Time Slots */}
              <div className="lg:col-span-7 space-y-6">
                {/* Selected Date Display with Esthetician Filter */}
                {selectedDate && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {format(selectedDate, 'EEEE, MMMM d')}
                        </h3>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-500">
                            {hasAvailability ? `${timeSlots.length} time slots available` : 'No availability'}
                          </p>
                          {hasAvailability && timeSlots.length <= 10 && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600 animate-pulse">
                              Limited spots left
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FFF0ED' }}>
                          <User className="w-4 h-4" style={{ color: '#FF502D' }} />
                        </div>
                        <div className="min-w-[160px]">
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Esthetician</p>
                          <Select value={esthetician} onValueChange={setEsthetician}>
                            <SelectTrigger className="border-0 bg-transparent p-0 h-auto text-sm font-semibold focus:ring-0" data-testid="select-esthetician">
                              <SelectValue placeholder="Any esthetician" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any Esthetician</SelectItem>
                              {staffData?.staff?.map((staff) => (
                                <SelectItem key={staff.id} value={staff.id}>
                                  {staff.displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Time Slots by Period */}
                {!selectedDate ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Date</h3>
                    <p className="text-gray-500">Choose a date from the calendar to see available times</p>
                  </div>
                ) : availabilityLoading ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <div className="animate-spin w-8 h-8 border-3 border-gray-200 rounded-full mx-auto mb-4" style={{ borderTopColor: '#FF502D' }}></div>
                    <p className="text-gray-500">Loading available times...</p>
                  </div>
                ) : hasAvailability ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                    {/* Morning Slots */}
                    {morningSlots.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <h4 className="font-semibold text-gray-900">Morning</h4>
                          <span className="text-xs text-gray-400">Before 12 PM</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {morningSlots.map((slot: any) => (
                            <button
                              key={slot.id}
                              onClick={() => setSelectedTimeSlot(slot)}
                              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                selectedTimeSlot?.id === slot.id
                                  ? 'text-white shadow-lg'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                              style={selectedTimeSlot?.id === slot.id ? { backgroundColor: '#FF502D' } : {}}
                              data-testid={`button-time-${slot.time.replace(/[:\s]/g, '-')}`}
                            >
                              {slot.time}
                              {slot.isDiscounted && (
                                <span className="ml-1.5 text-xs" style={{ color: selectedTimeSlot?.id === slot.id ? '#FFD4CC' : '#FF502D' }}>
                                  $10 OFF
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Afternoon Slots */}
                    {afternoonSlots.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <h4 className="font-semibold text-gray-900">Afternoon</h4>
                          <span className="text-xs text-gray-400">12 PM - 5 PM</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {afternoonSlots.map((slot: any) => (
                            <button
                              key={slot.id}
                              onClick={() => setSelectedTimeSlot(slot)}
                              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                selectedTimeSlot?.id === slot.id
                                  ? 'text-white shadow-lg'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                              style={selectedTimeSlot?.id === slot.id ? { backgroundColor: '#FF502D' } : {}}
                              data-testid={`button-time-${slot.time.replace(/[:\s]/g, '-')}`}
                            >
                              {slot.time}
                              {slot.isDiscounted && (
                                <span className="ml-1.5 text-xs" style={{ color: selectedTimeSlot?.id === slot.id ? '#FFD4CC' : '#FF502D' }}>
                                  $10 OFF
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evening Slots */}
                    {eveningSlots.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <h4 className="font-semibold text-gray-900">Evening</h4>
                          <span className="text-xs text-gray-400">After 5 PM</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {eveningSlots.map((slot: any) => (
                            <button
                              key={slot.id}
                              onClick={() => setSelectedTimeSlot(slot)}
                              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                selectedTimeSlot?.id === slot.id
                                  ? 'text-white shadow-lg'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                              style={selectedTimeSlot?.id === slot.id ? { backgroundColor: '#FF502D' } : {}}
                              data-testid={`button-time-${slot.time.replace(/[:\s]/g, '-')}`}
                            >
                              {slot.time}
                              {slot.isDiscounted && (
                                <span className="ml-1.5 text-xs" style={{ color: selectedTimeSlot?.id === slot.id ? '#FFD4CC' : '#FF502D' }}>
                                  $10 OFF
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <X className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Availability</h3>
                    <p className="text-gray-500">Try selecting a different date or changing your esthetician preference</p>
                  </div>
                )}
              </div>
            </div>

            {/* Nearby Studios - Full Width Side by Side */}
            {selectedDate && nearbyLocations.length >= 2 && (
              <div className="mt-6">
                <div className="mb-4">
                  <h4 className="font-bold text-gray-900 text-lg">More times at nearby studios with any estheticians</h4>
                  <p className="text-sm text-gray-500">for {format(selectedDate, 'EEEE, MMMM d')}</p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {nearbyLocations.slice(0, 2).map((location, idx) => {
                    const availabilityQuery = idx === 0 ? nearbyAvailability1 : nearbyAvailability2;
                    let nearbySlots = availabilityQuery.data?.availableSlots?.map((slot: any) => ({
                      ...slot,
                      time: format(new Date(slot.startTime), 'h:mm a')
                    })) || [];
                    
                    if (isUsingCreditsOrVoucher) {
                      nearbySlots = nearbySlots.filter((slot: any) => !slot.isDiscounted);
                    }
                    
                    return (
                      <div key={location.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <div className="mb-3">
                          <h5 className="font-semibold text-gray-900">{location.name}</h5>
                        </div>
                        {availabilityQuery.isLoading ? (
                          <p className="text-sm text-gray-400">Loading times...</p>
                        ) : nearbySlots.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {nearbySlots.slice(0, 4).map((slot: any) => (
                              <button
                                key={slot.id}
                                onClick={() => {
                                  setBookingState(prev => ({
                                    ...prev,
                                    selectedLocation: {
                                      id: location.id,
                                      name: location.name,
                                      city: location.address?.city || '',
                                      state: location.address?.state || ''
                                    },
                                    selectedTime: slot,
                                    selectedDate: selectedDate
                                  }));
                                  setSelectedTimeSlot(slot);
                                }}
                                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-100 transition-colors"
                                data-testid={`nearby-time-${location.id}-${slot.time.replace(/[:\s]/g, '-')}`}
                              >
                                {slot.time}
                              </button>
                            ))}
                            {nearbySlots.length > 4 && (
                              <span 
                                onClick={() => {
                                  setBookingState(prev => ({
                                    ...prev,
                                    selectedLocation: {
                                      id: location.id,
                                      name: location.name,
                                      city: location.address?.city || '',
                                      state: location.address?.state || ''
                                    }
                                  }));
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="text-sm text-gray-400 self-center underline cursor-pointer hover:text-gray-600"
                              >
                                view more
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">No availability</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Continue Button */}
            {isValid && (
              <Button
                onClick={() => {
                  setBookingState(prev => ({
                    ...prev,
                    selectedDate: selectedDate,
                    selectedTime: selectedTimeSlot,
                    step: 'checkout'
                  }));
                }}
                className="w-full h-14 text-base font-semibold text-white hover:opacity-90 shadow-lg mt-6" 
                style={{ backgroundColor: "#FF502D" }}
                data-testid="button-continue"
              >
                Continue to payment
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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={() => setBookingState({ step: 'phone-verification' })} className="cursor-pointer" data-testid="button-logo"><img src={glowbarLogoPath} alt="Glowbar" className="h-8" /></button>
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        
        {/* Selected Studio Display */}
        {bookingState.selectedLocation && (
          <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
            <button
              onClick={() => setBookingState(prev => ({ ...prev, step: 'location' }))}
              className="flex items-center gap-2 text-gray-700 hover:text-black transition-colors"
              data-testid="button-change-studio"
            >
              <MapPin className="w-4 h-4" />
              <span className="font-medium">{bookingState.selectedLocation.name}</span>
              <span className="text-gray-500">•</span>
              <span className="text-sm">{bookingState.selectedLocation.city}, {bookingState.selectedLocation.state}</span>
              <span className="text-xs ml-2" style={{ color: '#FF502D' }}>Change</span>
            </button>
          </div>
        )}

        <div className="flex-1 flex">
          {/* Left Side: Form */}
          <div className="w-1/2 overflow-y-auto px-6 py-8">
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
              <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Personal information</h1>
              <p className="text-gray-600">Please provide your contact information</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
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

                {/* Email opt-in for leads */}
                {bookingState.userFlow === 'lead' && (
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                    <Checkbox
                      id="email-optin"
                      checked={emailOptIn}
                      onCheckedChange={(checked) => setEmailOptIn(checked as boolean)}
                      className="mt-0.5 h-5 w-5"
                      style={{ '--checkbox-checked-bg': '#FF502D', '--checkbox-checked-border': '#FF502D' } as any}
                      data-testid="checkbox-email-optin"
                    />
                    <label
                      htmlFor="email-optin"
                      className="text-sm text-gray-600 leading-relaxed cursor-pointer"
                    >
                      By sharing your email address you're signing up to receive news and special offers from Glowbar. You may unsubscribe at any time (but we hope you won't).
                    </label>
                  </div>
                )}

                <Button
                  onClick={() => {
                    setBookingState(prev => ({
                      ...prev,
                      userFirstName: firstName,
                      userLastName: lastName,
                      userEmail: email,
                      userPhone: authPhone,
                      userName: `${firstName} ${lastName}`,
                      step: 'product'
                    }));
                  }}
                  className="w-full h-12 text-base font-medium text-white hover:opacity-90 mt-6"
                  style={{ backgroundColor: '#FF502D' }}
                  disabled={!isValid}
                  data-testid="button-continue"
                >
                  Continue
                </Button>
            </div>
          </div>

          {/* Right Side: Image */}
          <div className="w-1/2 relative">
            <img 
              src={luxurySpaImage} 
              alt="Luxury spa" 
              className="w-full h-full object-cover"
              data-testid="img-personal-info"
            />
          </div>
        </div>
      </div>
    );
  }

  // Step 6: Checkout
  if (bookingState.step === 'checkout') {
    // Check if this is a booking or a purchase-only flow
    const isMembership = bookingState.selectedProduct?.id.startsWith('membership-');
    const isPackage = bookingState.selectedProduct?.id.startsWith('package-');
    const isGiftCard = bookingState.selectedProduct?.id.startsWith('giftcard-');
    const isPurchaseOnly = isMembership || isPackage || isGiftCard;

    // For purchase-only, we only need product. For bookings, we need location and time too.
    if (!bookingState.selectedProduct) {
      return null;
    }
    if (!isPurchaseOnly && (!bookingState.selectedLocation || !bookingState.selectedTime)) {
      return null;
    }

    const productPrice = bookingState.selectedProduct.price;
    const tax = productPrice * 0.09;
    const total = bookingState.isMember ? 0 : productPrice + tax;

    // Testimonials data
    const testimonials = [
      { name: 'Paulina Trujillo', text: 'First time having a facial at Glowbar and omg. I did not wait more than a second as soon as I sat down after washing my face!', rating: 5 },
      { name: 'Selina Mendez', text: 'Couldn\'t have chose a better place to get my very first facial at!', rating: 5 },
      { name: 'Alyssa M.', text: 'Glowbar has changed my skin! I\'ve been going monthly for over a year and my skin has never been better!', rating: 5 },
    ];

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={() => setBookingState({ step: 'phone-verification' })} className="cursor-pointer" data-testid="button-logo"><img src={glowbarLogoPath} alt="Glowbar" className="h-8" /></button>
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>
        <ProgressBar />
        {/* Selected Studio Display */}
        {bookingState.selectedLocation && (
          <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
            <button
              onClick={() => setBookingState(prev => ({ ...prev, step: 'location' }))}
              className="flex items-center gap-2 text-gray-700 hover:text-black transition-colors"
              data-testid="button-change-studio"
            >
              <MapPin className="w-4 h-4" />
              <span className="font-medium">{bookingState.selectedLocation.name}</span>
              <span className="text-gray-500">•</span>
              <span className="text-sm">{bookingState.selectedLocation.city}, {bookingState.selectedLocation.state}</span>
              <span className="text-xs ml-2" style={{ color: '#FF502D' }}>Change</span>
            </button>
          </div>
        )}
        <div className="flex-1">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="mb-4"
              data-testid="button-back"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-1" data-testid="text-title">Complete your {isPurchaseOnly ? 'purchase' : 'booking'}</h1>
              <p className="text-gray-600" data-testid="text-subtitle">You're almost there!</p>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Payment & Summary */}
            <div className="lg:col-span-2 space-y-4">
              {/* Order/Appointment Summary - Compact */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={luxurySpaImage} alt="Treatment" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">
                      {bookingState.selectedProduct?.name}
                      {bookingState.selectedProduct?.id.startsWith('giftcard-') && bookingState.selectedProduct?.description && ` - ${bookingState.selectedProduct.description}`}
                    </h3>
                    {!isPurchaseOnly && (
                      <div className="text-sm text-gray-600 mt-1">
                        <p>{bookingState.selectedLocation?.name}</p>
                        <p>{bookingState.selectedDate && format(bookingState.selectedDate, 'EEE, MMM d')} at {bookingState.selectedTime?.time}</p>
                      </div>
                    )}
                    {isPurchaseOnly && (
                      <p className="font-bold mt-2" style={{ color: '#FF502D' }}>${productPrice.toFixed(2)}</p>
                    )}
                    {/* Voucher info for members and non-members */}
                    {!isPurchaseOnly && bookingState.userFlow === 'member' && (
                      <p className="text-sm text-gray-600 mt-2" data-testid="text-checkout-voucher-info">
                        You have <span style={{ fontWeight: '600', color: '#FF502D' }}>1 voucher</span> in your account that can be used for this facial.
                      </p>
                    )}
                    {!isPurchaseOnly && bookingState.userFlow === 'non-member' && (
                      <p className="text-sm text-gray-600 mt-2" data-testid="text-checkout-voucher-info">
                        You have <span style={{ fontWeight: '600', color: '#FF502D' }}>5 vouchers</span> in your account that can be used for this facial.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Form */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-bold mb-4">Payment method</h3>
                
                {/* Saved Cards */}
                <div className="space-y-3 mb-4">
                  {savedCards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => setSelectedPaymentMethod(card.id as 'saved-1' | 'saved-2')}
                      className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${
                        selectedPaymentMethod === card.id 
                          ? 'border-gray-400 bg-gray-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      data-testid={`card-option-${card.id}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedPaymentMethod === card.id ? 'border-gray-600' : 'border-gray-300'
                      }`}>
                        {selectedPaymentMethod === card.id && (
                          <div className="w-3 h-3 rounded-full bg-gray-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-7 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-600">
                          {card.brand === 'Visa' ? 'VISA' : 'MC'}
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900">•••• •••• •••• {card.last4}</p>
                          <p className="text-xs text-gray-500">Expires {card.expiry}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                  
                  {/* Add New Card Option */}
                  <button
                    onClick={() => setSelectedPaymentMethod('new')}
                    className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${
                      selectedPaymentMethod === 'new' 
                        ? 'border-gray-400 bg-gray-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid="card-option-new"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedPaymentMethod === 'new' ? 'border-gray-600' : 'border-gray-300'
                    }`}>
                      {selectedPaymentMethod === 'new' && (
                        <div className="w-3 h-3 rounded-full bg-gray-600" />
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-7 bg-gray-100 rounded flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-gray-500" />
                      </div>
                      <span className="font-medium text-gray-900">Add new card</span>
                    </div>
                  </button>
                </div>

                {/* New Card Form - Only shown when "new" is selected */}
                {selectedPaymentMethod === 'new' && (
                  <div className="space-y-3 pt-3 border-t">
                    <div>
                      <Label htmlFor="cardName" className="text-sm">Cardholder Name</Label>
                      <Input
                        id="cardName"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="Name on card"
                        className="mt-1"
                        data-testid="input-card-name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="cardNumber" className="text-sm">Card Number</Label>
                      <Input
                        id="cardNumber"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="1234 5678 9012 3456"
                        className="mt-1"
                        data-testid="input-card-number"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="cardExpiry" className="text-sm">Expiry</Label>
                        <Input
                          id="cardExpiry"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          className="mt-1"
                          data-testid="input-card-expiry"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cardCvc" className="text-sm">CVC</Label>
                        <Input
                          id="cardCvc"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          placeholder="123"
                          className="mt-1"
                          data-testid="input-card-cvc"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Promo Code - Inline */}
                <div className="flex gap-2 pt-4">
                  <Input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Promo code"
                    className="flex-1"
                    data-testid="input-promo"
                  />
                  <Button variant="outline" className="px-4" data-testid="button-apply-promo">
                    Apply
                  </Button>
                </div>

                {/* Price Breakdown */}
                <div className="border-t mt-4 pt-4">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>${(bookingState.userFlow === 'member' ? 65 : productPrice).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>${((bookingState.userFlow === 'member' ? 65 : productPrice) * 0.09).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                      <span>Total</span>
                      <span data-testid="text-total" style={{ color: '#FF502D' }}>
                        ${((bookingState.userFlow === 'member' ? 65 : productPrice) * 1.09).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Info Notice */}
                {!isPurchaseOnly && (
                  <div className="rounded-xl p-4 flex items-center gap-3 mt-4" style={{ backgroundColor: '#FFF0ED' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FF502D' }}>
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Your card won't be charged today</p>
                      <p className="text-xs text-gray-600">Card held for appointment, and won't be charged unless you cancel late or don't show up.</p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => {
                    // If using new card, validate card details
                    if (selectedPaymentMethod === 'new' && (!cardName || !cardNumber || !cardExpiry || !cardCvc)) {
                      toast({
                        title: "Card Details Required",
                        description: "Please enter your card details to continue",
                        variant: "destructive"
                      });
                      return;
                    }
                    setBookingState(prev => ({ ...prev, step: 'confirmation' }));
                  }}
                  disabled={selectedPaymentMethod === 'new' && (!cardName || !cardNumber || !cardExpiry || !cardCvc)}
                  className="w-full h-14 text-base font-semibold text-white hover:opacity-90 mt-4"
                  style={{ backgroundColor: '#FF502D' }}
                  data-testid="button-book-now"
                >
                  {isPurchaseOnly ? 'COMPLETE PURCHASE' : 'BOOK NOW'}
                </Button>

                {/* Trust Badges */}
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-1 text-gray-500 text-xs">
                    <Lock className="w-3 h-3" />
                    <span>Secure payment</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500 text-xs">
                    <CreditCard className="w-3 h-3" />
                    <span>All cards accepted</span>
                  </div>
                </div>
              </div>

              {/* Condensed Terms */}
              <p className="text-xs text-gray-500 text-center">
                By continuing, you agree to our <a href="#" className="underline" style={{ color: '#FF502D' }}>Terms</a> and <a href="#" className="underline" style={{ color: '#FF502D' }}>Privacy Policy</a>. 
                {!isPurchaseOnly ? (
                  <> Free cancellation or modification 24 hours before your appointment. After that, changes to the appointment will result in a charge of $30 plus any applicable taxes and fees. <a href="https://glowbar.com/pages/faqs" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#FF502D' }}>Learn More</a>. </>
                ) : (
                  <> By purchasing this product or service, you agree to receive texts and emails from Glowbar. You can unsubscribe at any time. Msg & data rates may apply. </>
                )}
                {!isPurchaseOnly && <>By booking this appointment, you agree to receive texts and emails from Glowbar. You can unsubscribe at any time. Msg & data rates may apply.</>}
              </p>
            </div>

            {/* Right Column - Social Proof */}
            <div className="space-y-4">
              {/* Rating Summary */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
                <div className="flex justify-center mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="font-bold text-2xl">4.8</p>
                <p className="text-sm text-gray-600">Based on 1,000+ reviews</p>
              </div>

              {/* Testimonials */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h4 className="font-bold mb-3">What Our Guests Say</h4>
                <div className="space-y-4">
                  {testimonials.map((testimonial, index) => (
                    <div key={index} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                      <div className="flex items-center gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <p className="text-sm text-gray-700 italic">"{testimonial.text}"</p>
                      <p className="text-xs text-gray-500 mt-1">— {testimonial.name}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      </div>
    );
  }

  // Step 7: Confirmation
  if (bookingState.step === 'confirmation') {
    // Check if this is a purchase-only flow (no appointment)
    const isMembership = bookingState.selectedProduct?.id.startsWith('membership-');
    const isPackage = bookingState.selectedProduct?.id.startsWith('package-');
    const isGiftCard = bookingState.selectedProduct?.id.startsWith('giftcard-');
    const isPurchaseOnly = isMembership || isPackage || isGiftCard;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={() => setBookingState({ step: 'phone-verification' })} className="cursor-pointer" data-testid="button-logo"><img src={glowbarLogoPath} alt="Glowbar" className="h-8" /></button>
          <Button variant="ghost" data-testid="button-my-account">
            <User className="w-4 h-4 mr-2" />
            My Account
          </Button>
        </div>

        <ProgressBar />
        
        {/* Selected Studio Display - Only for bookings */}
        {!isPurchaseOnly && bookingState.selectedLocation && (
          <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="w-4 h-4" />
              <span className="font-medium">{bookingState.selectedLocation.name}</span>
              <span className="text-gray-500">•</span>
              <span className="text-sm">{bookingState.selectedLocation.city}, {bookingState.selectedLocation.state}</span>
            </div>
          </div>
        )}

        <div className="flex-1">
          <div className="max-w-2xl mx-auto px-6 py-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h1 className="text-4xl font-bold mb-2" data-testid="text-title">
                {isPurchaseOnly ? 'Purchase Confirmed!' : 'Booking confirmed!'}
              </h1>
              <p className="text-gray-600" data-testid="text-subtitle">
                {isPurchaseOnly 
                  ? 'Your order has been successfully processed' 
                  : 'Your appointment has been successfully scheduled'}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h3 className="text-xl font-bold mb-4">{isPurchaseOnly ? 'Order details' : 'Appointment details'}</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">{isPurchaseOnly ? 'Product' : 'Service'}</p>
                  <p className="font-semibold">
                    {bookingState.selectedProduct?.name}
                    {bookingState.selectedProduct?.id.startsWith('giftcard-') && bookingState.selectedProduct?.description && ` - ${bookingState.selectedProduct.description}`}
                  </p>
                </div>
                {!isPurchaseOnly && bookingState.selectedLocation && (
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="font-semibold">{bookingState.selectedLocation.name}</p>
                    <p className="text-sm text-gray-500">
                      {bookingState.selectedLocation.city}, {bookingState.selectedLocation.state}
                    </p>
                  </div>
                )}
                {!isPurchaseOnly && bookingState.selectedDate && (
                  <div>
                    <p className="text-sm text-gray-600">Date & Time</p>
                    <p className="font-semibold">{format(bookingState.selectedDate, 'EEE, MMM d, yyyy')}</p>
                    <p className="text-sm text-gray-500">{bookingState.selectedTime?.time || 'Time TBD'}</p>
                  </div>
                )}
                {bookingState.userName && (
                  <div>
                    <p className="text-sm text-gray-600">{isPurchaseOnly ? 'Customer' : 'Guest'}</p>
                    <p className="font-semibold">{bookingState.userName}</p>
                    <p className="text-sm text-gray-500">{bookingState.userEmail}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Order Total</p>
                  <p className="font-semibold">${bookingState.selectedProduct?.price.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {(isMembership || isPackage) && (
                <Button
                  onClick={() => {
                    // Reset to product selection but keep user info
                    setBookingState(prev => ({ 
                      ...prev,
                      step: 'product',
                      selectedProduct: undefined,
                      selectedDate: undefined,
                      selectedTime: undefined,
                      selectedEsthetician: undefined
                    }));
                  }}
                  className="w-full h-14 text-base font-semibold text-white hover:opacity-90"
                  style={{ backgroundColor: '#FF502D' }}
                  data-testid="button-book-appointment"
                >
                  Book Your Appointment Now
                </Button>
              )}
              <Button
                onClick={() => {
                  setBookingState({ step: 'location' });
                  setAcceptTerms(false);
                }}
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: (isMembership || isPackage) ? '#000000' : '#FF502D' }}
                data-testid="button-new-booking"
              >
                {isPurchaseOnly ? 'Make Another Purchase' : 'Book Another Appointment'}
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
