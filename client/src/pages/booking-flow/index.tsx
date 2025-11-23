import { BookingFlowProvider, useBookingFlow } from "@/contexts/BookingFlowContext";
import { DeveloperControls } from "@/components/DeveloperControls";
import { CustomerTypePage } from "./CustomerTypePage";
import { LoginPage } from "./LoginPage";
import { ProductSelectionPage } from "./ProductSelectionPage";
import { LocationPage } from "./LocationPage";
import { DateTimePage } from "./DateTimePage";
import { PersonalInfoPage } from "./PersonalInfoPage";
import { CheckoutPage } from "./CheckoutPage";
import { ConfirmationPage } from "./ConfirmationPage";

function BookingFlowRouter() {
  const { state } = useBookingFlow();

  switch (state.currentStep) {
    case 'customer-type':
      return <CustomerTypePage />;
    case 'login':
      return <LoginPage />;
    case 'product':
      return <ProductSelectionPage />;
    case 'location':
      return <LocationPage />;
    case 'datetime':
      return <DateTimePage />;
    case 'personal-info':
      return <PersonalInfoPage />;
    case 'checkout':
      return <CheckoutPage />;
    case 'confirmation':
      return <ConfirmationPage />;
    default:
      return <CustomerTypePage />;
  }
}

export default function BookingFlowPage() {
  return (
    <BookingFlowProvider>
      <div className="relative">
        <DeveloperControls />
        <BookingFlowRouter />
      </div>
    </BookingFlowProvider>
  );
}
