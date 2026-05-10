import { Routes, Route } from 'react-router-dom';
import GalaxyView from './views/galaxy';
import BattleView from './views/battle';
import AdvisorView from './views/advisor';
import SubmitView from './views/submit';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    setTimeout(() => {
      document.body.style.transition = "background-color 150ms, color 150ms, border-color 150ms";
    }, 250);
  }, []);
  return (
    <Routes>
      <Route path="/" element={<GalaxyView />} />
      <Route path="/g" element={<GalaxyView />} />
      <Route path="/g/:galaxy" element={<GalaxyView />} />
      <Route path="/g/:galaxy/b" element={<GalaxyView />} />
      <Route path="/g/:galaxy/b/:battle" element={<BattleView />} />
      <Route path="/g/:galaxy/submit" element={<SubmitView />} />
      <Route path="/submit" element={<SubmitView />} />
      <Route path="/advisors" element={<AdvisorView />} />
      <Route path="*" element={<GalaxyView />} />
    </Routes>
  );
}
