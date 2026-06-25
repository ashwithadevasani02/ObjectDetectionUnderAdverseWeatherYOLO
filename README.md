# Object Detection under Adverse Weather Conditions

A minimal, modern, and professional web application designed to run object detection (e.g., vehicles, pedestrians, traffic signs) under adverse weather conditions (fog, rain, low-light) using a custom YOLO model (`rrp32.pt`).

The system uses a persistent Python subprocess architecture to execute inference on demand. By loading the model once upon server initialization, the Express.js server bypasses the model-loading overhead (1-3 seconds) on subsequent requests, yielding real-time latency.

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [System Requirements](#system-requirements)
- [Setup Instructions](#setup-instructions)
  - [1. Model Placement](#1-model-placement)
  - [2. Python Dependencies](#2-python-dependencies)
  - [3. Backend Setup](#3-backend-setup)
  - [4. Frontend Setup](#4-frontend-setup)
- [API Documentation](#api-documentation)
- [Troubleshooting & Support](#troubleshooting--support)

---

## 🏗️ Architecture Overview

```mermaid
graph TD
    Client[React + Vite Frontend] <-->|HTTP POST /predict| Express[Express.js Server]
    Express <-->|stdin (file paths) / stdout (JSON results)| Python[Persistent inference.py Subprocess]
    Python <-->|Inference| YOLO[YOLO Model: rrp32.pt]
```

1. **Frontend**: React application bundled using Vite, styled with Tailwind CSS, and using Lucide icons.
2. **Backend**: Express.js server exposing REST APIs. It uses Multer for managing temporary image uploads.
3. **Inference Bridge**: The backend spawns a persistent Python process running `inference.py` when it starts up.
   - When a prediction request is received, the backend writes the temporary file path to the Python process's `stdin`.
   - The Python script (which loaded `rrp32.pt` once during startup) reads the path, runs the detection, encodes the annotated image to Base64, and prints the result as JSON on `stdout`.
   - The backend reads `stdout`, parses the JSON, deletes the temporary upload file, and returns the payload to the frontend.

---

## 💻 System Requirements

Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher)
- **NPM** (v9 or higher)
- **Python** (v3.8 or higher, with `pip`)

---

## 🚀 Setup Instructions

### 1. Model Placement

Make sure the YOLO model file `rrp32.pt` is placed inside the `backend/python/` directory:
```
backend/python/rrp32.pt
```

### 2. Python Dependencies

Install the required Python packages for running YOLO and processing images:

```bash
pip install ultralytics opencv-python numpy pillow
```

### 3. Backend Setup

Open a terminal, navigate to the `backend` folder, install the Node dependencies, and start the server:

```bash
cd backend
npm install
npm start
```

> [!TIP]
> By default, the Express server runs on **http://localhost:4000**.
> To run in development mode with hot-reloading and nodemon, use: `npm run dev`.

### 4. Frontend Setup

Open another terminal window, navigate to the `frontend` folder, install the React packages, and start the Vite dev server:

```bash
cd frontend
npm install
npm run dev
```

> [!NOTE]
> The Vite dev server will run by default on **http://localhost:5173/**.

---

## 🔌 API Documentation

### **POST /api/predict**
Accepts a single image upload and returns YOLO inference results.

- **Request Type**: `multipart/form-data`
- **Body Parameter**: `image` (File, accepted extensions: `.jpg`, `.jpeg`, `.png`)
- **Success Response (200 OK)**:
  ```json
  {
    "annotated_image": "<base64_string>",
    "detections": [
      {
        "class": "Car",
        "confidence": 0.97
      },
      {
        "class": "Person",
        "confidence": 0.88
      }
    ]
  }
  ```
- **Error Response (400 / 500 / 503)**:
  ```json
  {
    "error": "YOLO model is still loading. Please wait a few seconds and try again."
  }
  ```

---

## 🔧 Troubleshooting & Support

- **Model is loading loop**: If you see a warning that the model is still loading, wait a few seconds. The persistent Python script takes around ~4-6 seconds to compile PyTorch, OpenCV, and load the 20MB `.pt` file.
- **Port Conflict**: If port `4000` is already in use, you can configure a different port by editing `PORT` inside the [backend .env](file:///c:/Users/DELL/OneDrive/Desktop/project2/backend/.env) configuration file.
