import { createContext, useContext, useState, type ReactNode } from 'react';
import type { UseRosReturn } from '@/hooks/useRos';

export type RosContextValue = UseRosReturn & {
  graphLoading: boolean;
  setGraphLoading: (v: boolean) => void;
};

const RosContext = createContext<RosContextValue | null>(null);

export function useRosContext(): RosContextValue {
  const ctx = useContext(RosContext);
  if (!ctx) throw new Error('useRosContext must be used within RosProvider');
  return ctx;
}

export function RosProvider({ children, value }: { children: ReactNode; value: UseRosReturn }) {
  const [graphLoading, setGraphLoading] = useState(false);
  const contextValue: RosContextValue = { ...value, graphLoading, setGraphLoading };
  return (
    <RosContext.Provider value={contextValue}>
      {children}
    </RosContext.Provider>
  );
}
