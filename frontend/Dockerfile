FROM node:24-alpine AS build
ARG BUILD_CONFIGURATION=production
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
# The build's prebuild step (gen:docs) reads the manual markdown (../manual) to bake the
# Tracey docs index into the bundle, so the manual sources must be present in this stage.
COPY manual/ /manual/
RUN npm run build

# Build the VitePress user/operator manual served at /docs.
FROM node:24-alpine AS manual
WORKDIR /manual
COPY manual/package.json manual/package-lock.json ./
RUN npm ci
COPY manual/ .
RUN npm run docs:build

FROM nginx:alpine AS final
EXPOSE 80
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=manual /manual/.vitepress/dist /usr/share/nginx/html/docs
CMD ["nginx", "-g", "daemon off;"]
