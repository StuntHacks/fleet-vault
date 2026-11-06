import { Routes, Route, useNavigate } from 'react-router-dom';
import GalaxyView from './views/galaxy';
import AdvisorView from './views/advisor';
import SubmitView from './views/submit';
import FlaggedView from './views/flagged';
import UpdatesView from './views/updates';
import EditView from './views/edit';
import AuditView from './views/audit';
import { useEffect } from 'react';
import { filteredStats } from './lib/battles';

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
      const isOnSubmit = path.endsWith('/submit') || /\/(edit|suggest|copy)\/\d+$/.test(path);

      if (isOnSubmit) {
        if (imageFile) {
          window.dispatchEvent(new CustomEvent('fv:paste-image', { detail: imageFile }));
        }
        return;
      }

      const galaxyMatch = path.match(/\/g\/(\d+)/);
      const galaxyId = galaxyMatch?.[1];
      const submitPath = galaxyId ? `/g/${galaxyId}/submit` : '/submit';
      const combatStats = galaxyId && /\/g\/\d+\/?$/.test(path) ? filteredStats(parseInt(galaxyId, 10)) : undefined;
      navigate(submitPath, { state: { pastedFile: imageFile, combatStats } });
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [navigate]);
  return (
    <Routes>
      <Route path="/" element={<GalaxyView />} />
      <Route path="/g" element={<GalaxyView />} />
      <Route path="/g/:galaxy" element={<GalaxyView />} />
      <Route path="/g/:galaxy/submit" element={<SubmitView />} />
      <Route path="/submit" element={<SubmitView />} />
      <Route path="/edit/:solution" element={<EditView />} />
      <Route path="/suggest/:solution" element={<EditView suggest />} />
      <Route path="/copy/:solution" element={<EditView copy />} />
      <Route path="/advisors" element={<AdvisorView />} />
      <Route path="/flagged" element={<FlaggedView />} />
      <Route path="/updates" element={<UpdatesView />} />
      <Route path="/audit" element={<AuditView />} />
      <Route path="*" element={<GalaxyView />} />
    </Routes>
  );
}
