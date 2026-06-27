# Deploying the Express Backend to Hugging Face Spaces (Docker)

This guide walks you through deploying your Node.js Express backend and YOLO Python model to Hugging Face Spaces using the custom Docker configuration.

## Architecture

```
Vercel (React Frontend) ──(API Requests)──> Hugging Face Spaces (Express Backend + YOLO Model)
```

By packaging both Node.js and Python together in a Docker container, the entire backend runs on Hugging Face's free tier with **16 GB RAM**, solving the 512 MB memory crash issue on Render while keeping the backend written entirely in Express.

---

## Step 1: Create a Hugging Face Space

1. Log in to [Hugging Face](https://huggingface.co/). If you don't have an account, create one for free.
2. Click on your profile picture at the top right and select **New Space** (or go to [huggingface.co/new-space](https://huggingface.co/new-space)).
3. Configure your Space:
   * **Space Name**: Choose a name (e.g., `adverse-weather-yolo`).
   * **License**: Choose `apache-2.0` (or leave default).
   * **SDK**: Select **Docker** (Crucial).
   * **Docker Template**: Select **Blank**.
   * **Space Hardware**: Choose **CPU basic (2 vCPU, 16 GB RAM, Free)**.
   * **Space Visibility**: Select **Public** (so Vercel can make API requests to it).
4. Click **Create Space**.

---

## Step 2: Upload Backend Files to the Space

The easiest and most reliable way to upload the code and the large YOLO model (`rrp32.pt`) is via Git.

1. Clone your Hugging Face Space repository to your computer (replace `<your-username>` and `<your-space-name>` with your actual details):
   ```bash
   git clone https://huggingface.co/spaces/<your-username>/<your-space-name>
   ```
2. Copy the contents of your `backend` directory into the cloned Space repository folder. Your Space folder should look like this:
   ```
   <your-space-name>/
   ├── routes/
   │   └── predict.js
   ├── services/
   │   └── pythonService.js
   ├── python/
   │   ├── inference.py
   │   └── rrp32.pt
   ├── .gitignore
   ├── Dockerfile
   ├── package.json
   ├── package-lock.json
   └── requirements.txt
   ```
3. Commit and push the files to Hugging Face:
   ```bash
   git add .
   git commit -m "Deploy Express backend with YOLO"
   git push
   ```
   *Note: If prompted for credentials, use your Hugging Face username and your **Access Token** as the password (you can generate a Write token in Hugging Face under Settings -> Access Tokens).*

---

## Step 3: Verify the Backend is Running

1. Once pushed, Hugging Face will automatically start building the Docker container (this takes ~3-5 minutes on the first run).
2. Go to the Hugging Face Space webpage and monitor the logs.
3. When it is done, the status will show **Running**.
4. Test the health endpoint by opening this URL in your browser:
   ```
   https://<your-username>-<your-space-name>.hf.space/health
   ```
   *(Note: Replace `-` with `_` if your username or space name contains characters, but check the address bar on Hugging Face to get your exact direct URL. Hugging Face Space URLs are formatted as `https://<username>-<space-name>.hf.space`)*
5. You should see a JSON response confirming everything is healthy:
   ```json
   {
     "status": "healthy",
     "pythonServiceReady": true,
     "pythonLogs": [ ... ]
   }
   ```

---

## Step 4: Update Frontend (Vercel) Environment Variables

Now we need to tell your Vercel frontend to talk to Hugging Face instead of Render:

1. Log in to [Vercel](https://vercel.com/) and open your frontend project dashboard.
2. Go to **Settings** -> **Environment Variables**.
3. Locate the variable named `VITE_API_BASE` (or create it if it doesn't exist).
4. Update its value to point to your Hugging Face Space API URL:
   ```
   https://<your-username>-<your-space-name>.hf.space/api
   ```
   *Make sure `/api` is at the end of the URL, and do not add a trailing slash.*
5. Save the variable.
6. Go to the **Deployments** tab on Vercel, click on your latest deployment, and select **Redeploy** to apply the new environment variable.

---

## Step 5: Keep the Space Warm (Optional but Recommended)

Free Hugging Face Spaces automatically go to sleep after **48 hours** of inactivity. The next request after sleeping will trigger a cold start (~30–60 seconds) to build/start the container.

To prevent this:
1. Go to a free cron service like [cron-job.org](https://cron-job.org/) or [UptimeRobot](https://uptimerobot.com/).
2. Create a free HTTP pinger targetting:
   ```
   https://<your-username>-<your-space-name>.hf.space/health
   ```
3. Set the schedule to ping once every **12 hours** or **24 hours**. This keeps the Space active permanently for free.
