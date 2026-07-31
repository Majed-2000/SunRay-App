#!/usr/bin/env bash
#
# One-time server provisioning for Ubuntu 22.04/24.04. Installs Docker, opens
# the web ports, and turns on automatic security updates.
#
# Works whether your provider gives you root (LightNode, most VPS hosts) or a
# sudo user (Oracle Cloud's `ubuntu`, AWS's `ec2-user`).
#
# Usage — from your laptop:
#   scp provision.sh root@<SERVER_IP>:~
#   ssh root@<SERVER_IP> 'bash provision.sh'
#
# Safe to re-run.

set -euo pipefail

# Providers differ: some hand you root, some a sudo user. Detect once and use
# $SUDO everywhere, so the same script works on both (and doesn't require sudo
# to even be installed on minimal root-only images).
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

# Always set environment variables via `env`, never as a bare `$SUDO VAR=x cmd`
# prefix. Bash decides whether a word is an assignment prefix at PARSE time — so
# once $SUDO expands to nothing, `VAR=x` becomes the command name and you get
# "DEBIAN_FRONTEND=noninteractive: command not found". `env` works either way.

log() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

# ── 1. System packages ───────────────────────────────────────────────────────
log "Updating system packages"
$SUDO apt-get update -y
$SUDO env DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
$SUDO apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades

# ── 2. Firewall ──────────────────────────────────────────────────────────────
# Order matters: add the allow rules FIRST, then enable — so the SSH session
# you are running this in never drops.
log "Configuring the firewall (ufw)"
$SUDO ufw allow 22/tcp comment 'SSH'
$SUDO ufw allow 80/tcp comment 'HTTP - Let us Encrypt challenge + redirect'
$SUDO ufw allow 443/tcp comment 'HTTPS'

# Some images (notably Oracle Cloud's Ubuntu) ship pre-loaded iptables rules
# that drop everything except SSH. They silently override ufw and are the #1
# cause of "my site won't load" on those providers. Remove them if present.
if dpkg -l | grep -qE '^ii\s+(netfilter-persistent|iptables-persistent)'; then
  log "Removing the image's pre-installed iptables rules"
  $SUDO env DEBIAN_FRONTEND=noninteractive apt-get purge -y netfilter-persistent iptables-persistent
  $SUDO iptables -P INPUT ACCEPT
  $SUDO iptables -F INPUT
fi

$SUDO ufw --force enable
$SUDO ufw status verbose

# NOTE: ufw does NOT filter ports that Docker publishes — Docker writes its own
# iptables rules that bypass ufw's INPUT chain. That is fine here because the
# only published ports are Caddy's 80/443, which we want public anyway, and
# Postgres is deliberately not published at all.

# ── 3. Docker ────────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine + Compose plugin"
  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  $SUDO chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null

  $SUDO apt-get update -y
  $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

  # Only meaningful for a non-root user; root can already talk to the daemon.
  if [ -n "$SUDO" ]; then
    $SUDO usermod -aG docker "$USER"
    echo "Added $USER to the docker group — log out and back in for it to apply."
  fi
else
  log "Docker already installed ($(docker --version))"
fi

$SUDO systemctl enable --now docker

# ── 4. Automatic security updates ────────────────────────────────────────────
# You are running a public server holding customer phone numbers and addresses.
# Unattended security patching is not optional.
log "Enabling unattended security upgrades"
$SUDO env DEBIAN_FRONTEND=noninteractive dpkg-reconfigure -f noninteractive unattended-upgrades
$SUDO systemctl enable --now fail2ban

# ── 5. Verify SSH is key-only ────────────────────────────────────────────────
# Providers that hand you a root password (LightNode does, by default) leave
# password login ON — which means the whole internet can brute-force your root
# account. Once your SSH key works, turn it off.
log "SSH password authentication check"
if $SUDO sshd -T 2>/dev/null | grep -qi '^passwordauthentication yes'; then
  cat <<'WARN'
  ⚠  Password login is ENABLED — the internet can brute-force this server.
     Confirm your SSH KEY works first (open a second terminal and log in),
     then disable passwords:

       sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
       rm -f /etc/ssh/sshd_config.d/*cloud-init* 2>/dev/null || true
       systemctl restart ssh

WARN
else
  echo "  ✓ Key-only login (password auth disabled)"
fi

log "Provisioning complete"
cat <<EOF

Next steps:
  1. Upload the project, create deploy/.env, then:
       cd \$HOME/sunray/backend/deploy
       docker compose -f docker-compose.prod.yml up -d --build
  2. Full walkthrough: backend/deploy/JEDDAH_VPS.md

EOF
