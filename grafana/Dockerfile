FROM grafana/grafana:11.3.0

USER root

# envsubst for contact point secrets (see docker-entrypoint.sh)
RUN apk add --no-cache gettext

# Quantus branding — same approach as commit 53a13823: plain COPY into Grafana public/img (no rsvg/icoutils).
COPY branding/logo.svg /usr/share/grafana/public/img/grafana_icon.svg
COPY branding/favicon.ico /usr/share/grafana/public/img/favicon.ico
COPY branding/fav32.png /usr/share/grafana/public/img/fav32.png
COPY branding/logo.png /usr/share/grafana/public/img/apple-touch-icon.png

COPY provisioning/alerting /etc/grafana/provisioning/alerting

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER grafana

ENTRYPOINT ["/docker-entrypoint.sh"]
