/**
 * Client for rosmon_bridge WebSocket server.
 * Protocol: send { op, id, ...payload }, receive { id, result } or { id, error }.
 * For send_action_goal with stream_feedback: server may send { id, stream: 'feedback', data } then { id, result } or { id, error }.
 */

export interface ActionGoalResult {
  result: Record<string, unknown>;
}

export interface GraphPayload {
  nodes: string[];
  topicConnections: Record<string, { publishers: string[]; subscribers: string[] }>;
  topics: string[];
  topicTypes: string[];
  services: string[];
  serviceTypes: string[];
  serviceToNode: Record<string, string>;
  actions: string[];
  actionTypes: string[];
  actionToNode: Record<string, string>;
  actionToClients: Record<string, string[]>;
  /** ROS_DOMAIN_ID from bridge process env (for "no nodes" hint). */
  rosDomainId?: string;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export class RosmonBridgeClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void; onFeedback?: (data: Record<string, unknown>) => void }
  >();
  private idCounter = 0;
  private _connectionState: ConnectionState = 'disconnected';
  private _error: string | null = null;
  private listeners = new Set<(state: ConnectionState, error: string | null) => void>();

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  get error(): string | null {
    return this._error;
  }

  onStateChange(cb: (state: ConnectionState, error: string | null) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private setState(state: ConnectionState, error: string | null = null) {
    this._connectionState = state;
    this._error = error;
    this.listeners.forEach((cb) => cb(state, error));
  }

  connect(url: string): Promise<void> {
    this.disconnect();
    this.url = url;
    this.setState('connecting');
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        this.ws = ws;
        ws.onopen = () => {
          this.setState('connected', null);
          resolve();
        };
        ws.onclose = () => {
          this.ws = null;
          // Keep 'error' state so UI shows the banner and we don't trigger auto-reconnect loop
          if (this._connectionState !== 'disconnected' && this._connectionState !== 'error') {
            this.setState('disconnected');
          }
          this.rejectAll(new Error('WebSocket closed'));
        };
        ws.onerror = () => {
          this.setState('error', 'WebSocket error');
          reject(new Error('WebSocket error'));
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string) as {
              id?: string;
              result?: unknown;
              error?: string;
              stream?: string;
              data?: Record<string, unknown>;
            };
            const id = msg.id;
            if (id == null || !this.pending.has(id)) return;
            const entry = this.pending.get(id)!;
            if (msg.stream === 'feedback' && msg.data != null) {
              entry.onFeedback?.(msg.data);
              return;
            }
            this.pending.delete(id);
            if ('error' in msg && msg.error != null) {
              entry.reject(new Error(String(msg.error)));
            } else {
              entry.resolve(msg.result);
            }
          } catch {
            // ignore parse errors
          }
        };
      } catch (e) {
        this.setState('error', e instanceof Error ? e.message : String(e));
        reject(e);
      }
    });
  }

  disconnect(): void {
    if (!this.ws) return;
    this.ws.close();
    this.ws = null;
    this.setState('disconnected');
    this.rejectAll(new Error('disconnected'));
  }

  private rejectAll(err: Error): void {
    this.pending.forEach(({ reject }) => reject(err));
    this.pending.clear();
  }

  private sendRequest<T>(op: string, payload: Record<string, unknown> = {}): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('not connected'));
    }
    const id = `req_${++this.idCounter}`;
    const msg = { op, id, ...payload };
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
    });
    this.ws.send(JSON.stringify(msg));
    return promise;
  }

  getGraph(): Promise<GraphPayload> {
    return this.sendRequest<GraphPayload>('get_graph');
  }

  getTopic(name: string): Promise<{ type: string; publishers: string[]; subscribers: string[] }> {
    return this.sendRequest('get_topic', { name });
  }

  getService(name: string): Promise<{ type: string; serverNode: string }> {
    return this.sendRequest('get_service', { name });
  }

  getAction(name: string): Promise<{ type: string; serverNode: string; clientNodes: string[] }> {
    return this.sendRequest('get_action', { name });
  }

  getNode(name: string): Promise<{ name: string; present: boolean }> {
    return this.sendRequest('get_node', { name });
  }

  /** Returns interface definition text (same as `ros2 interface show <type>`). Optional `error` and `error_detail` when text is empty. Skips request if type is empty. */
  getInterface(interfaceType: string): Promise<{ text: string; error?: string; error_detail?: string }> {
    const t = (interfaceType ?? '').trim();
    if (!t) return Promise.resolve({ text: '' });
    const p = this.sendRequest<{ text: string; error?: string; error_detail?: string }>('get_interface', { type: t });
    p.catch((err) => {
      console.warn('[rosmon] get_interface failed', interfaceType, err);
    });
    return p;
  }

  publishTopic(_name: string, _type: string, _msg: unknown): Promise<void> {
    return this.sendRequest('publish_topic', { name: _name, type: _type, msg: _msg });
  }

  callService(_name: string, _request: unknown): Promise<unknown> {
    return this.sendRequest('call_service', { name: _name, request: _request });
  }

  /**
   * Send action goal; resolves with { result } when the action completes.
   * If options.streamFeedback is true, server streams feedback; pass onFeedback to receive each feedback message.
   */
  sendActionGoal(
    name: string,
    type: string,
    goal: Record<string, unknown>,
    options?: { streamFeedback?: boolean; onFeedback?: (data: Record<string, unknown>) => void }
  ): Promise<ActionGoalResult> {
    const streamFeedback = options?.streamFeedback === true;
    if (!streamFeedback || !options?.onFeedback) {
      return this.sendRequest<ActionGoalResult>('send_action_goal', { name, type, goal, stream_feedback: false });
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('not connected'));
    }
    const id = `req_${++this.idCounter}`;
    return new Promise<ActionGoalResult>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as ActionGoalResult),
        reject,
        onFeedback: options.onFeedback,
      });
      this.ws.send(JSON.stringify({ op: 'send_action_goal', id, name, type, goal, stream_feedback: true }));
    });
  }
}
