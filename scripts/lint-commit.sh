#!/bin/bash
# Conventional commit regex pattern
PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,255}$"

# Read the commit message
MESSAGE="$(cat $1)"

# Check if the commit message is provided
if [[ -z "$MESSAGE" ]]; then
  echo "Error: Commit message not provided."
  exit 1
fi

# Validate the commit message against the pattern
if [[ ! $MESSAGE =~ $PATTERN ]]; then
  echo "Error: Commit message \""$MESSAGE"\" does not follow conventional commits format."
  echo "Example: feat(scope): add new feature"
  echo "Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
  exit 1
fi
