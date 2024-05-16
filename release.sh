#!/bin/bash

# This script is used to release a new version of the bolt-web-app
# It will:
# - create a new branch with the tag name and update the version in package.json
# - generate a changelog and release notes
# - create a branch, commit the changes and push them to the remote repository
# - create a pull request with the changes

# Check if required dependencies are installed
if ! command -v gh &> /dev/null
then
    echo "gh could not be found"
    exit 1
fi

if ! command -v npx git-cliff &> /dev/null
then
    echo "npx git-cliff could not be found"
    exit 1
fi

tag=$1
if [ -z "$tag" ]; then
  echo "Usage: release.sh <tag>"
  exit 1
fi

git checkout -b $tag

sed -i "s/\"version\": \".*\"/\"version\": \"$tag\"/" package.json
npm i

# Generate changelog after we updated the version
npx git-cliff -o CHANGELOG.md -t $tag

git add package.json package-lock.json LICENSE CHANGELOG.md

# Commit and create pull request
commit_message="chore: update version to $tag and prepare release"

git commit -m "$commit_message"

git push origin $tag
gh pr create --title "$commit_message" --base main --head $tag --body "$commit_message"

echo "1. Review the release notes"
echo "2. Merge the pull request"
echo "3. Pull latest main"
echo "4. Run the following commands to create the release"
echo "git tag -s -m "$tag""
echo "git push --tags"
echo "gh release create "$tag" -F release.md"
echo "rm release.md"
