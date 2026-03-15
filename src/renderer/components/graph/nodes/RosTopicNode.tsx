import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type RosTopicNodeData = {
  label: string;
  messageType?: string;
  publisherCount: number;
  subscriberCount: number;
  frequencyHz?: number | null;
};

export type RosTopicNodeType = Node<RosTopicNodeData, 'rosTopic'>;

export function RosTopicNode({
  data,
  selected,
}: NodeProps<RosTopicNodeType>) {
  const { label, messageType, publisherCount, subscriberCount } = data;
  return (
    <div
      className="relative rounded-lg flex flex-col items-center justify-center px-3 py-1.5 min-w-[72px] min-h-[60px] border-2 shadow-sm"
      style={{
        background: 'hsl(var(--chart-1) / 0.5)',
        borderColor: 'hsl(var(--chart-1))',
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
      <span className="text-foreground font-medium text-[10px] text-center break-all leading-tight">
        {label}
      </span>
      {messageType && (
        <span className="text-muted-foreground text-[9px] mt-0.5 text-center truncate max-w-full" title={messageType}>
          {messageType.split('/').pop() ?? messageType}
        </span>
      )}
      <span className="text-muted-foreground text-[9px] mt-0.5">
        {publisherCount} pub / {subscriberCount} sub
      </span>
    </div>
  );
}
