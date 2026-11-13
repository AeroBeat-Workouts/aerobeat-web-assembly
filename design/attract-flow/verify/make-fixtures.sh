#!/usr/bin/env bash
# Build the fake-camera video files used by verify/capture.mjs.
#   bash design/attract-flow/verify/make-fixtures.sh [outDir]   (default /tmp/af)
# person.y4m: a recorded athlete (from aerobeat-input-camera-tracking test fixtures) who
#             alternates hands-down and both-hands-overhead, 13.8 s, looped by Chromium.
# black.y4m:  a black picture (lens covered / privacy shutter).
# frozen.y4m: a single frame, so the picture never changes (frozen feed).
set -euo pipefail
out="${1:-/tmp/af}"
mkdir -p "$out"
src="$(cd "$(dirname "$0")/../../../.." && pwd)/aerobeat-input-camera-tracking/.testbed/assets/fixtures/flow/swings/left-and-right-hands/same-direction/lr6->lr12/flow_swing_lr6->lr12_repeat_04_take_01.mp4"
ffmpeg -v error -y -i "$src" -vf "scale=640:360,fps=15" -pix_fmt yuv420p "$out/person.y4m"
ffmpeg -v error -y -f lavfi -i color=c=black:s=640x360:r=15 -t 2 -pix_fmt yuv420p "$out/black.y4m"
ffmpeg -v error -y -ss 1 -i "$src" -vf "scale=640:360" -frames:v 1 -pix_fmt yuv420p "$out/frozen.y4m"
ls -la "$out"/*.y4m
