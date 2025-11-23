import { createContext, useContext, useState, ReactNode } from 'react';

export type UserType = 'new' | 'member' | 'non-member';
export type FlowStep = 
  | 'customer-type'
  | 'login'
  | 'product'
  | 'location'
  | 'datetime'
  | 'personal-info'
  | 'checkout'
  | 'confirmation';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface BookingFlowState {
  userType: UserType | null;
  currentStep: FlowStep;
  isAuthenticated: boolean;
  isMemberPastDue: boolean;
  
  // User data
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  
  // Booking selections
  selectedProduct?: Product;
  selectedLocation?: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
  selectedDate?: Date;
  selectedTime?: string;
  selectedEsthetician?: string;
  
  // Cart/Payment
  cartId?: string;
  paymentProcessed?: boolean;
}

interface BookingFlowContextType {
  state: BookingFlowState;
  setUserType: (type: UserType) => void;
  setCurrentStep: (step: FlowStep) => void;
  setAuthenticated: (auth: boolean) => void;
  setMemberPastDue: (pastDue: boolean) => void;
  updateUserData: (data: Partial<BookingFlowState>) => void;
  resetFlow: () => void;
}

const BookingFlowContext = createContext<BookingFlowContextType | undefined>(undefined);

const initialState: BookingFlowState = {
  userType: null,
  currentStep: 'customer-type',
  isAuthenticated: false,
  isMemberPastDue: false,
};

export function BookingFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingFlowState>(initialState);

  const setUserType = (type: UserType) => {
    setState(prev => ({ ...prev, userType: type }));
  };

  const setCurrentStep = (step: FlowStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  };

  const setAuthenticated = (auth: boolean) => {
    setState(prev => ({ ...prev, isAuthenticated: auth }));
  };

  const setMemberPastDue = (pastDue: boolean) => {
    setState(prev => ({ ...prev, isMemberPastDue: pastDue }));
  };

  const updateUserData = (data: Partial<BookingFlowState>) => {
    setState(prev => ({ ...prev, ...data }));
  };

  const resetFlow = () => {
    setState(initialState);
  };

  return (
    <BookingFlowContext.Provider
      value={{
        state,
        setUserType,
        setCurrentStep,
        setAuthenticated,
        setMemberPastDue,
        updateUserData,
        resetFlow,
      }}
    >
      {children}
    </BookingFlowContext.Provider>
  );
}

export function useBookingFlow() {
  const context = useContext(BookingFlowContext);
  if (context === undefined) {
    throw new Error('useBookingFlow must be used within a BookingFlowProvider');
  }
  return context;
}
