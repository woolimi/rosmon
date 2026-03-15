import type { MessageDetailsResponse } from '@/lib/messageDetails';
import { Button } from '@/components/ui/Button';
import { Copy, Check, Loader2 } from 'lucide-react';

// --- Interface parsing / display helpers ---

/** 줄바꿈이 제대로 보이도록 인터페이스 텍스트 정규화 (서버/CLI 형식 호환) */
export function normalizeInterfaceTextForDisplay(text: string): string {
  if (!text) return '';
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// --- UI components ---

/** 한 줄 CLI 명령 + 복사 버튼 (1줄, 횡스크롤 가능, 스크롤바 숨김) */
export function CopyableCliLine({
  text,
  id,
  copiedId,
  onCopy,
}: {
  text: string;
  id: string;
  copiedId: string | null;
  onCopy: (id: string) => void;
}) {
  const copied = copiedId === id;
  return (
    <div className="flex items-center gap-2 rounded bg-muted/40 px-2 py-1.5 font-mono text-sm text-foreground">
      <div
        className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:[display:none]"
        title={text}
      >
        <code className="whitespace-nowrap">
          {text}
        </code>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          onCopy(id);
        }}
        aria-label={copied ? 'Copied' : 'Copy'}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        )}
      </Button>
    </div>
  );
}

/** Interface 섹션: 로딩 / 텍스트 표시 / 에러 / 타입 없음 안내 */
export function InterfaceSection({
  resolvedType,
  interfaceText,
  loading,
  error,
  errorDetail,
  dataLoading,
  emptyMessage,
}: {
  resolvedType: string;
  interfaceText: string;
  loading: boolean;
  error: string | undefined;
  errorDetail: string | undefined;
  /** getTopic/getService/getAction 로딩 여부 (emptyMessage 표시 조건용) */
  dataLoading: boolean;
  emptyMessage: string;
}) {
  return (
    <section className="pt-4 border-t border-border space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Interface</p>
      {loading && (
        <div className="flex items-center gap-2 py-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span className="text-sm">Loading…</span>
        </div>
      )}
      {!loading && interfaceText && (
        <pre className="text-sm font-mono text-foreground whitespace-pre bg-muted/30 rounded p-2 overflow-x-auto overflow-y-auto max-h-48 min-w-0">
          {normalizeInterfaceTextForDisplay(interfaceText)}
        </pre>
      )}
      {!loading && !interfaceText && resolvedType && (
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">
            {error === 'import_failed'
              ? 'Could not load interface spec. (Package not found or source the workspace.)'
              : 'Could not load interface spec.'}
          </p>
          {errorDetail && (
            <p className="text-xs text-destructive font-mono break-all bg-destructive/10 rounded px-2 py-1">
              Server: {errorDetail}
            </p>
          )}
          <p className="text-xs text-muted-foreground font-mono break-all">Requested type: {resolvedType || '—'}</p>
        </div>
      )}
      {!loading && !resolvedType && !dataLoading && (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      )}
    </section>
  );
}

