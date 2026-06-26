# Deploying the backend on Oracle Cloud "Always Free"

This backend (Express + a Python/YOLO child process) needs ~570 MB RAM at peak,
which exceeds Render's 512 MB free tier. Oracle Cloud's **Always Free** Ampere A1
VM gives you up to **4 cores / 24 GB RAM for free, 24/7, with no sleep**, which is
more than enough.

Your Vercel frontend is served over **HTTPS**, so the backend must also be served
over HTTPS (browsers block HTTPS pages from calling plain `http://` APIs). These
steps include free HTTPS via DuckDNS + Caddy.

---

## 1. Create an Oracle Cloud account

1. Go to https://www.oracle.com/cloud/free/ and sign up.
2. A credit card is required for identity verification, but **Always Free**
   resources are never charged. (Optional: after setup, in *Billing* you can set
   the account to never upgrade to paid.)
3. Pick a home region close to your users (you can't change it later).

## 2. Create the VM (Always Free, Ampere A1)

1. Console → **Menu → Compute → Instances → Create instance**.
2. **Image and shape → Change shape → Ampere → `VM.Standard.A1.Flex`**.
   - Set **2 OCPUs** and **12 GB memory** (well within the free 4 OCPU / 24 GB).
3. **Image:** Canonical **Ubuntu 22.04**.
4. **Networking:** keep "Create new VCN" (it makes a public subnet) and ensure
   **"Assign a public IPv4 address"** is checked.
5. **SSH keys:** "Generate a key pair for me" → **download both keys**. Keep the
   private key safe (e.g. `~/.ssh/oracle_key`).
6. Click **Create** and wait until the instance is **Running**. Note its
   **Public IP address**.

> If Ampere capacity is "out of host capacity" in your region, retry later or pick
> another availability domain — A1 capacity frees up regularly.

## 3. Open the firewall (two layers!)

Oracle blocks ports in **two** places — you must open both.

**a) Security List (cloud firewall):**
- Console → your instance → **Virtual Cloud Network** → **Security Lists** →
  default security list → **Add Ingress Rules**:
  - Source `0.0.0.0/0`, IP Protocol **TCP**, Destination port **80**
  - Source `0.0.0.0/0`, IP Protocol **TCP**, Destination port **443**

**b) OS firewall (run on the VM after you SSH in, step 4):**
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 4. SSH into the VM

```bash
chmod 600 ~/.ssh/oracle_key
ssh -i ~/.ssh/oracle_key ubuntu@<YOUR_PUBLIC_IP>
```

## 5. Install Node, Python, and Git

```bash
sudo apt-get update && sudo apt-get upgrade -y
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs python3 python3-venv python3-pip git
# Native libs OpenCV needs
sudo apt-get install -y libgl1 libglib2.0-0
node -v && python3 --version
```

## 6. Clone the repo and install dependencies

```bash
cd ~
git clone https://github.com/ashwithadevasani02/ObjectDetectionUnderAdverseWeatherYOLO.git
cd ObjectDetectionUnderAdverseWeatherYOLO/backend

# Node deps
npm install

# Python venv with CPU-only torch (from requirements.txt)
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
```

## 7. Run it persistently with pm2 (auto-restart + start on boot)

```bash
sudo npm install -g pm2
cd ~/ObjectDetectionUnderAdverseWeatherYOLO/backend

# Tell the backend to use the venv's Python for the YOLO child
PYTHON_PATH=$PWD/.venv/bin/python pm2 start server.js --name yolo-backend

pm2 save
pm2 startup        # run the command it prints (sets up boot service)
```

Check it's healthy:
```bash
curl http://localhost:4000/health      # wait until it shows the model is ready
```

## 8. Free HTTPS (DuckDNS + Caddy)

Your Vercel frontend is HTTPS, so it needs an HTTPS backend with a real domain.
DuckDNS gives a free subdomain; Caddy auto-provisions a Let's Encrypt cert.

1. Go to https://www.duckdns.org, sign in, create a subdomain (e.g.
   `myyolo.duckdns.org`) and point it to your VM's **public IP**.
2. Install Caddy on the VM:
   ```bash
   sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt-get update && sudo apt-get install -y caddy
   ```
3. Configure Caddy to reverse-proxy your domain to port 4000:
   ```bash
   sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
   myyolo.duckdns.org {
       reverse_proxy localhost:4000
   }
   EOF
   sudo systemctl restart caddy
   ```
4. Test (from your laptop): `https://myyolo.duckdns.org/health` should return JSON
   over HTTPS.

## 9. Point the frontend at the new backend

In Vercel → your project → **Settings → Environment Variables**, set:
```
VITE_API_BASE = https://myyolo.duckdns.org/api
```
Then **redeploy** the frontend. Done — your app now talks to the Oracle backend.

---

## Updating the backend later

```bash
ssh -i ~/.ssh/oracle_key ubuntu@<YOUR_PUBLIC_IP>
cd ~/ObjectDetectionUnderAdverseWeatherYOLO
git pull
cd backend && npm install && .venv/bin/pip install -r requirements.txt
pm2 restart yolo-backend
```

## Troubleshooting

- **`/health` never ready:** check logs with `pm2 logs yolo-backend`. On the A1
  shape with 12 GB RAM you will not hit the OOM you saw on Render.
- **Frontend can't reach backend / CORS:** the backend already allows all origins
  (`app.use(cors())`), so it's almost always the HTTPS/domain piece — confirm
  `https://<your-domain>/health` works directly in a browser first.
- **Connection refused from the internet:** you missed one of the two firewall
  layers in step 3 (Security List *and* iptables).
