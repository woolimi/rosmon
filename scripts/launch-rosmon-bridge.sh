#!/usr/bin/env bash
# rosmon_bridge WebSocket 서버만 실행 (테스트용).
# - Conda 사용 시: conda activate <env> 후 실행하거나 ROSMON_CONDA_PREFIX 설정
# - /opt/ros 설치 시: ROS_DISTRO 설정 가능 (기본: jazzy)
# 전체 개발 실행(웹+브리지)은 npm run dev 를 사용하세요.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

CONDA_ENV="${ROSMON_CONDA_PREFIX:-$CONDA_PREFIX}"
if [[ -n "$CONDA_ENV" ]]; then
  export PATH="${CONDA_ENV}/bin:$PATH"
fi

# ROS2 setup (rclpy for rosmon_bridge)
if [[ -z "${ROS_VERSION}" ]] && [[ -z "${ROS_DISTRO}" ]]; then
  ROS_DISTRO=${ROS_DISTRO:-jazzy}
  SETUP="/opt/ros/${ROS_DISTRO}/setup.bash"
  if [[ ! -f "$SETUP" ]]; then
    echo "ROSMON dev:ros — ROS2 setup not found at $SETUP. Set ROS_DISTRO or use conda (conda activate <env> then npm run dev:ros)." >&2
    exit 1
  fi
  source "$SETUP"
fi

if ! python3 -c "import websockets" 2>/dev/null; then
  echo "ROSMON dev:ros — installing websockets (pip install -r rosmon_bridge/requirements.txt)..." >&2
  pip install -r rosmon_bridge/requirements.txt
fi

echo "ROSMON dev:ros — starting rosmon_bridge on ws://localhost:9090 ..." >&2
PYTHONPATH="$REPO_ROOT" python -m rosmon_bridge --port 9090
