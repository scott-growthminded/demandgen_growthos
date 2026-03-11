import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBookingFlow } from "@/contexts/BookingFlowContext";

export function PersonalInfoPage() {
  const { state, setCurrentStep, updateUserData } = useBookingFlow();
  const [firstName, setFirstName] = useState(state.firstName || '');
  const [lastName, setLastName] = useState(state.lastName || '');
  const [email, setEmail] = useState(state.email || '');
  const [phone, setPhone] = useState(state.phone || '');

  const handleContinue = () => {
    updateUserData({ firstName, lastName, email, phone });
    // Route through personalization before checkout
    setCurrentStep("personalization");
  };

  const isValid = firstName && lastName && email && phone;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-6" data-testid="text-page-title">
            Personal info
          </h1>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
              <Input
                id="firstName"
                placeholder="Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-12 bg-gray-50 border border-gray-200"
                data-testid="input-first-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-12 bg-gray-50 border border-gray-200"
                data-testid="input-last-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-gray-50 border border-gray-200"
                data-testid="input-email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 bg-gray-50 border border-gray-200"
                data-testid="input-phone"
              />
            </div>
            
            <Button
              onClick={handleContinue}
              className="w-full h-12 text-base font-medium text-white hover:opacity-90 mt-6"
              style={{ backgroundColor: '#FF502D' }}
              disabled={!isValid}
              data-testid="button-continue"
            >
              Continue
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
