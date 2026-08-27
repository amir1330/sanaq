#!/usr/bin/env bash
# Provision a restricted deploy key for GitHub Actions (run on your laptop).
# - Creates sanaq on the VPS (docker group, app dir)
# - Installs forced-command authorized_keys entry (sync-deploy / deploy only)
# - Sets GitHub secrets HOST / USERNAME / SSH_KEY
# Idempotent: replaces previous github-actions-sanaq keys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${GITHUB_REPO:-amir1330/sanaq}"
VPS="${DEPLOY_HOST:-root@89.167.79.221}"
HOST_ONLY="${DEPLOY_IP:-89.167.79.221}"
USER_NAME=sanaq
KEY_COMMENT="github-actions-sanaq"
ENTRY="/home/${USER_NAME}/bin/ci-entry.sh"
SSH=(ssh -F /dev/null -o BatchMode=yes)

if ! command -v gh >/dev/null; then
  echo "gh CLI required" >&2
  exit 1
fi
if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "gh is not authenticated for github.com" >&2
  exit 1
fi

echo "==> Bootstrap VPS user/app dir"
"${SSH[@]}" "$VPS" "sh -s" < "$ROOT/deploy/bootstrap-vps.sh"

echo "==> Upload ci-entry.sh"
"${SSH[@]}" "$VPS" "cat > '$ENTRY' && chmod 755 '$ENTRY' && chown $USER_NAME:$USER_NAME '$ENTRY'" < "$ROOT/deploy/ci-entry.sh"

KEYDIR=$(mktemp -d)
trap 'rm -rf "$KEYDIR"' EXIT
ssh-keygen -t ed25519 -N "" -C "$KEY_COMMENT" -f "$KEYDIR/id_ed25519" >/dev/null
PUB=$(cat "$KEYDIR/id_ed25519.pub")
# forced command + no forwarding
AUTH_LINE="command=\"$ENTRY\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty $PUB"

echo "==> Install restricted authorized_keys (replace old $KEY_COMMENT entries)"
"${SSH[@]}" "$VPS" bash -s <<EOF
set -euo pipefail
AK=/home/$USER_NAME/.ssh/authorized_keys
touch "\$AK"
grep -v "$KEY_COMMENT" "\$AK" > "\$AK.tmp" || true
printf '%s\n' '$AUTH_LINE' >> "\$AK.tmp"
mv "\$AK.tmp" "\$AK"
chmod 600 "\$AK"
chown -R $USER_NAME:$USER_NAME /home/$USER_NAME/.ssh
# Remove the old unrestricted root CI key with the same comment.
if [ -f /root/.ssh/authorized_keys ]; then
  grep -v "$KEY_COMMENT" /root/.ssh/authorized_keys > /root/.ssh/authorized_keys.tmp || true
  mv /root/.ssh/authorized_keys.tmp /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys
fi
EOF

echo "==> Smoke-test forced command (expect deploy error without GHCR token is ok / or forbidden without sync)"
# Plain ssh should hit forced command with empty ORIGINAL_COMMAND → deploy → missing token
if ssh -F /dev/null -i "$KEYDIR/id_ed25519" -o IdentitiesOnly=yes -o BatchMode=yes \
  -o UserKnownHostsFile="$ROOT/.github/known_hosts" -o StrictHostKeyChecking=yes \
  "${USER_NAME}@${HOST_ONLY}" true 2>/dev/null; then
  echo "WARNING: unrestricted shell works — forced command may be wrong" >&2
else
  echo "forced-command active (shell denied) — good"
fi

echo "==> Set GitHub secrets on $REPO"
printf '%s' "$HOST_ONLY" | gh secret set HOST -R "$REPO"
printf '%s' "$USER_NAME" | gh secret set USERNAME -R "$REPO"
gh secret set SSH_KEY -R "$REPO" < "$KEYDIR/id_ed25519"

echo "Done."
echo "Secrets set: HOST=$HOST_ONLY USERNAME=$USER_NAME SSH_KEY=<ed25519>"
echo "Push to main (or re-run CI) to deploy."
