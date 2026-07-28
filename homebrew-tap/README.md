# sand1027/homebrew-tap

Homebrew tap for [Archly](https://github.com/sand1027/Archly) CLI.

## For users

After this repo is published as **`github.com/sand1027/homebrew-tap`**:

```bash
brew tap sand1027/tap
brew install archly
archly version
```

## For maintainers (one-time setup)

This folder lives in the Archly monorepo for convenience. To enable the short `brew tap sand1027/tap` flow:

1. Create a new GitHub repo: **`sand1027/homebrew-tap`** (name must start with `homebrew-`).
2. Push the contents of this directory (`Formula/` + this README) to that repo’s default branch.
3. Tag a CLI release in Archly (`git tag v0.1.0 && git push origin v0.1.0`).
4. After release assets are on GitHub, refresh checksums:

```bash
./archly-cli/scripts/bump-brew-formula.sh v0.1.0
git add Formula/archly.rb homebrew-tap/Formula/archly.rb
git commit -m "chore(cli): bump Homebrew formula to v0.1.0"
```

5. Copy or sync `homebrew-tap/Formula/archly.rb` to the `homebrew-tap` repo and push.

## Install without a separate tap repo

```bash
brew tap sand1027/archly https://github.com/sand1027/Archly
brew trust sand1027/archly
brew install archly --HEAD
```
