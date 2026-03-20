import type { Node, Edge } from '@xyflow/react';
import { MarkerType, Position } from '@xyflow/react';

/** Dagre가 위치를 계산하므로 초기 position은 placeholder */
const PLACEHOLDER_POSITION = { x: 0, y: 0 };

/** 네임스페이스 그룹 프레임보다 위(ROS 노드가 가려지지 않도록) */
const Z_GRAPH_FOREGROUND = 2;

/** 액션 노드에 이미 표시되므로 그래프에서 제외할 _action 하위 5개 (토픽/서비스 공통) */
const ACTION_SUB_SUFFIXES = [
  '/_action/send_goal',
  '/_action/cancel_goal',
  '/_action/status',
  '/_action/feedback',
  '/_action/get_result',
];

function isActionSubResource(name: string): boolean {
  return ACTION_SUB_SUFFIXES.some((s) => name.endsWith(s));
}

/** rcl_interfaces 패키지 서비스(GetParameters, SetParameters 등)는 그래프에서 제외 */
function isRclInterfacesService(type: string): boolean {
  return type.trim().startsWith('rcl_interfaces/');
}

/** type_description_interfaces 패키지 서비스(GetTypeDescription 등 인트로스펙션용)는 그래프에서 제외 */
function isTypeDescriptionInterfacesService(type: string): boolean {
  return type.trim().startsWith('type_description_interfaces/');
}

export interface GraphVisibility {
  topics: boolean;
  services: boolean;
  actions: boolean;
}

/** 엣지 라벨/마커 스타일 공통 (노드-토픽/서비스/액션 엣지) */
const DEFAULT_EDGE_LABEL_STYLE = {
  labelStyle: { fontSize: 9, fill: 'hsl(var(--foreground))' },
  labelBgStyle: { fill: 'hsl(var(--card))' },
  labelBgPadding: [4, 2] as [number, number],
  labelBgBorderRadius: 4,
  markerEnd: { type: MarkerType.ArrowClosed as const },
};

