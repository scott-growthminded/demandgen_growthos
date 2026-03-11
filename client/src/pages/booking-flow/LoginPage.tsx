import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useBookingFlow } from "@/contexts/BookingFlowContext";

export function LoginPage() {
  const { setAuthenticated, setUserType, setCurrentStep, updateUserData } =
    useBookingFlow();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      // Look up customer profile — sets member status from real data
      const res = await fetch(
        `/api/personalization/profile?email=${encodeURIComponent(email)}`
      );

      if (res.ok) {
        const profile = await res.json();
        const nameParts = (profile.name as string | undefined)?.split(" ") ?? [];
        updateUserData({
          email,
          password,
          firstName: nameParts[0] ?? "",
          lastName: nameParts.slice(1).join(" ") ?? "",
        });
        setAuthenticated(true);
        setUserType(profile.isMember ? "member" : "non-member");
      } else {
        // Email not in system — treat as new customer, personalization will 404 gracefully
        updateUserData({ email, password });
        setAuthenticated(false);
        setUserType("new");
      }
    } catch {
      // Network error — fall back gracefully
      updateUserData({ email, password });
      setUserType("non-member");
    } finally {
      setLoading(false);
      setCurrentStep("personalization");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="space-y-6">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Welcome back
          </h1>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-gray-50 border border-gray-200"
                data-testid="input-email"
                onKeyDown={(e) => e.key === "Enter" && email && password && handleLogin()}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-gray-50 border border-gray-200"
                data-testid="input-password"
                onKeyDown={(e) => e.key === "Enter" && email && password && handleLogin()}
              />
            </div>

            <Button
              onClick={handleLogin}
              className="w-full h-12 text-base font-medium text-white hover:opacity-90"
              style={{ backgroundColor: "#FF502D" }}
              disabled={!email || !password || loading}
              data-testid="button-login"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
