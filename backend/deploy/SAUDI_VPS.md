# Deploying the Sun Ray backend to a VPS in Saudi Arabia 🇸🇦

Puts the backend on a server **inside Saudi Arabia**, on `https://api.sunray.sa`,
with automatic TLS and nightly database backups.

Primary path: **LightNode, Riyadh**. Any Ubuntu 22.04/24.04 VPS works identically
from step 3 onward — see the appendix for Oracle Cloud.

> **Why Riyadh and not Jeddah?** LightNode's Jeddah location was **Sold Out** when
> we provisioned (2026-07-31). Riyadh II was available and is equivalent for our
> purposes: same country, same PDPL position, and the extra distance to Taif costs
> roughly 10 ms on an API call — irrelevant for ordering coffee. If you rebuild
> later and Jeddah is back in stock, nothing in this guide changes but the region
> you click.

Why in-Kingdom: customer phone numbers, addresses and order history are personal
data of Saudi residents. Keeping it in Saudi Arabia is the simplest path under
the **PDPL**, and it cuts latency for customers in Taif to a few milliseconds.

> **Still true from `DEPLOYMENT.md`:** the OTP is **mock** — any 4-digit code
> logs in as any phone number, so **anyone can log in as anyone**. Fine for a
> private demo, not fine for real customers. Wire a real SMS provider
> (Unifonic, Msegat, Twilio) before launch.

---

## What this costs

