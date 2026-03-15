"""Collect ROS2 graph (nodes, topics, services, actions + connections) via rclpy."""

from __future__ import annotations

SKIP_NODES = {'/rosapi', '/rosbridge_websocket', '/rosmon_bridge', 'rosmon_bridge'}
SYSTEM_TOPICS = {'/client_count', '/connected_clients', '/rosout', '/parameter_events'}


def _normalize_name_for_skip(name) -> str:
    """Normalize node name for skip checks; returns empty string on error."""
    try:
        return str(name).strip() if name is not None else ''
    except (TypeError, ValueError):
        return ''


def _is_rosmon_bridge_node(full_name: str) -> bool:
    """True if this node is rosmon_bridge or any node under /rosmon_bridge/."""
    full_name = _normalize_name_for_skip(full_name)
    if not full_name:
        return False
    if full_name in SKIP_NODES:
        return True
    if full_name.startswith('/rosmon_bridge/') or full_name.startswith('rosmon_bridge/'):
        return True
    if '/rosmon_bridge' in full_name or full_name.endswith('/rosmon_bridge'):
        return True
    return False


def _is_ros2cli_daemon_node(full_name: str) -> bool:
    """True if this node is an rcl ros2cli daemon (e.g. _ros2cli_daemon_131)."""
    s = _normalize_name_for_skip(full_name)
    if not s:
        return False
    # strip leading slash/namespace for comparison
    base = s.split('/')[-1] if '/' in s else s
    return base.startswith('_ros2cli_daemon_')


def _full_name(namespace: str, name: str) -> str:
    ns = namespace if namespace and namespace != '/' else ''
    return (ns + '/' + name) if ns else name


def _str(s) -> str:
    """Normalize to string (rclpy may return custom types in some distros)."""
    if s is None:
        return ''
    return str(s).strip()


def _add_topic_connection_side(
    topic_connections: dict,
    topic_name: str,
    type_str: str,
    node_full_name: str,
    side: str,
) -> None:
    """Add node to topic_connections[topic_name][side]. side is 'publishers' or 'subscribers'."""
    if topic_name in SYSTEM_TOPICS:
        return
    if topic_name not in topic_connections:
        topic_connections[topic_name] = {'publishers': [], 'subscribers': [], '_type': type_str}
    elif type_str and not (topic_connections[topic_name].get('_type') or '').strip():
        topic_connections[topic_name]['_type'] = type_str
    if node_full_name not in topic_connections[topic_name][side]:
        topic_connections[topic_name][side].append(node_full_name)


def _process_node(
    node,
    node_name: str,
    namespace: str,
    full: str,
    topic_connections: dict,
    service_to_node: dict,
    service_type_by_name: dict,
    services_list: list,
) -> None:
    """Update topic_connections, service_to_node, service_type_by_name, services_list for one node."""
    # Publishers
    try:
        for (topic_name, types) in node.get_publisher_names_and_types_by_node(node_name, namespace):
            type_str = (types[0] if types else '').strip()
            _add_topic_connection_side(topic_connections, topic_name, type_str, full, 'publishers')
    except Exception:
        pass

    # Subscribers
    try:
        for (topic_name, types) in node.get_subscriber_names_and_types_by_node(node_name, namespace):
            type_str = (types[0] if types else '').strip()
            _add_topic_connection_side(topic_connections, topic_name, type_str, full, 'subscribers')
    except Exception:
        pass

    # Service servers
    try:
        for (srv_name, types) in node.get_service_names_and_types_by_node(node_name, namespace):
            type_str = (types[0] if types else '').strip()
            if srv_name not in service_to_node:
                service_to_node[srv_name] = full
                service_type_by_name[srv_name] = type_str
                services_list.append(srv_name)
            elif type_str and not (service_type_by_name.get(srv_name) or '').strip():
                service_type_by_name[srv_name] = type_str
    except Exception:
        pass

    # Service clients
    try:
        if hasattr(node, 'get_client_names_and_types_by_node'):
            for (srv_name, types) in node.get_client_names_and_types_by_node(node_name, namespace):
                type_str = (types[0] if types else '').strip()
                if srv_name not in service_to_node:
                    service_to_node[srv_name] = ''
                    service_type_by_name[srv_name] = type_str
                    services_list.append(srv_name)
                elif type_str and not (service_type_by_name.get(srv_name) or '').strip():
                    service_type_by_name[srv_name] = type_str
    except Exception:
        pass


