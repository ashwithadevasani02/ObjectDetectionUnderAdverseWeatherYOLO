# Deploying the backend on Azure for Students (no credit card)

This backend is an **Express server that spawns a Python/YOLO child process** and
needs ~570 MB RAM at peak — more than Render's 512 MB free tier, which is why it
crash-loops with "model is still loading" on Render.

**Azure for Students** gives you **$100 of credit with NO credit card** (verified
with a school/university email). That's enough to run a small always-on Linux VM
for months, with no OOM and no sleep.

Your Vercel frontend is HTTPS, and a browser **blocks** an HTTPS page from calling
a plain `http://` API ("mixed content"). So the backend must be HTTPS too — this
guide sets that up for free with DuckDNS (free domain) + Caddy (automatic Let's
Encrypt certificate).

Total time: ~45–60 minutes the first time. Almost everything is copy-paste.

Placeholders to replace as you go:
- `<PUBLIC_IP>` — your VM's public IP (Part 2).
- `<SUBDOMAIN>` — your DuckDNS name, e.g. `myyolo` (Part 7).

---

## Cost / credit reality (read this first)

- Azure for Students = **$100 credit, valid 12 months, no card**. Renewable while
  you're still a student.
- Recommended VM size **B2s** (2 vCPU / 4 GB RAM) ≈ **$30/mo** → credit lasts
  ~3 months. To stretch it, use **B1ms** (1 vCPU / 2 GB) ≈ **$15/mo** → ~6 months.
  2 GB is enough for this backend (~570 MB peak + OS).
- You are **never charged to a card** — when the credit runs out, Azure just stops
  the resources. No surprise bills.
- To save credit when you don't need the app, you can **Stop (deallocate)** the VM
  in the portal — billing for compute pauses while it's stopped. (For an
  always-on demo, leave it running.)

---

## Part 1 — Create your Azure for Students account

1. Go to https://azure.microsoft.com/free/students/ and click **Start free**.
2. Sign in with your **school/university email** (or create a Microsoft account
   using it). Azure verifies student status from the email/institution.
3. Complete the phone verification. **No credit card is requested** for the
   student offer.
4. When done you land on the **Azure Portal**: https://portal.azure.com

---

## Part 2 — Create the VM (Ubuntu)

1. In the portal search bar type **Virtual machines** → open it → **+ Create →
   Azure virtual machine**.
2. **Basics tab:**
   - **Subscription:** Azure for Students. **Resource group:** click *Create new*,
     name it `yolo-rg`.
   - **Virtual machine name:** `yolo-backend`.
   - **Region:** pick one close to you (e.g. Central India / East US).
   - **Image:** **Ubuntu Server 22.04 LTS - x64 Gen2**.
   - **Size:** click *See all sizes* → choose **B2s** (2 vCPU, 4 GB) — or **B1ms**
     (1 vCPU, 2 GB) to save credit.
   - **Authentication type:** **SSH public key**.
   - **Username:** leave `azureuser`.
   - **SSH public key source:** **Generate new key pair**, key name
     `yolo-key`.
   - **Inbound port rules → Select inbound ports:** check **HTTP (80)**,
     **HTTPS (443)**, and **SSH (22)**.
3. Click **Review + create → Create**.
4. A popup appears: **Download private key and create resource** — click it and
   **save the `yolo-key.pem` file** (e.g. to `~/.ssh/yolo-key.pem`). You only get
   it once.
5. When deployment finishes, click **Go to resource** and copy the
   **Public IP address** → this is your `<PUBLIC_IP>`.

> Azure's Ubuntu images do **not** have a restrictive OS firewall, so unlike
> Oracle you only configure the cloud firewall (the NSG, done in Part 3).

---

## Part 3 — Confirm/open the firewall (NSG)

If you checked HTTP + HTTPS + SSH during creation, ports 80/443/22 are already
open. To verify or add them:

1. In the portal, open your VM → left menu **Networking → Network settings**.
2. Under **Inbound port rules**, confirm rules allowing **22**, **80**, and
   **443** (TCP, source `Any`). If 80 or 443 is missing, click **Create port
   rule → Inbound**, set **Destination port ranges = 80** (then again for 443),
   Protocol **TCP**, Action **Allow**, and save.

---

## Part 4 — Connect over SSH

**macOS / Linux:**
```bash
chmod 600 ~/.ssh/yolo-key.pem
ssh -i ~/.ssh/yolo-key.pem azureuser@<PUBLIC_IP>
```
Type `yes` to trust the host the first time.

