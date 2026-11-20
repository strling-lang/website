import {
  identifiesExecution,
  type LabExecutionRequest,
  type LabExecutionResult,
} from './contracts.ts';
import { isPcreRuntime, runtimes, type Runtime } from './interactive.ts';
import { coordinateMap, editorRange } from './offsets.ts';
import { browserProviderIdentity } from './result-validation.ts';
import type { StructureNode } from './structure.ts';

export interface PatternInspection {
  schema: 'strling-lab-pattern-inspection-v1';
  requestId: string;
  profileReleaseId: string;
  version: string;
  authority: 'pcre2-callout-enumeration' | 'cpython-re-parser';
  disposition: 'parsed' | 'partial' | 'unavailable' | 'rejected';
  tree?: StructureNode;
  diagnostics?: LabExecutionResult;
}

export type NativeStructure = Pick<PatternInspection, 'disposition' | 'tree'>;

export function inspection(
  request: LabExecutionRequest,
  runtime: Runtime,
  version: string,
  body: NativeStructure,
  diagnostics?: LabExecutionResult,
): PatternInspection {
  return {
    schema: 'strling-lab-pattern-inspection-v1',
    requestId: request.requestId,
    profileReleaseId: request.runtime.profileReleaseId,
    authority: isPcreRuntime(runtime)
      ? 'pcre2-callout-enumeration'
      : 'cpython-re-parser',
    version,
    ...body,
    diagnostics,
  };
}

export function verifyInspection(
  value: unknown,
  request: LabExecutionRequest,
  runtime: Runtime,
): value is PatternInspection {
  if (!value || typeof value !== 'object') return false;
  const result = value as PatternInspection;
  const isPcre = isPcreRuntime(runtime);
  const version = isPcre
    ? { pcre2: '10.49', pcre243: '10.43', pcre242: '10.42' }[runtime]
    : undefined;
  if (
    result.schema !== 'strling-lab-pattern-inspection-v1' ||
    result.requestId !== request.requestId ||
    result.profileReleaseId !== request.runtime.profileReleaseId ||
    result.authority !==
      (isPcre ? 'pcre2-callout-enumeration' : 'cpython-re-parser') ||
    typeof result.version !== 'string' ||
    (version
      ? result.version.split(' ')[0] !== version
      : !(runtime === 'python' ? /^3\.14\.\d+$/ : /^3\.11\.\d+$/).test(
          result.version,
        ))
  )
    return false;
  const unit = runtimes[runtime].unit;
  const map = coordinateMap(request.pattern, unit);
  const validLocation = (start: number, end: number) =>
    Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    editorRange({ start, end, unit }, request.pattern.length, map) !==
      undefined;
  if (result.disposition === 'rejected') {
    const diagnostics = result.diagnostics;
    if (
      result.tree ||
      !diagnostics ||
      !('error' in diagnostics) ||
      !identifiesExecution(diagnostics, request, browserProviderIdentity) ||
      typeof diagnostics.error?.message !== 'string'
    )
      return false;
    const { offset, offsetUnit } = diagnostics.error;
    const nativeLength =
      unit === 'utf8-bytes'
        ? new TextEncoder().encode(request.pattern).length
        : Array.from(request.pattern).length;
    return (
      offset === undefined ||
      (offsetUnit === unit &&
        Number.isSafeInteger(offset) &&
        offset >= 0 &&
        offset <= nativeLength)
    );
  }
  if (result.diagnostics) return false;
  if (result.disposition === 'unavailable') return !result.tree;
  if (result.disposition !== 'parsed' && result.disposition !== 'partial')
    return false;
  let remaining = 768;
  function valid(node: StructureNode | undefined, depth: number): boolean {
    if (
      !node ||
      --remaining < 0 ||
      depth > 50 ||
      typeof node.label !== 'string' ||
      node.label.length > 512 ||
      !Array.isArray(node.children)
    )
      return false;
    if (
      node.range &&
      (node.range.unit !== unit ||
        !validLocation(node.range.start, node.range.end))
    )
      return false;
    return node.children.every((child) => valid(child, depth + 1));
  }
  return valid(result.tree, 0);
}