| Item | Cost |
|---|---|
| LightNode VPS, 2 vCPU / 4 GB / 50 GB, Riyadh | roughly 2× the $7.71 entry tier — the console Summary shows the exact figure |
| Domain `sunray.sa` | already yours |
| TLS certificate (Let's Encrypt via Caddy) | 0 |

Billing is hourly, so you can destroy and rebuild while experimenting and pay
only for the hours used. Expect a minimum account top-up (around $10) before you
can launch the first instance.

---

## Step 1 — Create the server

Sign up at <https://www.lightnode.com>, add funds, then **Create Instance**:

| Field | Value |
|---|---|
| Location | **Riyadh II, Saudi Arabia** (filter the list for "Saudi") |
| Image | **Ubuntu 24.04** |
| Plan | **2 vCPU / 4 GB / 50 GB** (2 GB is the workable minimum) |
| Hostname | `sunray-backend` |
| Auth | **SSH key** — not Password (see below) |
| Firewall group | leave empty — `provision.sh` configures `ufw` on the host |

**Take at least 2 GB of RAM.** 1 GB runs out of memory while compiling TypeScript
and building the Prisma engines on the first deploy. 4 GB gives comfortable
headroom for the build plus Postgres.

LightNode's dialog only accepts an **RSA** public key in OpenSSH `.pub` format,
so we generated a dedicated pair for it:

```powershell
ssh-keygen -t rsa -b 4096 -f "$env:USERPROFILE\.ssh\lightnode_rsa" -N '""' -C "sunray-lightnode"
```

Upload the **public** half — `C:\Users\smaji\.ssh\lightnode_rsa.pub`.

> ⚠️ Never upload `lightnode_rsa` (no extension). That's the private key; it
> never leaves your machine. Only the `.pub` file is meant to be shared.

**Use the SSH Key tab, not Password.** A public IP is found by automated scanners
within minutes of booting, and every one of them tries `root` with common
passwords. Key auth rejects all of them outright, because they hold no key.
LightNode also emails you the root password in plaintext — that's full access to
your customer database sitting in an inbox.

If you take a root password to get unstuck, that's recoverable — but add your key
and disable password auth immediately after (`provision.sh` in step 3 prints the
exact commands). Do not leave password auth on once real customer data exists.

Write down the **public IPv4 address** once the instance is running. The default
login user is **`root`**.

## Step 2 — Point `api.sunray.sa` at it

We're using the domain you already own, with the backend on the `api` subdomain,
leaving the bare `sunray.sa` free for a website later.

In whatever control panel manages `sunray.sa` DNS, add:

| Type | Name  | Value | TTL |
|------|-------|-------|-----|
| A    | `api` | `<your server IP>` | 300 |

Two things that catch people out:

- **If you use Cloudflare, set the proxy to OFF (grey cloud).** With the proxy
  on, Cloudflare answers the Let's Encrypt challenge instead of Caddy and
  certificate issuance fails.
- **`.sa` DNS can be slow to propagate.** Verify before starting the stack —
  Let's Encrypt allows only 5 certificate attempts per domain per week, so don't
  burn them on a name that isn't resolving yet:

```bash
dig +short api.sunray.sa      # must print your server IP
```

Only continue once that returns the right address.

## Step 3 — Provision the server

From your project folder in PowerShell:

```powershell
$IP  = "<your server IP>"
$KEY = "$env:USERPROFILE\.ssh\lightnode_rsa"

ssh -i $KEY root@$IP                            # accept the fingerprint once
scp -i $KEY backend\deploy\provision.sh root@${IP}:~
ssh -i $KEY root@$IP 'bash provision.sh'
```

It installs Docker, configures `ufw` (allowing 22, 80, 443), and enables
automatic security updates plus fail2ban. Read its final output — if it warns
that **password login is enabled**, follow the three commands it prints.

## Step 4 — Deploy the stack

```bash
ssh -i $KEY root@$IP
git clone https://github.com/Majed-2000/SunRay-App.git sunray
cd sunray/backend/deploy
```

Create the secrets file:

```bash
cp prod.env.example .env
nano .env
```

Set `DOMAIN=api.sunray.sa`, your `ACME_EMAIL`, and generate the two secrets:

```bash
openssl rand -base64 36 | tr -d '/+=' | cut -c1-40      # → POSTGRES_PASSWORD
openssl rand -base64 48 | tr '+/' '-_' | tr -d '='      # → JWT_ACCESS_SECRET
```

Start everything:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f
```

First build takes 3–6 minutes. Watch for Caddy logging `certificate obtained
successfully`.

## Step 5 — Seed the menu, once

`prisma db push` creates **empty** tables — menu and branch screens stay blank
until you seed.

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma db seed
```

> ⚠️ **Run this exactly once.** `seed.ts` calls `deleteMany` before inserting, so
> re-running it **wipes every real order and customer**. Never put it in the
> start command.

## Step 6 — Verify

```bash
curl https://api.sunray.sa/health         # {"ok":true,...}
curl https://api.sunray.sa/health/ready   # database reachable
curl -I http://api.sunray.sa              # expect 308 redirect → https://
```

## Step 7 — Point the app at it

Already done in this repo — `eas.json` (both profiles) and the root `.env` use
`https://api.sunray.sa`. To build the installable APK:

```bash
eas build --profile preview --platform android
```

For local dev, `npx expo start -c` (the `-c` clears the cache so the new env is
picked up).

No cold starts — unlike the Render free tier, this server is always on.

## Step 8 — Turn on backups

```bash
chmod +x ~/sunray/backend/deploy/backup.sh
mkdir -p ~/backups
crontab -e
```

Add (adjust the path if you didn't clone into `$HOME/sunray`):

```
15 3 * * * /root/sunray/backend/deploy/backup.sh >> /root/backups/backup.log 2>&1
```

Run it once by hand to confirm, then **test a restore** — commands are at the
bottom of `backup.sh`. An untested backup is not a backup.

---

## Day-to-day operations

```bash
cd ~/sunray/backend/deploy

# Deploy new code
git pull && docker compose -f docker-compose.prod.yml up -d --build

# Logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f caddy

# Restart / stop
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml down          # keeps the data volumes

# Database shell
docker compose -f docker-compose.prod.yml exec db psql -U sunray -d sunray

# Disk / memory
df -h && free -h
```

`down` preserves `pgdata` and `caddy_data`. **`down -v` deletes them** — that's
your database and your TLS certificates. Don't.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Connection times out | Firewall | `ufw status` on the host; check the provider's panel firewall too |
| Caddy: `could not get certificate` | DNS not resolving yet, or Cloudflare proxy on | `dig +short api.sunray.sa` must return your IP; set the cloud to grey |
| API restarts in a loop | Bad `DATABASE_URL` — usually special characters in the password | Regenerate `POSTGRES_PASSWORD` with the URL-safe command in step 4, then `down` + `up -d` |
| Menu and branches empty | Never seeded | Step 5 |
| Build killed / OOM | Under 2 GB RAM | Resize the plan, or add swap: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile` |
| `permission denied (publickey)` | Key not registered on the instance | Use the panel's console/VNC to add it to `~/.ssh/authorized_keys` |

## Before real customers

1. **Real OTP** — mock OTP means anyone can log into anyone's account.
2. **Real payments** — a PCI-compliant gateway, or default to pay-at-branch.
3. **Prisma migrations** — the container runs `db push` on every start. Move to
   `prisma migrate deploy` as a release step before the data matters.
4. **Offsite backups** — on-box dumps die with the box.
5. **Confirm PDPL obligations** with someone who knows the regulation. Hosting
   in Saudi Arabia is the foundation, not the whole compliance story.

---

## Appendix — Oracle Cloud (free, if you can get an account)

Oracle's Always Free tier gives a far bigger machine (up to 4 ARM cores / 24 GB)
at zero cost, in Jeddah (`me-jeddah-1`). The catch is signup: their payment
processor rejects most Saudi **mada and debit cards** as "prepaid, virtual or
single use". A Visa/Mastercard **credit** card usually clears it.

If you get in later, everything from step 3 onward is identical. Only these
differ:

- **Home region must be `Saudi Arabia West (Jeddah)`** — chosen at signup and
  **impossible to change afterwards**.
- Shape **VM.Standard.A1.Flex** (ARM), Ubuntu 24.04, 2 OCPU / 12 GB, and tick
  **assign a public IPv4 address**. Avoid the 1 GB AMD micro shape.
- `Out of host capacity` is common on free ARM — retry, or switch to Pay As You
  Go (still bills 0 inside the free allowances, and stops Oracle reclaiming idle
  instances).
- Oracle blocks inbound traffic in **two** places. Besides the host firewall,
  open TCP **80** and **443** from `0.0.0.0/0` in the VCN **Default Security
  List**, or nothing reaches the server. `provision.sh` handles the host side,
  including removing the pre-installed iptables rules Oracle's image ships with.
- The default login user is **`ubuntu`**, not `root`, and cron paths become
  `/home/ubuntu/...`.
