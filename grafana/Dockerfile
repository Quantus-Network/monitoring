FROM grafana/grafana:11.3.0

USER root

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Copy Quantus branding assets
COPY branding/logo.svg /usr/share/grafana/public/img/grafana_icon.svg
COPY branding/favicon.ico /usr/share/grafana/public/img/favicon.ico
COPY branding/favicon.ico /usr/share/grafana/public/img/fav32.png
COPY branding/logo.png /usr/share/grafana/public/img/apple-touch-icon.png

# Copy alerting provisioning to image (will be modified by entrypoint)
COPY provisioning/alerting /etc/grafana/provisioning/alerting

# Copy custom entrypoint for email configuration
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER grafana

ENTRYPOINT ["/docker-entrypoint.sh"]

