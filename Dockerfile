FROM node:20-bookworm

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Copy and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# Create persistent data directories
RUN mkdir -p data ../projects

EXPOSE 3000

CMD ["npm", "start"]
