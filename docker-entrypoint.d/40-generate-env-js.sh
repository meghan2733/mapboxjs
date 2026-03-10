#!/bin/sh
set -eu

ESCAPED_MAPBOX_TOKEN=$(printf '%s' "${MAPBOX_ACCESS_TOKEN:-}" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat > /usr/share/nginx/html/env.js <<EOF
window.__APP_CONFIG__ = {
  MAPBOX_ACCESS_TOKEN: "${ESCAPED_MAPBOX_TOKEN}"
};
EOF
