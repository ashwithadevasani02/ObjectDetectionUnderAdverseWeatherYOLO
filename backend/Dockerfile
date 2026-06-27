# Use Node.js 20 base image
FROM node:20-slim

# Install Python 3, pip, and system dependencies for OpenCV and glib
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libglib2.0-0 \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy requirements.txt and install Python dependencies
COPY requirements.txt ./
# --break-system-packages is needed for modern debian systems using global pip installs
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt || pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend files (including python/inference.py and python/rrp32.pt)
COPY . .

# Hugging Face Spaces require the container to expose and listen on port 7860
EXPOSE 7860
ENV PORT=7860
ENV PYTHON_PATH=python3

# Start the Express application
CMD ["node", "server.js"]

