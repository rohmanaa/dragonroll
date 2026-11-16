#!/usr/bin/env python3
"""Rename assets/data paths for stage two and update resolved references."""

import argparse
import json
import posixpath
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "tools" / "rename-stage2-map.json"
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


def map_path(path, data):
    exact = data["exact_moves"].get(path)
    if exact:
        return exact

    updated = path
    for source, destination in sorted(
        data["directory_moves"].items(), key=lambda item: len(item[0]), reverse=True
    ):
        if updated.startswith(source):
            updated = destination + updated[len(source):]
            break

    if updated.startswith("assets/images/ui/"):
        parts = updated.split("/")
        for index in range(3, len(parts) - 1):
            parts[index] = data["directory_names"].get(parts[index], parts[index])
        updated = "/".join(parts)
    return updated


def map_index(indexed, data):
    return {
        path: map_path(path, data)
        for path in indexed
        if path.startswith(("assets/", "data/"))
        and not path.startswith(SKIP_PREFIXES)
    }


def make_plan(indexed, data):
    path_map = map_index(indexed, data)
    moving = {source for source, destination in path_map.items() if source != destination}
    groups = defaultdict(list)
    for source, destination in path_map.items():
        if source != destination:
            groups[destination.casefold()].append((source, destination))

    by_case = defaultdict(list)
    for path in indexed:
        by_case[path.casefold()].append(path)

    moves = []
    dedupes = []
    errors = []
    for entries in sorted(groups.values(), key=lambda items: items[0][1].casefold()):
        targets = {destination for _, destination in entries}
        if len(targets) != 1:
            errors.append("Different destination casing in one group: " + ", ".join(sorted(targets)))
            continue
        destination = next(iter(targets))
        existing = [
            path for path in by_case[destination.casefold()]
            if path not in moving and path not in {source for source, _ in entries}
        ]
        if len(existing) > 1:
            errors.append("Multiple existing case-insensitive targets for " + destination)
            continue

        entry_ids = {index_object_id(source) for source, _ in entries}
        if len(entry_ids) > 1:
            errors.append(
                "Different-content sources collide at {}: {}".format(
                    destination, ", ".join(source for source, _ in entries)
                )
            )
            continue
        if existing:
            target_id = index_object_id(existing[0])
            if target_id not in entry_ids:
                errors.append(
                    "Different-content target collision: {} -> {} ({})".format(
                        ", ".join(source for source, _ in entries), existing[0], destination
                    )
                )
                continue
            dedupes.extend((source, existing[0]) for source, _ in entries)
            continue

        keeper = sorted(entries)[0]
        moves.append(keeper)
        dedupes.extend((source, destination) for source, _ in entries if source != keeper[0])

    if errors:
        raise RuntimeError("Unresolved destination collisions:\n  " + "\n  ".join(errors))

    destinations = {destination.casefold() for _, destination in moves}
    for _, destination in moves:
        if (ROOT / Path(destination)).exists() and destination.casefold() not in {
            source.casefold() for source, _ in moves
        }:
            if destination.casefold() not in {path.casefold() for path in indexed}:
                raise RuntimeError("Untracked filesystem target already exists: " + destination)
    if len(destinations) != len(moves):
        raise RuntimeError("Unresolved case-insensitive destination collision.")
    return path_map, moves, dedupes


def is_excluded(path, exclusions):
    return (
        path.startswith(SKIP_PREFIXES)
        or path in exclusions
        or Path(path).suffix.lower() not in TEXT_SUFFIXES
    )


def build_replacements(path_map, data):
    pairs = {}
    for source, destination in path_map.items():
        if source != destination:
            pairs[source.encode("utf-8")] = destination.encode("utf-8")

    for source, destination in data["directory_moves"].items():
        pairs[source.encode("utf-8")] = destination.encode("utf-8")

    for item in data["path_replacements"]:
        if item.get("files"):
            continue
        old, new = item["old"].encode("utf-8"), item["new"].encode("utf-8")
        previous = pairs.get(old)
        if previous is not None and previous != new:
            raise RuntimeError("Conflicting path replacement for " + item["old"])
        pairs[old] = new

    return sorted(
        ((old, new) for old, new in pairs.items()),
        key=lambda item: len(item[0]),
        reverse=True,
    )


def rewrite_relative_imports(content, source, destination, data):
    def mapped_relative_path(match):
        old_value = match.group("path").decode("utf-8")
        suffix_at = min(
            (index for index in (old_value.find("?"), old_value.find("#")) if index >= 0),
            default=len(old_value),
        )
        relative_path, suffix = old_value[:suffix_at], old_value[suffix_at:]
        target = posixpath.normpath(posixpath.join(posixpath.dirname(source), relative_path))
        mapped_target = map_path(target, data)
        if mapped_target == target:
            return None
        updated = posixpath.relpath(mapped_target, posixpath.dirname(destination) or ".")
        if relative_path.startswith("./") and not updated.startswith("../"):
            updated = "./" + updated
        return (updated + suffix).encode("utf-8")

    def replace_string(match):
        updated = mapped_relative_path(match)
        if updated is None:
            return match.group(0)
        quote = match.group("quote")
        return quote + updated + quote

    def replace_url(match):
        updated = mapped_relative_path(match)
        if updated is None:
            return match.group(0)
        quote = match.group("quote")
        return b"url(" + quote + updated + quote + b")"

    content = RELATIVE_STRING.sub(replace_string, content)
    return RELATIVE_URL.sub(replace_url, content)


