import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBookingFlow } from "@/contexts/BookingFlowContext";
import { CheckCircle } from "lucide-react";

export function ConfirmationPage() {
  const { state, resetFlow } = useBookingFlow();
  const isMember = state.userType === 'member';

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {isMember && (
        <div className="bg-green-500 text-white px-4 py-2" data-testid="banner-member-status">
          <span className="font-semibold">Members</span>
        </div>
      )}
      
      <div className="max-w-2xl mx-auto pt-8">
        <Card className="p-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="h-16 w-16 text-green-500" data-testid="icon-success" />
            </div>
            
            <h1 className="text-3xl font-semibold" data-testid="text-page-title">
              Confirmation
            </h1>
            
            <div className="bg-gray-300 p-6 rounded-lg text-left space-y-3" data-testid="section-booking-details">
              <h2 className="font-semibold text-lg mb-4">Your Booking Details</h2>
              
              {state.selectedProduct && (
                <div>
                  <div className="text-sm text-gray-600">Treatment</div>
                  <div className="font-semibold">{state.selectedProduct.name}</div>
                </div>
              )}
              
              {state.selectedLocation && (
                <div>
                  <div className="text-sm text-gray-600">Location</div>
                  <div className="font-semibold">
                    {state.selectedLocation.name}, {state.selectedLocation.city}
                  </div>
                </div>
              )}
              
              {state.selectedDate && state.selectedTime && (
                <div>
                  <div className="text-sm text-gray-600">Date & Time</div>
                  <div className="font-semibold">
                    {state.selectedDate.toLocaleDateString()} at {state.selectedTime}
                  </div>
                </div>
              )}
              
              {state.firstName && state.email && (
                <div>
                  <div className="text-sm text-gray-600">Contact</div>
                  <div className="font-semibold">
                    {state.firstName} {state.lastName}
                  </div>
                  <div className="text-sm">{state.email}</div>
                  {state.phone && <div className="text-sm">{state.phone}</div>}
                </div>
              )}
              
              <div className="pt-4 border-t border-gray-400">
                <div className="flex justify-between">
                  <span className="font-semibold">Total Paid</span>
                  <span className="font-semibold">
                    {isMember ? '$0 (Voucher)' : `$${state.selectedProduct?.price || 0}`}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="pt-4 text-sm text-gray-600">
              A confirmation email has been sent to {state.email || 'your email'}
            </div>
            
            <Button
              onClick={resetFlow}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
              data-testid="button-book-another"
            >
              Book Another Treatment
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
