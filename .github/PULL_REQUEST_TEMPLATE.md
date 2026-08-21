## Description

Please include a summary of the changes and the related issue. List any dependencies that are required for this change.

Fixes # (issue)

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?

Record the exact commands run and any environmental limitations.

- [ ] `cargo fmt --all --check`
- [ ] `cargo clippy --all-targets --all-features --locked -- -D warnings`
- [ ] `cargo test --all-features --locked`
- [ ] `cargo sqlx prepare --check`
- [ ] `docker build --file Dockerfile .`

## Architecture and documentation

- [ ] Relevant ADRs are linked in the description.
- [ ] API or operational behavior changes are reflected in `README.md`.
- [ ] New domain terms are reflected in `CONTEXT.md`.

## Checklist

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my code
- [ ] Non-obvious decisions are documented in code or an ADR
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have checked my code and corrected any misspellings
