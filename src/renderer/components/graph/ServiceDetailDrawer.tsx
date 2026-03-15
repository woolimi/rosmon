import type { RosmonBridgeClient } from '@/lib/rosmonBridge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/Sheet';
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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

export interface ServiceDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  name: string;
  type: string;
  ros: RosmonBridgeClient | null;
  serviceClients?: string[];
  serviceServers?: string[];
}

export function ServiceDetailDrawer({
  open,
  onClose,
  name,
  type,
  ros,
  serviceClients = [],
  serviceServers = [],
}: ServiceDetailDrawerProps) {
  const [serviceRequest, setServiceRequest] = useState<MessageDetailsResponse | null>(null);
  const [resolvedServiceType, setResolvedServiceType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [requestJson, setRequestJson] = useState<string>('{}');
  const [callLoading, setCallLoading] = useState(false);
  const [callResult, setCallResult] = useState<Record<string, unknown> | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  /** get_service 중복 호출 방지: 동일 (name, ros)로 이미 요청 중이면 스킵 (Strict Mode 또는 ros 참조 변경 시 이중 호출 가능) */
  const getServiceInFlightRef = useRef<{ name: string; ros: RosmonBridgeClient } | null>(null);

  const { text: interfaceText, error: interfaceError, errorDetail: interfaceErrorDetail, loading: interfaceLoading } = useInterfaceText(open, ros, resolvedServiceType);
  const [copiedId, setCopiedId] = useCopiedId(2000);

  useEffect(() => {
    if (!open || !ros) {
      getServiceInFlightRef.current = null;
      setServiceRequest(null);
      setResolvedServiceType('');
      setRequestJson('{}');
      setCallResult(null);
      setCallError(null);
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (
      getServiceInFlightRef.current?.name === trimmedName &&
      getServiceInFlightRef.current?.ros === ros
    ) {
      return;
    }
    getServiceInFlightRef.current = { name: trimmedName, ros };
    setLoading(true);
    setResolvedServiceType('');
    setRequestJson('{}');
    ros
      .getService(trimmedName)
      .then((res) => {
        const resolvedType = (res.type || type || '').trim();
        setResolvedServiceType(resolvedType);
        setServiceRequest(null);
      })
      .catch(() => {
        setResolvedServiceType(type || '');
        setServiceRequest(null);
      })
      .finally(() => {
        if (getServiceInFlightRef.current?.name === trimmedName && getServiceInFlightRef.current?.ros === ros) {
          getServiceInFlightRef.current = null;
        }
        setLoading(false);
      });
  }, [open, name, type, ros]);

  useEffect(() => {
    if (!open) return;
    if (serviceRequest?.typedefs?.length && serviceRequest.typedefs[0]?.fieldnames?.length) {
      const placeholder = buildMessagePlaceholder(serviceRequest, 0);
      setRequestJson(JSON.stringify(placeholder, null, 2));
    } else if (interfaceText.trim()) {
      const placeholder = parseInterfaceTextToPlaceholder(interfaceText, 'request');
      setRequestJson(JSON.stringify(placeholder, null, 2));
    } else {
      setRequestJson('{}');
    }
  }, [open, name, resolvedServiceType, serviceRequest, interfaceText]);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="z-[100] flex flex-col p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-border px-4 pr-10 py-3 shrink-0">
          <SheetTitle className="text-base font-medium">Service details</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto px-4 py-4 space-y-5 text-sm">
          <section className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Service name</p>
            <p className="font-mono text-foreground break-all">{name}</p>
          </section>
          <section className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Service type</p>
            <p className="font-mono text-foreground">
              {resolvedServiceType || (loading ? '…' : type) || '—'}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-x-4 gap-y-2 pt-4 border-t border-border">
            <NodeListSection label="Clients" items={serviceClients} />
            <NodeListSection label="Servers" items={serviceServers} />
          </section>

          <InterfaceSection
            resolvedType={resolvedServiceType}
            interfaceText={interfaceText}
            loading={interfaceLoading}
            error={interfaceError}
            errorDetail={interfaceErrorDetail}
            dataLoading={loading}
            emptyMessage="No service type; refresh the graph to show the interface."
          />

          <section className="pt-4 border-t border-border space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Send request</p>
            <p className="text-xs text-muted-foreground">
              Enter request fields in JSON and click Send. Default request field values are filled below.
            </p>
            <textarea
              value={requestJson}
              onChange={(e) => {
                setRequestJson(e.target.value);
                setCallError(null);
                setCallResult(null);
              }}
              rows={6}
              className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[100px]"
              placeholder='{"field": value}'
              spellCheck={false}
            />
            <Button
              type="button"
              size="sm"
              disabled={!ros || !resolvedServiceType?.trim() || callLoading}
              onClick={() => {
                let req: Record<string, unknown>;
                try {
                  req = JSON.parse(requestJson) as Record<string, unknown>;
                } catch {
                  setCallError('Invalid JSON.');
                  setCallResult(null);
                  return;
                }
                setCallError(null);
                setCallResult(null);
                setCallLoading(true);
                ros!
                  .callService(name, req)
                  .then((res) => setCallResult((res as Record<string, unknown>) ?? null))
                  .catch((err) => {
                    const msg =
                      (err as { message?: string })?.message ??
                      (typeof err === 'string' ? err : 'Service call failed');
                    setCallError(String(msg));
                    setCallResult(null);
                  })
                  .finally(() => setCallLoading(false));
              }}
            >
              {callLoading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                  Calling…
                </>
              ) : (
                'Send request'
              )}
            </Button>
            {callError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {callError}
              </div>
            )}
            {callResult != null && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Response</p>
                <pre className="rounded-md border border-border bg-muted/30 p-3 font-mono text-sm text-foreground whitespace-pre-wrap break-normal overflow-x-auto max-h-48 overflow-y-auto">
                  {JSON.stringify(callResult, null, 2)}
                </pre>
              </div>
            )}
          </section>

          <section className="pt-4 border-t border-border space-y-2">
            <p className="text-sm font-medium text-muted-foreground">ROS2 CLI commands</p>
            <div className="space-y-1.5">
              <CopyableCliLine
                text={`ros2 service info ${name}`}
                id="svc-info"
                copiedId={copiedId}
                onCopy={setCopiedId}
              />
              <CopyableCliLine
                text={`ros2 service type ${name}`}
                id="svc-type"
                copiedId={copiedId}
                onCopy={setCopiedId}
              />
              {(resolvedServiceType || type) && (
                <>
                  <CopyableCliLine
                    text={`ros2 interface show ${resolvedServiceType || type}`}
                    id="svc-interface"
                    copiedId={copiedId}
                    onCopy={setCopiedId}
                  />
                  <CopyableCliLine
                    text={`ros2 service call ${name} ${resolvedServiceType || type} "{}"`}
                    id="svc-call"
                    copiedId={copiedId}
                    onCopy={setCopiedId}
                  />
                </>
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
