FROM nginx:1.31.9-alpine-slim@sha256:a4d4bfb7422de90749b94dcc0374844d153b3c9e44d1d221a5f7ede18e9d60b4

# Install apache2-utils for htpasswd
RUN apk add --no-cache apache2-utils

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]

