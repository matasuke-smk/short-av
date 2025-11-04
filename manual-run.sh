#!/bin/bash
echo "==========================================="
echo "手動大量取得開始"
echo "==========================================="
echo ""
echo "予想実行時間: 5-10分"
echo "URL: https://short-av.vercel.app/api/cron/update-videos"
echo ""
echo "実行中..."
echo ""

curl -X POST https://short-av.vercel.app/api/cron/update-videos \
  -H "Authorization: Bearer your_random_secret_key_here" \
  -H "Content-Type: application/json" \
  -w "\n\n実行時間: %{time_total}秒\n" \
  -s | jq '.'

echo ""
echo "完了"
