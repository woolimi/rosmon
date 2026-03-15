import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RosProvider } from '@/contexts/RosContext';
import { useRos } from '@/hooks/useRos';
import { Layout } from '@/components/layout/Layout';
import { Graph } from '@/pages/Graph';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Graph />} />
        <Route path="graph" element={<Graph />} />
      </Route>
    </Routes>
  );
}

function App() {
  const rosApi = useRos();
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <RosProvider value={rosApi}>
        <AppRoutes />
      </RosProvider>
    </BrowserRouter>
  );
}

export default App;
