import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useBookingFlow } from "@/contexts/BookingFlowContext";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

interface Location {
  id: string;
  name: string;
  address?: {
    city: string;
    state: string;
    line1?: string;
  };
}

// Location names must match the keys in availability.json for low-demand slot lookup
const MOCK_LOCATIONS: Location[] = [
  {
    id: '1',
    name: 'Union Square',
    address: { city: 'New York', state: 'NY', line1: '4 Union Square South' }
  },
  {
    id: '2',
    name: 'Upper East Side',
    address: { city: 'New York', state: 'NY', line1: '1049 Lexington Ave' }
  },
  {
    id: '3',
    name: 'Tribeca',
    address: { city: 'New York', state: 'NY', line1: '56 Thomas St' }
  },
  {
    id: '4',
    name: 'Williamsburg Wythe',
    address: { city: 'New York', state: 'NY', line1: '218 Wythe Ave' }
  },
  {
    id: '5',
    name: 'Georgetown',
    address: { city: 'Washington', state: 'DC', line1: '1234 Wisconsin Ave NW' }
  },
  {
    id: '6',
    name: 'Logan Circle',
    address: { city: 'Washington', state: 'DC', line1: '1319 14th St NW' }
  },
];

const CITIES = ['New York', 'Washington'];

export function LocationPage() {
  const { state, setCurrentStep, updateUserData } = useBookingFlow();
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedStudioId, setSelectedStudioId] = useState('');
  const isMember = state.userType === 'member';

  const handleContinue = () => {
    const studio = MOCK_LOCATIONS.find(loc => loc.id === selectedStudioId);
    if (studio && studio.address) {
      updateUserData({
        selectedLocation: {
          id: studio.id,
          name: studio.name,
          city: studio.address.city,
          state: studio.address.state,
        }
      });
      setCurrentStep('datetime');
    }
  };

  const filteredStudios = selectedCity
    ? MOCK_LOCATIONS.filter(loc => loc.address?.city === selectedCity)
    : [];

  const isValid = selectedCity && selectedStudioId;

  return (
    <div className="min-h-screen bg-gray-50">
      {isMember && (
        <div className="bg-green-500 text-white px-4 py-2" data-testid="banner-member-status">
          <span className="font-semibold">Member</span>
        </div>
      )}
      
      <div className="bg-[#D4E157] h-16" data-testid="banner-progress" />
      
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-semibold text-gray-600 mb-6" data-testid="text-page-title">
          Location
        </h1>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="city-select">Select city</Label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger
                  id="city-select"
                  className="h-14 bg-gray-300 border-0"
                  data-testid="select-city"
                >
                  <SelectValue placeholder="Choose a city" />
                </SelectTrigger>
                <SelectContent>
                  {CITIES.map(city => (
                    <SelectItem key={city} value={city} data-testid={`option-city-${city}`}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedCity && (
              <div className="space-y-2">
                <Label htmlFor="studio-select">Select studio</Label>
                <Select value={selectedStudioId} onValueChange={setSelectedStudioId}>
                  <SelectTrigger
                    id="studio-select"
                    className="h-14 bg-gray-300 border-0"
                    data-testid="select-studio"
                  >
                    <SelectValue placeholder="Choose a studio" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStudios.map(studio => (
                      <SelectItem key={studio.id} value={studio.id} data-testid={`option-studio-${studio.id}`}>
                        {studio.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <Button
              onClick={handleContinue}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
              disabled={!isValid}
              data-testid="button-continue"
            >
              Continue to Date & Time
            </Button>
          </div>
          
          <Card className="bg-gray-300 p-4 h-[400px] flex items-center justify-center" data-testid="map-container">
            <div className="text-center text-gray-600">
              <div className="font-semibold mb-2">Map</div>
              <div className="text-sm">Interactive map would display here</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
