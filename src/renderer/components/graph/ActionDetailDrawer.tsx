import type { RosmonBridgeClient } from '@/lib/rosmonBridge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  CopyableCliLine,
  InterfaceSection,
  NodeListSection,
  parseInterfaceTextToPlaceholder,
} from '@/components/graph/DetailDrawerCommon';
import { useInterfaceText } from '@/hooks/useInterfaceText';
import { useCopiedId } from '@/hooks/useCopiedId';

export interface ActionDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  name: string;
  type: string;
  ros: RosmonBridgeClient | null;
  actionClients?: string[];
  actionServers?: string[];
}

export function ActionDetailDrawer({
  open,
  onClose,
  name,
  type,
  ros,
  actionClients = [],
  actionServers = [],
}: ActionDetailDrawerProps) {
  const [resolvedType, setResolvedType] = useState<string>(type);
  const [displayServers, setDisplayServers] = useState<string[]>(actionServers);
  const [displayClients, setDisplayClients] = useState<string[]>(actionClients);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [goalPayload, setGoalPayload] = useState('{}');
  const [goalStatus, setGoalStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [goalError, setGoalError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
  const [streamFeedback, setStreamFeedback] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<string, unknown>[]>([]);
  const feedbackScrollRef = useRef<HTMLDivElement>(null);

  const { text: interfaceText, error: interfaceError, errorDetail: interfaceErrorDetail, loading: interfaceLoading } = useInterfaceText(open, ros, resolvedType);
  const [copiedId, setCopiedId] = useCopiedId(2000);

  useLayoutEffect(() => {
    const el = feedbackScrollRef.current;
    if (!el || feedbacks.length === 0) return;
    el.scrollTop = el.scrollHeight;
  }, [feedbacks]);

  useEffect(() => {
    if (!open || !ros) {
      setError(false);
      return;
    }
    if (!name.trim()) return;
    setLoading(true);
    setError(false);
    ros
      .getAction(name.trim())
      .then((res) => {
        setResolvedType(res.type?.trim() || type || '');
        setDisplayServers(res.serverNode ? [res.serverNode] : actionServers);
        setDisplayClients(res.clientNodes?.length ? res.clientNodes : actionClients);
      })
      .catch(() => {
        setResolvedType(type || '');
        setDisplayServers(actionServers);
        setDisplayClients(actionClients);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [open, name, type, ros, actionServers, actionClients]);

  useEffect(() => {
    if (!open) return;
    setGoalPayload('{}');
    setGoalStatus('idle');
    setGoalError(null);
    setLastResult(null);
    setFeedbacks([]);
  }, [open, name]);

  useEffect(() => {
    if (!open || !interfaceText.trim()) return;
    const placeholder = parseInterfaceTextToPlaceholder(interfaceText, 'full');
    setGoalPayload(JSON.stringify(placeholder, null, 2));
  }, [open, name, resolvedType, interfaceText]);

  useEffect(() => {
    if (goalStatus !== 'success') return;
    const t = setTimeout(() => setGoalStatus('idle'), 3000);
    return () => clearTimeout(t);
  }, [goalStatus]);

  const handleSendGoal = useCallback(() => {
    setGoalError(null);
    let goal: Record<string, unknown>;
    try {
      goal = JSON.parse(goalPayload) as Record<string, unknown>;
    } catch {
      setGoalError('Invalid JSON.');
      setGoalStatus('error');
      return;
    }
    if (!ros || !resolvedType?.trim()) {
      setGoalError('Not connected or no action type.');
      setGoalStatus('error');
      return;
    }
    setGoalStatus('sending');
    setLastResult(null);
    setFeedbacks([]);
    ros
      .sendActionGoal(name, resolvedType.trim(), goal, {
        streamFeedback,
        onFeedback: streamFeedback ? (data) => setFeedbacks((prev) => [...prev, data]) : undefined,
      })
      .then((res) => {
        setLastResult(res.result ?? null);
        setGoalStatus('success');
        setGoalError(null);
      })
      .catch((err: unknown) => {
        setGoalError(err instanceof Error ? err.message : String(err));
        setGoalStatus('error');
      });
  }, [ros, name, resolvedType, goalPayload, streamFeedback]);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="z-[100] flex flex-col p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-border px-4 pr-10 py-3 shrink-0">
          <SheetTitle className="text-base font-medium">Action details</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto px-4 py-4 space-y-5 text-sm">
          <section className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Action name</p>
            <p className="font-mono text-foreground break-all">{name}</p>
          </section>
          <section className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Action type</p>
            <p className="font-mono text-foreground">{resolvedType || (loading ? '…' : type) || '—'}</p>
          </section>

          <section className="grid grid-cols-2 gap-x-4 gap-y-2 pt-4 border-t border-border">
            <NodeListSection label="Action Clients" items={displayClients} />
            <NodeListSection label="Action Servers" items={displayServers} />
          </section>

          <InterfaceSection
            resolvedType={resolvedType}
            interfaceText={interfaceText}
            loading={interfaceLoading}
            error={interfaceError}
            errorDetail={interfaceErrorDetail}
            dataLoading={loading}
            emptyMessage="No action type; refresh the graph to show the interface."
          />

          <section className="pt-4 border-t border-border space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Send Goal</p>
            <p className="text-xs text-muted-foreground">
              Enter the goal in JSON and click Send Goal. Result is shown when complete.
            </p>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/50 px-3 py-2.5 cursor-pointer hover:bg-card/70 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
              <span className="text-sm font-medium text-foreground">Stream feedback</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {streamFeedback ? 'On' : 'Off'}
              </span>
              <div className="relative w-9 h-5 shrink-0">
                <input
                  type="checkbox"
                  checked={streamFeedback}
                  onChange={(e) => setStreamFeedback(e.target.checked)}
                  className="sr-only peer"
                  aria-label="Stream feedback"
                />
                <div
                  className="absolute inset-0 rounded-full bg-muted border border-border transition-colors peer-checked:bg-primary/20 peer-checked:border-primary/50"
                  aria-hidden
                />
                <div
                  className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-muted-foreground border border-border shadow-sm transition-all duration-200 pointer-events-none peer-checked:left-[18px] peer-checked:bg-primary peer-checked:border-primary"
                  aria-hidden
                />
              </div>
            </label>
            <textarea
              value={goalPayload}
              onChange={(e) => {
                setGoalPayload(e.target.value);
                setGoalError(null);
                setGoalStatus('idle');
              }}
              rows={5}
              className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[80px]"
              placeholder='{"order": 5}'
              spellCheck={false}
            />
            <Button
              type="button"
              size="sm"
              disabled={!ros || !resolvedType?.trim() || loading || goalStatus === 'sending'}
              onClick={handleSendGoal}
              className="gap-1.5"
            >
              {goalStatus === 'sending' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
              ) : (
                <Send className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              {goalStatus === 'sending' ? 'Sending…' : 'Send Goal'}
            </Button>
            {goalStatus === 'success' && (
              <p className="text-sm text-green-400">Goal completed.</p>
            )}
            {goalStatus === 'error' && goalError && (
              <p className="text-sm text-destructive">{goalError}</p>
            )}
          </section>

          {streamFeedback && (goalStatus === 'sending' || feedbacks.length > 0 || lastResult != null) && (
            <section className="pt-4 border-t border-border space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Feedback {feedbacks.length > 0 ? `(${feedbacks.length})` : ''}
              </p>
              <div
                ref={feedbackScrollRef}
                className="max-h-32 overflow-auto overflow-x-hidden rounded bg-muted/30 p-2 font-mono text-xs text-foreground space-y-1"
              >
                {feedbacks.length === 0 ? (
                  <p className="text-muted-foreground">No feedback received</p>
                ) : (
                  feedbacks.map((fb, i) => (
                    <div key={i} className="rounded bg-background/50 px-2 py-1">
                      <span className="text-muted-foreground">#{i + 1}</span> {JSON.stringify(fb)}
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {lastResult != null && (
            <section className="pt-4 border-t border-border space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Result</p>
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-normal bg-muted/30 rounded p-2 overflow-x-auto max-h-40">
                {JSON.stringify(lastResult, null, 2)}
              </pre>
            </section>
          )}

          <section className="pt-4 border-t border-border space-y-2">
            <p className="text-sm font-medium text-muted-foreground">ROS2 CLI commands</p>
            <div className="space-y-1.5">
              <CopyableCliLine
                text={`ros2 action info ${name}`}
                id="act-info"
                copiedId={copiedId}
                onCopy={setCopiedId}
              />
              {(resolvedType || type) && (
                <CopyableCliLine
                  text={`ros2 interface show ${resolvedType || type}`}
                  id="act-interface"
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
