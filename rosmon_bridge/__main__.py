"""Entry point: python -m rosmon_bridge [--host HOST] [--port PORT].

Must be run with the Python that has ROS2 rclpy (e.g. conda env with ros, or
after source /opt/ros/<distro>/setup.bash). If you see ModuleNotFoundError for
rclpy or _rclpy_pybind11, use that environment's python, e.g.:
  conda activate ros
  python -m rosmon_bridge --port 9090
"""

import argparse
import logging
import sys

from .server import run_server


def main() -> None:
    # Fail fast if rclpy is not loadable (wrong Python / env)
    try:
        import rclpy  # noqa: F401
    except (ImportError, ModuleNotFoundError) as e:
        sys.stderr.write(
            'rosmon_bridge: rclpy not available. Run with the Python that has ROS2 rclpy\n'
            '(e.g. conda activate ros, then: python -m rosmon_bridge --port 9090).\n'
            f'Error: {e}\n'
        )
        sys.exit(1)

    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s %(message)s')
    ap = argparse.ArgumentParser(description='rosmon_bridge WebSocket + rclpy graph server')
    ap.add_argument('--host', default='0.0.0.0', help='Bind host')
    ap.add_argument('--port', type=int, default=9090, help='WebSocket port')
    args = ap.parse_args()
    try:
        run_server(host=args.host, port=args.port)
    except KeyboardInterrupt:
        pass
    except Exception as e:
        logging.error('%s', e)
        sys.exit(1)


if __name__ == '__main__':
    main()
