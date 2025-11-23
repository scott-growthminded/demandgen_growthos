import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBookingFlow } from "@/contexts/BookingFlowContext";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

const MOCK_TIME_SLOTS = [
  '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'
];

export function DateTimePage() {
  const { state, setCurrentStep, updateUserData } = useBookingFlow();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(state.selectedDate);
  const [selectedTime, setSelectedTime] = useState(state.selectedTime || '');
  const isMember = state.userType === 'member';
  const isNewUser = state.userType === 'new';

  const handleContinue = () => {
    updateUserData({ selectedDate, selectedTime });
    
    if (isNewUser) {
      setCurrentStep('personal-info');
    } else {
      setCurrentStep('checkout');
    }
  };

  const isValid = selectedDate && selectedTime;

  return (
    <div className="min-h-screen bg-gray-50">
      {isMember && (
        <div className="bg-green-500 text-white px-4 py-2" data-testid="banner-member-status">
          <span className="font-semibold">Members</span>
        </div>
      )}
      
      <div className="bg-[#D4E157] h-16" data-testid="banner-progress">
        <div className="flex justify-end items-center h-full px-4">
          <div className="bg-gray-700 text-white rounded-full w-10 h-10 flex items-center justify-center" data-testid="avatar-initial">
            <span className="font-semibold">
              {state.firstName ? state.firstName[0].toUpperCase() : 'G'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-semibold text-gray-600 mb-6" data-testid="text-page-title">
          Date and Time
        </h1>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 bg-gray-300" data-testid="calendar-container">
            <div className="font-semibold mb-4">Calendar Date Select</div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              disabled={(date) => date < new Date()}
            />
          </Card>
          
          <div className="space-y-4">
            <Card className="p-6 bg-gray-300" data-testid="timeslot-container">
              <div className="font-semibold mb-4">Select time</div>
              <div className="grid grid-cols-2 gap-2">
                {MOCK_TIME_SLOTS.map(time => (
                  <Button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    variant={selectedTime === time ? 'default' : 'outline'}
                    className={selectedTime === time ? 'bg-blue-600' : 'bg-white'}
                    data-testid={`button-time-${time.replace(/[:\s]/g, '-')}`}
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </Card>
            
            <Button
              onClick={handleContinue}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700"
              disabled={!isValid}
              data-testid="button-continue"
            >
              Continue
            </Button>
          </div>
        </div>
        
        <Card className="mt-6 p-6 bg-gray-300" data-testid="section-nearby-studios">
          <div className="font-semibold text-center">Nearby studios</div>
          <div className="text-sm text-gray-600 text-center mt-2">
            Check availability at nearby locations
          </div>
        </Card>
      </div>
    </div>
  );
}
