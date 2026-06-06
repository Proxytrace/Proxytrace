import type { MessageDto, TestSuiteMessageDto, ToolArgumentDto, ToolRequestInputDto, ToolSpecDto } from '../../../api/models';

/**
 * Edited expected output. `toolRequests === null` means plain-text mode; a (possibly
 * empty) array means tool-request mode. The two modes are mutually exclusive.
 */
export interface ExpectedOutput {
  content: string;
  toolRequests: ToolRequestInputDto[] | null;
}

/** Derives editor state from a captured trace response (null response → empty text). */
export function expectedFromResponse(response: MessageDto | null): ExpectedOutput {
  const toolRequests = response?.toolRequests ?? [];
  return toolRequests.length > 0
    ? { content: '', toolRequests: toolRequests.map(t => ({ name: t.name, arguments: t.arguments })) }
    : { content: response?.content ?? '', toolRequests: null };
}

/** Derives editor state from a stored expected-output DTO. */
export function expectedFromDto(dto: TestSuiteMessageDto): ExpectedOutput {
  return dto.toolRequests?.length
    ? { content: '', toolRequests: dto.toolRequests.map(t => ({ ...t })) }
    : { content: dto.content, toolRequests: null };
}

/** A placeholder value for a tool argument, inferred from its declared type. */
function skeletonValue(arg: ToolArgumentDto): unknown {
  if (arg.enumValues?.length) return arg.enumValues[0];
  const t = arg.type.toLowerCase();
  if (t.includes('bool')) return false;
  if (/(int|number|float|double|long|decimal)/.test(t)) return 0;
  if (t.includes('array') || t.endsWith('[]')) return [];
  if (t.includes('object')) return {};
  return '';
}

/** Builds a pretty-printed JSON argument skeleton from a tool's declared parameters. */
export function argsSkeleton(tool: ToolSpecDto): string {
  const obj: Record<string, unknown> = {};
  for (const arg of tool.arguments) obj[arg.name] = skeletonValue(arg);
  return JSON.stringify(obj, null, 2);
}

/** Whether an args string is the empty default and may be safely overwritten on tool pick. */
export function isArgsEmpty(args: string): boolean {
  const t = args.trim();
  return t.length === 0 || t === '{}' || t.replace(/\s/g, '') === '{}';
}

/** True when a tool-argument string is non-empty and parses as JSON. */
export function argsValid(args: string): boolean {
  if (!args.trim()) return false;
  try {
    JSON.parse(args);
    return true;
  } catch {
    return false;
  }
}

/** True when the expected output is complete enough to save. */
export function validateExpected(v: ExpectedOutput): boolean {
  if (v.toolRequests === null) return v.content.trim().length > 0;
  return v.toolRequests.length > 0 && v.toolRequests.every(r => r.name.trim().length > 0 && argsValid(r.arguments));
}

/** Converts editor state into the wire DTO sent to the API. */
export function toMessage(v: ExpectedOutput): TestSuiteMessageDto {
  return {
    role: 'assistant',
    content: v.toolRequests === null ? v.content : '',
    toolRequests: v.toolRequests,
  };
}
