import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBookingFlow } from "@/contexts/BookingFlowContext";

export function CheckoutPage() {
  const { state, setCurrentStep, updateUserData } = useBookingFlow();
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [billingZip, setBillingZip] = useState('');

  const isMember = state.userType === 'member';
  const showPaymentForm = !isMember;

  const handleCheckout = () => {
    if (!isMember) {
      updateUserData({ paymentProcessed: true });
    }
    setCurrentStep('confirmation');
  };

  const isPaymentValid = isMember || (cardNumber && expiryDate && cvv && billingZip);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {isMember && (
        <div className="bg-green-500 text-white px-4 py-2" data-testid="banner-member-status">
          <span className="font-semibold">Members</span>
        </div>
      )}
      
      <div className="max-w-2xl mx-auto pt-8">
        <Card className="p-6">
          <h1 className="text-2xl font-semibold text-gray-600 mb-6" data-testid="text-page-title">
            Checkout
          </h1>
          
          <div className="space-y-6">
            {/* Cart Details */}
            <div className="bg-gray-300 p-6 rounded-lg" data-testid="section-cart-details">
              <h2 className="font-semibold mb-4">Cart details</h2>
              <div className="space-y-2 text-sm">
                {state.selectedProduct && (
                  <div className="flex justify-between">
                    <span>{state.selectedProduct.name}</span>
                    <span className="font-semibold">
                      {isMember ? 'Voucher' : `$${state.selectedProduct.price}`}
                    </span>
                  </div>
                )}
                {state.selectedLocation && (
                  <div className="text-gray-600">
                    {state.selectedLocation.name} - {state.selectedLocation.city}, {state.selectedLocation.state}
                  </div>
                )}
                {state.selectedDate && state.selectedTime && (
                  <div className="text-gray-600">
                    {state.selectedDate.toLocaleDateString()} at {state.selectedTime}
                  </div>
                )}
              </div>
              
              {isMember && (
                <div className="mt-4 pt-4 border-t border-gray-400">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>$0 (Redeemed with voucher)</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Payment Form - Only for non-members */}
            {showPaymentForm && (
              <div className="bg-gray-300 p-6 rounded-lg space-y-4" data-testid="section-payment-details">
                <h2 className="font-semibold mb-4">Bank Details</h2>
                
                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input
                    id="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="bg-white"
                    data-testid="input-card-number"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">Expiry Date</Label>
                    <Input
                      id="expiryDate"
                      placeholder="MM/YY"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="bg-white"
                      data-testid="input-expiry-date"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="cvv">CVV</Label>
                    <Input
                      id="cvv"
                      placeholder="123"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value)}
                      className="bg-white"
                      data-testid="input-cvv"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="billingZip">Billing ZIP Code</Label>
                  <Input
                    id="billingZip"
                    placeholder="10001"
                    value={billingZip}
                    onChange={(e) => setBillingZip(e.target.value)}
                    className="bg-white"
                    data-testid="input-billing-zip"
                  />
                </div>

                <div className="pt-4 border-t border-gray-400">
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span data-testid="text-total-price">${state.selectedProduct?.price || 0}</span>
                  </div>
                </div>
              </div>
            )}
            
            <Button
              onClick={handleCheckout}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
              disabled={!isPaymentValid}
              data-testid="button-complete-booking"
            >
              {isMember ? 'Complete Booking' : 'Pay & Complete Booking'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
