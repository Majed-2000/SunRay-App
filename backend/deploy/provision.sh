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
#
# Several VPS providers (LightNode among them) ship images with apt's automatic
# updates disabled THREE separate ways: the timers masked, the services they
# trigger masked (symlinked to /dev/null), and APT::Periodic::* set to "0".
# dpkg-reconfigure alone does not undo any of that, so undo all three explicitly.
log "Enabling unattended security upgrades"
$SUDO systemctl unmask apt-daily.timer apt-daily-upgrade.timer >/dev/null 2>&1 || true
$SUDO systemctl unmask apt-daily.service apt-daily-upgrade.service unattended-upgrades.service >/dev/null 2>&1 || true
$SUDO systemctl daemon-reload

$SUDO tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

$SUDO systemctl enable --now unattended-upgrades.service >/dev/null 2>&1 || true
$SUDO systemctl enable --now apt-daily.timer apt-daily-upgrade.timer >/dev/null 2>&1 || true

# Verify rather than assume — this is exactly the kind of step that silently
# does nothing and leaves you unpatched for months.
if $SUDO systemctl is-active apt-daily-upgrade.timer >/dev/null 2>&1; then
  echo "  ✓ automatic security updates active"
else
  echo "  ⚠ apt-daily-upgrade.timer is NOT running — patch this manually:"
  echo "     systemctl unmask apt-daily-upgrade.service apt-daily-upgrade.timer"
  echo "     systemctl enable --now apt-daily-upgrade.timer"
fi

$SUDO systemctl enable --now fail2ban >/dev/null 2>&1 || true

# ── 5. Enforce key-only SSH ──────────────────────────────────────────────────
# Providers that hand you a root password (LightNode does, by default) leave
# password login ON — the whole internet can then brute-force your root account.
#
# NOTE: `sshd -T` can fail transiently (e.g. openssh is mid-upgrade from step 1).
# An earlier version of this script piped it to grep with stderr discarded, so a
# FAILED probe produced no output, matched nothing, and cheerfully reported
# "key-only" on a box that accepted passwords. Never infer "secure" from the
# absence of output — check the command actually succeeded.
log "Enforcing key-only SSH"
SSHD_OUT="$($SUDO sshd -T 2>/dev/null)" && SSHD_OK=1 || SSHD_OK=0

if [ "$SSHD_OK" -ne 1 ]; then
  echo "  ⚠ could not read sshd config (sshd -T failed) — check manually:"
  echo "     sshd -T | grep -i passwordauthentication"
elif echo "$SSHD_OUT" | grep -qi '^passwordauthentication yes'; then
  # Only safe to disable passwords if a key is actually installed — otherwise
  # we would lock the user out of their own server.
  KEYFILE="$HOME/.ssh/authorized_keys"
  if [ -s "$KEYFILE" ]; then
    echo "  → password auth is ON and an authorized key exists; disabling passwords"
    # Both files matter: the cloud-init drop-in overrides the main config.
    $SUDO sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
    for f in /etc/ssh/sshd_config.d/*.conf; do
      [ -e "$f" ] && $SUDO sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$f"
    done
    # Validate BEFORE restarting — a bad config means no more SSH, ever.
    if $SUDO sshd -t; then
      $SUDO systemctl restart ssh
      echo "  ✓ $($SUDO sshd -T | grep -i '^passwordauthentication')"
    else
      echo "  ⚠ sshd config invalid after edit — NOT restarting. Fix before disconnecting."
    fi
  else
    echo "  ⚠ password auth is ON but no authorized_keys found — refusing to disable"
    echo "     (that would lock you out). Install your key, then re-run this script."
  fi
else
  echo "  ✓ Key-only login (password auth disabled)"
fi

log "Provisioning complete"
cat <<EOF

Next steps:
  1. Upload the project, create deploy/.env, then:
       cd \$HOME/sunray/backend/deploy
       docker compose -f docker-compose.prod.yml up -d --build
  2. Full walkthrough: backend/deploy/SAUDI_VPS.md

EOF
