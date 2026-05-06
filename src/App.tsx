import { Routes, Route } from 'react-router-dom';
import GalaxyView from './views/galaxy';
import BattleView from './views/battle';
import AdvisorView from './views/advisor';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GalaxyView />} />
      <Route path="/g" element={<GalaxyView />} />
      <Route path="/g/:galaxy" element={<GalaxyView />} />
      <Route path="/g/:galaxy/b" element={<GalaxyView />} />
      <Route path="/g/:galaxy/b/:battle" element={<BattleView />} />
      <Route path="/advisors" element={<AdvisorView />} />
      <Route path="*" element={<GalaxyView />} />
    </Routes>
  );
}