def tracked_text_files(indexed, exclusions):
    return [
        path for path in sorted(indexed)
        if not is_excluded(path, exclusions)
    ]


def rewrite_references(indexed, path_map, data, dry_run):
    rules = [
        (
            item["old"].encode("utf-8"),
            item["new"].encode("utf-8"),
            set(item.get("files", [])),
        )
        for item in data["path_replacements"]
    ]
    rules.extend((old, new, set()) for old, new in build_replacements(path_map, data))
    rules.sort(key=lambda item: len(item[0]), reverse=True)
    exclusions = set(data["reference_exclusions"])
    changed = []
    for relative in tracked_text_files(indexed, exclusions):
        path = ROOT / Path(relative)
        if not path.is_file():
            continue
        original = path.read_bytes()
        updated = original
        substitutions = 0
        for old, new, scoped_files in rules:
            if scoped_files and relative not in scoped_files:
                continue
            if old == b"../new sound/" and relative not in scoped_files:
                continue
            count = updated.count(old)
            if count:
                updated = updated.replace(old, new)
                substitutions += count
        destination = path_map.get(relative, relative)
        updated = rewrite_relative_imports(updated, relative, destination, data)
        if updated != original:
            changed.append((relative, destination, substitutions))
            if not dry_run:
                path.write_bytes(updated)
    return changed


def unique_temporary(source, counter):
    parent = posixpath.dirname(source)
    while True:
        candidate = posixpath.join(parent, ".rename-stage2-{}.tmp".format(counter))
        if not (ROOT / Path(candidate)).exists() and candidate not in indexed_paths():
            return candidate
        counter += 1


def perform_moves(moves, dedupes, dry_run):
    if dry_run:
        return
    for counter, (source, destination) in enumerate(sorted(moves), 1):
        destination_path = ROOT / Path(destination)
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        if source.casefold() == destination.casefold():
            temporary = unique_temporary(source, counter)
            git("mv", "--", source, temporary, capture=False)
            git("mv", "--", temporary, destination, capture=False)
        else:
            git("mv", "--", source, destination, capture=False)
    for source, _ in dedupes:
        if source in indexed_paths():
            git("rm", "--", source, capture=False)


def stage_rewrites(changed, path_map, dry_run):
    if dry_run:
        return
    for source, destination, _ in changed:
        staged_path = destination if destination != source else source
        git("add", "--", staged_path, capture=False)


def write_skipped_notes(data, dry_run):
    lines = [
        "Path yang tidak dipindah pada tahap 2 dan alasannya:",
        "",
    ]
    lines.extend(
        "- {} — {}".format(item["path"], item["reason"])
        for item in data["preserved_paths"]
    )
    lines.extend([
        "",
        "Penggabungan string gameplay yang terinventarisasi:",
        "- Prefix audio dan ikon HUD diperbarui pada literal serta fragmen string yang ditemukan.",
        "- Tidak ada path hasil penggabungan string yang ditunda.",
        "",
        "Path audio yang sengaja opsional dan belum tersedia (fallback audio tetap berlaku):",
    ])
    lines.extend("- {} — opsional.".format(path) for path in data["optional_missing_paths"])
    lines.extend([
        "",
        "Catatan DB:",
        "- Tidak ada akses ke DB eksternal; path tersimpan di DB tidak dapat diubah dari repo.",
    ])
    target = ROOT / "rename-skipped.txt"
    if not dry_run:
        target.write_text("\n".join(lines) + "\n", encoding="utf-8")


def bump_service_worker(data, dry_run):
    path = ROOT / "sw.js"
    content = path.read_bytes()
    version = data["sw_version"].encode("ascii")
    match = re.search(rb"""const VERSION = ['"]([^'"]+)['"];""", content)
    if not match:
        raise RuntimeError("Unable to find VERSION constant in sw.js")
    old = match.group(1)
    if old == version:
        return False
    if version <= old:
        raise RuntimeError("Service worker VERSION must increase.")
    updated = content[:match.start(1)] + version + content[match.end(1):]
    if not dry_run:
        path.write_bytes(updated)
        git("add", "--", "sw.js", capture=False)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verify-gameplay", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    data = load_map()
    indexed = indexed_paths()
    path_map, moves, dedupes = make_plan(indexed, data)
    print(
        "File renames: {}; identical duplicates to remove: {}; unresolved target collisions: 0".format(
            len(moves), len(dedupes)
        )
    )
    if args.verbose:
        for source, destination in sorted(moves):
            print("MOVE {} -> {}".format(source, destination))
        for source, destination in dedupes:
            print("DEDUPLICATE {} (identical to {})".format(source, destination))

    changed = rewrite_references(indexed, path_map, data, args.dry_run)
    print("Path-bearing files to rewrite: {}; substitutions: {}".format(
        len(changed), sum(item[2] for item in changed)
    ))
    if args.verbose:
        for source, _, count in changed:
            print("REWRITE {} ({})".format(source, count))

    bump = bump_service_worker(data, args.dry_run)
    print("Service worker VERSION {}.".format("will increase" if bump else "already current"))
    perform_moves(moves, dedupes, args.dry_run)
    stage_rewrites(changed, path_map, args.dry_run)
    write_skipped_notes(data, args.dry_run)
    if not args.dry_run:
        git("add", "--", "rename-skipped.txt", capture=False)

    if args.verify_gameplay and not args.dry_run:
        subprocess.run(
            [sys.executable, "tools/rename-stage1.py", "--verify-only"],
            cwd=ROOT,
            check=True,
        )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print("ERROR: {}".format(error), file=sys.stderr)
        sys.exit(1)
