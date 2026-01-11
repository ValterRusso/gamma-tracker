import { Route, Switch } from 'wouter';
import Dashboard from './pages/Dashboard';
import EntropyOverview from './pages/EntropyOverview';
import EntropyDivergences from './pages/EntropyDivergences';
import EntropyDepthAnalysis from './pages/EntropyDepthAnalysis';
import EntropyHistory from './pages/EntropyHistory';
import GEXHeatmap from './pages/GEXHeatmap';

function App() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/entropy" component={EntropyOverview} />
      <Route path="/entropy/overview" component={EntropyOverview} />
      <Route path="/entropy/divergences" component={EntropyDivergences} />
      <Route path="/entropy/depth" component={EntropyDepthAnalysis} />
      <Route path="/entropy/history" component={EntropyHistory} />
      <Route path="/gamma-profile" component={GEXHeatmap} />
      <Route path="/gex-heatmap" component={GEXHeatmap} />
      <Route>404 - Not Found</Route>
    </Switch>
  );
}

export default App;
