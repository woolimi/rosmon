"""WebSocket server: receives JSON { op, id, ... }, dispatches to rclpy worker, returns { id, result } or { id, error }."""

from __future__ import annotations

import asyncio
import json
import logging
import queue
import threading

import websockets
from websockets.server import WebSocketServerProtocol

from .worker import Request, run_rclpy_worker

logger = logging.getLogger(__name__)

# ANSI: [ROSMON]=시안, [시간]=노랑
_CYAN = "\033[36m"
_YELLOW = "\033[33m"
_RESET = "\033[0m"


class _YellowPrefixFormatter(logging.Formatter):
    """[ROSMON]은 시안, [시간]은 노란색으로 출력하는 포맷터."""

    def __init__(self) -> None:
        super().__init__(
            fmt="%(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        self._datefmt = "%Y-%m-%d %H:%M:%S"

    def format(self, record: logging.LogRecord) -> str:
        ts = self.formatTime(record, self._datefmt)
        prefix = _CYAN + "[ROSMON]" + _RESET + _YELLOW + "[" + ts + "] " + _RESET
        return prefix + record.getMessage()


async def handle_connection(
    ws: WebSocketServerProtocol,
    path: str,
    request_queue: queue.Queue[Request],
    loop: asyncio.AbstractEventLoop,
) -> None:
    """Handle one WebSocket connection: read JSON messages, dispatch, send response."""
    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError as e:
                await ws.send(json.dumps({'error': f'invalid json: {e}'}))
                continue
            op = msg.get('op') or msg.get('type') or 'get_graph'
            req_id = msg.get('id', '')
            body_line = json.dumps(msg, ensure_ascii=False)
            logger.info("%s", body_line)
            # Only strip op/id so that get_interface receives payload.type
            payload = {k: v for k, v in msg.items() if k not in ('op', 'id')}

            result_fut: asyncio.Future[dict] = loop.create_future()

            async def send_and_maybe_complete(response: dict) -> None:
                is_terminal = 'stream' not in response and ('result' in response or 'error' in response)
                if is_terminal:
                    try:
                        result_fut.set_result(response)
                    except asyncio.InvalidStateError:
                        pass
                await ws.send(json.dumps(response))

            def on_done(response: dict) -> None:
                try:
                    asyncio.run_coroutine_threadsafe(send_and_maybe_complete(response), loop)
                except Exception:
                    pass

            request_queue.put((op or 'get_graph', req_id or '0', payload, on_done))
            try:
                response = await asyncio.wait_for(result_fut, timeout=330.0)
            except asyncio.TimeoutError:
                response = {'id': req_id, 'error': 'timeout'}
                await ws.send(json.dumps(response))
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        logger.exception('handle_connection: %s', e)


def run_server(host: str = '0.0.0.0', port: int = 9090) -> None:
    """Start WebSocket server and rclpy worker thread."""
    # 통일된 로그 포맷: [LEVEL] [시간] 메시지, [LEVEL][시간]은 노란색 (websockets 등 모든 로거에 적용)
    _root = logging.getLogger()
    _fmt = _YellowPrefixFormatter()
    for h in _root.handlers:
        h.setFormatter(_fmt)
    # websockets "server listening" 제거 — 시작 로그만 남김
    logging.getLogger("websockets.server").setLevel(logging.WARNING)

    request_queue: queue.Queue[Request] = queue.Queue()
    ready = threading.Event()
    shutdown_event = threading.Event()

    def start_worker() -> None:
        run_rclpy_worker(request_queue, ready, shutdown_event)

    t = threading.Thread(target=start_worker, daemon=False)
    t.start()
    ready.wait(timeout=5.0)
    if not ready.is_set():
        shutdown_event.set()
        t.join(timeout=2.0)
        raise RuntimeError('rclpy worker did not become ready')

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    async def handler(ws: WebSocketServerProtocol, path: str = "") -> None:
        await handle_connection(ws, path, request_queue, loop)

    async def main() -> None:
        async with websockets.serve(handler, host, port, ping_interval=20, ping_timeout=20) as server:
            logger.info("rosmon_bridge on %s:%s", host, port)
            await asyncio.Future()

    try:
        loop.run_until_complete(main())
    except KeyboardInterrupt:
        pass
    finally:
        logger.info("rosmon_bridge stopping")
        shutdown_event.set()
        t.join(timeout=3.0)
        loop.close()
