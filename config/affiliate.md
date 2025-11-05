# アフィリエイト設定

## 現在の状態
**有効**（2025年11月5日更新）

新しいアフィリエイトIDとAPIIDが発行され、設定完了。

---

## 現在のアフィリエイトID
```
af_id=matasuke-005
api_id=matasuke-990
```

## 過去のアフィリエイトID
```
af_id=matasuke-002（使用不可）
```

---

## 設定箇所

### 1. VideoSwiper.tsx（メイン動画画面の広告バナー）
**ファイル**: `app/components/VideoSwiper.tsx`
**場所**: 264行目付近

```tsx
<a
  href="https://al.fanza.co.jp?lurl=https%3A%2F%2Fwww.dmm.co.jp%2Fdigital%2F-%2Fwelcome-coupon%2F&ch=banner&ch_id=1082_640_200&af_id=matasuke-002"
  target="_blank"
  rel="sponsored"
  className="block w-full"
>
```

**現在の状態**:
```tsx
<a
  href="https://al.fanza.co.jp?lurl=https%3A%2F%2Fwww.dmm.co.jp%2Fdigital%2F-%2Fwelcome-coupon%2F&ch=banner&ch_id=1082_640_200"
  target="_blank"
  rel="sponsored"
  className="block w-full"
>
```

### 2. AgeVerificationGate.tsx（年齢確認画面の広告バナー）
**ファイル**: `app/components/AgeVerificationGate.tsx`
**場所**: 77行目付近

```tsx
<a
  href="https://al.fanza.co.jp?lurl=https%3A%2F%2Fwww.dmm.co.jp%2Fdigital%2F-%2Fwelcome-coupon%2F&ch=banner&ch_id=1082_300_250&af_id=matasuke-002"
  target="_blank"
  rel="sponsored"
>
```

**現在の状態**:
```tsx
<a
  href="https://al.fanza.co.jp?lurl=https%3A%2F%2Fwww.dmm.co.jp%2Fdigital%2F-%2Fwelcome-coupon%2F&ch=banner&ch_id=1082_300_250"
  target="_blank"
  rel="sponsored"
>
```

---

## 復元方法

新しいアフィリエイトIDが発行されたら、以下の手順で復元してください。

### 手順1: VideoSwiper.tsx を編集
```bash
# ファイルを開く
code app/components/VideoSwiper.tsx

# 264行目付近のhrefを編集
# 変更前: ...&ch_id=1082_640_200"
# 変更後: ...&ch_id=1082_640_200&af_id=新しいID"
```

### 手順2: AgeVerificationGate.tsx を編集
```bash
# ファイルを開く
code app/components/AgeVerificationGate.tsx

# 77行目付近のhrefを編集
# 変更前: ...&ch_id=1082_300_250"
# 変更後: ...&ch_id=1082_300_250&af_id=新しいID"
```

### 手順3: コミット＆デプロイ
```bash
git add app/components/VideoSwiper.tsx app/components/AgeVerificationGate.tsx
git commit -m "アフィリエイトIDを復元: 新しいID"
git push
```

---

## 検索用のキーワード
- affiliate
- af_id
- matasuke-002
- DMMアフィリエイト
- FANZA

---

## 参考情報

### DMMアフィリエイトの設定
- サイト名: Short AV
- サイトURL: https://short-av.com
- 旧URL: （不明）
- アフィリエイトプログラム: FANZA Webサービス

### 広告バナーのサイズ
1. メイン画面: 640x200px
2. 年齢確認画面: 300x250px

### 関連リンク
- FANZA Webサービス: https://affiliate.dmm.com/api/
- 広告画像: https://pics.dmm.com/af/a_digital_500off01/

---

**最終更新**: 2025年10月29日
**作成者**: Claude Code
