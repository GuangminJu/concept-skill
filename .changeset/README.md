# Changesets

This monorepo uses Changesets for package versioning and release notes.

Typical flow:

```bash
npm run changeset
npm run version-packages
npm run build
```

Publishing is automated through the GitHub Actions release workflow when the
repository is configured with an `NPM_TOKEN`.
