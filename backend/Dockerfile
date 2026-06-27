# Use a lightweight python base image (since ultralytics needs python)
FROM python:3.9-slim

# Install Node.js, npm, and system packages for OpenCV and glib
RUN apt-get update && apt-get install -y \
    curl \
    libglib2.0-0 \
    libgl1-mesa-glx \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy requirements.txt and install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend files (including python/inference.py and python/rrp32.pt)
COPY . .

# Hugging Face Spaces require the container to expose and listen on port 7860
EXPOSE 7860
ENV PORT=7860

# Start the Express application
CMD ["node", "server.js"]
