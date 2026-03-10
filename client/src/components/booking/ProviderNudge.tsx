import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Star, UserCircle2 } from "lucide-react";
import type { NudgeSlot } from "@/contexts/BookingFlowContext";

interface ProviderNudgeProps {
  provider: string;
  message: string;
  suggestedSlots: NudgeSlot[];
  onAccept: () => void;
  onSkip: () => void;
}

export function ProviderNudge({
  provider,
  message,
  suggestedSlots,
  onAccept,
  onSkip,
}: ProviderNudgeProps) {
  return (
    <div className="space-y-5">
      {/* Provider header */}
      <div className="flex items-start gap-4 bg-green-50 rounded-xl p-4 border border-green-200">
        <div className="bg-green-500 text-white rounded-full w-12 h-12 flex items-center justify-center flex-shrink-0">
          <UserCircle2 className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{provider}</span>
            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs shrink-0">
              <Star className="h-3 w-3 mr-1 fill-green-500 text-green-500" />
              Your provider
            </Badge>
          </div>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{message}</p>
        </div>
      </div>

      {/* Available low-demand slots */}
      {suggestedSlots.length > 0 && (
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-gray-400" />
            Available off-peak times
          </div>
          <div className="grid grid-cols-3 gap-2">
            {suggestedSlots.map((slot, i) => (
              <div
                key={i}
                className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center"
                data-testid={`slot-${i}`}
              >
                <div className="text-xs text-gray-500 font-medium">
                  {slot.dayOfWeek.slice(0, 3)}
                </div>
                <div className="text-sm font-semibold text-blue-700 mt-0.5">
                  {slot.displayTime}
                </div>
                <div className="text-xs text-blue-500 mt-1">Less busy</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-2 pt-1">
        <Button
          onClick={onAccept}
          className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-medium"
          data-testid="button-provider-accept"
        >
          Got it — continue to checkout
        </Button>
        <Button
          onClick={onSkip}
          variant="ghost"
          className="w-full h-11 text-gray-500 hover:text-gray-700"
          data-testid="button-provider-skip"
        >
          Keep my current time selection
        </Button>
      </div>
    </div>
  );
}
