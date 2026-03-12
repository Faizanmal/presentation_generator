#!/bin/sh
set -e

# startup.sh
echo "🚀 Pre-boot configuration... (Process: $PPID)"

# 0. Ensure directories exist and are writable
echo "📂 Ensuring directories exist..."
mkdir -p /app/uploads/acquired-images /app/logs /app/backups
# Even though Dockerfile does this, doing it here ensures it's done if volumes are mounted
chmod -R 777 /app/uploads /app/logs /app/backups || true

# 1. Run database migrations
if [ -z "$DATABASE_URL" ]; then
  echo "⚠ Warning: DATABASE_URL is not set. Skipping migrations."
else
  echo "📦 Database detected. Ensuring schema is up to date..."
  
  # Check if we are using a pooler without a direct URL
  echo "$DATABASE_URL" | grep -q ":6543" && [ -z "$DIRECT_DATABASE_URL" ] && {
    echo "⚠ Warning: Detected Supabase Pooler (6543) without DIRECT_DATABASE_URL."
    echo "💡 Migrations may get stuck. Please provide DIRECT_DATABASE_URL (Port 5432) in your env."
  }

  echo "🚀 Running 'prisma migrate deploy'..."
  # Use npx prisma migrate deploy which only applies existing migrations
  if npx prisma migrate deploy --preview-feature; then
    echo "✅ Migrations applied successfully."
  else
    echo "❌ Migration failed — check your database status and Direct URL."
    exit 1
  fi
fi

# 2. Check for port (Railway default is 3001)
echo "🌍 Starting NestJS application on PORT: ${PORT:-3001}"

# Execute the application (replaces the current shell process)
exec node dist/src/main.js