def collect_graph(node) -> dict:
    """Build graph payload compatible with useRosApi state. Call from rclpy thread."""
    nodes = []
    topic_connections = {}
    topics = []
    topic_types = []
    services_list = []
    service_type_by_name = {}
    service_to_node = {}
    actions = []
    action_types = []
    action_to_node = {}
    action_to_clients = {}

    try:
        node_names_and_ns = node.get_node_names_and_namespaces()
    except Exception:
        return _payload(
            nodes, topic_connections, topics, topic_types,
            [], [], service_to_node,
            actions, action_types, action_to_node, action_to_clients,
        )

    def ns_norm(ns):
        if not ns or ns == '/':
            return ''
        return _str(ns)

    for item in node_names_and_ns:
        node_name = _str(item[0]) if len(item) > 0 else ''
        namespace = _str(item[1]) if len(item) > 1 else ''
        if not node_name:
            continue
        full = _full_name(namespace, node_name)
        if full in SKIP_NODES or any(full.startswith(p + '/') for p in SKIP_NODES):
            continue
        if _is_rosmon_bridge_node(full):
            continue
        if _is_ros2cli_daemon_node(full):
            continue
        nodes.append(full)
        _process_node(
            node, node_name, namespace, full,
            topic_connections, service_to_node, service_type_by_name, services_list,
        )

    # Actions: use action graph if available
    try:
        from rclpy.action import graph as action_graph
        if hasattr(action_graph, 'get_action_server_names_and_types_by_node'):
            for item in node_names_and_ns:
                node_name = _str(item[0]) if len(item) > 0 else ''
                namespace = _str(item[1]) if len(item) > 1 else ''
                if not node_name:
                    continue
                full = _full_name(namespace, node_name)
                if full in SKIP_NODES:
                    continue
                try:
                    servers = action_graph.get_action_server_names_and_types_by_node(
                        node, node_name, namespace
                    )
                    for (action_name, types) in servers:
                        if action_name not in action_to_node:
                            actions.append(action_name)
                            action_types.append(types[0] if types else '')
                            action_to_node[action_name] = full
                            action_to_clients[action_name] = []
                except Exception:
                    pass
                try:
                    clients = action_graph.get_action_client_names_and_types_by_node(
                        node, node_name, namespace
                    )
                    for (action_name, types) in clients:
                        if action_name not in action_to_clients:
                            actions.append(action_name)
                            action_types.append(types[0] if types else '')
                            action_to_node[action_name] = action_to_node.get(action_name, '')
                            action_to_clients[action_name] = []
                        if full not in action_to_clients[action_name]:
                            action_to_clients[action_name].append(full)
                except Exception:
                    pass
    except Exception:
        pass

    # Derive topics/topicTypes from topic_connections (drop internal _type)
    topics_ordered = []
    topic_types_ordered = []
    for t, conn in topic_connections.items():
        topics_ordered.append(t)
        topic_types_ordered.append(conn.pop('_type', ''))
    services_ordered = list(dict.fromkeys(services_list))
    service_types_ordered = [service_type_by_name.get(s, '') for s in services_ordered]

    return _payload(
        nodes, topic_connections, topics_ordered, topic_types_ordered,
        services_ordered, service_types_ordered, service_to_node,
        actions, action_types, action_to_node, action_to_clients,
    )


def _payload(nodes, topic_connections, topics, topic_types,
             services, service_types, service_to_node,
             actions, action_types, action_to_node, action_to_clients):
    return {
        'nodes': nodes,
        'topicConnections': topic_connections,
        'topics': topics,
        'topicTypes': topic_types,
        'services': services,
        'serviceTypes': service_types,
        'serviceToNode': service_to_node,
        'actions': actions,
        'actionTypes': action_types,
        'actionToNode': action_to_node,
        'actionToClients': action_to_clients,
    }
