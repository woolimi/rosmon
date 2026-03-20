import { type Node, type NodeProps } from '@xyflow/react';

export type RosNamespaceGroupData = {
  label: string;
};

export type RosNamespaceGroupNodeType = Node<RosNamespaceGroupData, 'rosNamespaceGroup'>;

/** 토픽·서비스 네임스페이스 그룹 — 드래그 시 자식이 함께 이동(parentId). 상세 패널은 자식만 연다. */
export function RosNamespaceGroupNode({
  data,
}: NodeProps<RosNamespaceGroupNodeType>) {
  return (
    <div
      className="h-full w-full cursor-grab active:cursor-grabbing rounded-lg border border-dashed border-muted-foreground/55 bg-muted/40"
      aria-label={`Namespace ${data.label}`}
    >
      <div
        className="px-2 pt-1.5 text-sm font-semibold text-foreground/90 truncate select-none pointer-events-none min-w-0 max-w-full tracking-tight"
        title={data.label}
      >
        {data.label}
      </div>
    </div>
  );
}
