import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBookingFlow } from "@/contexts/BookingFlowContext";

const PRODUCTS = {
  member: [
    { id: 'member-treatment-1', name: 'Member First Time Treatment', price: 65, description: 'Redeem with voucher' },
    { id: 'member-treatment-2', name: 'Member Returning Treatment', price: 65, description: 'Redeem with voucher' },
  ],
  nonMember: [
    { id: 'non-member-treatment-1', name: 'First Time Treatment', price: 80, description: '60-minute facial' },
    { id: 'non-member-treatment-2', name: 'Returning Treatment', price: 80, description: '60-minute facial' },
  ],
  packages: [
    { id: 'package-5', name: '5 Treatment Package', price: 350, description: 'Save $50' },
  ],
  giftCards: [
    { id: 'gift-card', name: 'Gift Card', price: 0, description: 'Any amount' },
  ],
};

export function ProductSelectionPage() {
  const { state, setCurrentStep, updateUserData } = useBookingFlow();
  const isMember = state.userType === 'member';
  const isNewUser = state.userType === 'new';

  const handleProductSelect = (product: typeof PRODUCTS.member[0]) => {
    updateUserData({ selectedProduct: product });
    setCurrentStep('location');
  };

  const availableProducts = isNewUser || !isMember ? PRODUCTS.nonMember : PRODUCTS.member;
  const showMembershipBanner = state.isMemberPastDue;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        {isMember && (
          <div className="bg-green-500 text-white px-4 py-2 mb-6" data-testid="banner-member-status">
            <span className="font-semibold">Member</span>
            {showMembershipBanner && (
              <span className="ml-4 text-sm" data-testid="text-past-due-warning">
                ⚠️ Membership Past Due
              </span>
            )}
          </div>
        )}

        <Card className="p-6">
          <h1 className="text-2xl font-semibold text-gray-600 mb-6" data-testid="text-page-title">
            Select product
          </h1>
          
          <div className="space-y-4">
            {availableProducts.map((product) => (
              <Button
                key={product.id}
                onClick={() => handleProductSelect(product)}
                className="w-full h-20 bg-gray-300 hover:bg-gray-400 text-black justify-between px-6"
                data-testid={`button-product-${product.id}`}
              >
                <div className="text-left">
                  <div className="font-semibold">{product.name}</div>
                  {product.description && (
                    <div className="text-sm text-gray-600">{product.description}</div>
                  )}
                </div>
                <div className="font-bold">${product.price}</div>
              </Button>
            ))}
            
            {!isMember && (
              <>
                <div className="pt-4 border-t">
                  <h2 className="text-lg font-semibold mb-3">Packages</h2>
                  {PRODUCTS.packages.map((product) => (
                    <Button
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className="w-full h-16 bg-gray-300 hover:bg-gray-400 text-black justify-between px-6 mb-2"
                      data-testid={`button-product-${product.id}`}
                    >
                      <div className="text-left">
                        <div className="font-semibold">{product.name}</div>
                        <div className="text-sm text-gray-600">{product.description}</div>
                      </div>
                      <div className="font-bold">${product.price}</div>
                    </Button>
                  ))}
                </div>
                
                <div className="pt-4 border-t">
                  <h2 className="text-lg font-semibold mb-3">Gift Cards</h2>
                  {PRODUCTS.giftCards.map((product) => (
                    <Button
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className="w-full h-16 bg-gray-300 hover:bg-gray-400 text-black justify-between px-6"
                      data-testid={`button-product-${product.id}`}
                    >
                      <div className="text-left">
                        <div className="font-semibold">{product.name}</div>
                        <div className="text-sm text-gray-600">{product.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
