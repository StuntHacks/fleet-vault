import { Routes, Route, useNavigate } from 'react-router-dom';
import GalaxyView from './views/galaxy';
import BattleView from './views/battle';
import AdvisorView from './views/advisor';
import SubmitView from './views/submit';
import { useEffect } from 'react';

export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.transition = undefined as unknown as string;
    const timer = setTimeout(() => {
      document.body.style.transition = "background-color 150ms, color 150ms, border-color 150ms";
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      let imageFile: File | undefined;
      if (e.clipboardData?.items) {
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) { imageFile = file; break; }
          }
        }
      }

      const path = window.location.pathname;
      const isOnSubmit = path.endsWith('/submit');

      if (isOnSubmit) {
        if (imageFile) {
          window.dispatchEvent(new CustomEvent('fv:paste-image', { detail: imageFile }));
        }
        return;
      }

      const galaxyMatch = path.match(/\/g\/(\d+)/);
      const galaxyId = galaxyMatch?.[1];
      const submitPath = galaxyId ? `/g/${galaxyId}/submit` : '/submit';
      navigate(submitPath, imageFile ? { state: { pastedFile: imageFile } } : undefined);
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [navigate]);
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
