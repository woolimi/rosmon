"""ROS2 메시지 타입 정규화, dict↔메시지 변환, 인터페이스 필드 포맷. node/queue 미참조."""

from __future__ import annotations

import importlib
from typing import Any, Literal

ROS_PRIMITIVE_TYPES = frozenset({
    'bool', 'byte', 'int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32',
    'int64', 'uint64', 'float32', 'float64', 'string', 'wstring',
})


def norm_interface_type(it: str) -> tuple[str, str, str]:
    """인터페이스 타입 문자열을 (pkg, kind, name)으로 정규화. kind는 msg/srv/action."""
    it = (it or '').strip()
    if not it:
        return ('', '', '')
    parts = it.split('/')
    if len(parts) == 3:
        return (parts[0], parts[1], parts[2])
    if len(parts) == 2:
        pkg, name = parts
        return (pkg, 'msg', name)
    return ('', '', '')


def get_fields(msg_class: type) -> dict[str, str]:
    """Return dict of field name -> type string (e.g. 'string', 'std_msgs/msg/Header')."""
    try:
        if hasattr(msg_class, 'get_fields_and_field_types'):
            out = msg_class.get_fields_and_field_types()
            if out is not None:
                return out if isinstance(out, dict) else dict(out)
    except Exception:
        pass
    try:
        from rosidl_runtime_py.convert import get_message_slot_types
        inst = msg_class()
        out = get_message_slot_types(inst)
        if out is not None:
            return dict(out) if not isinstance(out, dict) else out
    except Exception:
        pass
    return {}


def format_msg(msg_class: type, indent: str = '', visited: set[str] | None = None) -> list[str]:
    """인터페이스 클래스를 ros2 interface show 스타일 줄 목록으로."""
    if visited is None:
        visited = set()
    fields = get_fields(msg_class)
    if not fields:
        return []
    lines = []
    for fname, type_str in fields.items():
        type_str = (type_str or '').strip()
        is_array = type_str.endswith('[]')
        base = type_str[:-2].strip() if is_array else type_str
        if '/' in base and base not in ROS_PRIMITIVE_TYPES:
            short = base.split('/')[-1]
            lines.append(f'{indent}{short} {fname}')
            full = base if base.count('/') >= 2 else f"{base.split('/')[0]}/msg/{base.split('/')[-1]}"
            if full not in visited:
                visited.add(full)
                try:
                    pkg, kind, cname = norm_interface_type(full)
                    if pkg and kind and cname:
                        m = importlib.import_module(f'{pkg}.{kind}')
                        nested = getattr(m, cname, None)
                        if nested is not None and get_fields(nested):
                            lines.extend(format_msg(nested, indent + '\t', visited))
                except Exception:
                    pass
                finally:
                    visited.discard(full)
        else:
            lines.append(f'{indent}{type_str} {fname}')
    return lines


def _get_interface_class(interface_type: str, kind: Literal['msg', 'srv', 'action']) -> type | None:
    """Load interface class by type string and kind. Returns None on failure."""
    it = (interface_type or '').strip()
    if not it:
        return None
    pkg, k, name = norm_interface_type(it)
    if not pkg or k != kind or not name:
        return None
    try:
        mod = importlib.import_module(f'{pkg}.{k}')
        cls = getattr(mod, name, None)
        if cls is not None:
            return cls
    except Exception:
        pass
    try:
        from rosidl_runtime_py.utilities import get_message, get_service, get_action
        if kind == 'msg':
            return get_message(it)
        if kind == 'srv':
            return get_service(it)
        if kind == 'action':
            return get_action(it)
    except Exception:
        pass
    return None


def get_message_class(interface_type: str) -> type | None:
    """Return message class for type string (e.g. geometry_msgs/msg/Twist), or None."""
    return _get_interface_class(interface_type, 'msg')


def get_service_class(interface_type: str) -> type | None:
    """Return service class for type string (e.g. std_srvs/srv/SetBool). Has .Request and .Response."""
    return _get_interface_class(interface_type, 'srv')


