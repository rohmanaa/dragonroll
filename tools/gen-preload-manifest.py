#!/usr/bin/env python3
"""Generate the preload manifest from paths and blob sizes in the Git index."""

import hashlib
import json
import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INC_DIRS = ("assets", "data", "gameplay", "hud", "promosi")
EXT = {
    ".png", ".webp", ".jpg", ".jpeg", ".gif", ".svg", ".mp3", ".ogg",
    ".wav", ".js", ".css", ".woff", ".woff2", ".webm",
    ".glb", ".gltf", ".bin", ".ktx2",
}
SKIP_PARTS = {"old", "doc", "referensi", "node_modules"}
# Media yang disimpan service worker di cache PERMANEN (sw.js MEDIA). Hash = id blob git (12 hex) -> SW hanya
# mengunduh ulang file yang hash-nya berubah, bukan seluruh aset tiap SW naik versi.
MEDIA_EXT = {".png", ".webp", ".jpg", ".jpeg", ".gif", ".svg", ".mp3", ".ogg", ".wav", ".woff", ".woff2", ".glb", ".gltf", ".bin", ".ktx2"}


def git_output(*args, input_bytes=None):
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        input=input_bytes,
        check=True,
        stdout=subprocess.PIPE,
    ).stdout


def index_files():
    selected = []
    for record in git_output("ls-files", "--stage", "-z").split(b"\0"):
        if not record:
            continue
        metadata, raw_path = record.split(b"\t", 1)
        _, object_id, stage = metadata.decode("ascii").split()
        if stage != "0":
            continue
        path = os.fsdecode(raw_path).replace(os.sep, "/")
        parts = path.split("/")
        if not any(path.startswith(directory + "/") for directory in INC_DIRS):
            continue
        if any(part in SKIP_PARTS for part in parts):
            continue
        if Path(path).suffix.lower() not in EXT:
            continue
        if ".old." in Path(path).name:
            continue  # backup aset lama (*.old.webp): jangan di-preload
        if path in ("assets/preload-manifest.json", "assets/media-hash.json"):
            continue
        selected.append((path, object_id))
    return selected


def blob_sizes(object_ids):
    unique_ids = sorted(set(object_ids))
    if not unique_ids:
        return {}
    output = git_output(
        "cat-file",
        "--batch-check=%(objectname) %(objectsize)",
        input_bytes=("\n".join(unique_ids) + "\n").encode("ascii"),
    )
    return {
        object_id: int(size)
        for object_id, size in (line.decode("ascii").split() for line in output.splitlines())
    }


def dist_files():
    """Scan dist/ directory for built assets (hashed filenames)."""
    selected = []
    dist_root = ROOT / "dist"
    if not dist_root.is_dir():
        return selected
    for p in dist_root.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(dist_root).as_posix()
        parts = rel.split("/")
        if any(part in SKIP_PARTS for part in parts):
            continue
        if Path(rel).suffix.lower() not in EXT:
            continue
        if rel in ("assets/preload-manifest.json", "assets/media-hash.json"):
            continue
        # Content hash for media-hash (sha1 hex first 12, same format as git blob hash)
        data = p.read_bytes()
        h = hashlib.sha1(("blob %d\0" % len(data)).encode("ascii") + data).hexdigest()[:12]
        selected.append((rel, h, p.stat().st_size))
    return selected


def write_manifests(base_dir, entries, media_entries):
    """entries: list of (path, size_or_hash). media_entries: list of (path, hash)."""
    manifest = {}
    media = {}
    for path, size in entries:
        manifest[path] = size
    for path, h in media_entries:
        media[path] = h
    output_path = base_dir / "assets" / "preload-manifest.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(dict(sorted(manifest.items())), separators=(",", ":")),
        encoding="utf-8",
        newline="",
    )
    media_path = base_dir / "assets" / "media-hash.json"
    media_path.write_text(
        json.dumps(dict(sorted(media.items())), separators=(",", ":")),
        encoding="utf-8",
        newline="",
    )
    return len(manifest), len(media)


def main():
    # Development mode: generate from git index
    files = index_files()
    sizes = blob_sizes(object_id for _, object_id in files)
    manifest = {path: sizes[object_id] for path, object_id in files}
    media = {
        path: object_id[:12]
        for path, object_id in files
        if Path(path).suffix.lower() in MEDIA_EXT
    }
    write_manifests(ROOT, [(p, sizes[oid]) for p, oid in files], [(p, oid[:12]) for p, oid in files if Path(p).suffix.lower() in MEDIA_EXT])

    # Build mode: generate from dist/ directory
    dist_entries = dist_files()
    if dist_entries:
        manifest_d = {p: s for p, _, s in dist_entries}
        media_d = {p: h for p, h, _ in dist_entries if Path(p).suffix.lower() in MEDIA_EXT}
        write_manifests(ROOT / "dist", [(p, s) for p, _, s in dist_entries], [(p, h) for p, h, _ in dist_entries if Path(p).suffix.lower() in MEDIA_EXT])
        print("dist: %d file, %d media-hash" % (len(manifest_d), len(media_d)))

    print("%d file, %.2f MB; %d media-hash" % (len(manifest), round(sum(manifest.values()) / 1048576, 2), len(media)))


if __name__ == "__main__":
    main()
