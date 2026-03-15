import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import { Position } from '@xyflow/react';

const { layout, graphlib } = dagre;

/** 노드 타입별 대략적인 크기 (dagre 겹침 방지용) */
const NODE_SIZE: Record<string, { width: number; height: number }> = {
  rosNode: { width: 120, height: 44 },
  rosTopic: { width: 100, height: 60 },
  rosService: { width: 100, height: 60 },
  /** 액션 + _action 하위 5개(send_goal, cancel_goal, status, feedback, get_result) 박스 포함 */
  rosAction: { width: 120, height: 128 },
};

const DEFAULT_SIZE = { width: 100, height: 50 };

const ISOLATED_GAP = 120;
const ISOLATED_ROW = 60;

/** 원 반지름 최소값 (리소스 0개일 때) */
const MIN_CIRCLE_RADIUS = 60;
/** 연관 토픽/서비스 1개당 추가되는 반지름 (반지름 = MIN + count × 이 값) */
const RADIUS_PER_RESOURCE = 28;
/** ROS 노드 원 간 최소 간격(원이 겹치지 않도록) */
const ROS_CIRCLE_GAP = 50;

const RESOURCE_TYPES = new Set<string>(['rosTopic', 'rosService', 'rosAction']);

/**
 * 연관 토픽/서비스 개수에 비례한 원 반지름 (반지름 = MIN + count × RADIUS_PER_RESOURCE)
 */
function radiusFromResourceCount(count: number): number {
  if (count <= 0) return MIN_CIRCLE_RADIUS;
  return MIN_CIRCLE_RADIUS + count * RADIUS_PER_RESOURCE;
}

/** 노드들을 원 위에 균등 배치 (위치만 갱신) */
function placeNodesOnCircle(
  nodeList: Node[],
  centerX: number,
  centerY: number,
  radius: number
): void {
  const n = nodeList.length;
  if (n === 0) return;
  nodeList.forEach((node, i) => {
    const size = (node.type && NODE_SIZE[node.type]) || DEFAULT_SIZE;
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const cx = centerX + radius * Math.cos(angle);
    const cy = centerY + radius * Math.sin(angle);
    (node as Node).position = {
      x: cx - size.width / 2,
      y: cy - size.height / 2,
    };
  });
}

/** 고립 노드를 한 곳에 세로로 배치 */
function placeIsolatedNodes(
  isolated: Node[],
  anchorX: number,
  anchorY: number
): void {
  isolated.forEach((node, i) => {
    (node as Node).position = {
      x: anchorX,
      y: anchorY + i * ISOLATED_ROW,
    };
  });
}

