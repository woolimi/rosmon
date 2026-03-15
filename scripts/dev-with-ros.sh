#!/usr/bin/env bash
# 전제: 호출 전에 ROS2 환경을 source 해 둔 상태에서 실행 (e.g. source /opt/ros/jazzy/setup.bash)
# 1) rosmon_bridge 백그라운드 실행
# 2) 브리지 실패 시 웹 미실행, 성공 시 npm run dev:web

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

BRIDGE_PID=""
cleanup() {
  if [[ -n "$BRIDGE_PID" ]]; then
    kill "$BRIDGE_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$BRIDGE_PID" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup INT TERM

# ---------- rosmon_bridge: 실패하면 웹 실행 안 함 ----------
# PYTHONPATH 앞에만 REPO_ROOT 추가 (기존 ROS 경로 덮어쓰지 않음)
export PYTHONPATH="$REPO_ROOT:${PYTHONPATH:-}"
python -m rosmon_bridge --port 9090 &
BRIDGE_PID=$!

sleep 3
if ! kill -0 "$BRIDGE_PID" 2>/dev/null; then
  echo "ROSMON dev — rosmon_bridge exited early. Refusing to start web without bridge." >&2
  exit 1
fi

# ---------- 웹 앱 (foreground) ----------
npm run dev:web
