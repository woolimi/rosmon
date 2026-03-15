"""Worker 요청별 핸들러. 시그니처: (req_id, payload, callback, ctx)."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Callable

from . import graph
from . import interface_loader
from .message_utils import (
    dict_to_message,
    get_action_class,
    get_service_class,
    message_to_dict,
    message_summary_for_log,
)

logger = logging.getLogger(__name__)

CALL_SERVICE_TIMEOUT_SEC = 25.0
WAIT_FOR_SERVICE_TIMEOUT_SEC = 5.0
WAIT_FOR_ACTION_SERVER_SEC = 5.0
ACTION_GOAL_TIMEOUT_SEC = 300.0  # 5 min max for long-running actions

# ctx: last_graph (list of one), topic_publisher, node, build_message(type_str, msg_payload) -> msg_obj | None


# --- Helpers: last_graph lookup ---

def _get_name_and_last(payload: dict, ctx: dict) -> tuple[str | None, dict | None]:
    """Return (name, last_graph) from payload and ctx. (None, None) if name or last_graph missing."""
    name = (payload.get('name') or '').strip() or None
    last = ctx.get('last_graph', [None])[0]
    if not name or not last:
        return (None, None)
    return (name, last)


def _get_type_from_graph(last: dict, name: str, list_key: str, types_key: str) -> str:
    """Look up type string for name in last[list_key] / last[types_key]. Returns '' if not found."""
    lst = last.get(list_key) or []
    types = last.get(types_key) or []
    idx = next((i for i, x in enumerate(lst) if x == name), -1)
    return (types[idx] if 0 <= idx < len(types) else '').strip()


def _spin_until_done(node: Any, future: Any, timeout_sec: float, step_sec: float = 0.1) -> bool:
    """Spin node until future is done or timeout. Returns True if future.done()."""
    import rclpy
    while rclpy.ok() and not future.done() and timeout_sec > 0:
        rclpy.spin_once(node, timeout_sec=step_sec)
        timeout_sec -= step_sec
    return future.done()


# --- Handlers: graph based ---

def handle_get_graph(req_id: str, payload: dict, callback: Callable[[dict], None], ctx: dict) -> None:
    result = graph.collect_graph(ctx['node'])
    result = {**result, 'rosDomainId': os.environ.get('ROS_DOMAIN_ID', '')}
    ctx['last_graph'][0] = result
    callback({'id': req_id, 'result': result})


def handle_get_topic(req_id: str, payload: dict, callback: Callable[[dict], None], ctx: dict) -> None:
    name, last = _get_name_and_last(payload, ctx)
    if name is None:
        callback({'id': req_id, 'result': {'type': '', 'publishers': [], 'subscribers': []}})
        return
    typ = _get_type_from_graph(last, name, 'topics', 'topicTypes')
    conn = last.get('topicConnections') or {}
    entry = conn.get(name, {'publishers': [], 'subscribers': []})
    callback({'id': req_id, 'result': {'type': typ, 'publishers': entry.get('publishers', []), 'subscribers': entry.get('subscribers', [])}})


def handle_get_service(req_id: str, payload: dict, callback: Callable[[dict], None], ctx: dict) -> None:
    name, last = _get_name_and_last(payload, ctx)
    if name is None:
        callback({'id': req_id, 'result': {'type': '', 'serverNode': ''}})
        return
    typ = _get_type_from_graph(last, name, 'services', 'serviceTypes')
    stn = last.get('serviceToNode') or {}
    callback({'id': req_id, 'result': {'type': typ, 'serverNode': stn.get(name, '')}})


def handle_get_action(req_id: str, payload: dict, callback: Callable[[dict], None], ctx: dict) -> None:
    name, last = _get_name_and_last(payload, ctx)
    if name is None:
        callback({'id': req_id, 'result': {'type': '', 'serverNode': '', 'clientNodes': []}})
        return
    typ = _get_type_from_graph(last, name, 'actions', 'actionTypes')
    atn = last.get('actionToNode') or {}
    atc = last.get('actionToClients') or {}
    callback({'id': req_id, 'result': {'type': typ, 'serverNode': atn.get(name, ''), 'clientNodes': atc.get(name, [])}})


def handle_get_node(req_id: str, payload: dict, callback: Callable[[dict], None], ctx: dict) -> None:
    name, last = _get_name_and_last(payload, ctx)
    if name is None:
        callback({'id': req_id, 'result': {}})
        return
    nodes = last.get('nodes') or []
    callback({'id': req_id, 'result': {'name': name, 'present': name in nodes}})


def handle_get_interface(req_id: str, payload: dict, callback: Callable[[dict], None], ctx: dict) -> None:
    interface_type = (payload.get('type') or payload.get('interface_type') or '').strip()
    text, py_error = interface_loader.get_interface_text_rclpy(interface_type)
    if not text and interface_type:
        logger.warning(
            'get_interface: returned empty | type=%r detail=%s',
            interface_type, py_error or '(no detail)',
        )
    result: dict = {'text': text}
    if not text and interface_type:
        result['error'] = 'import_failed'
        result['error_detail'] = py_error or 'unknown (no error message captured)'
    callback({'id': req_id, 'result': result})


def handle_publish_topic(req_id: str, payload: dict, callback: Callable[[dict], None], ctx: dict) -> None:
    topic_name = (payload.get('name') or '').strip()
    type_str = (payload.get('type') or '').strip()
    msg_payload = payload.get('msg')
    publish_err = None
    if not topic_name or not type_str:
        publish_err = 'publish_topic requires name and type'
    elif msg_payload is None:
        publish_err = 'publish_topic requires msg payload (object)'
    elif isinstance(msg_payload, str):
        try:
            msg_payload = json.loads(msg_payload)
        except json.JSONDecodeError as e:
            publish_err = f'msg payload is invalid JSON: {e}'
        if publish_err is None and not isinstance(msg_payload, dict):
            publish_err = 'publish_topic requires msg to be an object'
    elif not isinstance(msg_payload, dict):
        publish_err = f'publish_topic requires msg to be an object, got {type(msg_payload).__name__}'
    if publish_err is not None:
        callback({'id': req_id, 'error': publish_err})
        return
    build_message = ctx.get('build_message')
    if not build_message:
        callback({'id': req_id, 'error': 'publish_topic: build_message not configured'})
        return
    try:
        msg_obj = build_message(type_str, msg_payload)
        if msg_obj is None:
            logger.warning('publish_topic: cannot load message type %r', type_str)
            callback({'id': req_id, 'error': f'cannot load message type {type_str!r}'})
            return
        ok, err = ctx['topic_publisher'].publish_once(topic_name, msg_obj)
        if not ok:
            callback({'id': req_id, 'error': err})
        else:
            logger.info('publish_topic: topic=%r type=%r', topic_name, type_str)
            callback({'id': req_id, 'result': {}})
    except ValueError as e:
        logger.warning('publish_topic: %s', e)
        callback({'id': req_id, 'error': f'잘못된 형식: {e}'})
    except Exception as e:
        logger.warning('publish_topic failed: %s', e, exc_info=True)
        callback({'id': req_id, 'error': str(e)})


def handle_call_service(req_id: str, payload: dict, callback: Callable[[dict], None], ctx: dict) -> None:
    name = (payload.get('name') or '').strip()
    request_payload = payload.get('request')
    if not name:
        callback({'id': req_id, 'error': 'call_service requires name'})
        return
    if request_payload is None:
        callback({'id': req_id, 'error': 'call_service requires request (object)'})
        return
    if isinstance(request_payload, str):
        try:
            request_payload = json.loads(request_payload)
        except json.JSONDecodeError as e:
            callback({'id': req_id, 'error': f'request is invalid JSON: {e}'})
            return
    if not isinstance(request_payload, dict):
        callback({'id': req_id, 'error': 'call_service requires request to be an object'})
        return

    last = ctx.get('last_graph', [None])[0]
    if not last:
        callback({'id': req_id, 'error': 'no graph data; refresh graph first'})
        return
    type_str = _get_type_from_graph(last, name, 'services', 'serviceTypes')
    if not type_str:
        callback({'id': req_id, 'error': f'service {name!r} not found in graph or type unknown; refresh graph'})
        return

    srv_class = get_service_class(type_str)
    if srv_class is None:
        callback({'id': req_id, 'error': f'cannot load service type {type_str!r}'})
        return
    request_class = getattr(srv_class, 'Request', None)
    if request_class is None:
        callback({'id': req_id, 'error': f'service type {type_str!r} has no Request class'})
        return

    logger.info('call_service: received payload request=%s', request_payload)

    set_message_fields = ctx.get('set_message_fields')
    request_msg = None
    if set_message_fields:
        try:
            request_msg = request_class()
            set_message_fields(request_msg, request_payload)
        except Exception as e:
            logger.warning('call_service: set_message_fields failed, falling back to dict_to_message: %s', e)
            request_msg = None
    if request_msg is None:
        try:
            request_msg = dict_to_message(request_class, request_payload)
        except ValueError as e:
            logger.warning('call_service: invalid request payload: %s', e)
            callback({'id': req_id, 'error': f'invalid request: {e}'})
            return

    logger.info('call_service: built request_msg=%s', message_summary_for_log(request_msg))

    node = ctx.get('node')
    if not node:
        callback({'id': req_id, 'error': 'bridge node not available'})
        return

    client = node.create_client(srv_class, name)
    if not client.wait_for_service(timeout_sec=WAIT_FOR_SERVICE_TIMEOUT_SEC):
        callback({'id': req_id, 'error': f'service {name!r} not available (no server or timeout)'})
        node.destroy_client(client)
        return

    future = client.call_async(request_msg)
    done = _spin_until_done(node, future, CALL_SERVICE_TIMEOUT_SEC)
    node.destroy_client(client)

    if not done:
        callback({'id': req_id, 'error': 'service call timeout'})
        return
    try:
        response_msg = future.result()
        result = message_to_dict(response_msg)
        logger.info('call_service: name=%r type=%r success', name, type_str)
        callback({'id': req_id, 'result': result})
    except Exception as e:
        logger.warning('call_service: result failed: %s', e, exc_info=True)
        callback({'id': req_id, 'error': str(e)})


def handle_send_action_goal(req_id: str, payload: dict, callback: Callable[[dict], None], ctx: dict) -> None:
    """Send action goal. If stream_feedback is true, stream feedback via callback(stream='feedback'); then callback(result=...) or error."""
    name = (payload.get('name') or '').strip()
    type_str = (payload.get('type') or '').strip()
    goal_payload = payload.get('goal')
    stream_feedback = payload.get('stream_feedback') is True or payload.get('streamFeedback') is True
    logger.info('send_action_goal: name=%r stream_feedback=%s payload_keys=%s', name, stream_feedback, list(payload.keys()))
    if not name:
        callback({'id': req_id, 'error': 'send_action_goal requires name'})
        return
    if not type_str:
        callback({'id': req_id, 'error': 'send_action_goal requires type'})
        return
    if goal_payload is None:
        callback({'id': req_id, 'error': 'send_action_goal requires goal (object)'})
        return
    if isinstance(goal_payload, str):
        try:
            goal_payload = json.loads(goal_payload)
        except json.JSONDecodeError as e:
            callback({'id': req_id, 'error': f'goal is invalid JSON: {e}'})
            return
    if not isinstance(goal_payload, dict):
        callback({'id': req_id, 'error': 'send_action_goal requires goal to be an object'})
        return

    action_class = get_action_class(type_str)
    if action_class is None:
        logger.warning('send_action_goal: cannot load action type %r', type_str)
        callback({'id': req_id, 'error': f'cannot load action type {type_str!r}'})
        return
    goal_class = getattr(action_class, 'Goal', None)
    if goal_class is None:
        callback({'id': req_id, 'error': f'action type {type_str!r} has no Goal class'})
        return

    try:
        goal_msg = dict_to_message(goal_class, goal_payload)
    except ValueError as e:
        logger.warning('send_action_goal: invalid goal payload: %s', e)
        callback({'id': req_id, 'error': f'invalid goal: {e}'})
        return

    node = ctx.get('node')
    if not node:
        callback({'id': req_id, 'error': 'bridge node not available'})
        return

    from rclpy.action import ActionClient

    client = ActionClient(node, action_class, name)
    if not client.wait_for_server(timeout_sec=WAIT_FOR_ACTION_SERVER_SEC):
        callback({'id': req_id, 'error': f'action server for {name!r} not available (timeout)'})
        client.destroy()
        return

    def feedback_cb(*args):
        if not stream_feedback:
            return
        if not args:
            return
        # rclpy may call (feedback_msg) or (goal_handle, feedback_msg); some versions use a wrapper with .feedback
        raw = args[-1]
        feedback_msg = getattr(raw, 'feedback', raw)
        if feedback_msg is None:
            return
        try:
            fb_dict = message_to_dict(feedback_msg)
            callback({'id': req_id, 'stream': 'feedback', 'data': fb_dict})
        except Exception as e:
            logger.warning('feedback_cb: message_to_dict failed (type=%s): %s', type(feedback_msg).__name__, e)

    send_future = client.send_goal_async(goal_msg, feedback_callback=feedback_cb if stream_feedback else None)
    if not _spin_until_done(node, send_future, WAIT_FOR_ACTION_SERVER_SEC):
        client.destroy()
        callback({'id': req_id, 'error': 'send_goal timeout'})
        return

    try:
        goal_handle = send_future.result()
    except Exception as e:
        client.destroy()
        callback({'id': req_id, 'error': str(e)})
        return

    if not goal_handle.accepted:
        client.destroy()
        callback({'id': req_id, 'error': 'goal rejected by action server'})
        return

    result_future = goal_handle.get_result_async()
    done = _spin_until_done(node, result_future, ACTION_GOAL_TIMEOUT_SEC)
    client.destroy()

    if not done:
        callback({'id': req_id, 'error': 'action result timeout'})
        return

    try:
        result_wrapper = result_future.result()
        # rclpy may return the Result message directly or a wrapper with .result attribute
        result_msg = getattr(result_wrapper, 'result', result_wrapper)
        result_dict = message_to_dict(result_msg) if result_msg is not None else {}
        logger.info('send_action_goal: name=%r type=%r success', name, type_str)
        callback({'id': req_id, 'result': {'result': result_dict}})
    except Exception as e:
        logger.warning('send_action_goal: result failed: %s', e, exc_info=True)
        callback({'id': req_id, 'error': str(e)})


HANDLERS: dict[str, Callable[[str, dict, Callable[[dict], None], dict], None]] = {
    'get_graph': handle_get_graph,
    'get_topic': handle_get_topic,
    'get_service': handle_get_service,
    'get_action': handle_get_action,
    'get_node': handle_get_node,
    'get_interface': handle_get_interface,
    'publish_topic': handle_publish_topic,
    'call_service': handle_call_service,
    'send_action_goal': handle_send_action_goal,
}
