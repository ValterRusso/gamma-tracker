// ============================================================================
// APP.TSX - Updated with Sidebar Layout
// ============================================================================

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import MainLayout from "./components/layout/MainLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import VolatilitySurface from "./pages/VolatilitySurface";
import VolatilitySkew from "./pages/VolatilitySkew";
import Anomalies from "./pages/Anomalies";
import HalfPipe from "./pages/HalfPipe";
import StrategyCenter from "./pages/StrategyCenter";
import MarketMicrostructureDashboard from "./pages/Marketmicrostructuredashboard";
import EntropyOverview from "./pages/EntropyOverview";

function Router() {
  return (
    <MainLayout>
      <Switch>
        {/* Gamma Analysis */}
        <Route path={"/"} component={Home} />
        {/* TODO: Uncomment when pages are created
        <Route path="/gamma-profile" component={GammaProfile} />
        <Route path="/wall-zones" component={WallZones} />
        <Route path="/max-pain" component={MaxPain} />
        */}

        {/* Volatility */}
        <Route path={"/volatility-surface"} component={VolatilitySurface} />
        <Route path="/volatility-skew" component={VolatilitySkew} />
        <Route path="/anomalies" component={Anomalies} />

        {/* Trading Signals */}
        <Route path="/strategy-center" component={StrategyCenter} />
        <Route path="/half-pipe" component={HalfPipe} />
        <Route path="/microstructure" component={MarketMicrostructureDashboard} />

        {/* Entropy Analysis */}
        <Route path="/entropy/overview" component={EntropyOverview} /> 

        {/* Real-Time Data */}
        {/* TODO: Uncomment when pages are created
        <Route path="/liquidations" component={Liquidations} />
        <Route path="/orderbook" component={Orderbook} />
        <Route path="/sentiment" component={MarketSentiment} />
        */}

        {/* 404 */}
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;