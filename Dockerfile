# Dockerfile for PdfKaro Deployment
FROM node:20-slim

# Install system dependencies for Playwright and Office conversion
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    fonts-liberation \
    xdg-utils \
    wget \
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install

# Install Playwright browsers
RUN npx playwright install --with-deps chromium

# Copy all source
COPY . .

# Build frontend
RUN npm run build

# Expose port (Hugging Face listens on 7860 by default)
ENV PORT=7860
EXPOSE 7860

# Start server
CMD ["node", "server.js"]
