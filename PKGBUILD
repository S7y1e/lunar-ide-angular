# Maintainer: S7y1e
pkgname=lunar-ide
_reponame=lunar-ide-angular
pkgver=5.0.1
pkgrel=1
pkgdesc="IDE for Luau, built with Tauri, Angular and Monaco Editor"
arch=('x86_64')
url="https://github.com/S7y1e/${_reponame}"
license=('LicenseRef-PolyForm-Noncommercial-1.0.0')
depends=('webkit2gtk-4.1' 'gtk3')
# npm drives the build (the lockfile is package-lock.json), but bun is still
# required: download-binaries is a .ts script run directly by bun.
makedepends=('rust' 'npm' 'bun' 'git')
options=('!lto')
source=("git+${url}.git#tag=v${pkgver}")
sha256sums=('SKIP')

build() {
  cd "$srcdir/$_reponame"
  npm ci
  # Fetches the rokit/argon/rojo/luau-lsp sidecars into src-tauri/binaries and
  # marks them executable, which the committed copies are not.
  npm run download-binaries
  # `--` so the flags reach tauri instead of being eaten by npm run.
  npm run tauri -- build --bundles deb
}

package() {
  cd "$srcdir/$_reponame/src-tauri/target/release/bundle/deb"
  local debfile
  debfile=$(find . -maxdepth 1 -name '*.deb' | head -n1)

  ar x "$debfile"
  local dataarchive
  dataarchive=$(find . -maxdepth 1 -name 'data.tar.*' | head -n1)

  bsdtar -xf "$dataarchive" -C "$pkgdir"
}
