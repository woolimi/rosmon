/** rosmon_bridge WebSocket 주소. 브라우저는 localhost로 연결 (0.0.0.0은 서버 바인딩용). */
export const ROSMON_BRIDGE_WS_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_ROSMON_BRIDGE_WS_URL) ||
  'ws://localhost:9090';
