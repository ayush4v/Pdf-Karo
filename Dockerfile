# Dockerfile for PdfKaro - Hugging Face Spaces
FROM node:20-slim

# Install system dependencies for Sharp and image processing
RUN apt-get update && apt-get install -y \
    libvips-dev \
    libvips-tools \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Build the frontend
RUN npm run build

# Create necessary directories
RUN mkdir -p uploads outputs

# Set environment variables for Hugging Face
ENV PORT=7860
ENV NODE_ENV=production

# Expose port
EXPOSE 7860

# Start server
CMD ["node", "server.js"]
