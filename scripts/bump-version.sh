#!/bin/bash

set -e
CHANGELOG_TEMPLATE_PATH=./changelog-template.yaml
NEW_SEMVERSION=$(npx git-cliff -r ./ --bumped-version -c $CHANGELOG_TEMPLATE_PATH)
NEW_VERSION="${NEW_SEMVERSION#v}"

perl -i -pe "s/\"version\":\\s*\"[0-9]+\\.[0-9]+\\.[0-9]+\"/\"version\": \"$NEW_VERSION\"/" ./package.json
perl -i -pe "s/const API_VERSION = '([0-9]+\.[0-9]+\.[0-9]+)'/const API_VERSION = '$NEW_VERSION'/" ./src/app/setup/swagger.ts

git add ./package.json
git commit -m "chore(release): $NEW_VERSION"
git tag -a "$NEW_SEMVERSION" -m "chore(release): $NEW_VERSION"

npx git-cliff -r ./ -c $CHANGELOG_TEMPLATE_PATH -o ./CHANGELOG.md

git add ./CHANGELOG.md
git commit --amend --no-edit
git tag -d $NEW_SEMVERSION
git tag -a "$NEW_SEMVERSION" -m "chore(release): $NEW_VERSION"

echo "The new version is: $NEW_VERSION"
