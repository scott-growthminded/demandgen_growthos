import { BookingFlowProvider, useBookingFlow } from "@/contexts/BookingFlowContext";
import { ScenarioSelector } from "@/components/ScenarioSelector";
import { ProductSelectionPage } from "./ProductSelectionPage";
import { LocationPage } from "./LocationPage";
import { DateTimePage } from "./DateTimePage";
import { CustomerTypePage } from "./CustomerTypePage";
import { LoginPage } from "./LoginPage";
import { PersonalInfoPage } from "./PersonalInfoPage";
import { PersonalizationStep } from "./PersonalizationStep";
import { CheckoutPage } from "./CheckoutPage";
import { ConfirmationPage } from "./ConfirmationPage";

// ── Top navigation bar ────────────────────────────────────────────────────────

function NavBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 h-12 flex items-center px-5 gap-5 shadow-sm">
      <span className="font-bold text-gray-900 tracking-tight text-base">
        Glowbar
      </span>
      <span className="text-gray-200">|</span>
      <a
        href="/book"
        className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium"
      >
        Booking Flow
      </a>
      <a
        href="/dashboard"
        className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        Operator Dashboard
      </a>
    </div>
  );
}

// ── Step router ───────────────────────────────────────────────────────────────

function BookingFlowRouter() {
  const { state } = useBookingFlow();

  switch (state.currentStep) {
    case 'product':
      return <ProductSelectionPage />;
    case 'location':
      return <LocationPage />;
    case 'datetime':
      return <DateTimePage />;
    case 'customer-type':
      return <CustomerTypePage />;
    case 'login':
      return <LoginPage />;
    case 'personal-info':
      return <PersonalInfoPage />;
    case 'personalization':
      // Key on email so switching scenarios forces a remount + fresh API fetch
      return <PersonalizationStep key={state.email ?? 'guest'} />;
    case 'checkout':
      return <CheckoutPage />;
    case 'confirmation':
      return <ConfirmationPage />;
    default:
      return <ProductSelectionPage />;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BookingFlowPage() {
  return (
    <BookingFlowProvider>
      <NavBar />
      {/* pt-12 offsets the fixed nav bar height */}
      <div className="relative pt-12">
        <ScenarioSelector />
        <BookingFlowRouter />
      </div>
    </BookingFlowProvider>
  );
}
