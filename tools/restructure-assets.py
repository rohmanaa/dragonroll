#!/usr/bin/env python3
"""Move assets from mapping.json and rewrite only affected path references."""

import argparse
import json
import os
import posixpath
import re
import subprocess
import sys
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAP_FILE = ROOT / "mapping.json"
FROZEN_FILE = ROOT / "frozen.txt"
TEXT_SUFFIXES = {".html", ".css", ".js", ".mjs", ".json", ".md", ".webmanifest"}
SKIP_PREFIXES = ("supabase/", "referensi/", "old/")
SKIP_DIRS = {".git", "node_modules"}
TOKEN_RE = re.compile(r"""(?P<quote>['"`])(?P<value>[^'"`\r\n]*)(?P=quote)""")
URL_RE = re.compile(r"""url\(\s*(?P<quote>['"]?)(?P<value>[^'"\s)]+)(?P=quote)\s*\)""", re.I)
HTML_PATH_RE = re.compile(r"""(?:src|href|poster)\s*=\s*(?P<quote>['"])(?P<value>[^'"]+)(?P=quote)""", re.I)
IMPORT_PATH_RE = re.compile(
    r"""\bimport\s*(?:\(\s*)?(?P<quote>['"])(?P<value>[^'"]+)(?P=quote)|(?<![\w$.])from\s+(?P<quote2>['"])(?P<value2>[^'"]+)(?P=quote2)|\brequire\s*\(\s*(?P<quote3>['"])(?P<value3>[^'"]+)(?P=quote3)""",
    re.M,
)
IMPORT_RE = re.compile(
    r"""\bimport\s*(?:\(\s*)?['"]([^'"]+)['"]|(?<![\w$.])from\s+['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]""",
    re.M,
)
PATH_SUFFIXES = {".html", ".css", ".js", ".mjs", ".json", ".webmanifest", ".webp", ".png", ".jpg", ".jpeg", ".svg", ".mp3", ".ogg", ".woff", ".woff2", ".ttf", ".glb", ".gltf"}


def relpath(value):
    return value.replace("\\", "/")


def load_mapping():
    with MAP_FILE.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_git_mv(source, destination):
    target_path = ROOT / Path(destination)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    if source.lower() == destination.lower() and source != destination:
        temporary = source + ".__restructure_case_" + uuid.uuid4().hex[:8]
        subprocess.run(["git", "mv", "--", source, temporary], cwd=ROOT, check=True)
        subprocess.run(["git", "mv", "--", temporary, destination], cwd=ROOT, check=True)
    else:
        subprocess.run(["git", "mv", "--", source, destination], cwd=ROOT, check=True)


def list_repo_files():
    found = []
    for current, dirs, files in os.walk(ROOT):
        relative_dir = Path(current).relative_to(ROOT).as_posix()
        dirs[:] = [
            directory
            for directory in dirs
            if directory not in SKIP_DIRS
            and not (relative_dir == "." and directory in {"referensi", "old", "supabase"})
        ]
        for filename in files:
            path = Path(current) / filename
            found.append(path.relative_to(ROOT).as_posix())
    return found


def allowed_referrer(path):
    path = relpath(path)
    if path == "gameplay.html" or path.startswith("gameplay/"):
        return False
    if path in {"mapping.json", "frozen.txt", "tools/restructure-assets.py"} or path.startswith("tests/"):
        return False
    if path.startswith(SKIP_PREFIXES):
        return False
    return Path(path).suffix.lower() in TEXT_SUFFIXES


def resolve_source(token, origin):
    token = token.replace("\\", "/")
    if not token or "${" in token or token.startswith(("http:", "https:", "data:", "javascript:", "#")):
        return None, "", ""
    match = re.match(r"^([^?#]*)([?#].*)?$", token)
    value = match.group(1)
    suffix = match.group(2) or ""
    if not value:
        return None, "", suffix
    if value.startswith("/"):
        candidate = posixpath.normpath(value.lstrip("/"))
        style = "root_abs"
    elif value.startswith(("assets/", "data/", "gameplay/")):
        candidate = posixpath.normpath(value)
        style = "root"
    else:
        candidate = posixpath.normpath(posixpath.join(posixpath.dirname(origin), value))
        style = "relative"
    if candidate == "." or candidate.startswith("../"):
        return None, style, suffix
    return candidate, style, suffix


