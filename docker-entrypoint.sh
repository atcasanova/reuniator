#!/bin/sh
set -eu

DATABASE_URL_VALUE="${DATABASE_URL:-file:/app/prisma/dev.db}"

if [ "${DATABASE_URL_VALUE#file:}" != "$DATABASE_URL_VALUE" ]; then
  DB_PATH="${DATABASE_URL_VALUE#file:}"
else
  DB_PATH="/app/prisma/dev.db"
fi

case "$DB_PATH" in
  /*) ;;
  *) DB_PATH="/app/$DB_PATH" ;;
esac

DB_DIR="$(dirname "$DB_PATH")"

mkdir -p "$DB_DIR"
touch "$DB_PATH"

if ! chown -R nextjs:nodejs "$DB_DIR"; then
  echo "Failed to update ownership for SQLite directory: $DB_DIR"
  echo "Ensure the mounted path is writable by the container."
  exit 1
fi

exec su-exec nextjs sh -c "npx prisma db push --skip-generate && npm start"
