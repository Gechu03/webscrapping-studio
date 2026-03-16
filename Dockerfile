FROM node:20-bookworm

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Install build tools for native modules (better-sqlite3, lightningcss)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies
COPY package.json package-lock.json* ./
RUN npm install && npm install lightningcss-linux-x64-gnu@1.31.1

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# Create persistent data directories
RUN mkdir -p data ../projects

EXPOSE 3000

CMD ["npm", "start"]