def destination_token(destination, style, post_referrer, original):
    if style == "root_abs":
        return "/" + destination
    if style == "root":
        return destination
    relative = posixpath.relpath(destination, posixpath.dirname(post_referrer) or ".")
    if original.startswith("./") and not relative.startswith("."):
        relative = "./" + relative
    return relative


def reference_rewriter(text, origin, post_referrer, mapping):
    candidates = []

    def collect(pattern, value_group, quote_group=None):
        for match in pattern.finditer(text):
            value = match.group(value_group)
            if not value:
                continue
            start, end = match.span(value_group)
            candidates.append((start, end, value, "relative"))

    collect(URL_RE, "value")
    collect(HTML_PATH_RE, "value")
    for match in IMPORT_PATH_RE.finditer(text):
        for group in ("value", "value2", "value3"):
            token = match.group(group)
            if token:
                candidates.append((match.start(group), match.end(group), token, "relative"))
                break

    for match in TOKEN_RE.finditer(text):
        value = match.group("value")
        if (
            Path(origin).suffix.lower() in {".js", ".mjs"}
            and Path(re.split(r"[?#]", value, maxsplit=1)[0]).suffix.lower() == ".html"
        ):
            continue
        if not value or not (
            Path(re.split(r"[?#]", value, maxsplit=1)[0]).suffix.lower() in PATH_SUFFIXES
            or value.startswith(("./", "../", "/assets/", "/data/", "assets/", "data/", "gameplay/"))
        ):
            continue
        candidates.append((match.start("value"), match.end("value"), value, "relative"))

    for source in sorted(mapping, key=len, reverse=True):
        pattern = re.compile(
            r"(?<![A-Za-z0-9._/-])(?P<value>/?" + re.escape(source) + r")(?=$|[?#\s'\"<>),;])"
        )
        for match in pattern.finditer(text):
            value = match.group("value")
            candidates.append((match.start("value"), match.end("value"), value, "root"))

    candidates.sort(key=lambda item: (item[0], -(item[1] - item[0])))
    replacements = []
    occupied_until = -1
    for start, end, token, _ in candidates:
        if start < occupied_until:
            continue
        source, style, suffix = resolve_source(token, origin)
        if source is None:
            continue
        destination = mapping.get(source, source)
        if destination == source and style != "relative":
            continue
        if destination == source and origin == post_referrer:
            continue
        replacement = destination_token(destination, style, post_referrer, token) + suffix
        if replacement != token:
            replacements.append((start, end, replacement))
            occupied_until = end

    for start, end, replacement in reversed(replacements):
        text = text[:start] + replacement + text[end:]
    return text, len(replacements)


def dynamic_gameplay_paths():
    paths = set()
    main_path = ROOT / "gameplay/js/main.js"
    main = main_path.read_text(encoding="utf-8")
    hud_base = re.search(r"""const\s+GAME_HUD_ASSETS\s*=\s*['"]([^'"]+)['"]""", main)
    if hud_base:
        base = hud_base.group(1)
        table = re.search(r"const\s+GAME_HUD_POWER_ART\s*=\s*\{(.*?)\n\};", main, re.S)
        if table:
            for group, name in re.findall(r"""\w+\s*:\s*\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]""", table.group(1)):
                paths.add(posixpath.normpath(base + group + "/" + name + ".webp"))
        for match in re.finditer(r"gameHudImage\(\s*'([^']+)'\s*,\s*([^)]*)\)", main):
            for name in re.findall(r"'([^']+)'", match.group(2)):
                paths.add(posixpath.normpath(base + match.group(1) + "/" + name + ".webp"))
        for group, name in re.findall(r"""addBuff\(\s*'([^']+)'\s*,\s*'([^']+)'""", main):
            paths.add(posixpath.normpath(base + group + "/" + name + ".webp"))

    audio_path = ROOT / "gameplay/js/audio.js"
    audio = audio_path.read_text(encoding="utf-8")
    sfx_dir = re.search(r"""const\s+SFX_DIR\s*=\s*'([^']+)'""", audio)
    ns = re.search(r"""NS\s*=\s*'([^']+)'""", audio)
    if sfx_dir:
        root = sfx_dir.group(1)
        table = re.search(r"const\s+FILE\s*=\s*\{(.*?)\n\s*\};", audio, re.S)
        if table:
            for use_ns, value in re.findall(
                r"""(?:\w+)\s*:\s*(?:(NS)\s*\+\s*)?'([^']+)'""", table.group(1)
            ):
                suffix = (ns.group(1) if ns and use_ns else "") + value
                paths.add(posixpath.normpath(root + suffix))
        awakening = re.search(r"""FILE_AWAKENING\s*=\s*NS\s*\+\s*'([^']+)'""", audio)
        if awakening and ns:
            paths.add(posixpath.normpath(root + ns.group(1) + awakening.group(1)))
    return paths


