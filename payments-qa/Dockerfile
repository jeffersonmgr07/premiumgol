FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js ./
ENV NODE_ENV=production PORT=8080
USER node
CMD ["node", "server.js"]