/** 노드 목록 섹션: 레이블 + 목록 또는 "없음" */
export function NodeListSection({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">None</p>
      ) : (
        <ul className="font-mono text-foreground space-y-0.5">
          {items.map((node) => (
            <li key={node} className="break-all">{node}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Placeholder build (parse interface text, build from typedefs) ---

function shortTypeName(full: string): string {
  const last = full.split('/').pop();
  return last ?? full;
}

const ROS_BUILTIN_DEFAULTS: Record<string, unknown> = {
  bool: false,
  boolean: false,
  byte: 0,
  int8: 0,
  uint8: 0,
  int16: 0,
  uint16: 0,
  int32: 0,
  uint32: 0,
  int64: 0,
  uint64: 0,
  float32: 0,
  float64: 0,
  float: 0,
  double: 0,
  string: '',
  wstring: '',
};

/** One parsed line: indent level (tabs or spaces), type, field name */
interface ParsedFieldLine {
  indent: number;
  type: string;
  fieldName: string;
  isArray: boolean;
}

function parseInterfaceLines(
  interfaceText: string,
  part: 'full' | 'request'
): ParsedFieldLine[] {
  const rawLines = interfaceText.replace(/\r\n/g, '\n').split('\n');
  const out: ParsedFieldLine[] = [];
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed === '---' || trimmed.startsWith('# ')) {
      if (part === 'request' && trimmed === '---') break;
      if (part === 'full' && trimmed === '---') break;
      continue;
    }
    if (!trimmed) continue;
    const leading = line.match(/^\s*/)?.[0] ?? '';
    const tabCount = (leading.match(/\t/g) ?? []).length;
    const indent = tabCount > 0 ? tabCount : Math.floor(leading.length / 2);
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    const typeStr = parts[0];
    const fieldName = parts[1];
    const arrayMatch = typeStr.match(/^(.+)\[(\d+)\]$/);
    const isSequence = /^sequence\s*<.+>$/.test(typeStr);
    out.push({
      indent,
      type: arrayMatch ? arrayMatch[1] : typeStr,
      fieldName,
      isArray: !!arrayMatch || isSequence,
    });
  }
  return out;
}

function isTimeOrDuration(typeStr: string): boolean {
  const short = shortTypeName(typeStr);
  return short === 'Time' || short === 'Duration' || typeStr.includes('Time') || typeStr.includes('Duration');
}

function defaultForType(typeStr: string, isArray: boolean): unknown {
  if (isArray) return [];
  if (/^sequence\s*<.+>$/.test(typeStr)) return [];
  const short = shortTypeName(typeStr);
  const v =
    ROS_BUILTIN_DEFAULTS[typeStr] ??
    ROS_BUILTIN_DEFAULTS[short] ??
    ROS_BUILTIN_DEFAULTS[typeStr.toLowerCase()] ??
    ROS_BUILTIN_DEFAULTS[short.toLowerCase()];
  if (v !== undefined) return v;
  if (isTimeOrDuration(typeStr)) return { sec: 0, nanosec: 0 };
  return undefined;
}

/**
 * Build placeholder object from parsed lines starting at index, for lines with indent >= baseIndent.
 * Returns { object, nextIndex }.
 */
function buildPlaceholderFromLines(
  lines: ParsedFieldLine[],
  startIdx: number,
  baseIndent: number
): { obj: Record<string, unknown>; nextIdx: number } {
  const result: Record<string, unknown> = {};
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < baseIndent) break;
    if (line.indent > baseIndent) {
      i++;
      continue;
    }
    const { type: typeStr, fieldName, isArray } = line;
    const defaultVal = defaultForType(typeStr, isArray);
    if (isArray) {
      result[fieldName] = [];
      i++;
      continue;
    }
    if (defaultVal !== undefined) {
      result[fieldName] = defaultVal;
      i++;
      continue;
    }
    let j = i + 1;
    while (j < lines.length && lines[j].indent > baseIndent) j++;
    if (j > i + 1) {
      const nestedBaseIndent = lines[i + 1].indent;
      const { obj: nested } = buildPlaceholderFromLines(lines, i + 1, nestedBaseIndent);
      result[fieldName] = nested;
      i = j;
    } else {
      result[fieldName] = {};
      i++;
    }
  }
  return { obj: result, nextIdx: i };
}

/**
 * Parse "ros2 interface show" style text and build a JSON placeholder (including nested fields).
 * For srv use part 'request'; for msg use 'full'.
 */
export function parseInterfaceTextToPlaceholder(
  interfaceText: string,
  part: 'full' | 'request' = 'full'
): Record<string, unknown> {
  if (!interfaceText?.trim()) return {};
  const lines = parseInterfaceLines(interfaceText, part);
  if (lines.length === 0) return {};
  const minIndent = Math.min(...lines.map((l) => l.indent));
  const { obj } = buildPlaceholderFromLines(lines, 0, minIndent);
  return obj;
}

/**
 * 메시지 타입 인터페이스(typedefs)로 JSON publish용 placeholder 객체 생성.
 * 필드 타입에 맞는 기본값을 채운 객체를 반환.
 */
export function buildMessagePlaceholder(
  details: MessageDetailsResponse | null,
  typedefIndex = 0
): Record<string, unknown> {
  const typedefs = details?.typedefs;
  const def = typedefs?.[typedefIndex];
  if (!def?.fieldnames?.length) return {};

  const typeByShort = new Map<string, number>();
  typedefs!.forEach((d, i) => {
    if (d.type) {
      typeByShort.set(shortTypeName(d.type), i);
      typeByShort.set(d.type, i);
      if (d.type.includes('/msg/')) typeByShort.set(d.type.replace('/msg/', '/'), i);
    }
  });

  const fieldnames = def.fieldnames ?? [];
  const fieldtypes = def.fieldtypes ?? [];
  const fieldarraylen = def.fieldarraylen ?? [];
  const result: Record<string, unknown> = {};

  for (let i = 0; i < fieldnames.length; i++) {
    const name = fieldnames[i];
    const fullType = (fieldtypes[i] ?? '').trim();
    const arrayLen = (fieldarraylen[i] ?? 0) as number;
    const shortName = shortTypeName(fullType);
    const isSequence = /^sequence\s*<.+>$/.test(fullType) || arrayLen < 0;

    if (arrayLen > 0 || isSequence) {
      result[name] = [];
      continue;
    }

    const builtin =
      ROS_BUILTIN_DEFAULTS[fullType] ??
      ROS_BUILTIN_DEFAULTS[shortName] ??
      ROS_BUILTIN_DEFAULTS[fullType.toLowerCase()] ??
      ROS_BUILTIN_DEFAULTS[shortName.toLowerCase()];
    if (builtin !== undefined) {
      result[name] = builtin;
      continue;
    }

    if (fullType === 'builtin_interfaces/Time' || fullType === 'builtin_interfaces/Duration' || shortName === 'Time' || shortName === 'Duration') {
      result[name] = { sec: 0, nanosec: 0 };
      continue;
    }

    const nestedIdx = typeByShort.get(fullType) ?? typeByShort.get(shortName);
    if (nestedIdx != null && nestedIdx !== typedefIndex) {
      result[name] = buildMessagePlaceholder({ typedefs: details!.typedefs }, nestedIdx);
    } else {
      result[name] = {};
    }
  }
  return result;
}

export function formatInterfaceLikeCli(
  typedefs: NonNullable<MessageDetailsResponse['typedefs']>,
  typedefIndex: number,
  indent: string,
  visiting: Set<number>
): string[] {
  const def = typedefs[typedefIndex];
  if (!def?.fieldnames?.length) return [];
  if (visiting.has(typedefIndex)) return [];

  const typeByShort = new Map<string, number>();
  typedefs.forEach((d, i) => {
    if (d.type) {
      typeByShort.set(shortTypeName(d.type), i);
      typeByShort.set(d.type, i);
      if (d.type.includes('/msg/')) typeByShort.set(d.type.replace('/msg/', '/'), i);
    }
  });

  const lines: string[] = [];
  const fieldnames = def.fieldnames ?? [];
  const fieldtypes = def.fieldtypes ?? [];
  const fieldarraylen = def.fieldarraylen ?? [];

  visiting.add(typedefIndex);
  for (let i = 0; i < fieldnames.length; i++) {
    const name = fieldnames[i];
    const fullType = fieldtypes[i] ?? '—';
    const arrayLen = (fieldarraylen[i] ?? 0) as number;
    const typeStr = arrayLen > 0 ? `${fullType}[${arrayLen}]` : fullType;
    const shortName = shortTypeName(fullType);

    const nestedIdx = typeByShort.get(fullType) ?? typeByShort.get(shortName);
    if (nestedIdx != null && nestedIdx !== typedefIndex && !visiting.has(nestedIdx)) {
      lines.push(`${indent}${shortName}  ${name}`);
      const nestedLines = formatInterfaceLikeCli(typedefs, nestedIdx, indent + '\t', visiting);
      lines.push(...nestedLines);
    } else {
      lines.push(`${indent}${typeStr} ${name}`);
    }
  }
  visiting.delete(typedefIndex);
  return lines;
}

// --- Format / display (InterfaceShowFormat, ServiceInterfaceFormat, ActionInterfaceFormat) ---

/** 메시지 타입 인터페이스 (ros2 interface show 형식) */
export function InterfaceShowFormat({ details }: { details: MessageDetailsResponse | null }) {
  const typedefs = details?.typedefs;
  if (!typedefs?.length || !typedefs[0]?.fieldnames?.length) return null;
  const lines = formatInterfaceLikeCli(typedefs, 0, '', new Set());
  return (
    <pre className="text-sm font-mono text-foreground whitespace-pre-wrap break-normal bg-muted/30 rounded p-2 overflow-x-auto">
      {lines.join('\n')}
    </pre>
  );
}

/** Service: request --- response (ros2 interface show <srv_type> 형식) */
export function ServiceInterfaceFormat({
  request,
  response,
}: {
  request: MessageDetailsResponse | null;
  response: MessageDetailsResponse | null;
}) {
  const reqTypedefs = request?.typedefs;
  const resTypedefs = response?.typedefs;
  const reqLines =
    reqTypedefs?.length && reqTypedefs[0]?.fieldnames?.length
      ? formatInterfaceLikeCli(reqTypedefs, 0, '', new Set())
      : [];
  const resLines =
    resTypedefs?.length && resTypedefs[0]?.fieldnames?.length
      ? formatInterfaceLikeCli(resTypedefs, 0, '', new Set())
      : [];
  const text = [...reqLines, '---', ...resLines].join('\n');
  if (!text) return null;
  return (
    <pre className="text-sm font-mono text-foreground whitespace-pre-wrap break-normal bg-muted/30 rounded p-2 overflow-x-auto">
      {text}
    </pre>
  );
}

/** Action: # Goal ... --- # Result ... --- # Feedback ... */
export function ActionInterfaceFormat({
  goal,
  result,
  feedback,
}: {
  goal: MessageDetailsResponse | null;
  result: MessageDetailsResponse | null;
  feedback: MessageDetailsResponse | null;
}) {
  const goalTypedefs = goal?.typedefs;
  const resultTypedefs = result?.typedefs;
  const feedbackTypedefs = feedback?.typedefs;
  const goalLines =
    goalTypedefs?.length && goalTypedefs[0]?.fieldnames?.length
      ? formatInterfaceLikeCli(goalTypedefs, 0, '', new Set())
      : [];
  const resultLines =
    resultTypedefs?.length && resultTypedefs[0]?.fieldnames?.length
      ? formatInterfaceLikeCli(resultTypedefs, 0, '', new Set())
      : [];
  const feedbackLines =
    feedbackTypedefs?.length && feedbackTypedefs[0]?.fieldnames?.length
      ? formatInterfaceLikeCli(feedbackTypedefs, 0, '', new Set())
      : [];
  const parts: string[] = [];
  if (goalLines.length) parts.push('# Goal', ...goalLines);
  parts.push('---');
  if (resultLines.length) parts.push('# Result', ...resultLines);
  parts.push('---');
  if (feedbackLines.length) parts.push('# Feedback', ...feedbackLines);
  const text = parts.join('\n');
  if (text === '---\n---') return null;
  return (
    <pre className="text-sm font-mono text-foreground whitespace-pre-wrap break-normal bg-muted/30 rounded p-2 overflow-x-auto">
      {text}
    </pre>
  );
}
