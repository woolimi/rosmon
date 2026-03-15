import { useMemo } from 'react';

export interface NodeDetailProps {
  publishers: string[];
  subscribers: string[];
  services: string[];
  actions: string[];
}

export function useNodeDetailProps(
  selectedNodeName: string | null,
  topicConnections: Record<string, { publishers: string[]; subscribers: string[] }>,
  serviceToNode: Record<string, string>,
  actionToNode: Record<string, string>
): NodeDetailProps {
  return useMemo(() => {
    if (!selectedNodeName) {
      return {
        publishers: [],
        subscribers: [],
        services: [],
        actions: [],
      };
    }
    const publishers: string[] = [];
    const subscribers: string[] = [];
    Object.entries(topicConnections).forEach(([topic, { publishers: pubs, subscribers: subs }]) => {
      if (pubs.includes(selectedNodeName)) publishers.push(topic);
      if (subs.includes(selectedNodeName)) subscribers.push(topic);
    });
    const servicesProvided = Object.entries(serviceToNode)
      .filter(([, node]) => node === selectedNodeName)
      .map(([s]) => s);
    const actionsProvided = Object.entries(actionToNode)
      .filter(([, node]) => node === selectedNodeName)
      .map(([a]) => a);
    return {
      publishers,
      subscribers,
      services: servicesProvided,
      actions: actionsProvided,
    };
  }, [selectedNodeName, topicConnections, serviceToNode, actionToNode]);
}
