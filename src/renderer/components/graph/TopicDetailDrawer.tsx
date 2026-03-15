import type { RosmonBridgeClient } from '@/lib/rosmonBridge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  CopyableCliLine,
  InterfaceSection,
  NodeListSection,
  parseInterfaceTextToPlaceholder,
  buildMessagePlaceholder,
} from '@/components/graph/DetailDrawerCommon';
import type { MessageDetailsResponse } from '@/lib/messageDetails';
import { useInterfaceText } from '@/hooks/useInterfaceText';
import { useCopiedId } from '@/hooks/useCopiedId';

export interface TopicDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  name: string;
  type: string;
  ros: RosmonBridgeClient | null;
  publishers?: string[];
  subscribers?: string[];
}

export function TopicDetailDrawer({
  open,
  onClose,
  name,
  type,
  ros,
  publishers = [],
  subscribers = [],
}: TopicDetailDrawerProps) {
  const [details, setDetails] = useState<MessageDetailsResponse | null>(null);
  const [resolvedTopicType, setResolvedTopicType] = useState<string>('');
  const [displayPublishers, setDisplayPublishers] = useState<string[]>(publishers);
  const [displaySubscribers, setDisplaySubscribers] = useState<string[]>(subscribers);
  const [loading, setLoading] = useState(false);
  const [publishPayload, setPublishPayload] = useState('{}');
  const [publishStatus, setPublishStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [publishError, setPublishError] = useState<string | null>(null);

  const { text: interfaceText, error: interfaceError, errorDetail: interfaceErrorDetail, loading: interfaceLoading } = useInterfaceText(open, ros, resolvedTopicType);
  const [copiedId, setCopiedId] = useCopiedId(2000);

  useEffect(() => {
    if (!open) return;
    setPublishPayload('{}');
    setPublishStatus('idle');
    setPublishError(null);
  }, [open, name]);

  useEffect(() => {
    if (!open) return;
    if (details?.typedefs?.length && details.typedefs[0]?.fieldnames?.length) {
      const placeholder = buildMessagePlaceholder(details, 0);
      setPublishPayload(JSON.stringify(placeholder, null, 2));
    } else if (interfaceText.trim()) {
      const placeholder = parseInterfaceTextToPlaceholder(interfaceText, 'full');
      setPublishPayload(JSON.stringify(placeholder, null, 2));
    } else {
      setPublishPayload('{}');
    }
  }, [open, name, resolvedTopicType, type, details, interfaceText]);

  useEffect(() => {
    if (publishStatus !== 'success') return;
    const t = setTimeout(() => setPublishStatus('idle'), 2000);
    return () => clearTimeout(t);
  }, [publishStatus]);

  useEffect(() => {
    if (!open || !ros) {
      setDetails(null);
      setResolvedTopicType('');
      setDisplayPublishers(publishers);
      setDisplaySubscribers(subscribers);
      return;
    }
    setLoading(true);
    ros
      .getTopic(name)
      .then((res) => {
        setResolvedTopicType(res.type?.trim() || type?.trim() || '');
        setDisplayPublishers(res.publishers?.length ? res.publishers : publishers);
        setDisplaySubscribers(res.subscribers?.length ? res.subscribers : subscribers);
        setDetails(null);
      })
      .catch(() => {
        setResolvedTopicType(type || '');
        setDisplayPublishers(publishers);
        setDisplaySubscribers(subscribers);
        setDetails(null);
      })
      .finally(() => setLoading(false));
  }, [open, name, type, ros, publishers, subscribers]);

  const displayType = resolvedTopicType || (loading ? '…' : type) || '—';

  const handlePublish = () => {
    setPublishError(null);
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(publishPayload) as Record<string, unknown>;
    } catch {
      setPublishError('Invalid JSON.');
      setPublishStatus('error');
      return;
    }
    if (!ros || !resolvedTopicType?.trim()) {
      setPublishError('Not connected or no message type.');
      setPublishStatus('error');
      return;
    }
    setPublishStatus('sending');
    ros
      .publishTopic(name, resolvedTopicType.trim(), msg)
      .then(() => {
        setPublishStatus('success');
        setPublishError(null);
      })
      .catch((e) => {
        setPublishError(e instanceof Error ? e.message : String(e));
        setPublishStatus('error');
      });
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="z-[100] flex flex-col p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-border px-4 pr-10 py-3 shrink-0">
          <SheetTitle className="text-base font-medium">Topic details</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto px-4 py-4 space-y-5 text-sm">
          <section className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Topic name</p>
            <p className="font-mono text-foreground break-all">{name}</p>
          </section>
          <section className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Message type</p>
            <p className="font-mono text-foreground">{displayType}</p>
          </section>

          <section className="grid grid-cols-2 gap-x-4 gap-y-2 pt-4 border-t border-border">
            <NodeListSection label="Publishers" items={displayPublishers} />
            <NodeListSection label="Subscribers" items={displaySubscribers} />
          </section>

          <InterfaceSection
            resolvedType={resolvedTopicType}
            interfaceText={interfaceText}
            loading={interfaceLoading}
            error={interfaceError}
            errorDetail={interfaceErrorDetail}
            dataLoading={loading}
            emptyMessage="No message type; refresh the graph to show the interface."
          />

          <section className="pt-4 border-t border-border space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Publish</p>
            <p className="text-xs text-muted-foreground">
              Enter the message in JSON and click Publish.
            </p>
            <textarea
              value={publishPayload}
              onChange={(e) => {
                setPublishPayload(e.target.value);
                setPublishError(null);
                setPublishStatus('idle');
              }}
              rows={6}
              className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[100px]"
              placeholder='{"field": value}'
              spellCheck={false}
            />
            <Button
              type="button"
              size="sm"
              disabled={!ros || !resolvedTopicType?.trim() || loading || publishStatus === 'sending'}
              onClick={handlePublish}
              className="gap-1.5"
            >
              {publishStatus === 'sending' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
              ) : (
                <Send className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              {publishStatus === 'sending' ? 'Publishing…' : 'Publish'}
            </Button>
            {publishStatus === 'success' && (
              <p className="text-sm text-green-400">Message published.</p>
            )}
            {publishStatus === 'error' && publishError && (
              <p className="text-sm text-destructive">{publishError}</p>
            )}
          </section>

          <section className="pt-4 border-t border-border space-y-2">
            <p className="text-sm font-medium text-muted-foreground">ROS2 CLI commands</p>
            <div className="space-y-1.5">
              <CopyableCliLine
                text={`ros2 topic info ${name}`}
                id="info"
                copiedId={copiedId}
                onCopy={setCopiedId}
              />
              <CopyableCliLine
                text={`ros2 topic type ${name}`}
                id="type"
                copiedId={copiedId}
                onCopy={setCopiedId}
              />
              <CopyableCliLine
                text={`ros2 topic echo ${name}`}
                id="echo"
                copiedId={copiedId}
                onCopy={setCopiedId}
              />
              <CopyableCliLine
                text={`ros2 topic bw ${name}`}
                id="bw"
                copiedId={copiedId}
                onCopy={setCopiedId}
              />
              <CopyableCliLine
                text={`ros2 topic hz ${name}`}
                id="hz"
                copiedId={copiedId}
                onCopy={setCopiedId}
              />
              <CopyableCliLine
                text={`ros2 topic delay ${name}`}
                id="delay"
                copiedId={copiedId}
                onCopy={setCopiedId}
              />
              <CopyableCliLine
                text={`ros2 topic pub --once ${name}`}
                id="pub"
                copiedId={copiedId}
                onCopy={setCopiedId}
              />
              {(resolvedTopicType || type) && (
                <CopyableCliLine
                  text={`ros2 interface show ${resolvedTopicType || type}`}
                  id="interface"
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
