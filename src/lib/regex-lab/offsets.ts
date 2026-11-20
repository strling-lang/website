export interface TextRange {
  start: number;
  end: number;
}

export function coordinateMap(text: string, unit: string): Map<number, number> {
  const map = new Map([[0, 0]]);
  const encoder = new TextEncoder();
  let native = 0;
  let utf16 = 0;
  for (const character of text) {
    utf16 += character.length;
    native += unit === 'utf8-bytes' ? encoder.encode(character).length : 1;
    map.set(native, utf16);
  }
  return map;
}

export function editorRange(
  span: TextRange & { unit: string },
  textLength: number,
  map?: ReadonlyMap<number, number>,
): TextRange | undefined {
  const start =
    span.unit === 'utf16-code-units' ? span.start : map?.get(span.start);
  const end = span.unit === 'utf16-code-units' ? span.end : map?.get(span.end);
  if (
    start === undefined ||
    end === undefined ||
    start < 0 ||
    end < start ||
    end > textLength
  )
    return;
  return { start, end };
}
