/**
 * 그래프 토픽·서비스·액션 노드의 최대 가로폭 (UI max-width·dagre·그룹 박스와 동일)
 * 조정 시 한 곳만 바꾸면 됨.
 */
export const GRAPH_RESOURCE_NODE_MAX_WIDTH_PX = 288;

/** 네임스페이스 그룹 안쪽 콘텐츠 폭 = 자식 노드 최대폭 + 여유 */
export const GRAPH_NAMESPACE_GROUP_INNER_EXTRA_PX = 10;

export function graphNamespaceGroupInnerContentWidthPx(): number {
  return GRAPH_RESOURCE_NODE_MAX_WIDTH_PX + GRAPH_NAMESPACE_GROUP_INNER_EXTRA_PX;
}
