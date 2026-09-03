#!/usr/bin/env python3
"""
Regenerates manifest.json for the background-music player.

Run this ONE command every time you add, remove, or rename an audio file
in this folder, then redeploy the site (commit + push if you're on GitHub
Pages). The site itself (js/music.js) just fetches manifest.json at load
time and picks tracks at random from whatever list is in it - it never
needs to be edited by hand for a new song.

Usage:
    python3 "build-manifest.py"

(run it from inside this "background music" folder, or from anywhere -
it always writes manifest.json next to this script.)

Supported audio extensions: .mp3 .ogg .m4a .wav
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
EXTENSIONS = ('.mp3', '.ogg', '.m4a', '.wav')
MANIFEST_NAME = 'manifest.json'


def main():
    tracks = sorted(
        f for f in os.listdir(HERE)
        if f.lower().endswith(EXTENSIONS) and os.path.isfile(os.path.join(HERE, f))
    )
    manifest_path = os.path.join(HERE, MANIFEST_NAME)
    with open(manifest_path, 'w', encoding='utf-8') as fh:
        json.dump(tracks, fh, ensure_ascii=False, indent=2)
        fh.write('\n')

    print(f'Wrote {MANIFEST_NAME} with {len(tracks)} track(s):')
    for t in tracks:
        print(f'  - {t}')


if __name__ == '__main__':
    main()
