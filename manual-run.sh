#!/bin/bash
# cron（動画データ更新）を手動実行する
# 使い方: CRON_SECRET=xxxx ./manual-run.sh

if [ -z "$CRON_SECRET" ]; then
  echo "環境変数 CRON_SECRET を設定してください（例: CRON_SECRET=xxxx ./manual-run.sh）"
  exit 1
fi

echo "動画データ更新を実行中..."

curl -X POST https://short-av.com/api/cron/update-videos \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -w "\n\n実行時間: %{time_total}秒\n" \
  -s | jq '.'
