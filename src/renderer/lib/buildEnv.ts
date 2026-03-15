/**
 * 실행 환경에서 주입된 ROS 관련 env (vite.config define).
 * npm run dev 시 터미널의 ROS_VERSION, ROS_DISTRO, ROS_PYTHON_VERSION, ROS_DOMAIN_ID, RMW_IMPLEMENTATION 등이 반영됨.
 */
export const buildEnv = {
  ROS_VERSION: typeof __ROS_VERSION__ !== 'undefined' ? __ROS_VERSION__ : '',
  ROS_DISTRO: typeof __ROS_DISTRO__ !== 'undefined' ? __ROS_DISTRO__ : '',
  ROS_PYTHON_VERSION: typeof __ROS_PYTHON_VERSION__ !== 'undefined' ? __ROS_PYTHON_VERSION__ : '',
  ROS_DOMAIN_ID: typeof __ROS_DOMAIN_ID__ !== 'undefined' ? __ROS_DOMAIN_ID__ : '',
  RMW_IMPLEMENTATION: typeof __RMW_IMPLEMENTATION__ !== 'undefined' ? __RMW_IMPLEMENTATION__ : '',
  ROS_LOCALHOST_ONLY: typeof __ROS_LOCALHOST_ONLY__ !== 'undefined' ? __ROS_LOCALHOST_ONLY__ : '',
  ROS_AUTOMATIC_DISCOVERY_RANGE:
    typeof __ROS_AUTOMATIC_DISCOVERY_RANGE__ !== 'undefined' ? __ROS_AUTOMATIC_DISCOVERY_RANGE__ : '',
} as const;

export function getBuildEnvDisplay(key: keyof typeof buildEnv): string {
  const v = buildEnv[key];
  return v === '' ? '—' : v;
}

/** 값이 존재하는 env만 반환 (표시용) */
export function getDefinedEnvEntries(): { key: keyof typeof buildEnv; value: string }[] {
  return (Object.keys(buildEnv) as (keyof typeof buildEnv)[]).filter(
    (key) => buildEnv[key] !== ''
  ).map((key) => ({ key, value: buildEnv[key] }));
}