def get_action_class(interface_type: str) -> type | None:
    """Return action class for type string (e.g. example_interfaces/action/Fibonacci). Has .Goal, .Result, .Feedback."""
    return _get_interface_class(interface_type, 'action')


def payload_val(d: dict, fname: str) -> Any:
    """페이로드 d에서 필드값 조회. 키가 정확히 일치하거나 대소문자 무시 일치하면 반환."""
    if fname in d:
        return d[fname]
    fl = fname.lower()
    for k, v in d.items():
        if k.lower() == fl:
            return v
    return None


def nest_flat_keys(d: dict) -> dict:
    """점 표기 키(예: 'linear.x')를 중첩 dict로 합침. 예: {'linear.x': 10} -> {'linear': {'x': 10}}."""
    out: dict = {}
    for k, v in d.items():
        if '.' in k and not k.startswith('.'):
            head, tail = k.split('.', 1)
            if head not in out:
                out[head] = {}
            if isinstance(out[head], dict):
                if '.' in tail:
                    sub = nest_flat_keys({tail: v})
                    out[head].update(sub)
                else:
                    out[head][tail] = v
            else:
                out[head] = v
        else:
            if k in out and isinstance(out[k], dict) and isinstance(v, dict):
                out[k] = {**out[k], **v}
            else:
                out[k] = v
    return out


def coerce_primitive(val: Any, base: str) -> Any:
    """ROS primitive 타입명에 맞게 값 변환. float/int/str 등."""
    if base in ('float32', 'float64', 'float', 'double'):
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            try:
                return float(val)
            except (ValueError, TypeError):
                raise ValueError(f'expected number, got {val!r}')
    if base in ('int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64', 'byte'):
        if val is not None and isinstance(val, (int, float)):
            return int(val)
        if isinstance(val, str):
            try:
                return int(float(val))
            except (ValueError, TypeError):
                raise ValueError(f'expected number, got {val!r}')
    return val


def _fill_message_from_dict(
    msg_obj: Any,
    d: dict,
    visited: set[str] | None = None,
) -> None:
    """기존 메시지 인스턴스에 페이로드 d만 반영. 중첩은 같은 인스턴스에 인플레이스로 설정."""
    if visited is None:
        visited = set()
    if not isinstance(d, dict):
        raise ValueError(f'expected dict, got {type(d).__name__}')
    d = nest_flat_keys(d)
    msg_class = type(msg_obj)
    fields = get_fields(msg_class)
    if not fields:
        raise ValueError('message has no fields')
    for fname, type_str in (fields or {}).items():
        val = payload_val(d, fname)
        if val is None:
            continue
        type_str = (type_str or '').strip()
        is_array = type_str.endswith('[]')
        base = type_str[:-2].strip() if is_array else type_str
        if is_array:
            if not isinstance(val, list):
                raise ValueError(f'field {fname!r}: expected list, got {type(val).__name__}')
            if base in ROS_PRIMITIVE_TYPES:
                if base in ('float32', 'float64', 'float', 'double'):
                    setattr(msg_obj, fname, [float(x) if isinstance(x, (int, float)) else float(x) if isinstance(x, str) else x for x in val])
                elif base in ('int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64', 'byte'):
                    setattr(msg_obj, fname, [int(x) if isinstance(x, (int, float)) else int(float(x)) if isinstance(x, str) else x for x in val])
                else:
                    setattr(msg_obj, fname, list(val))
            else:
                nested_cls = get_message_class(base) if '/' in base else None
                if nested_cls is None:
                    pkg, kind, cname = norm_interface_type(base)
                    if pkg and kind and cname:
                        try:
                            m = importlib.import_module(f'{pkg}.{kind}')
                            nested_cls = getattr(m, cname, None)
                        except Exception:
                            pass
                if nested_cls is not None:
                    setattr(msg_obj, fname, [dict_to_message(nested_cls, item, visited) for item in val])
                else:
                    setattr(msg_obj, fname, list(val))
        elif base in ROS_PRIMITIVE_TYPES:
            setattr(msg_obj, fname, coerce_primitive(val, base))
        else:
            full = base if base.count('/') >= 2 else f"{base.split('/')[0]}/msg/{base.split('/')[-1]}"
            if full in visited:
                raise ValueError(f'circular reference in type {full}')
            nested_cls = get_message_class(full)
            if nested_cls is None:
                pkg, kind, cname = norm_interface_type(full)
                if pkg and kind and cname:
                    try:
                        m = importlib.import_module(f'{pkg}.{kind}')
                        nested_cls = getattr(m, cname, None)
                    except Exception:
                        pass
            if nested_cls is not None:
                if not isinstance(val, dict):
                    raise ValueError(f'field {fname!r}: expected dict, got {type(val).__name__}')
                submsg = getattr(msg_obj, fname)
                if submsg is None:
                    raise ValueError(f'field {fname!r}: nested message is None (ROS2 message has no slot)')
                visited.add(full)
                try:
                    _fill_message_from_dict(submsg, val, visited)
                finally:
                    visited.discard(full)
            else:
                setattr(msg_obj, fname, val)


