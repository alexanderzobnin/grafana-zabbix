#!/bin/bash

# Exit script if you try to use an uninitialized variable.
set -o nounset
# Exit script if a statement returns a non-true return value.
set -o errexit
# Use the error status of the first failure, rather than that of the last item in a pipeline.
set -o pipefail

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

# Create zip package
PACKAGE_NAME="grafana-zabbix-${RELEASE_VER}.zip"
echo "packaging into $PACKAGE_NAME"
mv ./dist alexanderzobnin-zabbix-app
zip -r $PACKAGE_NAME ./alexanderzobnin-zabbix-app
