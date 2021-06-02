#!/bin/bash

# Exit script if you try to use an uninitialized variable.
set -o nounset
# Exit script if a statement returns a non-true return value.
set -o errexit
# Use the error status of the first failure, rather than that of the last item in a pipeline.
set -o pipefail

# Setup git env
git config --global user.email "$CI_GIT_EMAIL"
git config --global user.name "$CI_GIT_USER"
echo "git user is $CI_GIT_USER ($CI_GIT_EMAIL)"

RELEASE_VER=$(echo "$CIRCLE_TAG" | grep -Po "(?<=v)[0-9]+(\.[0-9]+){2}(-.+|[^-.]*)")

if [ -z "$RELEASE_VER" ]; then
    echo "No release version provided"
    exit 1
fi
if [[ $RELEASE_VER =~ ^[0-9]+(\.[0-9]+){2}(-.+|[^-.]*) ]]; then
  echo "Preparing release $RELEASE_VER"
else
  echo "Release should has format 1.2.3[-meta], got $RELEASE_VER"
  exit 1
fi

RELEASE_BRANCH=release-$RELEASE_VER

# Build plugin
git checkout -b "$RELEASE_BRANCH"
make clean install dist

# Commit release
git add --force dist/
git commit -m "release $RELEASE_VER"

RELEASE_COMMIT_HASH=$(git log -n 1 | grep -Po "(?<=commit )[0-9a-z]{40}")
echo "$RELEASE_COMMIT_HASH"

# Push release branch
git push origin "$RELEASE_BRANCH"
