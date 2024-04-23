#!/bin/bash
# This script is used to release a new version of the bolt-web-app
# It will create a new branch with the tag name and update the version in package.json
# It will also update the LICENSE file with the new date and licensed work
# It will generate a changelog and release notes
# It will create a branch, commit the changes and push them to the remote repository
# It will create a pull request with the changes

# check if gh is installed
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

commit_message="chore: update version to $tag and prepare release"

git checkout -b $tag

# make the changes
sed -i "s/\"version\": \".*\"/\"version\": \"$tag\"/" package.json
npm i

new_date=$(date -d "+4 years"  +%Y-%m-%d)
sed -i \
  -e "s/Change Date:.*/Change Date:          $new_date/g" \
  -e "s/Licensed Work:.*/Licensed Work:        boltz-web-app $tag/g" \
  LICENSE

# generate changelog after we updated version
npx git-cliff -o CHANGELOG.md -t $tag

git add package.json package-lock.json LICENSE CHANGELOG.md

# commit
git commit -m "$commit_message"

git push origin $tag
gh pr create --title "$commit_message" --base main --head $tag --body "$commit_message"

git tag -a $tag -m "$tag"
npx git-cliff -o release.md --latest
git tag -d $tag

echo "1. Please review the release notes"
echo "2. merge the pull request"
echo "3. pull latest main"
echo "4. run the following commands to create the release"
echo "gh release create "$tag" -F release.md"
echo "rm release.md"
