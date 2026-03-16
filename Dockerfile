FROM node:20-bookworm

# Install build tools for native modules (better-sqlite3, lightningcss)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user (Claude CLI refuses --dangerously-skip-permissions as root)
RUN useradd -m -s /bin/bash appuser

WORKDIR /app

# Copy package.json only — fresh install to get correct platform-specific binaries
COPY package.json ./
RUN npm install

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create persistent data directories and set ownership
RUN mkdir -p data ../projects /home/appuser/.claude && \
    chown -R appuser:appuser /app ../projects /home/appuser

# Switch to non-root user
USER appuser

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "start"]
