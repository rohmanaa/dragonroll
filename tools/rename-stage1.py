#!/usr/bin/env python3
"""Case-normalize the legacy icon directory and rewrite its path references."""

import argparse
import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "tools" / "rename-stage1-map.json"
TEXT_SUFFIXES = {".html", ".css", ".js", ".mjs", ".json", ".webmanifest", ".md", ".txt"}
SKIP_PREFIXES = ("old/", "referensi/", "supabase/")


def git(*args, capture=True):
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE if capture else None,
        text=capture,
    ).stdout if capture else None


def indexed_paths():
    return set(git("ls-files").splitlines())


def object_id(path):
    return git("rev-parse", "--verify", "HEAD:" + path).strip()


def load_map():
    return json.loads(MAP_PATH.read_text(encoding="utf-8"))


def validate_moves(data, indexed):
    mapping = {item["old"]: item["new"] for item in data["file_moves"]}
    if len(mapping) != len(data["file_moves"]):
        raise RuntimeError("Duplicate source path in stage 1 map.")
    if len(set(mapping.values())) != len(mapping):
        raise RuntimeError("Duplicate destination path in stage 1 map.")

    collisions = []
    pending = []
    sources = set(mapping)
    indexed_by_case = {}
    for path in indexed:
        indexed_by_case.setdefault(path.casefold(), []).append(path)
    for source, destination in mapping.items():
        if source in indexed:
            pending.append((source, destination))
            for existing in indexed_by_case.get(destination.casefold(), []):
                if existing in sources:
                    continue
                source_id = object_id(source)
                destination_id = object_id(existing)
                collisions.append((source, destination, source_id, destination_id))
        elif destination not in indexed:
            raise RuntimeError("Neither source nor idempotent destination exists: " + source)

    if collisions:
        details = "; ".join(
            "{} -> {} ({} vs {})".format(*item) for item in collisions
        )
        if any(source_id != destination_id for _, _, source_id, destination_id in collisions):
            raise RuntimeError("Different-content target collisions: " + details)
        raise RuntimeError("Identical duplicate target paths require deduplication: " + details)
    if pending and not all(item["old"].startswith(data["directory_move"]["source"] + "/")
                           for item in data["file_moves"]):
        raise RuntimeError("Directory move map does not match the listed files.")
    return pending


def tracked_text_files(indexed, exclusions):
    return [
        path for path in sorted(indexed)
        if Path(path).suffix.lower() in TEXT_SUFFIXES
        and not path.startswith(SKIP_PREFIXES)
        and path not in exclusions
    ]


def rewrite_references(data, dry_run):
    indexed = indexed_paths()
    exclusions = set(data["reference_exclusions"])
    replacements = sorted(
        ((item["old"].encode(), item["new"].encode())
         for item in data["path_replacements"]),
        key=lambda item: len(item[0]),
        reverse=True,
    )
    changed = []
    for relative in tracked_text_files(indexed, exclusions):
        path = ROOT / Path(relative)
        if not path.is_file():
            continue
        original = path.read_bytes()
        updated = original
        count = 0
        for old, new in replacements:
            occurrences = updated.count(old)
            if occurrences:
                updated = updated.replace(old, new)
                count += occurrences
        if updated != original:
            changed.append((relative, count))
            if not dry_run:
                path.write_bytes(updated)
    return changed


def move_directory(data, pending, dry_run):
    move = data["directory_move"]
    if not pending:
        print("Directory already normalized.")
        return
    if dry_run:
        print("MOVE {} -> {} -> {}".format(
            move["source"], move["temporary"], move["destination"]
        ))
        return

    try:
        git("mv", "--", move["source"], move["temporary"], capture=False)
        git("mv", "--", move["temporary"], move["destination"], capture=False)
    except subprocess.CalledProcessError:
        if (ROOT / move["temporary"]).exists():
            subprocess.run(
                ["git", "mv", "--", move["temporary"], move["source"]],
                cwd=ROOT,
                check=False,
            )
        raise


def verify_gameplay(data):
    baseline = data["baseline"]
    current = indexed_paths()
    baseline_paths = set(git(
        "ls-tree", "-r", "--name-only", baseline, "--", "gameplay.html", "gameplay/"
    ).splitlines())
    current_paths = {
        path for path in current
        if path == "gameplay.html" or path.startswith("gameplay/")
    }
    if baseline_paths != current_paths:
        missing = sorted(baseline_paths - current_paths)
        added = sorted(current_paths - baseline_paths)
        raise RuntimeError(
            "Gameplay path set differs; missing={}, added={}".format(missing, added)
        )

    replacement_stages = []
    for map_path in sorted((ROOT / "tools").glob("rename-stage*-map.json")):
        stage_map = json.loads(map_path.read_text(encoding="utf-8"))
        replacements = [
            (item["old"].encode(), item["new"].encode())
            for item in stage_map.get("path_replacements", [])
        ]
        replacement_stages.append(
            sorted(replacements, key=lambda item: len(item[0]), reverse=True)
        )

    differences = []
    for relative in sorted(current_paths):
        actual = (ROOT / Path(relative)).read_bytes().replace(b"\r\n", b"\n")
        expected = subprocess.run(
            ["git", "show", "{}:{}".format(baseline, relative)],
            cwd=ROOT,
            check=True,
            stdout=subprocess.PIPE,
        ).stdout.replace(b"\r\n", b"\n")
        path_only = expected
        for replacements in replacement_stages:
            for old, new in replacements:
                path_only = path_only.replace(old, new)
        if actual != path_only:
            differences.append(relative)
    if differences:
        raise RuntimeError(
            "Gameplay contains changes beyond mapped paths: " + ", ".join(differences)
        )
    print("Gameplay path-only comparison: reverse-map result is byte-identical to " + baseline)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verify-gameplay", action="store_true")
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()

    data = load_map()
    if args.verify_only:
        verify_gameplay(data)
        return 0

    indexed = indexed_paths()
    pending = validate_moves(data, indexed)
    print("Tracked source moves: {}; case-insensitive target collisions: 0".format(len(pending)))
    for source, destination in pending:
        print("FILE {} -> {}".format(source, destination))

    move_directory(data, pending, args.dry_run)
    changes = rewrite_references(data, args.dry_run)
    print("Path-bearing files to rewrite: {}; substitutions: {}".format(
        len(changes), sum(count for _, count in changes)
    ))
    for path, count in changes:
        print("{} ({})".format(path, count))
    if args.verify_gameplay and not args.dry_run:
        verify_gameplay(data)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print("ERROR: {}".format(error), file=sys.stderr)
        sys.exit(1)
