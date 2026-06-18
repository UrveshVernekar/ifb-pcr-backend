# Stage 1: Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for compilation)
RUN npm ci

# Copy application source files
COPY . .

# Build/compile the project
RUN npm run build

# Stage 2: Production runner stage
FROM node:20-alpine

# Set to production
ENV NODE_ENV=production

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled files from build stage
COPY --from=build /app/dist ./dist

# Create a production knexfile.js in the root of the app that references the compiled config
RUN echo "const { knexConfig } = require('./dist/config/database'); module.exports = knexConfig;" > knexfile.js

# Expose the application port
EXPOSE 5000

# Run the compiled application directly using node for proper signal handling (graceful shutdown)
CMD ["node", "dist/server.js"]
