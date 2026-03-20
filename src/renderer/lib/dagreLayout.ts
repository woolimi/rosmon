import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import { Position } from '@xyflow/react';
import {
  GRAPH_RESOURCE_NODE_MAX_WIDTH_PX,
  graphNamespaceGroupInnerContentWidthPx,
} from '@/lib/graph/graphNodeLayout';

const { layout, graphlib } = dagre;

/** 노드 타입별 대략적인 크기 (dagre 겹침 방지용) */
const NODE_SIZE: Record<string, { width: number; height: number }> = {
  rosNode: { width: 120, height: 44 },
  rosTopic: { width: GRAPH_RESOURCE_NODE_MAX_WIDTH_PX, height: 60 },
  rosService: { width: GRAPH_RESOURCE_NODE_MAX_WIDTH_PX, height: 60 },
  /** 액션 + _action 하위 5개(send_goal, cancel_goal, status, feedback, get_result) 박스 포함 */
  rosAction: { width: GRAPH_RESOURCE_NODE_MAX_WIDTH_PX, height: 128 },
};

/** ROS 중심~리소스 카드 바깥까지 대략 반경(원 배치 시 Dagre 간격에 가산) */
const LAYOUT_RESOURCE_HALF_EXTENT = Math.hypot(
  GRAPH_RESOURCE_NODE_MAX_WIDTH_PX / 2,
  NODE_SIZE.rosAction.height / 2
);

const DEFAULT_SIZE = { width: 100, height: 50 };

const ISOLATED_GAP = 176;
const ISOLATED_ROW = 60;

/** 원 반지름 최소값 (리소스 0개일 때) */
const MIN_CIRCLE_RADIUS = 60;
/** 연관 토픽/서비스 1개당 추가되는 반지름 (반지름 = MIN + count × 이 값) */
const RADIUS_PER_RESOURCE = 28;
/** ROS 노드 원 간 최소 간격(원이 겹치지 않도록) */
const ROS_CIRCLE_GAP = 50;

const RESOURCE_TYPES = new Set<string>(['rosTopic', 'rosService', 'rosAction']);

export const ROS_NAMESPACE_GROUP_TYPE = 'rosNamespaceGroup' as const;

/** `/turtle1/cmd_vel` → `/turtle1`; 단일 세그먼트(`/chatter`)는 null */
export function getRosNamespacePrefix(rosPath: string): string | null {
  const t = rosPath.trim();
  if (!t.startsWith('/')) return null;
  const parts = t.split('/').filter(Boolean);
  if (parts.length <= 1) return null;
  return `/${parts.slice(0, -1).join('/')}`;
}

const NS_GROUP_PAD = 10;
/** 그룹명 한 줄(text-sm) + 상단 패딩 */
const NS_GROUP_HEADER = 34;
/** 그룹 프레임은 ROS 노드·액션보다 뒤 */
const Z_NS_GROUP = 0;
/** 그룹 안 리소스는 프레임보다 앞, 메인 그래프 노드보다 뒤 */
const Z_NS_GROUP_MEMBER = 1;
/** 그룹 멤버를 한곳에 모을 때 노드 간 간격 */
const NS_MEMBER_STACK_GAP = 8;
/** 네임스페이스 그룹 슬롯은 같은 각에서 일반 리소스보다 ROS 중심에서 이만큼 더 멀리 (큰 프레임 가독성) */
const NS_CIRCLE_RADIUS_EXTRA = 48;
/** 그룹은 수평(좌·우) 부채꼴, 단일은 수직(상·하) 부채꼴 — 각도 반폭(라디안) */
const NS_PLACE_H_FAN_HALF = Math.PI / 6;
const NS_PLACE_V_FAN_HALF = Math.PI / 6;

/** 원형 배치 1슬롯: 단일 리소스 또는 네임스페이스 묶음 */
type PlacementUnit =
  | { kind: 'single'; id: string }
  | { kind: 'namespace'; prefix: string; ids: string[] };

