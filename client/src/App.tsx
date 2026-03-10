import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import BookingWidget from "@/pages/booking-widget";
import DashboardPage from "@/pages/dashboard";
import { ScenarioSelector } from "@/components/ScenarioSelector";

function Router() {
  return (
    <Switch>
      <Route path="/" component={BookingWidget} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        {import.meta.env.DEV && <ScenarioSelector />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
