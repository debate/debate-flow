# Arch (AUR)

`ebb-bin` packages the released Linux `.deb` for Arch. The recipe lives in this
repo so it is reviewed and built beside the app; the same three files are
copied into the AUR repository that serves it at
https://aur.archlinux.org/packages/ebb-bin.

## Why the .deb and not the AppImage

The `.deb` payload is already rooted at `/` - `usr/bin/ebb`, a `.desktop` entry,
hicolor icons and a shared-mime-info file - and it links the WebKitGTK the
distribution ships, so it is 13.5 MB. The AppImage is 87 MB because it carries
its own Wayland libraries, and an AppImage install lives outside the filesystem
hierarchy behind a wrapper. A source build is worse than either for someone
installing an editor: Rust, Node, and an npm fetch before the app exists.

## First submission (one time)

1. Create an account at https://aur.archlinux.org and add an SSH public key
   under My Account.
2. Clone the package repository. The AUR creates it on receipt of the first
   push, so clone the URL it will live at:

    ```bash
    git clone ssh://aur@aur.archlinux.org/ebb-bin.git
    ```

3. Copy `PKGBUILD`, `.SRCINFO` and `ebb-bin.install` from
   `packaging/aur/ebb-bin/` into it, commit `1.4.2-1`, and push.
4. Confirm the page renders: https://aur.archlinux.org/packages/ebb-bin

The AUR builds nothing and stores no binaries. It serves the `PKGBUILD` and the
`.SRCINFO` generated from it; `makepkg` on the user's machine downloads the
`.deb`, checks the pinned sha256, and installs the payload. A `.SRCINFO` that
disagrees with its `PKGBUILD` is what the package page and AUR helpers read, so
it is always generated, never edited by hand.

## Every release

The recipe names an artifact, so it moves after `release.yml` has published one,
not when the tag is pushed:

```bash
node scripts/aur-bump.mjs 1.4.3
```

That downloads the release's own `.deb`, rewrites `pkgver` and `sha256sums`
from it, and regenerates `.SRCINFO`. Commit the result here, then copy the three
files into the AUR clone and commit `1.4.3-1`.

A packaging-only change - a dependency rename, an install-hook fix - keeps
`pkgver` and increments `pkgrel`, so pacman offers the rebuild without a new
upstream release.

The script regenerates `.SRCINFO` with `makepkg`, so it needs Arch (or `devtools`
in a container). Where `makepkg` is missing it still bumps the `PKGBUILD` and
says so; `aur.yml` then fails on the stale `.SRCINFO`, which is the gate.

## What CI checks

`.github/workflows/aur.yml` builds the recipe in an `archlinux:base-devel`
container from the same `source=` URL and checksum a user gets, then installs
the result and asserts:

- `.SRCINFO` is exactly what `makepkg --printsrcinfo` generates today.
- `ldd /usr/bin/ebb` reports no missing library, so `depends` is complete.
- A `.ebb` file resolves to `application/x-ebb-flow`, so the MIME XML and the
  install hook work.
- `desktop-file-validate` passes on the shipped entry.

## Two things the recipe cannot fix

- **The in-app updater is off by default; leave it off.** `latest.json` offers
  the AppImage under `linux-x86_64`, and Tauri installs an update by rewriting
  the AppImage the process is running from. A pacman-owned `/usr/bin/ebb` is not
  one, so a user who turns checks on downloads 87 MB and then reads "Couldn't
  install the update." Updates here come from `pacman -Syu`.
- **Only x86_64.** Releases carry no Linux aarch64 asset, so `arch=('x86_64')`
  is the whole truth until CI publishes one.
