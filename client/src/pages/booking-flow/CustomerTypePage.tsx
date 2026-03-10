import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBookingFlow } from "@/contexts/BookingFlowContext";

export function CustomerTypePage() {
  const { setUserType, setCurrentStep } = useBookingFlow();

  // Identity gate — deferred to after service + time selection
  const handleNewUser = () => {
    setUserType("new");
    setCurrentStep("personal-info");
  };

  const handleReturningUser = () => {
    setCurrentStep("login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2" data-testid="text-page-title">
              Almost there!
            </h1>
            <p className="text-gray-500 text-sm">
              We just need a little more info to confirm your appointment.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <Button
              onClick={handleNewUser}
              className="w-full h-14 text-base font-medium bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-200"
              data-testid="button-new-user"
            >
              I'm new to Glowbar
            </Button>

            <Button
              onClick={handleReturningUser}
              className="w-full h-14 text-base font-medium bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-200"
              data-testid="button-returning-user"
            >
              I already have a Glowbar Account
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
