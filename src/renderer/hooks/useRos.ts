import { useState, useCallback, useEffect, useRef } from 'react';
import { RosmonBridgeClient } from '@/lib/rosmonBridge';
import { ROSMON_BRIDGE_WS_URL } from '@/lib/ros';

const DOMAIN_ID_STORAGE_KEY = 'rosmon-domain-id';

function loadSavedDomainId(): number {
  try {
    const s = localStorage.getItem(DOMAIN_ID_STORAGE_KEY);
    if (s == null) return 0;
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 && n <= 232 ? n : 0;
  } catch {
    return 0;
  }
}

function saveDomainId(id: number) {
  try {
    localStorage.setItem(DOMAIN_ID_STORAGE_KEY, String(id));
  } catch {
    /* ignore */
  }
}

export type RosConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseRosReturn {
  /** rosmon_bridge WebSocket client (null when disconnected). */
  ros: RosmonBridgeClient | null;
  connectionState: RosConnectionState;
  error: string | null;
  /** @deprecated 자동 재시도 미사용. 호환용으로 항상 0. */
  autoRetriesLeft: number;
  /** 첫 연결 실패 후 2초 대기 중이면 true. 이 동안 UI는 '토폴로지 로드 중' 표시. */
  initialRetryPending: boolean;
  domainId: number;
  setDomainId: (id: number) => void;
  connect: (url: string) => Promise<void>;
  disconnect: () => void;
}

export function useRos(): UseRosReturn {
  const [ros, setRos] = useState<RosmonBridgeClient | null>(null);
  const [connectionState, setConnectionState] = useState<RosConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [autoRetriesLeft, setAutoRetriesLeft] = useState(0);
  const [initialRetryPending, setInitialRetryPending] = useState(false);
  const [domainId, setDomainIdState] = useState<number>(loadSavedDomainId);
  const clientRef = useRef<RosmonBridgeClient | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  /** 첫 연결 실패 후 1회만 자동 재시도 스케줄했는지 */
  const initialRetryScheduledRef = useRef(false);

  const updateErrorState = useCallback((state: RosConnectionState, err: string | null) => {
    setConnectionState(state);
    setError(err);
    if (state === 'error') setAutoRetriesLeft(0);
  }, []);

  const setDomainId = useCallback((id: number) => {
    const value = Math.min(232, Math.max(0, Math.floor(id)));
    setDomainIdState(value);
    saveDomainId(value);
  }, []);

  const disconnect = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
      setRos(null);
      setConnectionState('disconnected');
      setError(null);
    }
  }, []);

  const connect = useCallback(async (url: string) => {
    /* 이전 연결만 정리하고, setRos(null)은 새 클라이언트 세팅 전에 하지 않아 context가 비는 순간을 줄임 */
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }

    setConnectionState('connecting');
    setError(null);

    const client = new RosmonBridgeClient();
    unsubRef.current = client.onStateChange((state, err) => {
      if (clientRef.current !== client) return;
      updateErrorState(state, err);
      if (state === 'disconnected') {
        clientRef.current = null;
        setRos(null);
      }
    });

    clientRef.current = client;
    setRos(client);

    try {
      await client.connect(url);
    } catch (e) {
      setConnectionState('error');
      setError(e instanceof Error ? e.message : String(e));
      setAutoRetriesLeft(0);
      setRos(null);
      clientRef.current = null;
    }
  }, []);

  /* ros가 null이고 disconnected일 때만 연결 (마운트 시 + 재연결). 한 군데에서만 호출해 이중 connect 방지 */
  useEffect(() => {
    if (ros !== null || connectionState !== 'disconnected') return;
    connect(ROSMON_BRIDGE_WS_URL);
  }, [ros, connectionState, connect]);

  /* 첫 연결 실패 후 1회만 2초 뒤 재시도. 그동안 initialRetryPending으로 '토폴로지 로드 중' 표시 */
  useEffect(() => {
    if (connectionState !== 'error' || initialRetryScheduledRef.current) return;
    initialRetryScheduledRef.current = true;
    setInitialRetryPending(true);
    const t = setTimeout(() => {
      setInitialRetryPending(false);
      connect(ROSMON_BRIDGE_WS_URL);
    }, 2000);
    return () => clearTimeout(t);
  }, [connectionState, connect]);

  return { ros, connectionState, error, autoRetriesLeft, initialRetryPending, domainId, setDomainId, connect, disconnect };
}
