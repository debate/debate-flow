#!/bin/sh
# Stands in for linuxdeploy's appimage output plugin, installed by
# prepare-appimage-tools.mjs. linuxdeploy runs it after every input plugin has
# finished filling the AppDir and before anything is packed or signed, so it is
# the last point at which the AppDir can be corrected.
#
# It takes the Wayland client libraries back out. The AppImage runtime puts
# usr/lib ahead of the host's on LD_LIBRARY_PATH, so a bundled libwayland-client
# from the build runner shadows the host's, and the host's Mesa EGL driver -
# which is never bundled - then fails to load on a symbol only its own Wayland
# exports. WebKit's web process aborts with EGL_BAD_PARAMETER and the window
# stays blank. The Wayland libraries keep a backward-compatible ABI and ship
# together as one package on every host that runs GTK, so the host's copies
# always serve the bundled GTK and WebKit. linuxdeploy's own excludelist names
# libwayland-client, but the GTK plugin deploys with --library, which bypasses
# it, and Tauri passes linuxdeploy no exclusions of its own.
set -eu

real="$(dirname "$0")/ebb-real/linuxdeploy-plugin-appimage.AppImage"

case "${1:-}" in
    --plugin-api-version | --plugin-type) exec "$real" "$@" ;;
esac

appdir=""
prev=""
for arg in "$@"; do
    case "$arg" in
        --appdir=*) appdir="${arg#--appdir=}" ;;
    esac
    if [ "$prev" = "--appdir" ]; then
        appdir="$arg"
    fi
    prev="$arg"
done

if [ -z "$appdir" ] || [ ! -d "$appdir/usr/lib" ]; then
    echo "ebb appimage plugin: no AppDir with usr/lib in: $*" >&2
    exit 1
fi

for lib in "$appdir"/usr/lib/libwayland-*.so*; do
    if [ -e "$lib" ] || [ -L "$lib" ]; then
        rm -f "$lib"
        echo "ebb appimage plugin: unbundled $(basename "$lib")" >&2
    fi
done

exec "$real" "$@"
