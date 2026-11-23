"""Fixed Lab entry point. Pattern and subject data enter exclusively as JSON."""
import json
import re
import sys
import time
import warnings

_RUNTIME_VERSION = ".".join(map(str, sys.version_info[:3]))
_FLAGS = dict(a=re.A, i=re.I, m=re.M, s=re.S, x=re.X)


def timer_resolution_ms():
    """Bound the probe and sample the clock used by the compile and run phases."""
    previous = time.perf_counter()
    ticks = []
    for _ in range(65_536):
        current = time.perf_counter()
        if current > previous:
            ticks.append(current - previous)
            previous = current
            if len(ticks) == 7:
                break
    return sorted(ticks)[len(ticks) // 2] * 1000 if len(ticks) >= 3 else None


class OutputLimit(Exception):
    pass


def _position(match, index, unit):
    start, end = match.span(index)
    return {"start": start, "end": end, "unit": unit}


def _value(text):
    return text.hex() if isinstance(text, bytes) else text


def _normalize(match, names, ordinal, unit):
    ident = f"match-{ordinal}"
    return {
        "matchId": ident,
        "ordinal": ordinal,
        "span": _position(match, 0, unit),
        "value": _value(match[0]),
        "captures": [
            {
                "captureId": f"{ident}-{index}",
                "index": index,
                **({"name": names[index]} if index in names else {}),
                **(
                    {"participation": "unmatched"}
                    if value is None
                    else {"participation": "participated", "value": _value(value), "span": _position(match, index, unit)}
                ),
            }
            for index, value in enumerate(match.groups(), 1)
        ],
    }


def _bounded_matches(pattern, subject, limit):
    for index, match in enumerate(pattern.finditer(subject), 1):
        if index > limit:
            raise OutputLimit
        yield match


def _execute(pattern, subject, operation, replacement, syntax, bounds, unit):
    maximum, max_output = bounds["matches"], bounds["output"]
    if pattern.groups > bounds["captures"]:
        raise OutputLimit
    if operation == "search":
        return {"status": "completed", "output": pattern.search(subject) is not None}
    if operation == "split":
        estimate = len(subject)
        for match in _bounded_matches(pattern, subject, maximum):
            estimate += sum(len(value or "") + 4 for value in match.groups()) + 4
            if estimate > max_output or estimate * 2 > max_output and not subject.isascii():
                raise OutputLimit
        return {"status": "completed", "output": list(map(_value, pattern.split(subject)))}
    if operation in ("replace", "replace-all"):
        literal = syntax == "literal"
        first = operation == "replace"
        estimate = len(subject)
        for match in _bounded_matches(pattern, subject, maximum):
            estimate += len(replacement if literal else match.expand(replacement))
            if estimate * 2 > max_output:
                raise OutputLimit
            if first:
                break
        return {"status": "completed", "output": _value(pattern.sub(
            (lambda _match: replacement) if literal else replacement,
            subject,
            count=1 if first else 0,
        ))}
    names = {index: name for name, index in pattern.groupindex.items()}
    if operation == "fullmatch":
        observed = [pattern.fullmatch(subject)]
    elif operation == "first":
        observed = [pattern.search(subject)]
    else:
        observed = _bounded_matches(pattern, subject, maximum)
    matches = []
    size = 0
    for match in observed:
        if match is not None:
            item = _normalize(match, names, len(matches) + 1, unit)
            size += len(json.dumps(item))
            if size > max_output:
                raise OutputLimit
            matches.append(item)
    return {"status": "matched" if matches else "no-match", "matches": matches}


def _run(request):
    start = time.perf_counter()
    options = request["options"]
    byte_mode = request["bytes"]
    unit = "utf8-bytes" if byte_mode else "unicode-code-points"
    pattern_text, subject, replacement = request["pattern"], request["input"], options["replacement"]
    if byte_mode:
        pattern_text, subject, replacement = (text.encode("utf-8") for text in (pattern_text, subject, replacement))
    try:
        flags = sum((_FLAGS[flag] for flag in options["flags"]), re.NOFLAG)
        with warnings.catch_warnings(record=True) as compile_warnings:
            warnings.simplefilter("always")
            pattern = re.compile(pattern_text, flags)
    except (re.error, OverflowError, RecursionError) as error:
        return {
            "status": "compile-rejection",
            "error": {"message": str(error), **(
                {"offset": error.pos, "offsetUnit": unit}
                if isinstance(error, re.error) and error.pos is not None else {}
            )},
            "compileMs": (time.perf_counter() - start) * 1000,
        }
    compiled = time.perf_counter()
    try:
        output = _execute(
            pattern, subject, options["operation"], replacement,
            options["replacementSyntax"], request["limits"], unit,
        )
        if len(json.dumps(output)) > request["limits"]["output"]:
            raise OutputLimit
    except OutputLimit:
        output = {"status": "resource-terminated", "error": {
            "termination": "output-limit", "message": "The operation exceeded the match, capture or output limit.",
        }}
    except (re.error, IndexError, OverflowError, RecursionError) as error:
        output = {"status": "runtime-error", "error": {"message": str(error)}}
    return {
        **output,
        "compileMs": (compiled - start) * 1000,
        "executionMs": (time.perf_counter() - compiled) * 1000,
        "engineNativeMetadata": {
            "warnings": [str(item.message) for item in compile_warnings],
            "valueEncoding": "hex" if byte_mode else "text",
            "inputEncoding": "utf-8" if byte_mode else "unicode",
        },
    }


def run_lab(payload):
    return json.dumps(_run(json.loads(payload)), ensure_ascii=True)


def _inspect(request):
    source = request["pattern"]
    byte_mode = request["bytes"]
    if byte_mode:
        source = source.encode("utf-8")
    flags = sum((_FLAGS[flag] for flag in request["flags"]), re.NOFLAG)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            compiled = re.compile(source, flags)
        except (re.error, OverflowError, RecursionError) as error:
            return {"status": "compile-rejection", "error": {
                "message": str(error),
                **({"offset": error.pos, "offsetUnit": "utf8-bytes" if byte_mode else "unicode-code-points"}
                   if isinstance(error, re.error) and error.pos is not None else {}),
            }}
        try:
            parsed = re._parser.parse(source, flags)
        except (AttributeError, TypeError, ValueError, OverflowError, RecursionError, re.error):
            return {"disposition": "unavailable"}

    names = {index: name for name, index in compiled.groupindex.items()}
    remaining = 510
    partial = False

    def group_label(index):
        nonlocal partial
        name = names.get(index)
        if name and len(name) > 192:
            name = name[:192] + "…"
            partial = True
        return f"Group {index}" + (f" · {name}" if name else "")

    def project(label, instructions, depth):
        nonlocal partial
        children = []
        for opcode, value in instructions:
            if remaining <= 0 or depth >= 24:
                partial = True
                break
            children.append(item(str(opcode), value, depth + 1))
        return {"label": label, "children": children}

    def item(opcode, value, depth):
        nonlocal remaining, partial
        remaining -= 1
        if opcode in ("LITERAL", "NOT_LITERAL"):
            label = "Exclude" if opcode == "NOT_LITERAL" else "Literal"
            return {"label": f"{label} · {ascii(chr(value))}", "children": []}
        if opcode == "SUBPATTERN":
            index, added, removed, body = value
            label = group_label(index) if index else "Scoped group"
            if added or removed:
                label += f" · add {re.RegexFlag(added)} · remove {re.RegexFlag(removed)}"
            return project(label, body, depth)
        if opcode == "ATOMIC_GROUP":
            return project("Atomic group", value, depth)
        if opcode == "IN":
            return project("Character set", value, depth)
        if opcode == "BRANCH":
            branches = []
            for index, body in enumerate(value[1], 1):
                if remaining <= 0 or depth >= 24:
                    partial = True
                    break
                remaining -= 1
                branches.append(project(f"Alternative {index}", body, depth + 1))
            return {"label": "Choice", "children": branches}
        repetitions = {"MAX_REPEAT": "Greedy", "MIN_REPEAT": "Lazy", "POSSESSIVE_REPEAT": "Possessive"}
        if opcode in repetitions:
            minimum, maximum, body = value
            return project(f"{repetitions[opcode]} repetition · {minimum} to {maximum}", body, depth)
        if opcode in ("ASSERT", "ASSERT_NOT"):
            direction, body = value
            return project(("Positive" if opcode == "ASSERT" else "Negative") +
                           (" lookahead" if direction > 0 else " lookbehind"), body, depth)
        if opcode == "GROUPREF_EXISTS":
            index, yes, no = value
            remaining -= 2
            branches = [project("Participated", yes, depth + 1)]
            if no is not None:
                branches.append(project("Did not participate", no, depth + 1))
            return {"label": "Conditional · " + group_label(index), "children": branches}
        if opcode == "GROUPREF":
            return {"label": "Backreference · " + group_label(value), "children": []}
        if opcode == "RANGE":
            return {"label": f"Range · {ascii(chr(value[0]))} to {ascii(chr(value[1]))}", "children": []}
        if opcode in ("AT", "CATEGORY", "NEGATE", "ANY"):
            labels = {"AT": f"Position · {value}", "CATEGORY": f"Category · {value}",
                      "NEGATE": "Negated set", "ANY": "Any character"}
            return {"label": labels[opcode], "children": []}
        partial = True
        return {"label": f"Uninterpreted CPython instruction · {opcode}", "children": []}

    tree = project("CPython re parser structure", parsed, 0)
    if partial:
        tree["children"].append({"label": "Some parser details are unavailable or exceeded the inspection limit", "children": []})
    return {"disposition": "partial" if partial else "parsed", "tree": tree}


def inspect_lab(payload):
    return json.dumps(_inspect(json.loads(payload)), ensure_ascii=True)
