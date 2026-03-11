import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useBookingFlow } from "@/contexts/BookingFlowContext";
import { Loader2 } from "lucide-react";

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

const selectedIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path fill="#2563eb" stroke="#fff" stroke-width="1.5" d="M12 0C7.03 0 3 4.03 3 9c0 7.5 9 18 9 18s9-10.5 9-18c0-4.97-4.03-9-9-9z"/>
      <circle cx="12" cy="9" r="3" fill="#fff"/>
    </svg>
  `),
  iconSize: [32, 48],
  iconAnchor: [16, 48],
  popupAnchor: [0, -48],
});

interface LocationData {
  id: string;
  name: string;
  address?: { city: string; state: string; line1?: string; line2?: string | null };
  subtext?: string;
  coordinates?: { lat: number; lng: number };
  staff: any[];
}

type GroupedLocations = Record<string, Record<string, LocationData[]>>;

export function LocationPage() {
  const { state, setCurrentStep, updateUserData } = useBookingFlow();
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedStudioId, setSelectedStudioId] = useState('');
  const isMember = state.userType === 'member';

  const { data: grouped, isLoading, error } = useQuery<GroupedLocations>({
    queryKey: ['/api/booking/locations'],
  });

  const allLocations = useMemo(() => {
    if (!grouped) return [];
    const locs: LocationData[] = [];
    for (const stateKey of Object.keys(grouped)) {
      for (const cityKey of Object.keys(grouped[stateKey])) {
        locs.push(...grouped[stateKey][cityKey]);
      }
    }
    return locs;
  }, [grouped]);

  const states = useMemo(() => {
    if (!grouped) return [];
    return Object.keys(grouped).sort();
  }, [grouped]);

  const cities = useMemo(() => {
    if (!grouped || !selectedState) return [];
    return Object.keys(grouped[selectedState] || {}).sort();
  }, [grouped, selectedState]);

  const filteredStudios = useMemo(() => {
    if (!grouped || !selectedState || !selectedCity) return [];
    return grouped[selectedState]?.[selectedCity] || [];
  }, [grouped, selectedState, selectedCity]);

  const selectedStudio = allLocations.find(loc => loc.id === selectedStudioId);

  const mapCenter = useMemo<[number, number]>(() => {
    if (selectedStudio?.coordinates) {
      return [selectedStudio.coordinates.lat, selectedStudio.coordinates.lng];
    }
    if (filteredStudios.length > 0) {
      const withCoords = filteredStudios.filter(s => s.coordinates);
      if (withCoords.length > 0) {
        const avgLat = withCoords.reduce((sum, s) => sum + s.coordinates!.lat, 0) / withCoords.length;
        const avgLng = withCoords.reduce((sum, s) => sum + s.coordinates!.lng, 0) / withCoords.length;
        return [avgLat, avgLng];
      }
    }
    return [40.7128, -74.006];
  }, [selectedStudio, filteredStudios]);

  const mapZoom = selectedStudio ? 15 : filteredStudios.length > 0 ? 12 : 5;

  const markersToShow = selectedStudio
    ? [selectedStudio]
    : filteredStudios.length > 0
      ? filteredStudios
      : allLocations;

  const handleContinue = () => {
    if (selectedStudio && selectedStudio.address) {
      updateUserData({
        selectedLocation: {
          id: selectedStudio.id,
          name: selectedStudio.name,
          city: selectedStudio.address.city,
          state: selectedStudio.address.state,
        }
      });
      setCurrentStep('datetime');
    }
  };

  const handleStateChange = (val: string) => {
    setSelectedState(val);
    setSelectedStudioId('');
    const citiesForState = grouped ? Object.keys(grouped[val] || {}) : [];
    if (citiesForState.length === 1) {
      setSelectedCity(citiesForState[0]);
    } else {
      setSelectedCity('');
    }
  };

  const handleCityChange = (val: string) => {
    setSelectedCity(val);
    setSelectedStudioId('');
  };

  const isValid = selectedStudioId !== '';

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

        {isLoading && (
          <div className="flex items-center justify-center py-12" data-testid="loading-locations">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-500">Loading locations...</span>
          </div>
        )}

        {error && (
          <div className="text-red-600 py-4" data-testid="error-locations">
            Failed to load locations. Please try again.
          </div>
        )}

        {grouped && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="state-select">Select state</Label>
                <Select value={selectedState} onValueChange={handleStateChange}>
                  <SelectTrigger
                    id="state-select"
                    className="h-14 bg-gray-300 border-0"
                    data-testid="select-state"
                  >
                    <SelectValue placeholder="Choose a state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map(st => (
                      <SelectItem key={st} value={st} data-testid={`option-state-${st}`}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedState && cities.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="city-select">Select city</Label>
                  <Select value={selectedCity} onValueChange={handleCityChange}>
                    <SelectTrigger
                      id="city-select"
                      className="h-14 bg-gray-300 border-0"
                      data-testid="select-city"
                    >
                      <SelectValue placeholder="Choose a city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map(city => (
                        <SelectItem key={city} value={city} data-testid={`option-city-${city}`}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(selectedCity || (selectedState && cities.length === 1)) && (
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
                      {(cities.length === 1
                        ? grouped[selectedState]?.[cities[0]] || []
                        : filteredStudios
                      ).map(studio => (
                        <SelectItem key={studio.id} value={studio.id} data-testid={`option-studio-${studio.id}`}>
                          {studio.name}
                          {studio.subtext ? ` — ${studio.subtext}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedStudio && (
                <Card className="p-4 bg-white border" data-testid="card-selected-studio">
                  <p className="font-semibold text-lg">{selectedStudio.name}</p>
                  {selectedStudio.subtext && (
                    <p className="text-sm text-gray-500">{selectedStudio.subtext}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedStudio.address?.line1}
                    {selectedStudio.address?.line2 ? `, ${selectedStudio.address.line2}` : ''}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedStudio.address?.city}, {selectedStudio.address?.state}
                  </p>
                </Card>
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

            <Card className="bg-gray-100 p-0 h-[450px] overflow-hidden" data-testid="map-container">
              <MapContainer
                key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}`}
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {markersToShow
                  .filter(loc => loc.coordinates)
                  .map(loc => (
                    <Marker
                      key={loc.id}
                      position={[loc.coordinates!.lat, loc.coordinates!.lng]}
                      icon={loc.id === selectedStudioId ? selectedIcon : blackIcon}
                    >
                      <Popup>
                        <div>
                          <strong>{loc.name}</strong>
                          {loc.subtext && <div className="text-xs text-gray-500">{loc.subtext}</div>}
                          <div className="text-xs">{loc.address?.line1}</div>
                          <div className="text-xs">{loc.address?.city}, {loc.address?.state}</div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
