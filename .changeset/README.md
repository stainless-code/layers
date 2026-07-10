# Changesets

This repo uses [`@changesets/cli`](https://github.com/changesets/changesets) for versioning and publishing.

Run **`bun run changeset`** when your PR should bump the version, and commit the `.changeset/*.md` file it generates. See the GitHub Release workflow for how `bun run version` + `changeset publish` fit together.
