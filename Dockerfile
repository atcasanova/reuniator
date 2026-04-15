FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate prisma client
RUN npx prisma generate

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

# Generate the sqlite file during build so it's ready, or rely on runtime migration
RUN npx prisma db push

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
# Note: Next.js outputs a standalone folder if we set output: 'standalone' in next.config.mjs
# Wait, we might not have set it! Let's copy standard next build
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy prisma schema for runtime schema queries if any, and the DB
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
#COPY --from=builder --chown=nextjs:nodejs /app/dev.db ./dev.db

# SQLite needs to write temporary files in the same directory as the database.
# Give the nextjs user permissions to write to /app and /app/prisma.
# RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 6742
ENV PORT 6742
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "start"]
