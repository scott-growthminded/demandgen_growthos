import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Tag, Copy, Check } from "lucide-react";
import type { NudgeOffer, NudgeSlot } from "@/contexts/BookingFlowContext";

interface IncentiveOfferProps {
  offer: NudgeOffer;
  message: string;
  suggestedSlots: NudgeSlot[];
  onAccept: () => void;
  onSkip: () => void;
}

export function IncentiveOffer({
  offer,
  message,
  suggestedSlots,
  onAccept,
  onSkip,
}: IncentiveOfferProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(offer.discountCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed silently
    }
  };

  return (
    <div className="space-y-5">
      {/* Offer banner */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
        <div className="flex items-start gap-3">
          <div className="bg-orange-100 rounded-full p-2.5 flex-shrink-0">
            <Tag className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-bold text-orange-600">
                {offer.displayLabel}
              </span>
              {offer.constraint && (
                <Badge
                  variant="outline"
                  className="text-orange-600 border-orange-300 text-xs"
                >
                  {offer.constraint}
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Discount code block */}
        <div className="mt-4 bg-white rounded-lg border border-orange-200 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Your discount code
            </div>
            <div
              className="text-lg font-mono font-bold text-gray-900 mt-0.5 truncate"
              data-testid="text-discount-code"
            >
              {offer.discountCode}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyCode}
            className="shrink-0 flex items-center gap-1.5 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            data-testid="button-copy-code"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Suggested off-peak slots (mid-tier only) */}
      {suggestedSlots.length > 0 && (
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-gray-400" />
            Eligible off-peak times
          </div>
          <div className="grid grid-cols-3 gap-2">
            {suggestedSlots.map((slot, i) => (
              <div
                key={i}
                className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center"
                data-testid={`slot-${i}`}
              >
                <div className="text-xs text-gray-500 font-medium">
                  {slot.dayOfWeek.slice(0, 3)}
                </div>
                <div className="text-sm font-semibold text-orange-700 mt-0.5">
                  {slot.displayTime}
                </div>
                <div className="text-xs text-orange-500 mt-1">Off-peak</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low-tier: no slot constraint messaging */}
      {suggestedSlots.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-1">
          Valid on any appointment — no time restriction.
        </p>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-2 pt-1">
        <Button
          onClick={onAccept}
          className="w-full h-12 font-medium text-white hover:opacity-90"
          style={{ backgroundColor: "#FF502D" }}
          data-testid="button-offer-accept"
        >
          Use this offer
        </Button>
        <Button
          onClick={onSkip}
          variant="ghost"
          className="w-full h-11 text-gray-500 hover:text-gray-700"
          data-testid="button-offer-skip"
        >
          No thanks, continue to checkout
        </Button>
      </div>
    </div>
  );
}
