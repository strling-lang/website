import type { RunOptions, Runtime } from './interactive.ts';

export function runtimeExample(
  runtime: Runtime,
  pattern: string,
  run: RunOptions,
) {
  if (runtime.startsWith('python'))
    return pythonExample(pattern, run, runtime === 'python311bytes');
  // JSON object syntax is valid for the ECMAScript string literals emitted here.
  const encoded = JSON.stringify(pattern);
  if (runtime !== 'javascript') return;
  const flags = [...run.flags]
    .filter((flag) => flag !== 'd' && flag !== 'g')
    .join('');
  const full = run.operation === 'fullmatch';
  const actualFlags = full
    ? flags.replace('y', '') + 'dy'
    : flags +
      'd' +
      (run.operation === 'scan' || run.operation === 'replace-all' ? 'g' : '');
  const lines = [
    'const source = ' + encoded + ';',
    full
      ? 'const expression = new RegExp("(?:" + new RegExp(source, ' +
        JSON.stringify(run.flags) +
        ').source + ")(?![\\\\s\\\\S])", ' +
        JSON.stringify(actualFlags) +
        ');'
      : 'const expression = new RegExp(source, ' +
        JSON.stringify(actualFlags) +
        ');',
    'const subject = "Your input here";',
  ];
  switch (run.operation) {
    case 'search':
      lines.push('console.log(expression.test(subject));');
      break;
    case 'scan':
      lines.push('console.log([...subject.matchAll(expression)]);');
      break;
    case 'split':
      lines.push('console.log(subject.split(expression));');
      break;
    case 'replace':
    case 'replace-all':
      lines.push(
        'const replacement = ' + JSON.stringify(run.replacement) + ';',
      );
      lines.push(
        run.replacementSyntax === 'literal'
          ? 'console.log(subject.replace(expression, () => replacement));'
          : 'console.log(subject.replace(expression, replacement));',
      );
      break;
    default:
      lines.push('console.log(expression.exec(subject));');
  }
  return lines.join('\n');
}

function pythonExample(pattern: string, run: RunOptions, bytesMode: boolean) {
  const flagNames: Record<string, string> = {
    a: 're.ASCII',
    i: 're.IGNORECASE',
    m: 're.MULTILINE',
    s: 're.DOTALL',
    x: 're.VERBOSE',
  };
  if ([...run.flags].some((flag) => !Object.hasOwn(flagNames, flag))) return;
  const encode = (value: string) => {
    const bytes = new TextEncoder().encode(value);
    const data = btoa(
      Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''),
    );
    return (
      'b64decode(' +
      JSON.stringify(data) +
      ')' +
      (bytesMode ? '' : '.decode("utf-8")')
    );
  };
  const flags =
    [...run.flags].map((flag) => flagNames[flag]).join(' | ') || '0';
  const lines = [
    'from base64 import b64decode',
    'import re',
    '',
    'source = ' + encode(pattern),
    'expression = re.compile(source, ' + flags + ')',
    'subject = "Your input here"' + (bytesMode ? '.encode("utf-8")' : ''),
  ];
  switch (run.operation) {
    case 'search':
      lines.push('print(expression.search(subject) is not None)');
      break;
    case 'fullmatch':
      lines.push('print(expression.fullmatch(subject))');
      break;
    case 'first':
      lines.push('print(expression.search(subject))');
      break;
    case 'scan':
      lines.push(
        'print([(m.span(), m.group(), m.groups(), m.groupdict()) for m in expression.finditer(subject)])',
      );
      break;
    case 'split':
      lines.push('print(expression.split(subject))');
      break;
    case 'replace':
    case 'replace-all':
      lines.push('replacement = ' + encode(run.replacement));
      lines.push(
        'print(expression.sub(' +
          (run.replacementSyntax === 'literal'
            ? 'lambda _: replacement'
            : 'replacement') +
          ', subject, count=' +
          (run.operation === 'replace' ? 1 : 0) +
          '))',
      );
      break;
  }
  return lines.join('\n');
}
