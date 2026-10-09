#!/bin/sh
# Nightly backup of the pb_data volume (database + photos) to a tar.gz, keeping 14 days.
# cron (as root, 03:15 every night):
#   15 3 * * * /opt/bins/scripts/backup.sh >> /var/log/bins-backup.log 2>&1
# Set VOLUME to the name shown by `docker volume ls | grep pb_data` (Portainer prefixes it with the stack name).
VOLUME="${VOLUME:-bins_pb_data}"
DEST="${DEST:-/var/backups/bins}"
mkdir -p "$DEST"
docker run --rm -v "$VOLUME":/data:ro -v "$DEST":/backup alpine \
  tar czf "/backup/pb_data-$(date +%F).tar.gz" -C /data .
find "$DEST" -name 'pb_data-*.tar.gz' -mtime +14 -delete
