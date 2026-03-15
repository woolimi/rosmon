import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRosContext } from '@/contexts/RosContext';
import { useRosApi } from '@/hooks/useRosApi';
import { useNodeDetailProps } from '@/hooks/useNodeDetailProps';
import { TopicDetailDrawer } from '@/components/graph/TopicDetailDrawer';
import { ServiceDetailDrawer } from '@/components/graph/ServiceDetailDrawer';
import { ActionDetailDrawer } from '@/components/graph/ActionDetailDrawer';
import { NodeDetailDrawer } from '@/components/graph/NodeDetailDrawer';
import {
  RosNode,
  RosTopicNode,
  RosServiceNode,
  RosActionNode,
} from '@/components/graph/nodes';
import { getLayoutedElements, assignEdgeHandles } from '@/lib/dagreLayout';
import { buildTopologyGraph, type GraphVisibility } from '@/lib/graph/buildTopologyGraph';
import { ROSMON_BRIDGE_WS_URL } from '@/lib/ros';
import { GraphVisibilityControls } from '@/components/graph/GraphVisibilityControls';
import { GraphOverlays } from '@/components/graph/GraphOverlays';

const graphReactFlowStyles = {
  '--xy-controls-button-background-color': 'hsl(var(--card))',
  '--xy-controls-button-background-color-hover': 'hsl(var(--muted))',
  '--xy-controls-button-color': 'hsl(var(--foreground))',
  '--xy-controls-button-border-color': 'hsl(var(--border))',
  '--xy-controls-box-shadow': '0 1px 2px hsl(var(--background) / 0.5)',
} as CSSProperties;

const nodeTypes = {
  rosNode: RosNode,
  rosTopic: RosTopicNode,
  rosService: RosServiceNode,
  rosAction: RosActionNode,
};

