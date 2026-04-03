FROM grafana/grafana:11.3.0

USER root

# gettext: envsubst; rsvg-convert (SVG→PNG); icoutils: icotool (PNG→ICO). Both live in Alpine community.
RUN ALPINE_V=$(cut -d. -f1,2 /etc/alpine-release) && \
    grep -q "/community" /etc/apk/repositories || \
    echo "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_V}/community" >> /etc/apk/repositories && \
    apk update --no-cache && \
    apk add --no-cache gettext rsvg-convert icoutils

# Quantus brand assets (see https://www.quantus.com/ — #0E0E0E / #FF6B35)
COPY branding/quantus-logo.svg /usr/share/grafana/public/img/grafana_icon.svg
COPY branding/quantus-favicon.svg /tmp/quantus-favicon.svg
RUN rsvg-convert -w 16 -h 16 /tmp/quantus-favicon.svg -o /tmp/fav16.png && \
    rsvg-convert -w 32 -h 32 /tmp/quantus-favicon.svg -o /tmp/fav32.png && \
    rsvg-convert -w 180 -h 180 /tmp/quantus-favicon.svg -o /usr/share/grafana/public/img/apple-touch-icon.png && \
    cp /tmp/fav32.png /usr/share/grafana/public/img/fav32.png && \
    icotool -c /tmp/fav16.png -c /tmp/fav32.png -o /usr/share/grafana/public/img/favicon.ico && \
    rm -f /tmp/fav16.png /tmp/fav32.png /tmp/quantus-favicon.svg

# Login page background (OSS: Branding.tsx loads public/img/g8_login_{dark,light}.svg — not Enterprise white_labeling)
COPY branding/quantus_login_dark.svg /usr/share/grafana/public/img/g8_login_dark.svg
COPY branding/quantus_login_light.svg /usr/share/grafana/public/img/g8_login_light.svg

# Copy alerting provisioning to image (will be modified by entrypoint)
COPY provisioning/alerting /etc/grafana/provisioning/alerting

# Copy custom entrypoint for email configuration
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER grafana

ENTRYPOINT ["/docker-entrypoint.sh"]

