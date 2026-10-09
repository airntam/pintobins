# PocketBase with this repo's hooks and migrations baked in.
FROM alpine:3.20 AS download
ARG PB_VERSION=0.40.5
ARG TARGETARCH
RUN apk add --no-cache ca-certificates unzip wget
RUN case "${TARGETARCH:-amd64}" in \
      amd64) A=amd64 ;; arm64) A=arm64 ;; *) echo "unsupported arch ${TARGETARCH}" && exit 1 ;; \
    esac \
 && wget -q -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${A}.zip" \
 && unzip -q /tmp/pb.zip -d /pb \
 && chmod +x /pb/pocketbase

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget
COPY --from=download /pb/pocketbase /usr/local/bin/pocketbase
COPY pb_hooks /pb_hooks
COPY pb_migrations /pb_migrations
VOLUME /pb_data
EXPOSE 8090
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null || exit 1
# ADMIN_EMAIL / ADMIN_PASSWORD create the first user on first boot (see pb_hooks/bootstrap.pb.js)
CMD ["pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data", "--hooksDir=/pb_hooks", "--migrationsDir=/pb_migrations"]
