# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.17.1
FROM node:${NODE_VERSION}-slim

LABEL fly_launch_runtime="NodeJS/Prisma"

# NodeJS/Prisma app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install -y python-is-python3 pkg-config build-essential openssl && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --verbose

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate --verbose

# Copy application code
COPY . .

# Make docker-entrypoint executable
RUN chmod +x docker-entrypoint

# Build the application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Entrypoint prepares the database.
ENTRYPOINT ["/app/docker-entrypoint"]

# Start the server by default, this can be overwritten at runtime
CMD [ "npm", "run", "start:prod" ]
