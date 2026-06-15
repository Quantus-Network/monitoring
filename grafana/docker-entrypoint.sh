#!/bin/sh
set -e

ALERTING_DIR=/etc/grafana/provisioning/alerting
TEMPLATE_DIR=/etc/grafana/alerting-templates
ALERT_EMAIL_ADDRESSES="${ALERT_EMAIL_ADDRESSES:-admin@example.com}"
export ALERT_EMAIL_ADDRESSES

echo "Building alert contact points..."
cp "$TEMPLATE_DIR/contactpoints.base.yml" /tmp/contactpoints.yml
envsubst < /tmp/contactpoints.yml > /tmp/contactpoints.env.yml
mv /tmp/contactpoints.env.yml /tmp/contactpoints.yml

if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    echo "Including Telegram contact point"
    envsubst < "$TEMPLATE_DIR/contactpoints.telegram.fragment.yml" >> /tmp/contactpoints.yml
else
    echo "Telegram not configured — skipping telegram contact point"
fi

if [ -n "$ROCKET_WEBHOOK_URL" ]; then
    echo "Including Rocket.Chat contact point"
    envsubst < "$TEMPLATE_DIR/contactpoints.rocket.fragment.yml" >> /tmp/contactpoints.yml
else
    echo "Rocket.Chat not configured — skipping rocket contact point"
fi

mv /tmp/contactpoints.yml "$ALERTING_DIR/contactpoints.yml"
echo "Alert email addresses configured: $ALERT_EMAIL_ADDRESSES"

if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ] && [ -n "$ROCKET_WEBHOOK_URL" ]; then
    cp "$TEMPLATE_DIR/policies.production.yml" "$ALERTING_DIR/policies.yml"
    echo "Using production notification policies"
else
    cp "$TEMPLATE_DIR/policies.local.yml" "$ALERTING_DIR/policies.yml"
    echo "Using email-only notification policies for local/testing"
fi

# Remove template/fragment files from provisioning dir so Grafana does not parse them.
rm -f \
    "$ALERTING_DIR/contactpoints.base.yml" \
    "$ALERTING_DIR/contactpoints.telegram.fragment.yml" \
    "$ALERTING_DIR/contactpoints.rocket.fragment.yml" \
    "$ALERTING_DIR/policies.local.yml" \
    "$ALERTING_DIR/policies.production.yml"

exec /run.sh "$@"