export function Graph() {
  const { ros, connectionState, setGraphLoading, initialRetryPending } = useRosContext();
  const {
    nodes,
    topics,
    topicConnections,
    topicTypes,
    services,
    serviceTypes,
    serviceToNode,
    actions,
    actionTypes,
    actionToNode,
    actionToClients,
    loading,
    error,
    rosDomainId,
    refresh,
  } = useRosApi(ros);

  const [visibility, setVisibility] = useState<GraphVisibility>({
    topics: true,
    services: true,
    actions: true,
  });
  const [isRefreshingGraph, setIsRefreshingGraph] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<
    { kind: 'topic' | 'service' | 'action'; name: string; type: string } | null
  >(null);
  const [selectedNodeName, setSelectedNodeName] = useState<string | null>(null);

  const { nodes: graphNodes, edges: graphEdges } = useMemo(() => {
    const { nodes: rawNodes, edges: rawEdges } = buildTopologyGraph(
      nodes,
      topicConnections,
      topics,
      topicTypes,
      serviceToNode,
      services,
      serviceTypes,
      actions,
      actionTypes,
      actionToNode,
      actionToClients,
      visibility
    );
    return getLayoutedElements(rawNodes, rawEdges, 'LR');
  }, [
    nodes,
    topicConnections,
    topics,
    topicTypes,
    serviceToNode,
    services,
    serviceTypes,
    actions,
    actionTypes,
    actionToNode,
    actionToClients,
    visibility,
  ]);

  const [nodesState, setNodesState, onNodesChange] = useNodesState(graphNodes);
  const [edgesState, setEdgesState, onEdgesChange] = useEdgesState(graphEdges);

  /* 새로고침 중에는 중간 상태로 레이아웃을 적용하지 않고, 끝난 뒤 한 번만 적용해 두 번 바뀌는 현상 방지 */
  useEffect(() => {
    if (isRefreshingGraph) return;
    setNodesState(graphNodes);
    setEdgesState(graphEdges);
  }, [graphNodes, graphEdges, isRefreshingGraph, setNodesState, setEdgesState]);

  /* 노드 드래그 등으로 위치가 바뀌면 엣지를 최단 방향(핸들)으로 다시 연결 */
  useEffect(() => {
    setEdgesState((prev) => assignEdgeHandles(nodesState, prev));
  }, [nodesState, setEdgesState]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshingGraph(true);
    setGraphLoading(true);
    try {
      await refresh();
    } finally {
      setIsRefreshingGraph(false);
      setGraphLoading(false);
    }
  }, [refresh, setGraphLoading]);

  const isConnected = connectionState === 'connected';
  /** 연결되고 ros 클라이언트가 준비된 뒤 한 번만 자동 새로고침. cleanup에서 ref 리셋해 Strict Mode 재마운트 시에도 한 번 더 실행됨 */
  const hasAutoRefreshed = useRef(false);
  useEffect(() => {
    if (!isConnected || !ros || hasAutoRefreshed.current) return;
    hasAutoRefreshed.current = true;
    handleRefresh();
    return () => {
      hasAutoRefreshed.current = false;
    };
  }, [isConnected, ros, handleRefresh]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const data = node.data as {
        label?: string;
        messageType?: string;
        serviceType?: string;
        actionType?: string;
      };
      if (node.type === 'rosTopic' && data?.label) {
        const name = data.label;
        const idx = topics.indexOf(name);
        const type = idx >= 0 ? (topicTypes[idx] ?? '') : (data.messageType ?? '');
        setSelectedDetail({ kind: 'topic', name, type });
        setSelectedNodeName(null);
        return;
      }
      if (node.type === 'rosService' && data?.label) {
        const name = data.label;
        const idx = services.indexOf(name);
        const type = idx >= 0 ? (serviceTypes[idx] ?? '') : (data.serviceType ?? '');
        setSelectedDetail({ kind: 'service', name, type });
        setSelectedNodeName(null);
        return;
      }
      if (node.type === 'rosAction' && data?.label) {
        const name = data.label;
        const idx = actions.indexOf(name);
        const type = idx >= 0 ? (actionTypes[idx] ?? '') : (data.actionType ?? '');
        setSelectedDetail({ kind: 'action', name, type });
        setSelectedNodeName(null);
        return;
      }
      if (node.type === 'rosNode' && data?.label) {
        setSelectedNodeName(data.label);
        setSelectedDetail(null);
      }
    },
    [topics, topicTypes, services, serviceTypes, actions, actionTypes]
  );

  const nodeDetailProps = useNodeDetailProps(
    selectedNodeName,
    topicConnections,
    serviceToNode,
    actionToNode
  );

  const showLoading =
    connectionState === 'connecting' ||
    initialRetryPending ||
    (connectionState !== 'error' && (loading || isRefreshingGraph));
  const showError =
    connectionState === 'error' && !initialRetryPending && !loading && !isRefreshingGraph;
  const showEmpty =
    !loading &&
    !isRefreshingGraph &&
    connectionState !== 'error' &&
    nodes.length === 0 &&
    !error &&
    isConnected;

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <GraphVisibilityControls
        visibility={visibility}
        setVisibility={setVisibility}
        onRefresh={handleRefresh}
        disabled={!isConnected || loading || isRefreshingGraph}
        isRefreshing={loading || isRefreshingGraph}
      />

      <div className="flex-1 min-h-0 relative overflow-hidden">
        <GraphOverlays
          showLoading={showLoading}
          showError={showError}
          showEmpty={showEmpty}
          bridgeUrl={ROSMON_BRIDGE_WS_URL}
          rosDomainId={rosDomainId}
        />
        <div className="absolute inset-0">
          <ReactFlow
            nodes={nodesState}
            edges={edgesState}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{
              type: 'default',
              markerEnd: { type: MarkerType.ArrowClosed },
              interactionWidth: 28,
            }}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
            className="bg-background dark !h-full !w-full"
            style={graphReactFlowStyles}
          >
            <Background
              variant={BackgroundVariant.Lines}
              gap={16}
              size={1}
              color="hsl(var(--border) / 0.52)"
              style={{ backgroundColor: 'hsl(var(--background))' }}
            />
            <Controls position="bottom-left" />
            <MiniMap
              nodeColor="hsl(var(--chart-1))"
              maskColor="hsl(var(--background) / 0.8)"
              className="!bg-card !border-border"
            />
          </ReactFlow>
        </div>
      </div>

      {selectedDetail?.kind === 'topic' && (
        <TopicDetailDrawer
          open={!!selectedDetail}
          onClose={() => setSelectedDetail(null)}
          name={selectedDetail.name}
          type={selectedDetail.type}
          ros={ros}
          publishers={topicConnections[selectedDetail.name]?.publishers ?? []}
          subscribers={topicConnections[selectedDetail.name]?.subscribers ?? []}
        />
      )}
      {selectedDetail?.kind === 'service' && (
        <ServiceDetailDrawer
          open={!!selectedDetail}
          onClose={() => setSelectedDetail(null)}
          name={selectedDetail.name}
          type={selectedDetail.type}
          ros={ros}
          serviceServers={
            selectedDetail.name && serviceToNode[selectedDetail.name]
              ? [serviceToNode[selectedDetail.name]]
              : []
          }
        />
      )}
      {selectedDetail?.kind === 'action' && (
        <ActionDetailDrawer
          open={!!selectedDetail}
          onClose={() => setSelectedDetail(null)}
          name={selectedDetail.name}
          type={selectedDetail.type}
          ros={ros}
          actionServers={
            selectedDetail.name && actionToNode[selectedDetail.name]
              ? [actionToNode[selectedDetail.name]]
              : []
          }
          actionClients={
            selectedDetail.name ? (actionToClients[selectedDetail.name] ?? []) : []
          }
        />
      )}

      <NodeDetailDrawer
        open={!!selectedNodeName}
        onClose={() => setSelectedNodeName(null)}
        nodeName={selectedNodeName ?? ''}
        publishers={nodeDetailProps.publishers}
        subscribers={nodeDetailProps.subscribers}
        services={nodeDetailProps.services}
        actions={nodeDetailProps.actions}
      />
    </div>
  );
}
