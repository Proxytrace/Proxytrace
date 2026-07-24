FROM node:lts-alpine
WORKDIR /app
# Install dependencies before copying sources so this layer is cached across source-only changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
# Drop to the built-in non-root node user, matching the non-root practice in the .NET Dockerfiles.
USER node
EXPOSE 3000
CMD ["node", "server.js"]
