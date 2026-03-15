import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';

export type RosNodeData = {
  label: string;
};

export type RosNodeType = Node<RosNodeData, 'rosNode'>;

export function RosNode({ data, selected }: NodeProps<RosNodeType>) {
  return (
    <div
      className="relative rounded-md border-2 px-4 py-3 text-xs font-medium min-w-[80px] text-center"
      style={{
        background: 'hsl(215 28% 18%)',
        borderColor: 'hsl(var(--foreground) / 0.45)',
        boxShadow: selected
          ? '0 0 0 2px hsl(var(--foreground) / 0.5)'
          : '0 1px 3px hsl(0 0% 0% / 0.35)',
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
      <span className="text-foreground break-all">{data.label}</span>
    </div>
  );
}
