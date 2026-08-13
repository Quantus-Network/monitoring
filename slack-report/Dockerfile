FROM alpine:3.21

ARG TARGETARCH
ARG SUPERCRONIC_VERSION=v0.2.48

RUN apk add --no-cache \
      bash \
      curl \
      jq \
      tzdata \
      imagemagick \
      libwebp-tools \
      ca-certificates \
  && case "${TARGETARCH}" in \
       amd64) SC_ARCH=amd64 ;; \
       arm64) SC_ARCH=arm64 ;; \
       *) echo "unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
     esac \
  && curl -fsSL \
       "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-${SC_ARCH}" \
       -o /usr/local/bin/supercronic \
  && chmod +x /usr/local/bin/supercronic

COPY slack-report.sh /usr/local/bin/slack-report.sh
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/slack-report.sh /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
