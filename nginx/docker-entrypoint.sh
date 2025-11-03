#!/bin/sh
# Generate .htpasswd from environment variables on container startup

set -e

# Get username and password from environment or use defaults
USERNAME=${PROMETHEUS_USER:-admin}
PASSWORD=${PROMETHEUS_PASSWORD:-prometheus}

# Generate htpasswd file
echo "Generating .htpasswd for user '$USERNAME'..."
htpasswd -cb /etc/nginx/.htpasswd "$USERNAME" "$PASSWORD"

# Start nginx
exec nginx -g 'daemon off;'

