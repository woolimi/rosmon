import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ROS_ACTION_SUB_LABELS } from '@/lib/graph/rosActionSubPaths';
import { GRAPH_RESOURCE_NODE_MAX_WIDTH_PX } from '@/lib/graph/graphNodeLayout';

/** ROS2 action 내부 채널 5개: srv=에메랄드(chart-3), topic=보라(chart-1) */
const ACTION_SUB_ITEMS = [
  { key: 'send_goal', label: ROS_ACTION_SUB_LABELS[0], kind: 'service' as const },
  { key: 'cancel_goal', label: ROS_ACTION_SUB_LABELS[1], kind: 'service' as const },
  { key: 'status', label: ROS_ACTION_SUB_LABELS[2], kind: 'topic' as const },
  { key: 'feedback', label: ROS_ACTION_SUB_LABELS[3], kind: 'topic' as const },
  { key: 'get_result', label: ROS_ACTION_SUB_LABELS[4], kind: 'service' as const },
] as const;

export type RosActionNodeData = {
  label: string;
  actionType?: string;
  /** Goal / Feedback / Result structure hint */
  hasGoal?: boolean;
  hasFeedback?: boolean;
  hasResult?: boolean;
};

export type RosActionNodeType = Node<RosActionNodeData, 'rosAction'>;

export function RosActionNode({
  data,
  selected,
}: NodeProps<RosActionNodeType>) {
  const { label, actionType } = data;
  return (
    <div
      className="relative rounded-lg flex flex-col items-stretch px-2.5 py-1.5 min-w-[100px] max-w-full w-full overflow-hidden border-2 shadow-sm gap-1"
      style={{
        maxWidth: GRAPH_RESOURCE_NODE_MAX_WIDTH_PX,
        background: 'hsl(var(--chart-4) / 0.5)',
        borderColor: 'hsl(var(--chart-4))',
        boxShadow: selected ? '0 0 0 2px hsl(var(--foreground) / 0.6)' : undefined,
      }}
      title={label}
    >
      <Handle type="source" id="left" position={Position.Left} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-left-[4px]" />
      <Handle type="source" id="right" position={Position.Right} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-right-[4px]" />
      <Handle type="source" id="top" position={Position.Top} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-top-[4px]" />
      <Handle type="source" id="bottom" position={Position.Bottom} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-bottom-[4px]" />
      <Handle type="target" id="left" position={Position.Left} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-left-[4px]" />
      <Handle type="target" id="right" position={Position.Right} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-right-[4px]" />
      <Handle type="target" id="top" position={Position.Top} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-top-[4px]" />
      <Handle type="target" id="bottom" position={Position.Bottom} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-bottom-[4px]" />

      {/* 액션 이름 */}
      <span className="text-foreground font-medium text-[10px] text-center truncate min-w-0">
        {label}
      </span>
      {actionType && (
        <span className="text-muted-foreground text-[9px] text-center truncate max-w-full" title={actionType}>
          {actionType.split('/').pop() ?? actionType}
        </span>
      )}

      {/* _action 하위 5개: 접두사(액션 이름) + 경로, 에메랄드점=srv 보라점=topic, 흰색 글씨 */}
      <div
        className="rounded border border-chart-4/80 bg-chart-4/20 px-1.5 py-0.5 mt-0.5"
        title={`${label} inner channels: send_goal, cancel_goal, status, feedback, get_result`}
      >
        {ACTION_SUB_ITEMS.map(({ key, label: subLabel, kind }) => {
          const fullPath = `${label}/${subLabel}`;
          return (
            <div
              key={key}
              className="flex items-center gap-1.5 text-white text-[8px] leading-tight min-w-0"
              title={`${fullPath} (${kind === 'service' ? 'srv' : 'topic'})`}
            >
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: kind === 'service' ? 'hsl(var(--chart-3))' : 'hsl(var(--chart-1))',
                }}
                aria-hidden
              />
              <span className="truncate">{fullPath}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
