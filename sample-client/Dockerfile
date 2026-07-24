FROM node:lts-alpine
WORKDIR /app
# Install dependencies before copying sources so this layer is cached across source-only changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
