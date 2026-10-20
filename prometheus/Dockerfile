FROM prom/prometheus:v3.15.0

USER root

COPY prometheus.yml /etc/prometheus/prometheus.yml
COPY docker-entrypoint.sh /etc/prometheus/docker-entrypoint.sh
RUN chmod 755 /etc/prometheus/docker-entrypoint.sh \
    && chown nobody:nobody /etc/prometheus/prometheus.yml /etc/prometheus/docker-entrypoint.sh

USER nobody

ENTRYPOINT ["/etc/prometheus/docker-entrypoint.sh"]
CMD ["--config.file=/etc/prometheus/prometheus.yml", \
     "--storage.tsdb.path=/prometheus", \
     "--storage.tsdb.retention.time=60d", \
     "--storage.tsdb.retention.size=30GB", \
     "--web.console.libraries=/usr/share/prometheus/console_libraries", \
     "--web.console.templates=/usr/share/prometheus/consoles", \
     "--web.enable-lifecycle"]
