// Runs as Tauri's beforeBundleCommand. On Linux it puts ebb's appimage output
// plugin (linuxdeploy-plugin-appimage.sh, beside this file) where linuxdeploy
// looks first, so every AppImage build - release, nightly, or local - drops the
// bundled Wayland libraries before the image is packed and before the updater
// signature is computed over it. Anywhere else it does nothing.
//
// `bundle.useLocalToolsDir` keeps Tauri's tools under the cargo target
// directory, so the stand-in never lands in the per-user cache other Tauri
// projects share. Tauri only downloads a tool whose file is missing, which is
// what lets the stand-in keep its name; the real plugin it hands off to comes
// from the same URL Tauri would fetch it from.

import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "linux") {
    process.exit(0);
}

const here = dirname(fileURLToPath(import.meta.url));

function toolsArch() {
    const triple = process.env.TAURI_ENV_TARGET_TRIPLE;
    const arch = triple ? triple.split("-")[0] : { x64: "x86_64", arm64: "aarch64" }[process.arch];
    if (!arch) {
        throw new Error(`no AppImage tools for ${triple ?? process.arch}`);
    }
    return arch.startsWith("armv7") ? "armhf" : arch;
}

const metadata = JSON.parse(
    execFileSync(
        "cargo",
        [
            "metadata",
            "--no-deps",
            "--format-version",
            "1",
            "--manifest-path",
            join(here, "..", "Cargo.toml"),
        ],
        { encoding: "utf8" },
    ),
);
const tools = join(metadata.target_directory, ".tauri");

const real = join(tools, "ebb-real", "linuxdeploy-plugin-appimage.AppImage");
if (!existsSync(real)) {
    const url = `https://github.com/linuxdeploy/linuxdeploy-plugin-appimage/releases/download/continuous/linuxdeploy-plugin-appimage-${toolsArch()}.AppImage`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`downloading ${url}: HTTP ${response.status}`);
    }
    mkdirSync(dirname(real), { recursive: true });
    writeFileSync(`${real}.part`, Buffer.from(await response.arrayBuffer()), { mode: 0o755 });
    renameSync(`${real}.part`, real);
}

const standIn = join(tools, "linuxdeploy-plugin-appimage.AppImage");
copyFileSync(join(here, "linuxdeploy-plugin-appimage.sh"), standIn);
chmodSync(standIn, 0o755);
