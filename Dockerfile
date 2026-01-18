FROM node:20-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/logs /app/uploads/shops /app/uploads/payment_requests && \
    chown -R nodejs:nodejs /app/logs /app/uploads

COPY --chown=nodejs:nodejs package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY --chown=nodejs:nodejs src ./src

USER nodejs

EXPOSE 5000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))" || exit 1

CMD ["node", "src/server.js"]

