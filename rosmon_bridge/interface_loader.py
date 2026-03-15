"""ROS2 인터페이스(msg/srv/action) 텍스트 로딩. rclpy 클래스 로드."""

from __future__ import annotations

import importlib
import logging

from .message_utils import format_msg, norm_interface_type

logger = logging.getLogger(__name__)


def _format_interface_text(cls: type, kind: str) -> tuple[str, str | None]:
    """Format loaded interface class to ros2 interface show style. Returns (text, error_detail)."""
    try:
        if kind == 'msg':
            lines = format_msg(cls)
            out = '\n'.join(lines) if lines else ''
            if not out:
                return '', 'interface format returned empty (get_fields_and_field_types gave no fields)'
            return out, None
        if kind == 'srv':
            req = getattr(cls, 'Request', None)
            res = getattr(cls, 'Response', None)
            parts = []
            if req is not None:
                parts.extend(format_msg(req))
            parts.append('---')
            if res is not None:
                parts.extend(format_msg(res))
            out = '\n'.join(parts) if parts else ''
            if not out:
                return '', 'interface format returned empty (srv Request/Response had no fields)'
            return out, None
        if kind == 'action':
            goal = getattr(cls, 'Goal', None)
            result = getattr(cls, 'Result', None)
            feedback = getattr(cls, 'Feedback', None)
            parts = []
            if goal is not None:
                parts.append('# Goal')
                parts.extend(format_msg(goal))
            parts.append('---')
            if result is not None:
                parts.append('# Result')
                parts.extend(format_msg(result))
            parts.append('---')
            if feedback is not None:
                parts.append('# Feedback')
                parts.extend(format_msg(feedback))
            out = '\n'.join(parts) if parts else ''
            if not out:
                return '', 'interface format returned empty (action Goal/Result/Feedback had no fields)'
            return out, None
        return '', 'unsupported kind'
    except Exception as e:
        return '', str(e)


def get_interface_text_rclpy(interface_type: str) -> tuple[str, str | None]:
    """Return (text, error_detail). error_detail is set when returning empty text."""
    it = (interface_type or '').strip()
    if not it:
        logger.debug('get_interface: empty interface type (no request sent or type omitted)')
        return '', None
    pkg, kind, name = norm_interface_type(it)
    if not pkg or not kind or not name:
        err = f'invalid type (need pkg/kind/name, got {it!r})'
        logger.warning('get_interface: %s', err)
        return '', err
    cls = None
    last_error: str | None = None
    try:
        mod = importlib.import_module(f'{pkg}.{kind}')
        cls = getattr(mod, name, None)
    except Exception as imp_err:
        last_error = str(imp_err)
        logger.warning(
            'get_interface: import failed | type=%r module=%s.%s name=%s error=%s (디버깅: 패키지 미설치 또는 워크스페이스 미 source)',
            it, pkg, kind, name, imp_err,
        )
        if kind == 'msg':
            try:
                from rosidl_runtime_py.utilities import get_message
                cls = get_message(it)
            except Exception as msg_fallback_err:
                last_error = str(msg_fallback_err)
                logger.warning(
                    'get_interface: get_message fallback failed for %r: %s',
                    it, msg_fallback_err,
                )
        elif kind == 'srv':
            try:
                from rosidl_runtime_py.utilities import get_service
                cls = get_service(it)
            except ImportError:
                pass
            except Exception as srv_fallback_err:
                last_error = str(srv_fallback_err)
                logger.warning(
                    'get_interface: get_service fallback failed for %r: %s',
                    it, srv_fallback_err,
                )
        elif kind == 'action':
            try:
                from rosidl_runtime_py.utilities import get_action
                cls = get_action(it)
            except ImportError:
                pass
            except Exception as action_fallback_err:
                last_error = str(action_fallback_err)
                logger.warning(
                    'get_interface: get_action fallback failed for %r: %s',
                    it, action_fallback_err,
                )
        if cls is None:
            try:
                alt_mod = importlib.import_module(f'{pkg}_{kind}')
                cls = getattr(alt_mod, name, None)
                if cls is not None:
                    logger.info('get_interface: loaded via alternate module %s.%s', pkg, kind)
            except Exception:
                pass
    if cls is None:
        last_error = last_error or f'class {name} not found in {pkg}.{kind}'
        logger.warning(
            'get_interface: class not found | type=%r pkg=%s kind=%s name=%s (디버깅: 모듈에는 있으나 해당 클래스 없음)',
            it, pkg, kind, name,
        )
        return '', last_error
    try:
        return _format_interface_text(cls, kind)
    except Exception as e:
        last_error = str(e)
        logger.warning(
            'get_interface: format failed | type=%r error=%s (디버깅: 인터페이스 포맷 중 예외, exc_info 아래 참고)',
            it, e, exc_info=True,
        )
        return '', last_error
