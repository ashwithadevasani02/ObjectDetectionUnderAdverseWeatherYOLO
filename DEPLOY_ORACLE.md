# Deploying the backend on Oracle Cloud "Always Free" (detailed, click-by-click)

This backend is an **Express server that spawns a Python/YOLO child process**. At
peak it needs ~570 MB RAM, which is more than Render's 512 MB free tier — that's
why it crash-loops with "model is still loading" on Render. Oracle Cloud's
**Always Free** Ampere A1 VM gives you up to **4 CPUs / 24 GB RAM, running 24/7
with no sleep, for free**. That removes the memory problem completely.

Your frontend on Vercel is served over **HTTPS**. A browser will **block** an
HTTPS page from calling a plain `http://` API ("mixed content"). So the backend
must also be HTTPS. These steps set that up for free using DuckDNS (free domain) +
Caddy (automatic Let's Encrypt certificate).

Total time: ~45–60 minutes the first time. You can copy-paste almost everything.

Throughout this guide, replace these placeholders:
- `<PUBLIC_IP>` — your VM's public IP (you get it in Part 2).
- `<SUBDOMAIN>` — your DuckDNS name, e.g. `myyolo` (you create it in Part 8).

---

## Part 1 — Create an Oracle Cloud account

1. Open https://www.oracle.com/cloud/free/ and click **Start for free**.
2. Enter your email, country, and verify the email.
3. Fill in your details. You **must** add a credit/debit card for identity
   verification. Oracle places a small temporary hold (~$1) and refunds it.
   **Always Free** resources are never charged.
4. Choose a **Home Region** close to you/your users. ⚠️ You **cannot change this
   later**, and your free VM lives in this region.
5. Finish signup and wait for the email that says your account is ready (can take
   a few minutes). Then sign in at https://cloud.oracle.com.

> Optional safety net: after signup, top-left menu → **Billing & Cost Management
> → Upgrade and Manage Payment** and confirm the account stays on the free model
> so you're never accidentally charged.

---

## Part 2 — Create the VM (Ampere A1, Ubuntu)

1. In the console, click the **hamburger menu (☰)** top-left →
   **Compute → Instances**.
2. Make sure the **Compartment** dropdown on the left is set to your root
   compartment (usually your account name). Click **Create instance**.
3. **Name:** type something like `yolo-backend`.
4. **Placement:** leave the default availability domain.
5. **Image and shape** → click **Edit**:
   - Click **Change image** → select **Canonical Ubuntu** → pick **22.04** →
     **Select image**.
   - Click **Change shape** → tab **Ampere** → select
     **`VM.Standard.A1.Flex`** → set **Number of OCPUs = 2** and **Amount of
     memory (GB) = 12** → **Select shape**.
     (Always Free allows up to 4 OCPU / 24 GB total across A1 instances; 2/12 is
     plenty and leaves headroom.)
6. **Networking** → leave **Create new virtual cloud network** selected, and make
   sure **Assign a public IPv4 address = Yes** (it is by default).
7. **Add SSH keys:**
   - Select **Generate a key pair for me**.
   - Click **Save private key** and **Save public key** — download **both**.
   - Move the private key somewhere safe, e.g. on your laptop:
     `~/.ssh/oracle_key` (Windows: `C:\Users\<you>\.ssh\oracle_key`).
8. Click **Create**. Wait until the instance tile turns **green / "Running"**.
9. On the instance details page, copy the **Public IP address** — this is your
   `<PUBLIC_IP>`.

> If you see **"Out of host capacity"** for A1: switch the Availability Domain
> (AD-1/AD-2/AD-3) in the Placement section and try again, or retry in a few
> hours. A1 capacity is popular and frees up regularly.

---

## Part 3 — Open the firewall (TWO layers — both required)

Oracle blocks inbound traffic in two independent places. If you skip either,
the internet can't reach your backend.

### 3a. Cloud firewall (Security List)

1. On the instance details page, under **Primary VNIC**, click the
   **Subnet** link.
2. On the subnet page, under **Security Lists**, click the **Default Security
   List for ...**.
3. Click **Add Ingress Rules** and add these two rules (click "+ Another Ingress
   Rule" to add the second):

   | Stateless | Source Type | Source CIDR | IP Protocol | Destination Port Range |
   |-----------|-------------|-------------|-------------|------------------------|
   | unchecked | CIDR        | `0.0.0.0/0` | TCP         | `80`                   |
   | unchecked | CIDR        | `0.0.0.0/0` | TCP         | `443`                  |

4. Click **Add Ingress Rules** to save.

(Ports 80 and 443 are all you need — Caddy will listen on 443 for HTTPS and 80 for
the certificate challenge. You do **not** need to expose 4000 publicly.)

### 3b. OS firewall (do this after you SSH in, Part 4)

Ubuntu on Oracle ships with strict iptables rules. After connecting (Part 4), run:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## Part 4 — Connect to the VM over SSH

**On macOS / Linux (Terminal):**
```bash
chmod 600 ~/.ssh/oracle_key
ssh -i ~/.ssh/oracle_key ubuntu@<PUBLIC_IP>
```
Type `yes` when asked to trust the host the first time.

**On Windows:** use PowerShell with the same `ssh -i ...` command, or use PuTTY
(convert the key with PuTTYgen first). The default username is **`ubuntu`**.

If it hangs/refuses: re-check that the instance is Running and that you used the
correct public IP and the **private** key file.

Now run the **Part 3b** iptables commands above before continuing.

---

## Part 5 — Install Node.js, Python, Git, and system libraries

Run these one block at a time on the VM:

```bash
# Update the system
sudo apt-get update && sudo apt-get upgrade -y
```
```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```
```bash
# Python, Git, and the native libraries OpenCV/YOLO need at runtime
sudo apt-get install -y python3 python3-venv python3-pip git libgl1 libglib2.0-0
```
```bash
# Verify versions (Node should be v20.x, Python 3.10+)
node -v && npm -v && python3 --version
```

---

## Part 6 — Get the code and install dependencies

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
# Python virtual environment + dependencies (CPU-only torch, from requirements.txt)
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
```
The torch install is large and may take several minutes — that's normal. On
Ampere (ARM/aarch64), pip automatically downloads the matching ARM wheels for
torch, opencv, and ultralytics, so no changes are needed.

**Quick sanity check that the model loads** (optional but recommended):
```bash
PYTHON_PATH=$PWD/.venv/bin/python node server.js
```
Wait ~30–60 s, then in a **second SSH session** run
`curl http://localhost:4000/health` — it should report the model ready. Press
**Ctrl+C** in the first session to stop, then continue to Part 7 to run it
properly as a background service.

---

## Part 7 — Keep the backend running 24/7 with pm2

pm2 restarts the app if it crashes and starts it automatically on reboot.

```bash
sudo npm install -g pm2
cd ~/ObjectDetectionUnderAdverseWeatherYOLO/backend
```
```bash
# Start the backend, telling it which Python to use for the YOLO child
PYTHON_PATH=$PWD/.venv/bin/python pm2 start server.js --name yolo-backend
```
```bash
# Persist the process list and enable start-on-boot
pm2 save
pm2 startup
```
`pm2 startup` prints a `sudo env ... systemctl enable ...` command — **copy that
exact line and run it**, then run `pm2 save` once more.

Verify it's healthy (give the model up to a minute the first time):
```bash
pm2 status                 # yolo-backend should be "online"
curl http://localhost:4000/health
pm2 logs yolo-backend      # watch logs; Ctrl+C to exit the log view
```

---

## Part 8 — Free domain + HTTPS (DuckDNS + Caddy)

### 8a. Create a free subdomain

1. Go to https://www.duckdns.org and sign in (Google/GitHub).
2. In the **domains** box type a name, e.g. `myyolo`, click **add domain**. Your
   domain is now `myyolo.duckdns.org` (this is `<SUBDOMAIN>.duckdns.org`).
3. In the **current ip** field for that domain, enter your VM's `<PUBLIC_IP>` and
   click **update ip**.
4. Confirm it resolves (run on the VM): `ping -c1 <SUBDOMAIN>.duckdns.org` should
   show your `<PUBLIC_IP>`.

### 8b. Install Caddy (automatic HTTPS reverse proxy)

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

### 8c. Point Caddy at your backend

Replace `<SUBDOMAIN>` below, then run the whole block:
```bash
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
<SUBDOMAIN>.duckdns.org {
    reverse_proxy localhost:4000
}
EOF
sudo systemctl restart caddy
```
Caddy now automatically gets a Let's Encrypt certificate (takes ~30 s the first
time). Check status if needed: `sudo systemctl status caddy`.

### 8d. Test HTTPS from your own computer

Open in a browser or curl from your laptop:
```
https://<SUBDOMAIN>.duckdns.org/health
```
You should get JSON over HTTPS with a valid padlock. If so, the backend is live.

---

## Part 9 — Point the Vercel frontend at the new backend

1. Go to https://vercel.com → your project → **Settings → Environment
   Variables**.
2. Edit (or add) `VITE_API_BASE` and set it to:
   ```
   https://<SUBDOMAIN>.duckdns.org/api
   ```
   Apply it to **Production** (and Preview if you use it).
3. Go to the **Deployments** tab → open the latest → **⋯ → Redeploy** (Vite reads
   env vars at build time, so a redeploy is required).
4. Open your live frontend and run a prediction — it now hits the Oracle backend.

---

## Updating the backend later

```bash
ssh -i ~/.ssh/oracle_key ubuntu@<PUBLIC_IP>
cd ~/ObjectDetectionUnderAdverseWeatherYOLO
git pull
cd backend
npm install
.venv/bin/pip install -r requirements.txt
pm2 restart yolo-backend
```

---

## Troubleshooting

- **`/health` never becomes ready:** `pm2 logs yolo-backend`. With 12 GB RAM you
  won't hit the Render OOM. If you see a Python import error, re-run
  `.venv/bin/pip install -r requirements.txt` and confirm `libgl1 libglib2.0-0`
  are installed.
- **Browser console shows "Mixed Content" or CORS:** you're calling `http://`
  from an HTTPS page, or the domain/cert isn't set up. First confirm
  `https://<SUBDOMAIN>.duckdns.org/health` loads directly. The backend already
  allows all origins (`app.use(cors())`), so it's almost always the HTTPS piece.
- **Can't reach the site from the internet but `curl localhost:4000/health`
  works on the VM:** you missed one of the two firewall layers in Part 3
  (Security List rule **and** the iptables commands).
- **Caddy won't get a certificate:** make sure DuckDNS points at the correct
  `<PUBLIC_IP>`, ports 80 and 443 are open in both firewalls, and nothing else is
  using port 80.
- **App stopped after a reboot:** run `pm2 resurrect`, and make sure you ran the
  `pm2 startup` command it printed earlier.