def refresh_mapping(data):
    mapping = data["mapping"]
    inventory = {item["file"]: item for item in data["inventory"]}
    frozen = {item["file"]: item for item in data["frozen_gameplay"]}
    added = []
    for source in sorted(dynamic_gameplay_paths()):
        if source not in inventory or source not in mapping:
            continue
        record = {
            "file": source,
            "reason": "referenced_by_gameplay_dynamic_path",
            "referenced_by": ["gameplay/js/main.js" if "/komponen/" in source else "gameplay/js/audio.js"],
        }
        frozen[source] = record
        added.append(source)
        inventory[source]["status"] = "frozen_gameplay"
        inventory[source]["proposed_target"] = source
        inventory[source]["phase"] = None
        inventory[source]["hold_reason"] = "gameplay dynamic path"
        mapping.pop(source, None)
        data["phase_by_source"].pop(source, None)

    data["frozen_gameplay"] = sorted(frozen.values(), key=lambda item: item["file"])

    held_prefixes = (
        ("data/inventory/dice/", "dice category held until gameplay"),
        ("data/inventory/frame/", "frame category held until gameplay"),
        ("assets/js/renderers/dice-kit/", "dice kit held until gameplay"),
        ("assets/js/renderers/power3d/", "power3d kit held until gameplay"),
    )
    for source, record in inventory.items():
        for prefix, reason in held_prefixes:
            if source.startswith(prefix) and source in mapping:
                frozen[source] = {
                    "file": source,
                    "reason": reason,
                    "referenced_by": record.get("used_by", []),
                }
                record["status"] = "frozen_category"
                record["proposed_target"] = source
                record["phase"] = None
                record["hold_reason"] = reason
                mapping.pop(source, None)
                data["phase_by_source"].pop(source, None)
                break

    data["frozen_gameplay"] = sorted(frozen.values(), key=lambda item: item["file"])

    # Keep button artwork in its requested functional folder.
    for source, destination in list(mapping.items()):
        if source.startswith("assets/ng/komponen/tombol-dan-kontrol/"):
            target = "assets/images/tombol/" + posixpath.basename(destination)
            mapping[source] = target
            inventory[source]["proposed_target"] = target

    data.setdefault("version_base", 197)
    data["path_prefixes"] = [
        {
            "old": "data/inventory/pet/",
            "new": "data/inventory/pet/items/",
            "referrer": "data/inventory/pet/_shared/js/pet-page.js",
            "phase": 3,
            "reason": "IMAGE_ROOT used for pet item card images",
        },
        {
            "old": "assets/sfx/",
            "new": "assets/audio/sfx/",
            "referrer": "assets/js/core/app.js",
            "phase": 1,
            "reason": "Shared audio base; the gameplay-only defeat sound uses a relative exception.",
        },
    ]
    data["dynamic_rewrites"] = [
        {
            "referrer": "assets/js/core/app.js",
            "old": "kalah: 'ui/game-lose.mp3'",
            "new": "kalah: '../../sfx/ui/game-lose.mp3'",
            "phase": 1,
            "reason": "Retain the frozen gameplay audio file after moving the shared SFX base.",
        },
        {
            "referrer": "assets/js/pages/room.js",
            "old": "assets/ng/komponen/tombol-dan-kontrol/",
            "new": "assets/images/tombol/",
            "phase": 1,
            "reason": "Room button images are assembled dynamically.",
        },
        {
            "referrer": "assets/js/pages/room.js",
            "old": "assets/images/tombol/tombol-biru-polos.webp",
            "new": "assets/images/tombol/../../ng/komponen/tombol-dan-kontrol/tombol-biru-polos.webp",
            "phase": 1,
            "reason": "The blue invite button remains frozen with Gameplay.",
        },
        {
            "referrer": "assets/js/pages/room.js",
            "old": "'tombol-hijau-polos'",
            "new": "'../../ng/komponen/tombol-dan-kontrol/tombol-hijau-polos'",
            "phase": 1,
            "reason": "The green invite button remains frozen with Gameplay.",
        },
    ] + [
        {
            "referrer": "assets/js/pages/{}.js".format(page),
            "old": "../../../assets/js/pages/",
            "new": "",
            "phase": 2,
            "reason": "Navigation page URLs resolve from the document, not the moved script.",
        }
        for page in ("lobby", "frame", "powerup")
    ] + [
        {
            "referrer": "assets/js/pages/pet-page.js",
            "old": "const ITEM_ROOT = 'assets/ng/komponen/';",
            "new": "const ITEM_ROOT = 'assets/images/ui/';",
            "phase": 3,
            "reason": "The Pet currency icon uses a dynamic shared-image prefix.",
        },
        {
            "referrer": "assets/js/pages/pet-page.js",
            "old": "'hud/ikon-koin-emas.webp'",
            "new": "'../../ng/komponen/hud/ikon-koin-emas.webp'",
            "phase": 3,
            "reason": "Gameplay freezes the coin icon in its existing source directory.",
        },
    ] + [
        {
            "referrer": "assets/js/pages/{}.js".format(page),
            "old": "assets/ng/komponen/",
            "new": "assets/images/ui/",
            "phase": 1,
            "reason": "Page artwork paths are assembled from a shared dynamic UI-image prefix.",
        }
        for page in ("hadiah-misi", "inventory", "leaderboard", "mail", "profile", "settings", "shop-page")
    ] + [
        {
            "referrer": "data/inventory/{}/index.js".format(domain),
            "old": "req('../inventory/pet",
            "new": "req('./items/",
            "phase": 3,
            "reason": "The category index imports manifests from its new items/ directory.",
        }
        for domain in ("pet",)
    ]

    by_target = {}
    for destination in mapping.values():
        parent = posixpath.dirname(destination)
        by_target[parent] = by_target.get(parent, 0) + 1
    data["target_counts"] = dict(sorted(by_target.items()))
    counts = {}
    for source in mapping:
        phase = str(data["phase_by_source"][source])
        counts[phase] = counts.get(phase, 0) + 1
    data["phase_counts"] = dict(sorted(counts.items()))
    data["validation"]["mapping_count"] = len(mapping)
    data["validation"]["gameplay_reference_count"] = sum(
        1 for item in data["frozen_gameplay"] if item["reason"].startswith("referenced_by_gameplay")
    )
    data["validation"]["frozen_category_count"] = sum(
        1 for item in data["frozen_gameplay"] if item["reason"].endswith("held until gameplay")
    )
    data["validation"]["two_sources_one_target"] = len(mapping.values()) - len(set(mapping.values()))
    return added


