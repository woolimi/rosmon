import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/Sheet';
import { CopyableCliLine, NodeListSection } from '@/components/graph/DetailDrawerCommon';
import { useCopiedId } from '@/hooks/useCopiedId';

export interface NodeDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  nodeName: string;
  /** Topics this node publishes to */
  publishers: string[];
  /** Topics this node subscribes to */
  subscribers: string[];
  /** Services this node provides (server) */
  services: string[];
  /** Actions this node provides (action server) */
  actions: string[];
}

export function NodeDetailDrawer({
  open,
  onClose,
  nodeName,
  publishers,
  subscribers,
  services,
  actions,
}: NodeDetailDrawerProps) {
  const [copiedId, setCopiedId] = useCopiedId(2000);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="z-[100] flex flex-col p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-border px-4 pr-10 py-3 shrink-0">
          <SheetTitle className="text-base font-medium">Node details</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto px-4 py-4 space-y-5 text-sm">
          <section className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Node name</p>
            <p className="font-mono text-foreground break-all">{nodeName}</p>
          </section>

          <section className="space-y-1.5 pt-4 border-t border-border">
            <NodeListSection label="Publish (topics)" items={publishers} />
          </section>

          <section className="space-y-1.5 pt-4 border-t border-border">
            <NodeListSection label="Subscribe (topics)" items={subscribers} />
          </section>

          <section className="space-y-1.5 pt-4 border-t border-border">
            <NodeListSection label="Services (server)" items={services} />
          </section>

          <section className="space-y-1.5 pt-4 border-t border-border">
            <NodeListSection label="Actions (action server)" items={actions} />
          </section>

          <section className="pt-4 border-t border-border space-y-2">
            <p className="text-sm font-medium text-muted-foreground">ROS2 CLI commands</p>
            <div className="space-y-1.5">
              <CopyableCliLine
                text="ros2 node list"
                id="node-list"
                copiedId={copiedId}
                onCopy={setCopiedId}
              />
              {nodeName && (
                <CopyableCliLine
                  text={`ros2 node info ${nodeName}`}
                  id="node-info"
                  copiedId={copiedId}
                  onCopy={setCopiedId}
                />
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