export function buildTopologyGraph(
  nodes: string[],
  topicConnections: Record<string, { publishers: string[]; subscribers: string[] }>,
  topics: string[],
  topicTypes: string[],
  serviceToNode: Record<string, string>,
  services: string[],
  serviceTypes: string[],
  actions: string[],
  actionTypes: string[],
  actionToNode: Record<string, string>,
  actionToClients: Record<string, string[]>,
  visibility: GraphVisibility
): { nodes: Node[]; edges: Edge[] } {
  const { topics: showTopics, services: showServices, actions: showActions } = visibility;

  const nodeList: Node[] = nodes.map((name) => ({
    id: `node:${name}`,
    type: 'rosNode',
    position: PLACEHOLDER_POSITION,
    data: { label: name },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    zIndex: Z_GRAPH_FOREGROUND,
  }));

  const edgeList: Edge[] = [];

  // Topic 노드 + Node → Topic (publish), Topic → Node (subscribe) — _action 하위 토픽 제외
  if (showTopics) {
    const topicEntries = Object.entries(topicConnections).filter(
      ([topicName]) => topics.includes(topicName) && !isActionSubResource(topicName)
    );
    topicEntries.forEach(([topicName, { publishers, subscribers }]) => {
      const topicId = `topic:${topicName}`;
      const typeIdx = topics.indexOf(topicName);
      const msgType = typeIdx >= 0 ? topicTypes[typeIdx] ?? '' : '';
      const pubCount = publishers.filter((n) => nodes.includes(n)).length;
      const subCount = subscribers.filter((n) => nodes.includes(n)).length;
      nodeList.push({
        id: topicId,
        type: 'rosTopic',
        position: PLACEHOLDER_POSITION,
        data: {
          label: topicName,
          messageType: msgType || undefined,
          publisherCount: pubCount,
          subscriberCount: subCount,
          frequencyHz: null,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        zIndex: Z_GRAPH_FOREGROUND,
      });
      publishers
        .filter((pub) => nodes.includes(pub))
        .forEach((pub) => {
          edgeList.push({
            id: `e:pub:${pub}-${topicName}`,
            source: `node:${pub}`,
            target: topicId,
            label: 'publish',
            type: 'default',
            ...DEFAULT_EDGE_LABEL_STYLE,
            animated: true,
            data: { topicName, topicType: msgType },
          });
        });
      subscribers
        .filter((sub) => nodes.includes(sub))
        .forEach((sub) => {
          edgeList.push({
            id: `e:sub:${topicName}-${sub}`,
            source: topicId,
            target: `node:${sub}`,
            label: 'subscribe',
            type: 'default',
            ...DEFAULT_EDGE_LABEL_STYLE,
            animated: true,
            data: { topicName, topicType: msgType },
          });
        });
    });
  }

  // Service 노드 (전체 services) + Service → Node (server) — _action 하위 서비스(get_result), rcl_interfaces·type_description_interfaces 제외
  if (showServices) {
    services
      .filter((name) => !isActionSubResource(name))
      .filter((name) => {
        const typeIdx = services.indexOf(name);
        const srvType = typeIdx >= 0 ? serviceTypes[typeIdx] ?? '' : '';
        return (
          !isRclInterfacesService(srvType) &&
          !isTypeDescriptionInterfacesService(srvType)
        );
      })
      .forEach((serviceName) => {
      const srvId = `service:${serviceName}`;
      const typeIdx = services.indexOf(serviceName);
      const srvType = typeIdx >= 0 ? serviceTypes[typeIdx] ?? '' : '';
      const providerNode = serviceToNode[serviceName];
      const serverCount = providerNode && nodes.includes(providerNode) ? 1 : 0;
      nodeList.push({
        id: srvId,
        type: 'rosService',
        position: PLACEHOLDER_POSITION,
        data: {
          label: serviceName,
          serviceType: srvType || undefined,
          serverCount,
          clientCount: null,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        zIndex: Z_GRAPH_FOREGROUND,
      });
      if (providerNode && nodes.includes(providerNode)) {
        edgeList.push({
          id: `e:srv:${serviceName}-${providerNode}`,
          source: srvId,
          target: `node:${providerNode}`,
          label: 'server',
          type: 'default',
          ...DEFAULT_EDGE_LABEL_STYLE,
          data: { kind: 'service' as const, serviceName, serviceType: srvType },
        });
      }
    });
  }

  // Action 노드 (확장 서비스에서 받은 목록) + Client → Action, Action → Server 엣지
  if (showActions && actions.length > 0) {
    actions.forEach((actionName, i) => {
      const actionId = `action:${actionName}`;
      const actType = actionTypes[i] ?? '';
      const serverNode = actionToNode[actionName];
      const clientNodes = actionToClients[actionName] ?? [];

      nodeList.push({
        id: actionId,
        type: 'rosAction',
        position: PLACEHOLDER_POSITION,
        data: {
          label: actionName,
          actionType: actType || undefined,
          hasGoal: true,
          hasFeedback: true,
          hasResult: true,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        zIndex: Z_GRAPH_FOREGROUND,
      });
      clientNodes
        .filter((client) => nodes.includes(client))
        .forEach((client) => {
          edgeList.push({
            id: `e:actclient:${client}-${actionName}`,
            source: `node:${client}`,
            target: actionId,
            label: 'action client',
            type: 'default',
            ...DEFAULT_EDGE_LABEL_STYLE,
            data: { kind: 'action' as const, actionName, actionType: actType },
          });
        });
      if (serverNode && nodes.includes(serverNode)) {
        edgeList.push({
          id: `e:act:${actionName}-${serverNode}`,
          source: actionId,
          target: `node:${serverNode}`,
          label: 'action server',
          type: 'default',
          ...DEFAULT_EDGE_LABEL_STYLE,
          data: { kind: 'action' as const, actionName, actionType: actType },
        });
      }
    });
  }

  return { nodes: nodeList, edges: edgeList };
}
