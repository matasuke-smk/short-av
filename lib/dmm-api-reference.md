# DMM Affiliate API リファレンス

## セットアップ

```.env.local
DMM_API_ID=your_api_id
DMM_AFFILIATE_ID=your_affiliate_id  # affiliate-990 ~ affiliate-999
```

## 1. 商品情報API (ItemList)

### エンドポイント
```
https://api.dmm.com/affiliate/v3/ItemList
```

### 主要パラメータ

| パラメータ | 必須 | 説明 | デフォルト値 |
|-----------|------|------|------------|
| api_id | ○ | API ID | - |
| affiliate_id | ○ | アフィリエイトID | affiliate-990 |
| site | ○ | サイト | FANZA / DMM.com |
| service | | サービスコード | digital |
| floor | | フロアコード | videoa |
| hits | | 取得件数 (最大100) | 20 |
| offset | | 検索開始位置 (最大50000) | 1 |
| sort | | 並び順 | rank / date / price / -price / review / match |
| keyword | | キーワード検索 | - |
| cid | | 商品ID | mizd00320 |
| article | | 絞り込み項目 | actress / author / genre / series / maker |
| article_id | | 絞り込みID | 1011199 |
| gte_date | | 発売日範囲（開始） | 2016-04-01T00:00:00 |
| lte_date | | 発売日範囲（終了） | 2016-04-30T23:59:59 |

### 使用例

```typescript
import { fetchDMMProducts } from '@/lib/dmm-api';

// 新着動画を20件取得
const newReleases = await fetchDMMProducts({
  site: 'FANZA',
  service: 'digital',
  floor: 'videoa',
  hits: 20,
  sort: 'date',
});

// 女優名で検索
const actressVideos = await fetchDMMProducts({
  site: 'FANZA',
  service: 'digital',
  floor: 'videoa',
  keyword: '女優名',
  hits: 20,
});

// ジャンルで絞り込み
const genreVideos = await fetchDMMProducts({
  site: 'FANZA',
  service: 'digital',
  floor: 'videoa',
  article: 'genre',
  article_id: '1001',
  hits: 20,
});
```

### レスポンス形式

```typescript
{
  request: {
    parameters: { ... }
  },
  result: {
    status: 200,
    result_count: 20,
    total_count: 5000,
    first_position: 1,
    items: [
      {
        content_id: "abc123",
        title: "作品タイトル",
        URL: "https://...",
        affiliateURL: "https://...",
        imageURL: {
          list: "https://...",
          small: "https://...",
          large: "https://..."
        },
        sampleMovieURL: {
          size_560_360: "https://..."
        },
        prices: {
          price: "1980"
        },
        date: "2024-01-01 10:00:00",
        iteminfo: {
          actress: [{ id: 123, name: "女優名" }],
          genre: [{ id: 456, name: "ジャンル名" }],
          maker: [{ id: 789, name: "メーカー名" }]
        }
      }
    ]
  }
}
```

## 2. フロアAPI (FloorList)

### エンドポイント
```
https://api.dmm.com/affiliate/v3/FloorList
```

### パラメータ

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| api_id | ○ | API ID |
| affiliate_id | ○ | アフィリエイトID |
| output | | 出力形式 (json / xml) |

### 使用例

```typescript
// 利用可能な全サービス・フロアを取得
const floors = await fetch(
  `https://api.dmm.com/affiliate/v3/FloorList?api_id=${apiId}&affiliate_id=${affiliateId}&output=json`
).then(r => r.json());
```

### 主要フロアコード

- **FANZA (アダルト)**
  - `videoa`: 動画（ビデオ）
  - `mono`: 通販（DVD）
  - `digital_doujin`: 同人

- **DMM.com (一般)**
  - `digital`: デジタル動画
  - `rental`: レンタル

## 3. 女優検索API (ActressSearch)

### エンドポイント
```
https://api.dmm.com/affiliate/v3/ActressSearch
```

### 主要パラメータ

| パラメータ | 説明 | デフォルト値 |
|-----------|------|-----------|
| actress_id | 女優ID | 123456 |
| keyword | 検索キーワード | - |
| initial | 頭文字（50音） | あ |
| bust | バスト範囲 | 85-90 |
| hits | 取得件数 | 20 |
| sort | 並び順 | name / -name / bust / -bust |

## 4. ジャンル検索API (GenreSearch)

### エンドポイント
```
https://api.dmm.com/affiliate/v3/GenreSearch
```

### 主要パラメータ

| パラメータ | 説明 | デフォルト値 |
|-----------|------|-----------|
| floor_id | フロアID | 43 |
| initial | 頭文字（50音） | あ |
| hits | 取得件数 | 100 |

## 5. メーカー検索API (MakerSearch)

### エンドポイント
```
https://api.dmm.com/affiliate/v3/MakerSearch
```

### 主要パラメータ

| パラメータ | 説明 | デフォルト値 |
|-----------|------|-----------|
| floor_id | フロアID | 43 |
| initial | 頭文字（50音） | あ |
| hits | 取得件数 | 100 |

## 6. シリーズ検索API (SeriesSearch)

### エンドポイント
```
https://api.dmm.com/affiliate/v3/SeriesSearch
```

### 主要パラメータ

| パラメータ | 説明 | デフォルト値 |
|-----------|------|-----------|
| floor_id | フロアID | 43 |
| initial | 頭文字（50音） | あ |
| hits | 取得件数 | 100 |

## プロジェクト固有のヘルパー関数

### 既存の関数

```typescript
// ランキング取得
fetchRankingVideos(limit: number): Promise<DMMItem[]>

// 女優名で検索
searchByActress(actressName: string, limit: number): Promise<DMMItem[]>

// キーワード検索
searchByKeyword(keyword: string, limit: number): Promise<DMMItem[]>

// ジャンル検索
searchByGenre(genreId: string, limit: number): Promise<DMMItem[]>

// 新作取得
fetchNewReleases(limit: number): Promise<DMMItem[]>

// データ変換
convertDMMItemToVideo(item: DMMItem, rankPosition?: number)
extractActresses(item: DMMItem)
extractGenres(item: DMMItem)
```

## 注意事項

1. **リクエスト制限**: API呼び出しには1秒間あたりの制限があるため注意
2. **キャッシュ**: Next.jsの`revalidate`を使用してAPIコール数を削減
3. **エラーハンドリング**: API呼び出しは必ずtry-catchで囲む
4. **アフィリエイトURL**: `affiliateURL`を使用して収益化を確実に
5. **画像**: `imageURL.large`が最高画質のサムネイル
6. **サンプル動画**: `sampleMovieURL.size_560_360`がサンプル動画URL

## 実装の推奨順序

1. 基本的なAPI呼び出し機能の確認
2. 定期的なデータ更新 (Vercel Cron)
3. レスポンスデータのDB保存
4. ISRの実装
