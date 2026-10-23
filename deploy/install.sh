#!/usr/bin/env bash
# ติดตั้งบน Debian 13 (รันด้วย root หรือ sudo จากโฟลเดอร์โปรเจกต์)
#   sudo bash deploy/install.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_USER="${APP_USER:-strata}"

echo "==> แพ็กเกจระบบ + ฟอนต์ไทย"
apt-get update
apt-get install -y curl ca-certificates fonts-thai-tlwg fonts-noto-core fonts-dejavu-core

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo "==> Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> ผู้ใช้ระบบ ${APP_USER}"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> npm install + Chromium (สำหรับแปลง HTML เป็นภาพ)"
cd "$APP_DIR"
sudo -u "$APP_USER" npm ci --omit=dev
npx playwright install-deps chromium
sudo -u "$APP_USER" env PLAYWRIGHT_BROWSERS_PATH="$APP_DIR/.browsers" npx playwright install chromium

[ -f .env ] || { cp .env.example .env; chown "$APP_USER:$APP_USER" .env; chmod 600 .env; echo "!! แก้ค่าใน $APP_DIR/.env ก่อนเปิดใช้"; }
[ -f config/groups.yaml ] || { cp config/groups.example.yaml config/groups.yaml; chown "$APP_USER:$APP_USER" config/groups.yaml; echo "!! แก้รายชื่อกลุ่มใน config/groups.yaml"; }

echo "==> systemd units"
for f in deploy/systemd/*; do
  sed -e "s#__APP_DIR__#$APP_DIR#g" -e "s#__APP_USER__#$APP_USER#g" "$f" > "/etc/systemd/system/$(basename "$f")"
done
systemctl daemon-reload
systemctl enable --now strata-web.service strata-generate.timer strata-publish-morning.timer strata-publish-evening.timer

echo
echo "เสร็จแล้ว ตรวจด้วย:"
echo "  sudo -u $APP_USER node --disable-warning=ExperimentalWarning src/cli.js check"
echo "  systemctl list-timers 'strata-*'"
