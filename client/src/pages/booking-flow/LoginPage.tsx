import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBookingFlow } from "@/contexts/BookingFlowContext";

export function LoginPage() {
  const { setAuthenticated, setUserType, setCurrentStep, updateUserData } = useBookingFlow();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // Mock login - in real app would call API
    updateUserData({ email, password });
    setAuthenticated(true);
    
    // Demo: set user type based on email
    if (email.includes('member')) {
      setUserType('member');
    } else {
      setUserType('non-member');
    }
    
    setCurrentStep('product');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-gray-600" data-testid="text-page-title">
            Login
          </h1>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 bg-gray-300 border-0"
                data-testid="input-email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 bg-gray-300 border-0"
                data-testid="input-password"
              />
            </div>
            
            <Button
              onClick={handleLogin}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
              disabled={!email || !password}
              data-testid="button-login"
            >
              Login
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