def write_frozen(data):
    gameplay_items = [item for item in data["frozen_gameplay"] if item["reason"].startswith("referenced_by_gameplay")]
    held_items = [item for item in data["frozen_gameplay"] if item not in gameplay_items]
    lines = [
        "Frozen inventory (gameplay.html and gameplay/** are never edited or moved)",
        "Gameplay-referenced paths: {}".format(len(gameplay_items)),
        "",
    ]
    for item in gameplay_items:
        refs = ", ".join(item.get("referenced_by", []))
        lines.append("{}\t[{}]\t{}".format(item["file"], item["reason"], refs))
    lines.extend(["", "Held categories/kits: {}".format(len(held_items))])
    for item in held_items:
        refs = ", ".join(item.get("referenced_by", []))
        lines.append("{}\t[{}]\t{}".format(item["file"], item["reason"], refs))
    lines.extend(["", "DB/seed-deferred paths: {}".format(len(data["db_deferred"]))])
    for item in data["db_deferred"]:
        lines.append("{}\t[{}]".format(item["file"], ", ".join(item.get("referenced_by", []))))
    lines.extend(["", "Known pre-existing broken references (leave unchanged):"])
    for item in data["validation"].get("known_broken_unmodified", []):
        lines.append("{}\t{}".format(item["referrer"], item["literal"]))
    lines.extend(["", "Typo cleanup, separate phase:"])
    for name in data["validation"].get("deferred_filename_cleanup", {}).get("filenames", []):
        lines.append(name)
    FROZEN_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def apply_mapping_rules(data, current_path, origin_path, text, phase):
    changed = 0
    for rule in data.get("path_prefixes", []):
        if int(rule.get("phase", 1)) == phase and relpath(rule.get("referrer", "")) == origin_path:
            old = rule["old"]
            count = text.count(old)
            text = text.replace(old, rule["new"])
            changed += count
    for rule in data.get("dynamic_rewrites", []):
        if int(rule.get("phase", 1)) == phase and relpath(rule.get("referrer", "")) == origin_path:
            count = text.count(rule["old"])
            text = text.replace(rule["old"], rule["new"])
            changed += count
    return text, changed


