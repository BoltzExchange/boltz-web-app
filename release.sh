#!/bin/bash
# This script is used to release a new version of the bolt-web-app
# It will create a new branch with the tag name and update the version in package.json
# It will also update the LICENSE file with the new date and licensed work
# It will create a branch, commit the changes and push them to the remote repository
# It will generate a changelog and release notes
# It will create a pull request with the changes

# check if gh is installed
if ! command -v gh &> /dev/null
then
    echo "gh could not be found"
    exit 1
fi

if ! command -v git-cliff &> /dev/null
then
    echo "git-cliff could not be found"
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

git add package.json package-lock.json LICENSE

# commit
git commit -am "$commit_message"

# generate changelog after we updated version
git-cliff -o CHANGELOG.md

# generate release notes only for latest tag
git-cliff -o release.md -t $tag

# squash the commit for changelog to be included
git add CHANGELOG.md
git commit -m "fixup!"
git reset --soft HEAD~1
git commit

# git push origin $tag
# gh pr create --title "$commit_message" --base main --head $tag

cat release.md

echo "1. Please review the release notes"
echo "2. merge the pull request"
echo "3. pull latest main"
echo "4. run the following command to create the release"
echo "gh release create "$tag" -F release.md"
