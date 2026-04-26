#!/bin/sh
# Substitute environment variables into nginx config template.
# If ONION_LOCATION is not set, envsubst replaces it with empty string,
# which results in no Onion-Location header (safe default).
envsubst '${ONION_LOCATION}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Execute the CMD
exec "$@"
