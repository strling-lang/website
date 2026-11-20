"""Rebuild the Lab's pinned 8-bit interpreter with Zig and the upstream tarball."""

import argparse
import hashlib
from pathlib import Path
import re
import subprocess
import tarfile
from tempfile import TemporaryDirectory


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIGESTS = {
    "10.42": "a8e52a9bd1bca8f51c5c24823adc2a99acb12288e289a6507090c1a4a4815010",
    "10.43": "f0048e26b02bdfaf43b8cec75030a9c2fe28552bf5caa693d3ccbf4d886fa930",
    "10.49": "69d04dcddcf9e038aeae8f58b0c07ee5e08abb835ee8daa2bd6acee433dc112c",
}
DESTINATION = ROOT / "src/lib/regex-lab/wasm"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--version", choices=SOURCE_DIGESTS, default="10.49")
    parser.add_argument("--zig", default="zig")
    parser.add_argument("--work-dir", type=Path)
    args = parser.parse_args()
    if hashlib.sha256(args.archive.read_bytes()).hexdigest() != SOURCE_DIGESTS[args.version]:
        parser.error(f"archive must match the pinned PCRE2 {args.version} source digest")

    with TemporaryDirectory(dir=args.work_dir) as directory:
        with tarfile.open(args.archive, "r:gz") as archive:
            archive.extractall(directory, filter="data")
        source = Path(directory) / f"pcre2-pcre2-{args.version}"
        src = source / "src"
        (src / "pcre2.h").write_bytes((src / "pcre2.h.generic").read_bytes())
        (src / "pcre2_chartables.c").write_bytes((src / "pcre2_chartables.c.dist").read_bytes())
        config = (src / "config.h.generic").read_text()
        for macro in ("HAVE_INTTYPES_H", "HAVE_LIMITS_H", "HAVE_STDINT_H",
                      "HAVE_STDLIB_H", "HAVE_STRING_H", "SUPPORT_PCRE2_8", "SUPPORT_UNICODE"):
            config = config.replace(f"/* #undef {macro} */", f"#define {macro} 1")
        (src / "config.h").write_text(config)
        cmake = (source / "CMakeLists.txt").read_text()
        sources = re.search(r"\bPCRE2_SOURCES\s*\n(.*?)\n\)", cmake, re.S)[1]
        files = sorted(src / name for name in re.findall(r"(pcre2_[\w]+\.c)", sources))
        DESTINATION.mkdir(exist_ok=True)
        subprocess.run([
            args.zig, "cc", "-target", "wasm32-wasi", "-mexec-model=reactor",
            "-O2", "-DNDEBUG", "-DHAVE_CONFIG_H", "-DPCRE2_CODE_UNIT_WIDTH=8",
            "-I", str(src), "-Wl,--strip-all", "-Wl,--max-memory=33554432",
            "-Wl,-z,stack-size=1048576",
            *map(str, files), str(ROOT / "scripts/lab-pcre2.c"),
            "-o", str(DESTINATION / f"pcre2-{args.version}.wasm"),
        ], check=True)
        notice = next(source / name for name in ("LICENCE.md", "LICENCE") if (source / name).is_file())
        (DESTINATION / f"PCRE2-{args.version}-LICENCE.txt").write_bytes(notice.read_bytes())


if __name__ == "__main__":
    main()
