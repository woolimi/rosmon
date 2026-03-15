/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** rosmon_bridge WebSocket URL (e.g. ws://localhost:9090 or ws://192.168.1.100:9090). */
  readonly VITE_ROSMON_BRIDGE_WS_URL?: string;
}

/** npm run dev / build 시 process.env에서 주입 (vite.config define) */
declare const __ROS_VERSION__: string;
declare const __ROS_DISTRO__: string;
declare const __ROS_PYTHON_VERSION__: string;
declare const __ROS_DOMAIN_ID__: string;
declare const __RMW_IMPLEMENTATION__: string;
declare const __ROS_LOCALHOST_ONLY__: string;
declare const __ROS_AUTOMATIC_DISCOVERY_RANGE__: string;
