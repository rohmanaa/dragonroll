#!/usr/bin/env python3
"""Move item-owned data into data/inventory and rewrite active path references."""

import argparse
import json
import posixpath
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "tools" / "rename-stage2a-map.json"
TEXT_SUFFIXES = {".html", ".css", ".js", ".mjs", ".json", ".webmanifest", ".md", ".txt"}
RELATIVE_STRING = re.compile(rb"""(?P<quote>['"])(?P<path>(?:\.\.?/)[^'"\r\n]+)(?P=quote)""")
RELATIVE_URL = re.compile(
    rb"""url\(\s*(?P<quote>['"]?)(?P<path>(?:\.\.?/)[^'"\s)]+)(?P=quote)\s*\)""",
    re.IGNORECASE,
)
GAMEPLAY_PATH = re.compile(r"""(?<![A-Za-z0-9_.-])(?:\.\.?/)*data/[A-Za-z0-9_./*?-]+""")


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


def is_frozen_manifest(path):
    parts = path.split("/")
    return (
        len(parts) >= 5
        and parts[:2] == ["data", "inventory"]
        and parts[-1] == "manifest.js"
    )


def map_path(path, data):
    exact = data["exact_moves"].get(path)
    if exact:
        return exact
    for source, destination in sorted(
        data["directory_moves"].items(), key=lambda item: len(item[0]), reverse=True
    ):
        if path.startswith(source):
            return destination + path[len(source):]
    return path


def require_pet_guards(indexed, data):
    for guard in data["pet_move_guards"]:
        paths = [path for path in indexed if path == guard or path.startswith(guard)]
        for path in paths:
            content = (ROOT / Path(path)).read_bytes()
            if b"data/pet/items/" in content:
                raise RuntimeError(
                    "Pet items are referenced by protected source {}; keep data/pet/items/** in place.".format(path)
                )


def resolved_gameplay_references(indexed, candidates):
    referenced = set()
    files = [
        path for path in indexed
        if path == "gameplay.html" or path.startswith("gameplay/")
    ]
    for path in files:
        file_path = ROOT / Path(path)
        if not file_path.is_file():
            continue
        text = file_path.read_text(encoding="utf-8", errors="replace")
        for match in GAMEPLAY_PATH.finditer(text):
            value = match.group(0).rstrip(".,;:)")
            if value.startswith("data/"):
                resolved = posixpath.normpath(value)
            else:
                resolved = posixpath.normpath(
                    posixpath.join(posixpath.dirname(path), value)
                )
            for candidate in candidates:
                if (
                    resolved == candidate
                    or resolved.startswith(candidate + "/")
                    or candidate.startswith(resolved.rstrip("/") + "/")
                ):
                    referenced.add(candidate)
    return referenced


def make_plan(indexed, data):
    path_map = {
        path: map_path(path, data)
        for path in indexed
        if map_path(path, data) != path
    }
    candidates = set(path_map)
    gameplay_refs = resolved_gameplay_references(indexed, candidates)
    moves = [
        (source, destination)
        for source, destination in path_map.items()
        if source not in gameplay_refs and not is_frozen_manifest(source)
    ]
    moving = {source for source, _ in moves}
    destinations = [destination.casefold() for _, destination in moves]
    if len(destinations) != len(set(destinations)):
        raise RuntimeError("Move map contains case-insensitive destination collisions.")

    for source, destination in moves:
        if (ROOT / Path(destination)).exists() and destination not in indexed:
            raise RuntimeError("Untracked destination collision: " + destination)
        if destination in indexed and destination not in moving:
            raise RuntimeError("Tracked destination collision: " + destination)
    return path_map, moves, gameplay_refs


def rewrite_relative_paths(content, source, destination, path_map):
    def replace(match):
        old_value = match.group("path").decode("utf-8")
        suffix_at = min(
            (index for index in (old_value.find("?"), old_value.find("#")) if index >= 0),
            default=len(old_value),
        )
        relative_path, suffix = old_value[:suffix_at], old_value[suffix_at:]
        target = posixpath.normpath(
            posixpath.join(posixpath.dirname(source), relative_path)
        )
        mapped_target = path_map.get(target, target)
        if mapped_target == target:
            return match.group(0)
        updated = posixpath.relpath(
            mapped_target, posixpath.dirname(destination) or "."
        )
        if relative_path.startswith("./") and not updated.startswith("../"):
            updated = "./" + updated
        start, end = match.span("path")
        return (
            match.group(0)[:start - match.start()]
            + (updated + suffix).encode("utf-8")
            + match.group(0)[end - match.start():]
        )

    content = RELATIVE_URL.sub(replace, content)
    return RELATIVE_STRING.sub(replace, content)


def replacements(path_map, data):
    pairs = {
        source.encode("utf-8"): destination.encode("utf-8")
        for source, destination in path_map.items()
    }
    for source, destination in data["directory_moves"].items():
        pairs[source.encode("utf-8")] = destination.encode("utf-8")
    return sorted(pairs.items(), key=lambda item: len(item[0]), reverse=True)


def plan_rewrites(indexed, path_map, data):
    pairs = replacements(path_map, data)
    excluded = set(data["reference_exclusions"])
    changed = []
    for source in sorted(indexed):
        if (
            source in excluded
            or source == "gameplay.html"
            or source.startswith("gameplay/")
            or is_frozen_manifest(source)
            or Path(source).suffix.lower() not in TEXT_SUFFIXES
        ):
            continue
        file_path = ROOT / Path(source)
        if not file_path.is_file():
            continue
        original = file_path.read_bytes()
        updated = original
        substitutions = 0
        for old, new in pairs:
            count = updated.count(old)
            if count:
                updated = updated.replace(old, new)
                substitutions += count
        destination = path_map.get(source, source)
        updated = rewrite_relative_paths(updated, source, destination, path_map)
        if updated != original:
            changed.append((source, destination, updated, substitutions))
    return changed


