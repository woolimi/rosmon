"""rclpy worker thread: runs ROS2 node, processes request queue, invokes handlers."""

from __future__ import annotations

import logging
import queue
import threading
from typing import Callable

from . import handlers
from .message_utils import dict_to_message, get_message_class
from .topic_publisher import TopicPublisher

logger = logging.getLogger(__name__)

# Request: (op, id, payload, callback(result_or_error))
Request = tuple[str, str, dict, Callable[[dict], None]]


def run_rclpy_worker(
    request_queue: queue.Queue[Request],
    ready: threading.Event,
    shutdown_event: threading.Event,
) -> None:
    """Run rclpy node and process requests. Call from dedicated thread."""
    import rclpy
    from rclpy.node import Node

    # ROS_DOMAIN_ID is always read from the process environment (never set in code).
    try:
        rclpy.init()
    except Exception as e:
        logger.exception("rclpy.init() failed (다른 프로세스에서 이미 rcl 종료했거나 ROS 환경 확인): %s", e)
        return
    try:
        node = Node('rosmon_bridge')
    except Exception as e:
        logger.exception("rclpy Node('rosmon_bridge') failed (context invalid 등): %s", e)
        try:
            rclpy.shutdown()
        except Exception:
            pass
        return
    ready.set()

    try:
        from rosidl_runtime_py.set_message import set_message_fields as _rosidl_set_message_fields
    except ImportError:
        _rosidl_set_message_fields = None

    def build_message(type_str: str, msg_payload: dict):
        msg_class = get_message_class(type_str)
        if msg_class is None:
            return None
        try:
            if _rosidl_set_message_fields is not None:
                msg_obj = msg_class()
                _rosidl_set_message_fields(msg_obj, msg_payload)
                return msg_obj
            return dict_to_message(msg_class, msg_payload)
        except Exception:
            return dict_to_message(msg_class, msg_payload)

    topic_publisher = TopicPublisher(node)
    ctx = {
        'last_graph': [None],
        'topic_publisher': topic_publisher,
        'node': node,
        'build_message': build_message,
        'set_message_fields': _rosidl_set_message_fields,
    }

    # On Ctrl+C, RCL may be shut down before shutdown_event is seen.
    while not shutdown_event.is_set():
        try:
            try:
                req = request_queue.get(timeout=0.1)
            except queue.Empty:
                if shutdown_event.is_set():
                    break
                if not rclpy.ok():
                    break
                try:
                    rclpy.spin_once(node, timeout_sec=0.05)
                except Exception as e:
                    if shutdown_event.is_set():
                        break
                    if not rclpy.ok():
                        break
                    err_str = str(e).lower()
                    if 'context is not valid' in err_str or 'rcl_shutdown' in err_str:
                        break
                    raise
                continue
            op, req_id, payload, callback = req
            try:
                handler = handlers.HANDLERS.get(op)
                if handler:
                    handler(req_id, payload, callback, ctx)
                else:
                    callback({'id': req_id, 'error': f'unknown op: {op}'})
            except Exception as e:
                logger.exception('request %s failed', req_id)
                callback({'id': req_id, 'error': str(e)})
        except Exception as e:
            if shutdown_event.is_set():
                break
            if not rclpy.ok():
                break
            err_str = str(e).lower()
            if 'context is not valid' in err_str or 'rcl_shutdown' in err_str:
                break
            logger.exception('worker loop: %s', e)

    try:
        node.destroy_node()
        rclpy.shutdown()
    except Exception:
        pass