**Windows:** run the same `ssh -i ...` command in PowerShell (the username is
`azureuser`).

If it refuses: confirm the VM is **Running**, the IP is correct, and you're using
the `.pem` **private** key.

---

## Part 5 — Install Node.js, Python, Git, and system libraries

Run one block at a time on the VM:

```bash
sudo apt-get update && sudo apt-get upgrade -y
```
```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```
```bash
# Python, Git, and native libs OpenCV/YOLO need at runtime
sudo apt-get install -y python3 python3-venv python3-pip git libgl1 libglib2.0-0
```
```bash
node -v && npm -v && python3 --version   # expect Node v20.x, Python 3.10+
```

---

## Part 6 — Get the code, install deps, and run it with pm2

```bash
cd ~
git clone https://github.com/ashwithadevasani02/ObjectDetectionUnderAdverseWeatherYOLO.git
cd ObjectDetectionUnderAdverseWeatherYOLO/backend
```
```bash
# Node dependencies
npm install
```
```bash
# Python virtual environment + CPU-only torch (from requirements.txt)
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
```
The torch download is large and may take a few minutes — that's normal.

```bash
# Keep it running 24/7 (auto-restart + start on boot)
sudo npm install -g pm2
PYTHON_PATH=$PWD/.venv/bin/python pm2 start server.js --name yolo-backend
pm2 save
pm2 startup     # then copy-paste and run the exact "sudo env ... systemctl ..." line it prints
pm2 save
```
Verify (give the model up to a minute on first load):
```bash
pm2 status
curl http://localhost:4000/health
pm2 logs yolo-backend     # Ctrl+C to exit the log view
```

---

## Part 7 — Free domain + HTTPS (DuckDNS + Caddy)

### 7a. Free subdomain
1. Go to https://www.duckdns.org, sign in, type a name (e.g. `myyolo`), click
   **add domain** → you now own `<SUBDOMAIN>.duckdns.org`.
2. In that domain's **current ip** field enter your `<PUBLIC_IP>` → **update ip**.
3. On the VM, confirm: `ping -c1 <SUBDOMAIN>.duckdns.org` shows your `<PUBLIC_IP>`.

### 7b. Install Caddy
```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

### 7c. Reverse-proxy your domain to the backend
Replace `<SUBDOMAIN>`, then run the whole block:
```bash
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
<SUBDOMAIN>.duckdns.org {
    reverse_proxy localhost:4000
}
EOF
sudo systemctl restart caddy
```
Caddy fetches a Let's Encrypt cert automatically (~30 s the first time).

### 7d. Test from your own computer
Open `https://<SUBDOMAIN>.duckdns.org/health` — you should get JSON over HTTPS with
a valid padlock.

---

## Part 8 — Point the Vercel frontend at the new backend

1. Vercel → your project → **Settings → Environment Variables**.
2. Set `VITE_API_BASE = https://<SUBDOMAIN>.duckdns.org/api` (Production).
3. **Deployments → latest → ⋯ → Redeploy** (Vite bakes env vars at build time).
4. Open your live frontend and run a prediction — it now hits the Azure backend.

---

## Updating the backend later

```bash
ssh -i ~/.ssh/yolo-key.pem azureuser@<PUBLIC_IP>
cd ~/ObjectDetectionUnderAdverseWeatherYOLO
git pull
cd backend && npm install && .venv/bin/pip install -r requirements.txt
pm2 restart yolo-backend
```

---

## Troubleshooting

- **`/health` never ready:** `pm2 logs yolo-backend`. On B1ms/B2s you won't hit
  the Render OOM. Python import errors → re-run the pip install and confirm
  `libgl1 libglib2.0-0` are installed.
- **"Mixed Content" / CORS in the browser console:** first confirm
  `https://<SUBDOMAIN>.duckdns.org/health` loads directly. The backend already
  allows all origins (`app.use(cors())`), so it's almost always the HTTPS/domain
  piece.
- **Can't reach from the internet but `curl localhost:4000/health` works on the
  VM:** the NSG (Part 3) is missing the 80/443 rule.
- **Caddy cert fails:** DuckDNS must point at the correct IP and ports 80+443 must
  be open in the NSG.
- **App gone after a reboot:** make sure you ran the `pm2 startup` line it printed,
  then `pm2 save`.
- **Saving credit:** Stop (deallocate) the VM in the portal when you don't need it
  — compute billing pauses while it's stopped.
