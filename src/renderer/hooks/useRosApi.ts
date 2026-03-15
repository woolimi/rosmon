import { useState, useCallback } from 'react';
import type { RosmonBridgeClient } from '@/lib/rosmonBridge';

export interface TopicConnection {
  publishers: string[];
  subscribers: string[];
}

export interface RosApiState {
  topics: string[];
  topicTypes: string[];
  services: string[];
  serviceTypes: string[];
  nodes: string[];
  actions: string[];
  actionTypes: string[];
  topicConnections: Record<string, TopicConnection>;
  serviceToNode: Record<string, string>;
  actionToNode: Record<string, string>;
  actionToClients: Record<string, string[]>;
  loading: boolean;
  error: string | null;
  /** ROS_DOMAIN_ID from bridge env (for "no nodes" hint). */
  rosDomainId: string;
}

const initialState: RosApiState = {
  topics: [],
  topicTypes: [],
  services: [],
  serviceTypes: [],
  nodes: [],
  actions: [],
  actionTypes: [],
  topicConnections: {},
  serviceToNode: {},
  actionToNode: {},
  actionToClients: {},
  loading: false,
  error: null,
  rosDomainId: '',
};

export function useRosApi(ros: RosmonBridgeClient | null) {
  const [state, setState] = useState<RosApiState>(initialState);

  const refresh = useCallback(
    async (): Promise<{ topics: string[]; services: string[] } | void> => {
      
      if (!ros) {
        setState(initialState);
        return;
      }
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await ros.getGraph();
        setState({
          topics: result.topics ?? [],
          topicTypes: result.topicTypes ?? [],
          services: result.services ?? [],
          serviceTypes: result.serviceTypes ?? [],
          nodes: result.nodes ?? [],
          actions: result.actions ?? [],
          actionTypes: result.actionTypes ?? [],
          topicConnections: result.topicConnections ?? {},
          serviceToNode: result.serviceToNode ?? {},
          actionToNode: result.actionToNode ?? {},
          actionToClients: result.actionToClients ?? {},
          loading: false,
          error: null,
          rosDomainId: result.rosDomainId ?? '',
        });
        return {
          topics: result.topics ?? [],
          services: result.services ?? [],
        };
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    },
    [ros]
  );

  return {
    ...state,
    refresh,
  };
}
