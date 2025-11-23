import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useBookingFlow, UserType, FlowStep } from "@/contexts/BookingFlowContext";
import { Settings, RefreshCw } from "lucide-react";
import { useState } from "react";

export function DeveloperControls() {
  const { state, setUserType, setCurrentStep, setAuthenticated, setMemberPastDue, resetFlow } = useBookingFlow();
  const [isOpen, setIsOpen] = useState(true);

  const handleUserTypeChange = (type: UserType) => {
    setUserType(type);
    if (type === 'new') {
      setAuthenticated(false);
      setCurrentStep('customer-type');
    } else {
      setAuthenticated(false);
      setCurrentStep('customer-type');
    }
  };

  return (
    <Card className="fixed top-4 right-4 w-80 z-50 shadow-lg border-2 border-blue-500" data-testid="developer-controls">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Developer Controls
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            data-testid="button-toggle-dev-controls"
          >
            {isOpen ? '−' : '+'}
          </Button>
        </CardTitle>
      </CardHeader>
      
      {isOpen && (
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2">
            <Label htmlFor="user-type-select">User Type</Label>
            <Select
              value={state.userType || ''}
              onValueChange={(value) => handleUserTypeChange(value as UserType)}
            >
              <SelectTrigger id="user-type-select" data-testid="select-user-type">
                <SelectValue placeholder="Select user type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new" data-testid="option-new-user">New User</SelectItem>
                <SelectItem value="member" data-testid="option-member">Member</SelectItem>
                <SelectItem value="non-member" data-testid="option-non-member">Non-Member (Returning)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="current-step-select">Current Step</Label>
            <Select
              value={state.currentStep}
              onValueChange={(value) => setCurrentStep(value as FlowStep)}
            >
              <SelectTrigger id="current-step-select" data-testid="select-current-step">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer-type">Customer Type</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="product">Product Selection</SelectItem>
                <SelectItem value="location">Location</SelectItem>
                <SelectItem value="datetime">Date & Time</SelectItem>
                <SelectItem value="personal-info">Personal Info</SelectItem>
                <SelectItem value="checkout">Checkout</SelectItem>
                <SelectItem value="confirmation">Confirmation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="authenticated"
              checked={state.isAuthenticated}
              onCheckedChange={(checked) => setAuthenticated(!!checked)}
              data-testid="checkbox-authenticated"
            />
            <Label htmlFor="authenticated" className="cursor-pointer">
              Is Authenticated
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="past-due"
              checked={state.isMemberPastDue}
              onCheckedChange={(checked) => setMemberPastDue(!!checked)}
              data-testid="checkbox-past-due"
            />
            <Label htmlFor="past-due" className="cursor-pointer">
              Member Past Due
            </Label>
          </div>

          <div className="pt-2 border-t">
            <div className="text-xs space-y-1 mb-3 text-muted-foreground">
              <div data-testid="text-flow-state">Flow: {state.userType || 'Not set'}</div>
              <div data-testid="text-step-state">Step: {state.currentStep}</div>
              {state.firstName && <div>Name: {state.firstName} {state.lastName}</div>}
              {state.email && <div>Email: {state.email}</div>}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFlow}
              className="w-full"
              data-testid="button-reset-flow"
            >
              <RefreshCw className="h-3 w-3 mr-2" />
              Reset Flow
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