def file_origins(mapping):
    reverse = {destination: source for source, destination in mapping.items()}
    return reverse


def phase_number(value):
    match = re.search(r"(\d+)$", str(value))
    return int(match.group(1)) if match else 0


def phase_moves(data, phase):
    return {
        source: destination
        for source, destination in data["mapping"].items()
        if phase_number(data["phase_by_source"].get(source, 0)) == phase
    }


def indexed_paths():
    output = subprocess.run(
        ["git", "ls-files"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        text=True,
    ).stdout
    return set(output.splitlines())


def indexed_path_map():
    return {path.lower(): path for path in indexed_paths()}


def preflight_moves(moves, indexed):
    sources = set(moves)
    targets = list(moves.values())
    if len(targets) != len(set(targets)):
        raise RuntimeError("Two sources have the same target.")
    for source, destination in moves.items():
        if source not in indexed and destination not in indexed:
            raise RuntimeError("Neither source nor idempotent target exists: {}".format(source))
        if (
            source in indexed
            and destination in indexed
            and destination not in sources
            and source.lower() != destination.lower()
        ):
            raise RuntimeError("Target already exists outside this phase: {}".format(destination))


def rewrite_files(data, dry_run, phase, moved_sources=()):
    mapping = {
        source: destination
        for source, destination in data["mapping"].items()
        if phase_number(data["phase_by_source"].get(source, 0)) <= phase
    }
    reverse = file_origins(mapping)
    moved_destinations = {mapping[source] for source in moved_sources}
    indexed_by_case = indexed_path_map()
    changes = []
    for physical_path in list_repo_files():
        current = indexed_by_case.get(physical_path.lower(), physical_path)
        if not allowed_referrer(current):
            continue
        path = ROOT / Path(physical_path)
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if current in moved_sources:
            origin = current
            post_referrer = mapping.get(current, current)
        elif current in moved_destinations and current in reverse:
            origin = reverse[current]
            post_referrer = current
        else:
            origin = current
            post_referrer = current
        updated, count = reference_rewriter(text, origin, post_referrer, mapping)
        rule_origin = reverse.get(current, origin)
        updated, dynamic_count = apply_mapping_rules(data, current, rule_origin, updated, phase)
        count += dynamic_count
        if updated != text:
            changes.append((current, updated, count))
            if not dry_run:
                path.write_text(updated, encoding="utf-8", newline="")
    return changes


def bump_version(data, phase, dry_run):
    sw = ROOT / "sw.js"
    text = sw.read_text(encoding="utf-8")
    match = re.search(r"ut-pwa-v(\d+)", text)
    if not match:
        raise RuntimeError("Could not find the service-worker VERSION.")
    current = int(match.group(1))
    wanted = int(data.get("version_base", current)) + phase
    if current >= wanted:
        return "unchanged (v{})".format(current)
    updated = text[: match.start(1)] + str(wanted) + text[match.end(1) :]
    if not dry_run:
        sw.write_text(updated, encoding="utf-8", newline="")
    return "v{} -> v{}".format(current, wanted)


def ref_tokens(path, text):
    suffix = Path(path).suffix.lower()
    if suffix in {".html", ".css"}:
        for match in URL_RE.finditer(text):
            yield match.group("value"), match.start("value"), "relative"
        if suffix == ".html":
            for match in re.finditer(r"""(?:src|href|poster)\s*=\s*(['"])([^'"]+)\1""", text, re.I):
                yield match.group(2), match.start(2), "root"
        for match in re.finditer(r"""@import\s+(?:url\(\s*)?(['"])([^'"]+)\1""", text, re.I):
            yield match.group(2), match.start(2), "relative"
    elif suffix in {".js", ".mjs"}:
        for match in IMPORT_RE.finditer(text):
            for group in range(1, 4):
                if match.group(group) and (
                    match.group(group).startswith(("./", "../", "assets/", "data/", "gameplay/"))
                    or match.group(group).startswith(("/assets/", "/data/", "/gameplay/"))
                ):
                    yield match.group(group), match.start(group), "import"
                    break
        for match in TOKEN_RE.finditer(text):
            value = match.group("value")
            if value.startswith(("assets/", "data/", "gameplay/", "/assets/", "/data/", "/gameplay/")):
                yield value, match.start("value"), "root"


def check_references(data):
    known = {
        (item["referrer"], item["literal"])
        for item in data["validation"].get("known_broken_unmodified", [])
    }
    broken = []
    indexed_by_case = indexed_path_map()
    for physical_path in list_repo_files():
        current = indexed_by_case.get(physical_path.lower(), physical_path)
        if Path(current).suffix.lower() not in {".html", ".css", ".js", ".mjs"}:
            continue
        if current.startswith(("tests/", "tools/", "assets/js/vendor/")):
            continue
        path = ROOT / Path(physical_path)
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for value, _, kind in ref_tokens(current, text):
            path_part = re.split(r"[?#]", value, maxsplit=1)[0]
            if (
                "${" in value
                or "..." in value
                or "<" in value
                or ">" in value
                or value.endswith("/")
                or Path(path_part).suffix.lower() not in PATH_SUFFIXES
                or value.startswith(("http:", "https:", "data:", "javascript:", "#"))
            ):
                continue
            if (current, value) in known:
                continue
            candidate, style, _ = resolve_source(value, current)
            if not candidate:
                continue
            disk_path = ROOT / Path(candidate)
            if not disk_path.exists():
                broken.append((current, value, candidate))
    return broken


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", type=int, choices=(1, 2, 3))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--refresh-mapping", action="store_true")
    parser.add_argument("--check-refs", action="store_true")
    args = parser.parse_args()
    if not (args.phase or args.refresh_mapping or args.check_refs):
        parser.error("Use --phase, --refresh-mapping, or --check-refs.")

    data = load_mapping()
    added = refresh_mapping(data)
    targets = list(data["mapping"].values())
    collisions = len(targets) - len({target.lower() for target in targets})
    if collisions:
        raise RuntimeError("Mapping contains {} target collisions.".format(collisions))

    if args.check_refs:
        broken = check_references(data)
        for current, value, candidate in broken:
            print("BROKEN {}: {} -> {}".format(current, value, candidate))
        print("Broken references: {}".format(len(broken)))
        return 1 if broken else 0

    if args.refresh_mapping:
        write_json(MAP_FILE, data)
        write_frozen(data)
        print("Mapping refreshed; dynamically frozen gameplay paths added: {}".format(len(added)))
        print("Moves: {}; duplicate targets: 0".format(len(data["mapping"])))
        return 0

    phase = args.phase
    moves = phase_moves(data, phase)
    indexed = indexed_paths()
    preflight_moves(moves, indexed)
    print("Phase {}: {} mapped files; dynamic gameplay freezes added: {}".format(phase, len(moves), len(added)))
    for source, destination in sorted(moves.items()):
        if source in indexed:
            print("MOVE {} -> {}".format(source, destination))
        elif destination in indexed:
            print("DONE {} -> {}".format(source, destination))
    if args.dry_run:
        pending_sources = [source for source in moves if source in indexed]
        changes = rewrite_files(data, True, phase, pending_sources)
        print("Path-bearing files to rewrite: {}; substitutions: {}".format(len(changes), sum(item[2] for item in changes)))
        print("Service-worker VERSION: {}".format(bump_version(data, phase, True)))
        return 0

    moved_count = 0
    for source, destination in sorted(moves.items()):
        if source in indexed:
            run_git_mv(source, destination)
            moved_count += 1
        elif destination not in indexed:
            raise RuntimeError("Move source disappeared during phase: {}".format(source))

    # Resolve relative references from the final location of every moved referrer.
    moved_sources = [source for source, _ in moves.items() if source in indexed]
    changes = rewrite_files(data, False, phase, moved_sources)
    print("Path-bearing files updated: {}; substitutions: {}".format(len(changes), sum(item[2] for item in changes)))
    print("Service-worker VERSION: {}".format(bump_version(data, phase, False)))
    write_json(MAP_FILE, data)
    write_frozen(data)
    print("Completed phase {}: {} files moved; {} path-bearing files updated.".format(
        phase, moved_count, len(changes)
    ))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print("ERROR: {}".format(error), file=sys.stderr)
        sys.exit(1)
