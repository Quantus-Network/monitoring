#!/bin/sh
set -e

# Replace environment variables in contactpoints.yml if ALERT_EMAIL_ADDRESSES is set
if [ -n "$ALERT_EMAIL_ADDRESSES" ]; then
    echo "Setting up alert email addresses from environment..."
    
    # Create temp file with substituted values
    envsubst < /etc/grafana/provisioning/alerting/contactpoints.yml > /tmp/contactpoints.yml
    
    # Copy it back (use cat to avoid permission issues with bind mounts)
    cat /tmp/contactpoints.yml > /etc/grafana/provisioning/alerting/contactpoints.yml
    
    echo "Alert email addresses configured: $ALERT_EMAIL_ADDRESSES"
else
    echo "Warning: ALERT_EMAIL_ADDRESSES not set. Using default from contactpoints.yml"
fi

# Execute Grafana with all arguments passed to this script
exec /run.sh "$@"