function buildResourceRosAssignments(
  nodes: Node[],
  edges: Edge[]
): {
  resourceToRosIds: Map<string, string[]>;
  rosToResourceIds: Map<string, string[]>;
} {
  const resourceToRosIds = new Map<string, string[]>();

  edges.forEach((e) => {
    const src = e.source;
    const tgt = e.target;
    const srcIsRos = nodes.some((n) => n.id === src && n.type === 'rosNode');
    const tgtIsRos = nodes.some((n) => n.id === tgt && n.type === 'rosNode');
    if (srcIsRos && tgtIsRos) return;
    const rosId = srcIsRos ? src : tgtIsRos ? tgt : null;
    const resourceId = srcIsRos ? tgt : tgtIsRos ? src : null;
    if (
      rosId &&
      resourceId &&
      RESOURCE_TYPES.has(nodes.find((n) => n.id === resourceId)?.type ?? '')
    ) {
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

  return { resourceToRosIds, rosToResourceIds };
}

function buildPlacementUnits(resourceIds: string[], nodeById: Map<string, Node>): PlacementUnit[] {
  const nsBuckets = new Map<string, string[]>();
  const singletonIds: string[] = [];

  for (const id of resourceIds) {
    const n = nodeById.get(id);
    if (!n) continue;
    if (n.type !== 'rosTopic' && n.type !== 'rosService' && n.type !== 'rosAction') {
      singletonIds.push(id);
      continue;
    }
    const label = (n.data as { label?: string }).label ?? '';
    const p = getRosNamespacePrefix(label);
    if (!p) singletonIds.push(id);
    else {
      if (!nsBuckets.has(p)) nsBuckets.set(p, []);
      nsBuckets.get(p)!.push(id);
    }
  }

  const units: PlacementUnit[] = [];
  for (const id of singletonIds) units.push({ kind: 'single', id });

  for (const [prefix, ids] of nsBuckets) {
    ids.sort((a, b) => {
      const la = (nodeById.get(a)?.data as { label?: string }).label ?? a;
      const lb = (nodeById.get(b)?.data as { label?: string }).label ?? b;
      return la.localeCompare(lb);
    });
    units.push({ kind: 'namespace', prefix, ids });
  }

  const sortKey = (u: PlacementUnit) =>
    u.kind === 'single'
      ? ((nodeById.get(u.id)?.data as { label?: string }).label ?? u.id)
      : u.prefix;

  units.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  return units;
}

function sizeOfForLayout(node: Node): { width: number; height: number } {
  if (node.width != null && node.height != null) {
    return { width: node.width, height: node.height };
  }
  return (node.type && NODE_SIZE[node.type]) || DEFAULT_SIZE;
}

/** UI `max-width`와 동일 — 긴 이름은 truncate */
function effectiveResourceWidth(node: Node): number {
  if (node.type === 'rosTopic' || node.type === 'rosService' || node.type === 'rosAction') {
    return GRAPH_RESOURCE_NODE_MAX_WIDTH_PX;
  }
  return sizeOfForLayout(node).width;
}

/** (centroidX, centroidY)를 스택 세로 중심으로 같은 네임스페이스 노드 배치 */
function packNamespaceAtCentroid(
  nodeById: Map<string, Node>,
  ids: string[],
  centroidX: number,
  centroidY: number
): void {
  type Entry = { node: Node; label: string; layoutW: number; h: number };
  const entries: Entry[] = [];
  for (const id of ids) {
    const n = nodeById.get(id);
    if (!n) continue;
    const label = (n.data as { label?: string }).label ?? id;
    const size = sizeOfForLayout(n);
    entries.push({
      node: n,
      label,
      layoutW: effectiveResourceWidth(n),
      h: size.height,
    });
  }
  if (entries.length === 0) return;

  entries.sort((a, b) => a.label.localeCompare(b.label));
  const maxW = Math.max(...entries.map((e) => e.layoutW));
  const totalH =
    entries.reduce((acc, e) => acc + e.h, 0) +
    NS_MEMBER_STACK_GAP * (entries.length - 1);

  let y = centroidY - totalH / 2;
  const colLeft = centroidX - maxW / 2;

  for (const e of entries) {
    const nx = colLeft + (maxW - e.layoutW) / 2;
    e.node.position = { x: nx, y };
    y += e.h + NS_MEMBER_STACK_GAP;
  }
}

/** count개 슬롯을 center 각도 주변 ±halfWidth 부채꼴에 균등 배치 */
function fanAngles(count: number, center: number, halfWidth: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [center];
  return Array.from(
    { length: count },
    (_, j) => center - halfWidth + (2 * halfWidth * j) / (count - 1)
  );
}

function placePlacementUnitsOnCircle(
  units: PlacementUnit[],
  centerX: number,
  centerY: number,
  radius: number,
  layoutedById: Map<string, Node>
): void {
  const n = units.length;
  if (n === 0) return;

  const nsIndexed = units
    .map((u, i) => ({ unit: u, i }))
    .filter((x) => x.unit.kind === 'namespace');
  const singleIndexed = units
    .map((u, i) => ({ unit: u, i }))
    .filter((x) => x.unit.kind === 'single');

  const angles: number[] = new Array(n);

  if (nsIndexed.length === 0) {
    for (let i = 0; i < n; i++) {
      angles[i] = (2 * Math.PI * i) / n - Math.PI / 2;
    }
  } else {
    const rightNs = nsIndexed.filter((_, k) => k % 2 === 0);
    const leftNs = nsIndexed.filter((_, k) => k % 2 === 1);
    const rightAngles = fanAngles(rightNs.length, 0, NS_PLACE_H_FAN_HALF);
    const leftAngles = fanAngles(leftNs.length, Math.PI, NS_PLACE_H_FAN_HALF);
    let ri = 0;
    let li = 0;
    for (let k = 0; k < nsIndexed.length; k++) {
      const { i: idx } = nsIndexed[k];
      angles[idx] = k % 2 === 0 ? rightAngles[ri++]! : leftAngles[li++]!;
    }

    const topSingles = singleIndexed.filter((_, k) => k % 2 === 0);
    const bottomSingles = singleIndexed.filter((_, k) => k % 2 === 1);
    const topAngles = fanAngles(topSingles.length, -Math.PI / 2, NS_PLACE_V_FAN_HALF);
    const bottomAngles = fanAngles(bottomSingles.length, Math.PI / 2, NS_PLACE_V_FAN_HALF);
    let ti = 0;
    let bi = 0;
    for (let k = 0; k < singleIndexed.length; k++) {
      const { i: idx } = singleIndexed[k];
      angles[idx] = k % 2 === 0 ? topAngles[ti++]! : bottomAngles[bi++]!;
    }
  }

  units.forEach((unit, i) => {
    const angle = angles[i]!;
    const r =
      unit.kind === 'namespace' ? radius + NS_CIRCLE_RADIUS_EXTRA : radius;
    const cx = centerX + r * Math.cos(angle);
    const cy = centerY + r * Math.sin(angle);

    if (unit.kind === 'single') {
      const node = layoutedById.get(unit.id);
      if (!node) return;
      const size = sizeOfForLayout(node);
      const w = effectiveResourceWidth(node);
      node.position = { x: cx - w / 2, y: cy - size.height / 2 };
    } else {
      packNamespaceAtCentroid(layoutedById, unit.ids, cx, cy);
    }
  });
}

function namespaceGroupId(rosNodeId: string, prefix: string): string {
  return `group:${rosNodeId}:ns:${prefix}`;
}

/**
 * ROS 노드별로 원형 배치된 네임스페이스 단위에 맞춰 부모 그룹을 만든다.
 * (getLayoutedElements의 PlacementUnit과 동일한 기준)
 */
export function applyNamespaceGrouping(nodes: Node[], edges: Edge[]): Node[] {
  const { rosToResourceIds } = buildResourceRosAssignments(nodes, edges);
  const refById = new Map(nodes.map((n) => [n.id, n]));

  const nodeMap = new Map<string, Node>();
  for (const n of nodes) {
    nodeMap.set(n.id, { ...n });
  }

  const groupNodes: Node[] = [];

  for (const n of nodes) {
    if (n.type !== 'rosNode') continue;
    const resourceIds = rosToResourceIds.get(n.id);
    if (!resourceIds?.length) continue;

    const units = buildPlacementUnits(resourceIds, refById);
    for (const u of units) {
      if (u.kind !== 'namespace') continue;
      const ids = u.ids;
      const prefix = u.prefix;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const mid of ids) {
        const node = nodeMap.get(mid);
        if (!node) continue;
        const x = typeof node.position.x === 'number' ? node.position.x : 0;
        const y = typeof node.position.y === 'number' ? node.position.y : 0;
        const size = sizeOfForLayout(node);
        const w = effectiveResourceWidth(node);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + size.height);
      }
      if (!Number.isFinite(minX)) continue;

      const groupId = namespaceGroupId(n.id, prefix);
      /** 자식 노드 최대폭 + 여유(헤더는 truncate) */
      const innerContentW = graphNamespaceGroupInnerContentWidthPx();
      const width = innerContentW + 2 * NS_GROUP_PAD;
      const contentCenterX = (minX + maxX) / 2;
      const parentX = contentCenterX - width / 2;
      const parentY = minY - NS_GROUP_PAD - NS_GROUP_HEADER;
      const height = maxY - minY + 2 * NS_GROUP_PAD + NS_GROUP_HEADER;

      groupNodes.push({
        id: groupId,
        type: ROS_NAMESPACE_GROUP_TYPE,
        position: { x: parentX, y: parentY },
        data: { label: prefix },
        width,
        height,
        selectable: false,
        zIndex: Z_NS_GROUP,
        style: { width, height },
      });

      for (const mid of ids) {
        const node = nodeMap.get(mid);
        if (!node) continue;
        const x = typeof node.position.x === 'number' ? node.position.x : 0;
        const y = typeof node.position.y === 'number' ? node.position.y : 0;
        node.parentId = groupId;
        node.position = { x: x - parentX, y: y - parentY };
        node.extent = 'parent';
        node.zIndex = Z_NS_GROUP_MEMBER;
      }
    }
  }

  const ordered: Node[] = [...groupNodes];
  for (const n of nodes) {
    ordered.push(nodeMap.get(n.id)!);
  }
  return ordered;
}

/**
 * 연관 토픽/서비스 개수에 비례한 원 반지름 (반지름 = MIN + count × RADIUS_PER_RESOURCE)
 */
function radiusFromResourceCount(count: number): number {
  if (count <= 0) return MIN_CIRCLE_RADIUS;
  return MIN_CIRCLE_RADIUS + count * RADIUS_PER_RESOURCE;
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

  const { resourceToRosIds, rosToResourceIds } = buildResourceRosAssignments(nodes, edges);
  const inputNodeById = new Map(nodes.map((n) => [n.id, n]));

  let maxRadius = MIN_CIRCLE_RADIUS;
  connectedRosNodes.forEach((n) => {
    const resourceIds = rosToResourceIds.get(n.id) ?? [];
    const units = buildPlacementUnits(resourceIds, inputNodeById);
    const baseR = radiusFromResourceCount(units.length);
    let extent = baseR;
    for (const u of units) {
      const r = u.kind === 'namespace' ? baseR + NS_CIRCLE_RADIUS_EXTRA : baseR;
      if (r > extent) extent = r;
    }
    if (extent > maxRadius) maxRadius = extent;
  });
  const minRosNodeDistance =
    2 * (maxRadius + LAYOUT_RESOURCE_HALF_EXTENT) + ROS_CIRCLE_GAP;

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

  const layoutedById = new Map(layoutedNodes.map((n) => [n.id, n]));

  connectedRosNodes.forEach((rosNode) => {
    const resourceIds = rosToResourceIds.get(rosNode.id) ?? [];
    if (resourceIds.length === 0) return;
    const center = rosNodeCenter(rosNode.id);
    if (!center) return;
    const units = buildPlacementUnits(resourceIds, inputNodeById);
    const radius = radiusFromResourceCount(units.length);
    placePlacementUnitsOnCircle(units, center.x, center.y, radius, layoutedById);
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

/** parentId 체인을 따라 flow 좌표계에서의 노드 좌상단 */
function getAbsoluteTopLeft(node: Node, nodeMap: Map<string, Node>): { x: number; y: number } {
  const chain: Node[] = [];
  let cur: Node | undefined = node;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? nodeMap.get(cur.parentId) : undefined;
  }
  let x = 0;
  let y = 0;
  for (const n of chain) {
    x += typeof n.position.x === 'number' ? n.position.x : 0;
    y += typeof n.position.y === 'number' ? n.position.y : 0;
  }
  return { x, y };
}

function getNodeCenterAbsolute(
  node: Node,
  size: { width: number; height: number },
  nodeMap: Map<string, Node>
): { x: number; y: number } {
  const topLeft = getAbsoluteTopLeft(node, nodeMap);
  return {
    x: topLeft.x + size.width / 2,
    y: topLeft.y + size.height / 2,
  };
}

function measuredNodeSize(node: Node): { width: number; height: number } {
  if (node.width != null && node.height != null) {
    return { width: node.width, height: node.height };
  }
  const base = (node.type && NODE_SIZE[node.type]) || DEFAULT_SIZE;
  if (node.type === 'rosTopic' || node.type === 'rosService' || node.type === 'rosAction') {
    return { width: effectiveResourceWidth(node), height: base.height };
  }
  return base;
}

const OVERLAP_SEP_GAP = 16;
const OVERLAP_SEP_ITERS = 36;

function translationRoot(node: Node, nodeMap: Map<string, Node>): Node {
  let cur: Node = node;
  const seen = new Set<string>();
  while (cur.parentId && !seen.has(cur.id)) {
    seen.add(cur.id);
    const p = nodeMap.get(cur.parentId);
    if (!p) break;
    cur = p;
  }
  return cur;
}

function axisAlignedRect(node: Node, nodeMap: Map<string, Node>) {
  const tl = getAbsoluteTopLeft(node, nodeMap);
  const sz = measuredNodeSize(node);
  return {
    left: tl.x,
    top: tl.y,
    right: tl.x + sz.width,
    bottom: tl.y + sz.height,
    midX: tl.x + sz.width / 2,
    midY: tl.y + sz.height / 2,
    node,
  };
}

/**
 * 배치 후 AABB 겹침을 줄이기 위해 이동 가능한 루트(그룹·단독 리소스)만 미세 이동.
 * rosNode는 고정, 겹치면 상대만 밀어냄.
 */
export function resolveGraphNodeOverlaps(nodes: Node[], gap = OVERLAP_SEP_GAP): Node[] {
  const next = nodes.map((n) => ({
    ...n,
    position: { x: n.position.x, y: n.position.y },
    ...(n.style ? { style: { ...n.style } } : {}),
  })) as Node[];
  const map = new Map(next.map((n) => [n.id, n]));

  const nudgeRoot = (n: Node, dx: number, dy: number) => {
    const r = translationRoot(n, map);
    r.position = {
      x: (typeof r.position.x === 'number' ? r.position.x : 0) + dx,
      y: (typeof r.position.y === 'number' ? r.position.y : 0) + dy,
    };
  };

  for (let iter = 0; iter < OVERLAP_SEP_ITERS; iter++) {
    const rects = next.map((n) => axisAlignedRect(n, map));
    let moved = false;

    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const A = rects[i]!;
        const B = rects[j]!;
        const overlapW = Math.min(A.right, B.right) - Math.max(A.left, B.left);
        const overlapH = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (overlapW <= 0 || overlapH <= 0) continue;

        const rA = translationRoot(A.node, map);
        const rB = translationRoot(B.node, map);
        if (rA.id === rB.id) continue;

        const rosA = rA.type === 'rosNode';
        const rosB = rB.type === 'rosNode';
        if (rosA && rosB) continue;

        if (overlapW < overlapH) {
          const total = overlapW + gap;
          const aIsLeft = A.midX < B.midX;
          if (rosA) {
            nudgeRoot(B.node, aIsLeft ? total : -total, 0);
          } else if (rosB) {
            nudgeRoot(A.node, aIsLeft ? -total : total, 0);
          } else {
            const half = total / 2;
            nudgeRoot(A.node, aIsLeft ? -half : half, 0);
            nudgeRoot(B.node, aIsLeft ? half : -half, 0);
          }
        } else {
          const total = overlapH + gap;
          const aIsAbove = A.midY < B.midY;
          if (rosA) {
            nudgeRoot(B.node, 0, aIsAbove ? total : -total);
          } else if (rosB) {
            nudgeRoot(A.node, 0, aIsAbove ? -total : total);
          } else {
            const half = total / 2;
            nudgeRoot(A.node, 0, aIsAbove ? -half : half);
            nudgeRoot(B.node, 0, aIsAbove ? half : -half);
          }
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  return next;
}

/** 노드 위치 기준으로 엣지별 최단 방향의 sourceHandle/targetHandle 부여 (드래그 시 재계산용으로 export) */
export function assignEdgeHandles(nodes: Node[], edges: Edge[]): Edge[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return edges.map((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) return edge;

    const srcCenter = getNodeCenterAbsolute(sourceNode, measuredNodeSize(sourceNode), nodeMap);
    const tgtCenter = getNodeCenterAbsolute(targetNode, measuredNodeSize(targetNode), nodeMap);
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
