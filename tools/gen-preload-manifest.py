#!/usr/bin/env python3
"""Generate the preload manifest from paths and blob sizes in the Git index."""

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


def main():
    files = index_files()
    sizes = blob_sizes(object_id for _, object_id in files)
    manifest = {path: sizes[object_id] for path, object_id in files}
    output_path = ROOT / "assets" / "preload-manifest.json"
    output_path.write_text(
        json.dumps(dict(sorted(manifest.items())), separators=(",", ":")),
        encoding="utf-8",
        newline="",
    )
    media = {
        path: object_id[:12]
        for path, object_id in files
        if Path(path).suffix.lower() in MEDIA_EXT
    }
    (ROOT / "assets" / "media-hash.json").write_text(
        json.dumps(dict(sorted(media.items())), separators=(",", ":")),
        encoding="utf-8",
        newline="",
    )
    print(len(manifest), "file,", round(sum(manifest.values()) / 1048576, 2), "MB;", len(media), "media-hash")


if __name__ == "__main__":
    main()