def perform_moves(moves, dry_run):
    if dry_run:
        return
    for source, destination in sorted(moves):
        target = ROOT / Path(destination)
        target.parent.mkdir(parents=True, exist_ok=True)
        git("mv", "--", source, destination, capture=False)


def apply_rewrites(changed, dry_run):
    if dry_run:
        return
    for source, destination, updated, _ in changed:
        target = ROOT / Path(destination)
        target.write_bytes(updated)
        git("add", "--", destination, capture=False)


def remove_empty_data_directories(dry_run):
    if dry_run:
        return
    data_root = ROOT / "data"
    directories = sorted(
        (path for path in data_root.rglob("*") if path.is_dir()),
        key=lambda path: len(path.parts),
        reverse=True,
    )
    for directory in directories:
        try:
            directory.rmdir()
        except OSError:
            pass


def write_skipped_notes(data, gameplay_refs, dry_run):
    lines = [
        "Path yang sengaja tidak dipindah pada tahap 2A:",
        "",
    ]
    lines.extend(
        "- {} — {}".format(item["path"], item["reason"])
        for item in data["preserved_paths"]
    )
    lines.extend([
        "",
        "Pemeriksaan prasyarat pemindahan data/pet/items/**:",
        "- Tidak ditemukan rujukan di supabase/, tools/wallet/gen-item-seed.js, atau tests/fixtures/item-catalog-baseline.json; item Pet dipindah ke data/inventory/pet/items/.",
        "",
        "Rujukan gameplay yang menjaga file di lokasi asal:",
    ])
    lines.extend("- {} — tidak dipindah.".format(path) for path in sorted(gameplay_refs))
    if not gameplay_refs:
        lines.append("- Tidak ada rujukan ke file yang dipindah.")
    if not dry_run:
        (ROOT / "rename-skipped.txt").write_text(
            "\n".join(lines) + "\n", encoding="utf-8"
        )
        git("add", "--", "rename-skipped.txt", capture=False)


def bump_service_worker(data, dry_run):
    path = ROOT / "sw.js"
    content = path.read_bytes()
    match = re.search(rb"""const VERSION = ['"]([^'"]+)['"];""", content)
    if not match:
        raise RuntimeError("Unable to find VERSION constant in sw.js")
    current, wanted = match.group(1), data["sw_version"].encode("ascii")
    if current == wanted:
        return False
    if wanted <= current:
        raise RuntimeError("Service worker VERSION must increase.")
    if not dry_run:
        path.write_bytes(content[:match.start(1)] + wanted + content[match.end(1):])
        git("add", "--", "sw.js", capture=False)
    return True


def verify(indexed, path_map, data):
    missing = []
    for source, destination in path_map.items():
        if source in indexed:
            missing.append("old source remains: " + source)
        if not (ROOT / Path(destination)).is_file():
            missing.append("destination missing: " + destination)

    excluded = set(data["reference_exclusions"])
    stale = []
    old_prefixes = list(data["directory_moves"]) + list(data["exact_moves"])
    for path in sorted(indexed):
        if (
            path in excluded
            or path == "gameplay.html"
            or path.startswith("gameplay/")
            or is_frozen_manifest(path)
            or Path(path).suffix.lower() not in TEXT_SUFFIXES
        ):
            continue
        file_path = ROOT / Path(path)
        if not file_path.is_file():
            continue
        content = file_path.read_bytes()
        for old in old_prefixes:
            needle = old.encode("utf-8")
            if needle in content:
                stale.append("{}: {}".format(path, old))
    if missing or stale:
        raise RuntimeError(
            "Reference verification failed:\n  " + "\n  ".join(missing + stale)
        )
    return len(path_map)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    data = load_map()
    indexed = indexed_paths()
    if args.verify_only:
        count = verify(indexed, {}, data)
        print("Path verification passed: 0 broken references.")
        return 0

    require_pet_guards(indexed, data)
    path_map, moves, gameplay_refs = make_plan(indexed, data)
    moved_sources = {source for source, _ in moves}
    rewrite_map = {source: path_map[source] for source in moved_sources}
    changed = plan_rewrites(indexed, rewrite_map, data)
    print(
        "File renames: {}; path-bearing files to rewrite: {}; substitutions: {}; gameplay-protected files: {}".format(
            len(moves), len(changed), sum(item[3] for item in changed), len(gameplay_refs)
        )
    )
    if args.verbose:
        for source, destination in sorted(moves):
            print("MOVE {} -> {}".format(source, destination))
        for source, _, _, count in changed:
            print("REWRITE {} ({})".format(source, count))

    bump = bump_service_worker(data, args.dry_run)
    print("Service worker VERSION {}.".format("will increase" if bump else "already current"))
    perform_moves(moves, args.dry_run)
    apply_rewrites(changed, args.dry_run)
    remove_empty_data_directories(args.dry_run)
    write_skipped_notes(data, gameplay_refs, args.dry_run)
    if args.dry_run:
        return 0

    # Re-read staged paths after git mv/add so verification checks the final tree.
    final_index = indexed_paths()
    print("Path verification passed: {} moved files; 0 broken references.".format(
        verify(final_index, rewrite_map, data)
    ))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print("ERROR: {}".format(error), file=sys.stderr)
        sys.exit(1)
