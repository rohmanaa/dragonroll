#!/usr/bin/env python3
"""Move reusable UI components and update their path references."""

import argparse
import json
import posixpath
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "tools" / "rename-stage3-map.json"
SKIP_PREFIXES = ("old/", "referensi/", "supabase/")
TEXT_SUFFIXES = {".html", ".css", ".js", ".mjs", ".json", ".webmanifest", ".md", ".txt"}
RELATIVE_STRING = re.compile(rb"""(?P<quote>['"])(?P<path>(?:\.\.?/)[^'"\r\n]+)(?P=quote)""")
RELATIVE_URL = re.compile(
    rb"""url\(\s*(?P<quote>['"]?)(?P<path>(?:\.\.?/)[^'"\s)]+)(?P=quote)\s*\)""",
    re.IGNORECASE,
)


def git(*args, capture=True):
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE if capture else None,
        text=capture,
    )
    return result.stdout if capture else None


def load_map():
    return json.loads(MAP_PATH.read_text(encoding="utf-8"))


def indexed_paths():
    return set(git("ls-files").splitlines())


def index_object_id(path):
    output = git("ls-files", "-s", "--", path).strip()
    if not output:
        raise RuntimeError("Path is not present in the Git index: " + path)
    return output.split()[1]


def make_plan(indexed, data):
    moves = data["moves"]
    destinations = [destination.casefold() for destination in moves.values()]
    if len(destinations) != len(set(destinations)):
        raise RuntimeError("Move map contains case-insensitive destination collisions.")

    pending = []
    sources = set(moves)
    for source, destination in moves.items():
        if source in indexed:
            if any(
                path.casefold() == destination.casefold() and path not in sources
                for path in indexed
            ):
                raise RuntimeError("Tracked destination collision: " + destination)
            if (ROOT / Path(destination)).exists() and destination not in indexed:
                raise RuntimeError("Untracked destination collision: " + destination)
            pending.append((source, destination))
        elif destination not in indexed:
            raise RuntimeError("Neither source nor idempotent destination exists: " + source)

    for path in data.get("remove_paths", []):
        if path not in indexed and (ROOT / Path(path)).exists():
            raise RuntimeError("Untracked removal-path collision: " + path)
    return pending


def map_target(path, moves):
    return moves.get(path, path)


def rewrite_relative_paths(content, source, destination, moves):
    if source == destination:
        return content

    def replace(match):
        old_value = match.group("path").decode("utf-8")
        suffix_at = min(
            (index for index in (old_value.find("?"), old_value.find("#")) if index >= 0),
            default=len(old_value),
        )
        relative_path, suffix = old_value[:suffix_at], old_value[suffix_at:]
        target = posixpath.normpath(posixpath.join(posixpath.dirname(source), relative_path))
        mapped_target = map_target(target, moves)
        updated = posixpath.relpath(mapped_target, posixpath.dirname(destination) or ".")
        if relative_path.startswith("./") and not updated.startswith("../"):
            updated = "./" + updated
        start, end = match.span("path")
        return match.group(0)[:start - match.start()] + (updated + suffix).encode("utf-8") + match.group(0)[end - match.start():]

    content = RELATIVE_URL.sub(replace, content)
    return RELATIVE_STRING.sub(replace, content)


def is_excluded(path):
    return (
        path.startswith(SKIP_PREFIXES)
        or path in set(load_map().get("reference_exclusions", []))
        or Path(path).suffix.lower() not in TEXT_SUFFIXES
    )


def transform_content(content, source, destination, data, replacements):
    substitutions = 0
    for old, new, scoped_files in replacements:
        if scoped_files and source not in scoped_files:
            continue
        count = content.count(old)
        if count:
            content = content.replace(old, new)
            substitutions += count
    content = rewrite_relative_paths(content, source, destination, data["moves"])
    return content, substitutions


def stage_index_content(source, destination, data, replacements):
    indexed_content = subprocess.check_output(
        ["git", "show", ":" + source], cwd=ROOT
    )
    updated, _ = transform_content(
        indexed_content, source, destination, data, replacements
    )
    if updated == indexed_content:
        return
    mode = git("ls-files", "-s", "--", source).split()[0]
    blob = subprocess.run(
        ["git", "hash-object", "-w", "--stdin"],
        cwd=ROOT,
        input=updated,
        stdout=subprocess.PIPE,
        check=True,
    ).stdout.decode("ascii").strip()
    git("update-index", "--cacheinfo", "{},{},{}".format(mode, blob, source), capture=False)


def rewrite_references(indexed, data, dry_run):
    replacements = sorted(
        (
            (item["old"].encode("utf-8"), item["new"].encode("utf-8"), set(item.get("files", [])))
            for item in data["path_replacements"]
        ),
        key=lambda item: len(item[0]),
        reverse=True,
    )
    changed = []
    for source in sorted(indexed):
        if is_excluded(source):
            continue
        path = ROOT / Path(source)
        if not path.is_file():
            continue
        original = path.read_bytes()
        destination = map_target(source, data["moves"])
        updated, substitutions = transform_content(
            original, source, destination, data, replacements
        )
        if updated != original:
            changed.append((source, substitutions))
            if not dry_run:
                path.write_bytes(updated)
        if not dry_run:
            stage_index_content(source, destination, data, replacements)
    return changed


def perform_moves(moves, data, dry_run):
    if dry_run:
        return
    for source, destination in sorted(moves):
        target = ROOT / Path(destination)
        target.parent.mkdir(parents=True, exist_ok=True)
        git("mv", "--", source, destination, capture=False)
    indexed = indexed_paths()
    for path in data.get("remove_paths", []):
        if path in indexed:
            git("rm", "--", path, capture=False)
    for directory in ("hud/components", "hud/theme", "hud"):
        try:
            (ROOT / Path(directory)).rmdir()
        except OSError:
            pass


def bump_service_worker(data, dry_run):
    path = ROOT / "sw.js"
    content = path.read_bytes()
    match = re.search(rb"""const VERSION = ['"]([^'"]+)['"];""", content)
    if not match:
        raise RuntimeError("Unable to find VERSION constant in sw.js")
    old, wanted = match.group(1), data["sw_version"].encode("ascii")
    if old == wanted:
        return False
    if wanted <= old:
        raise RuntimeError("Service worker VERSION must increase.")
    if not dry_run:
        path.write_bytes(content[:match.start(1)] + wanted + content[match.end(1):])
        git("add", "--", "sw.js", capture=False)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    data = load_map()
    indexed = indexed_paths()
    moves = make_plan(indexed, data)
    print("File renames: {}; destination collisions: 0".format(len(moves)))
    if args.verbose:
        for source, destination in moves:
            print("MOVE {} -> {}".format(source, destination))

    changed = rewrite_references(indexed, data, args.dry_run)
    print("Path-bearing files to rewrite: {}; substitutions: {}".format(
        len(changed), sum(count for _, count in changed)
    ))
    if args.verbose:
        for source, count in changed:
            print("REWRITE {} ({})".format(source, count))

    bump = bump_service_worker(data, args.dry_run)
    print("Service worker VERSION {}.".format("will increase" if bump else "already current"))
    perform_moves(moves, data, args.dry_run)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print("ERROR: {}".format(error), file=sys.stderr)
        sys.exit(1)
