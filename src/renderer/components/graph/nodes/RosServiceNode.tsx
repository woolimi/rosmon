import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { GRAPH_RESOURCE_NODE_MAX_WIDTH_PX } from '@/lib/graph/graphNodeLayout';

export type RosServiceNodeData = {
  label: string;
  serviceType?: string;
  /** server count (usually 1) */
  serverCount: number;
  /** client count (when available from graph) */
  clientCount: number | null;
};

export type RosServiceNodeType = Node<RosServiceNodeData, 'rosService'>;

export function RosServiceNode({
  data,
  selected,
}: NodeProps<RosServiceNodeType>) {
  const { label, serviceType, serverCount, clientCount } = data;
  const clientStr = clientCount !== null ? String(clientCount) : '—';
  return (
    <div
      className="relative rounded-lg flex flex-col items-center justify-center px-3 py-1.5 min-w-[72px] min-h-[50px] max-w-full w-full overflow-hidden border-2 shadow-sm"
      style={{
        maxWidth: GRAPH_RESOURCE_NODE_MAX_WIDTH_PX,
        background: 'hsl(var(--chart-3) / 0.5)',
        borderColor: 'hsl(var(--chart-3))',
        boxShadow: selected ? '0 0 0 2px hsl(var(--foreground) / 0.6)' : undefined,
      }}
    >
      <Handle type="source" id="left" position={Position.Left} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-left-[4px]" />
      <Handle type="source" id="right" position={Position.Right} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-right-[4px]" />
      <Handle type="source" id="top" position={Position.Top} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-top-[4px]" />
      <Handle type="source" id="bottom" position={Position.Bottom} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-bottom-[4px]" />
      <Handle type="target" id="left" position={Position.Left} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-left-[4px]" />
      <Handle type="target" id="right" position={Position.Right} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-right-[4px]" />
      <Handle type="target" id="top" position={Position.Top} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-top-[4px]" />
      <Handle type="target" id="bottom" position={Position.Bottom} className="!w-2 !h-2 !border-0 !bg-transparent !opacity-0 pointer-events-none !-bottom-[4px]" />
      <span
        className="text-foreground font-medium text-[10px] text-center truncate max-w-full"
        title={label}
      >
        {label}
      </span>
      {serviceType && (
        <span className="text-muted-foreground text-[9px] mt-0.5 text-center truncate max-w-full" title={serviceType}>
          {serviceType.split('/').pop() ?? serviceType}
        </span>
      )}
      <span className="text-muted-foreground text-[9px] mt-0.5">
        {clientStr} client / {serverCount} server
      </span>
    </div>
  );
}