def dict_to_message(
    msg_class: type,
    d: dict,
    visited: set[str] | None = None,
) -> Any:
    """페이로드 d로 메시지 생성. 페이로드에 없는 필드는 설정하지 않음. 형식 오류 시 ValueError."""
    if visited is None:
        visited = set()
    if not isinstance(d, dict):
        raise ValueError(f'expected dict, got {type(d).__name__}')
    msg = msg_class()
    _fill_message_from_dict(msg, d, visited)
    return msg


def message_to_dict(msg_obj: Any, visited: set[str] | None = None) -> dict[str, Any]:
    """Convert a ROS message instance to a nested dict (for service response, etc.)."""
    if visited is None:
        visited = set()
    key: str | None = None
    try:
        msg_cls = type(msg_obj)
        if hasattr(msg_cls, '__module__') and hasattr(msg_cls, '__name__'):
            key = f'{msg_cls.__module__}.{msg_cls.__name__}'
            if key in visited:
                return {}
            visited.add(key)
        try:
            fields = get_fields(msg_cls)
        except Exception:
            fields = {}
        if not fields:
            return {}
        out: dict[str, Any] = {}
        for fname, type_str in fields.items():
            try:
                v = getattr(msg_obj, fname, None)
                type_str = (type_str or '').strip()
                is_array = type_str.endswith('[]')
                base = type_str[:-2].strip() if is_array else type_str
                if v is None:
                    out[fname] = None
                elif is_array and isinstance(v, (list, tuple)):
                    if base in ROS_PRIMITIVE_TYPES:
                        out[fname] = list(v)
                    else:
                        out[fname] = [message_to_dict(item, visited) for item in v]
                elif base not in ROS_PRIMITIVE_TYPES and (hasattr(v, 'get_fields_and_field_types') or (type_str and '/' in base)):
                    out[fname] = message_to_dict(v, visited)
                else:
                    out[fname] = v
            except Exception:
                out[fname] = None
        return out
    except Exception:
        return {}
    finally:
        if key and key in visited:
            visited.discard(key)


def message_summary_for_log(msg_obj: Any, depth: int = 0, max_depth: int = 2) -> dict | str:
    """Return a short dict-like summary of a message for debug logging."""
    if depth > max_depth:
        return '...'
    try:
        msg_cls = type(msg_obj)
        fields = get_fields(msg_cls)
        if not fields:
            return str(msg_obj)[:80]
        out: dict[str, Any] = {}
        for fname in list(fields.keys())[:10]:
            try:
                v = getattr(msg_obj, fname, None)
                if hasattr(v, 'get_fields_and_field_types') or (type(v).__name__ not in ('int', 'float', 'str', 'bool', 'list')):
                    out[fname] = message_summary_for_log(v, depth + 1, max_depth)
                else:
                    out[fname] = v
            except Exception:
                out[fname] = '?'
        return out
    except Exception:
        return str(msg_obj)[:80]