/**
 * 하이브리드 레이아웃:
 * - rosNode: Dagre로 배치
 * - 노드와 연결된 토픽/서비스/액션: 원형(circular) 배치 (rosNode 영역 중심 원 위)
 * - 고립 노드(엣지 없음): 오른쪽 세로 배치
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR'
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };

  const connectedIds = new Set<string>();
  edges.forEach((e) => {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
  });

  const isolated = nodes.filter((n) => !connectedIds.has(n.id));
  const connected = nodes.filter((n) => connectedIds.has(n.id));
  const connectedRosNodes = connected.filter((n) => n.type === 'rosNode');

  const resourceToRosIds = new Map<string, string[]>();
  edges.forEach((e) => {
    const src = e.source;
    const tgt = e.target;
    const srcIsRos = nodes.some((n) => n.id === src && n.type === 'rosNode');
    const tgtIsRos = nodes.some((n) => n.id === tgt && n.type === 'rosNode');
    if (srcIsRos && tgtIsRos) return;
    const rosId = srcIsRos ? src : tgtIsRos ? tgt : null;
    const resourceId = srcIsRos ? tgt : tgtIsRos ? src : null;
    if (rosId && resourceId && RESOURCE_TYPES.has(nodes.find((n) => n.id === resourceId)?.type ?? '')) {
      if (!resourceToRosIds.has(resourceId)) resourceToRosIds.set(resourceId, []);
      const list = resourceToRosIds.get(resourceId)!;
      if (!list.includes(rosId)) list.push(rosId);
    }
  });

  const rosToResourceIds = new Map<string, string[]>();
  resourceToRosIds.forEach((rosIds, resourceId) => {
    const assignTo = rosIds[0];
    if (!rosToResourceIds.has(assignTo)) rosToResourceIds.set(assignTo, []);
    rosToResourceIds.get(assignTo)!.push(resourceId);
  });

  let maxRadius = MIN_CIRCLE_RADIUS;
  connectedRosNodes.forEach((n) => {
    const count = rosToResourceIds.get(n.id)?.length ?? 0;
    const r = radiusFromResourceCount(count);
    if (r > maxRadius) maxRadius = r;
  });
  const minRosNodeDistance = 2 * maxRadius + ROS_CIRCLE_GAP;

  const g = new graphlib.Graph({ compound: true }).setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: minRosNodeDistance,
    ranksep: minRosNodeDistance,
    marginx: 24,
    marginy: 24,
  });
  if (connectedRosNodes.length > 0) {
    connectedRosNodes.forEach((node) => {
      const size = (node.type && NODE_SIZE[node.type]) || DEFAULT_SIZE;
      g.setNode(node.id, { width: size.width, height: size.height });
    });
    const rosEdges = new Set<string>();
    resourceToRosIds.forEach((rosIds) => {
      for (let i = 0; i < rosIds.length; i++) {
        for (let j = i + 1; j < rosIds.length; j++) {
          const a = rosIds[i];
          const b = rosIds[j];
          const key = a < b ? `${a}:${b}` : `${b}:${a}`;
          if (!rosEdges.has(key)) {
            rosEdges.add(key);
            g.setEdge(a, b);
          }
        }
      }
    });
    layout(g);
  }

  const layoutedNodes = nodes.map((node) => {
    if (node.type === 'rosNode' && connectedIds.has(node.id)) {
      const nodeWithPosition = g.node(node.id);
      if (!nodeWithPosition) return { ...node, position: { x: 0, y: 0 } };
      const size = (node.type && NODE_SIZE[node.type]) || DEFAULT_SIZE;
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - size.width / 2,
          y: nodeWithPosition.y - size.height / 2,
        },
        sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
        targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      };
    }
    return {
      ...node,
      position: { x: 0, y: 0 },
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
    };
  });

  const rosNodeCenter = (nodeId: string) => {
    const n = layoutedNodes.find((x) => x.id === nodeId);
    if (!n) return null;
    const pos = n.position;
    const size = (n.type && NODE_SIZE[n.type]) || DEFAULT_SIZE;
    return {
      x: (typeof pos.x === 'number' ? pos.x : 0) + size.width / 2,
      y: (typeof pos.y === 'number' ? pos.y : 0) + size.height / 2,
    };
  };

  connectedRosNodes.forEach((rosNode) => {
    const resourceIds = rosToResourceIds.get(rosNode.id) ?? [];
    if (resourceIds.length === 0) return;
    const center = rosNodeCenter(rosNode.id);
    if (!center) return;
    const radius = radiusFromResourceCount(resourceIds.length);
    const resourceNodes = resourceIds
      .map((id) => layoutedNodes.find((n) => n.id === id))
      .filter((n): n is Node => n != null);
    placeNodesOnCircle(resourceNodes, center.x, center.y, radius);
  });

  if (isolated.length > 0) {
    let anchorX = 0;
    let anchorY = 0;
    const nonIsolated = layoutedNodes.filter((n) => connectedIds.has(n.id));
    if (nonIsolated.length > 0) {
      let maxX = -Infinity;
      let minY = Infinity;
      nonIsolated.forEach((n) => {
        const pos = n.position;
        const x = typeof pos.x === 'number' ? pos.x : 0;
        const y = typeof pos.y === 'number' ? pos.y : 0;
        const size = (n.type && NODE_SIZE[n.type]) || DEFAULT_SIZE;
        maxX = Math.max(maxX, x + size.width);
        minY = Math.min(minY, y);
      });
      anchorX = maxX + ISOLATED_GAP;
      anchorY = minY;
    }
    const isolatedNodes = layoutedNodes.filter((n) => !connectedIds.has(n.id));
    placeIsolatedNodes(isolatedNodes, anchorX, anchorY);
  }

  const layoutedEdges = assignEdgeHandles(layoutedNodes, edges);
  return { nodes: layoutedNodes, edges: layoutedEdges };
}

export type HandleSide = 'left' | 'right' | 'top' | 'bottom';

function getNodeCenter(
  node: Node,
  size: { width: number; height: number }
): { x: number; y: number } {
  const pos = node.position;
  const x = typeof pos.x === 'number' ? pos.x : 0;
  const y = typeof pos.y === 'number' ? pos.y : 0;
  return { x: x + size.width / 2, y: y + size.height / 2 };
}

/** 노드 위치 기준으로 엣지별 최단 방향의 sourceHandle/targetHandle 부여 (드래그 시 재계산용으로 export) */
export function assignEdgeHandles(nodes: Node[], edges: Edge[]): Edge[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const sizeOf = (node: Node) =>
    (node.type && NODE_SIZE[node.type]) || DEFAULT_SIZE;

  return edges.map((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) return edge;

    const srcCenter = getNodeCenter(sourceNode, sizeOf(sourceNode));
    const tgtCenter = getNodeCenter(targetNode, sizeOf(targetNode));
    const dx = tgtCenter.x - srcCenter.x;
    const dy = tgtCenter.y - srcCenter.y;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    let sourceHandle: HandleSide;
    let targetHandle: HandleSide;
    if (absDx >= absDy) {
      sourceHandle = dx >= 0 ? 'right' : 'left';
      targetHandle = dx >= 0 ? 'left' : 'right';
    } else {
      sourceHandle = dy >= 0 ? 'bottom' : 'top';
      targetHandle = dy >= 0 ? 'top' : 'bottom';
    }

    return {
      ...edge,
      sourceHandle,
      targetHandle,
    };
  });
}
