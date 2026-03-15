"""토픽당 퍼블리셔 캐시 및 1회 즉시 publish. rclpy Node 필요."""

from __future__ import annotations

import os
from typing import Any


class TopicPublisher:
    """토픽당 퍼블리셔 싱글톤; 첫 요청 시 생성·캐시, 이후 재사용."""

    def __init__(self, node: Any) -> None:
        self._node = node
        self._cache: dict[str, tuple[Any, type]] = {}

    def publish_once(self, topic_name: str, msg_obj: Any) -> tuple[bool, str | None]:
        """캐시된(또는 새로 만든) 퍼블리셔로 1회 즉시 publish. 구독자 없으면 (False, 에러메시지) 반환."""
        pub = self._get_or_create_publisher(topic_name, type(msg_obj))
        if pub.get_subscription_count() == 0:
            return False, 'no subscribers on topic'
        pub.publish(msg_obj)
        return True, None

    def _get_or_create_publisher(self, topic_name: str, msg_class: type) -> Any:
        cached = self._cache.get(topic_name)
        if cached is not None:
            pub, cached_class = cached
            if cached_class is msg_class:
                return pub
            try:
                self._node.destroy_publisher(pub)
            except Exception:
                pass
            del self._cache[topic_name]
        use_be = os.environ.get('ROSMON_PUBLISH_BEST_EFFORT', '').strip().lower() in ('1', 'true', 'yes')
        pub = self._create_publisher_with_qos(topic_name, msg_class, use_best_effort=use_be)
        self._cache[topic_name] = (pub, msg_class)
        return pub

    def _create_publisher_with_qos(self, topic_name: str, msg_class: type, use_best_effort: bool) -> Any:
        try:
            from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
            qos = QoSProfile(
                depth=10,
                reliability=ReliabilityPolicy.BEST_EFFORT if use_best_effort else ReliabilityPolicy.RELIABLE,
                history=HistoryPolicy.KEEP_LAST,
            )
            return self._node.create_publisher(msg_class, topic_name, qos)
        except Exception:
            return self._node.create_publisher(msg_class, topic_name, 10)
