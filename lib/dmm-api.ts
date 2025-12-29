/**
 * DMM API ラッパー関数（直接API呼び出し）
 * https://affiliate.dmm.com/api/
 */

export type DMMItem = {
  service_code: string;
  service_name: string;
  floor_code: string;
  floor_name: string;
  category_name: string;
  content_id: string;
  product_id: string;
  title: string;
  volume: string;
  review: {
    count: number;
    average: number;
  };
  URL: string;
  affiliateURL: string;
  imageURL: {
    list: string;
    small: string;
    large: string;
  };
  sampleImageURL?: {
    sample_s: {
      image: string[];
    };
  };
  sampleMovieURL?: {
    size_560_360: string;
    size_644_414: string;
    size_720_480: string;
  };
  prices: {
    price: string;
    list_price?: string;
    deliveries?: {
      delivery: {
        type: string;
        price: string;
      }[];
    };
  };
  date: string;
  iteminfo: {
    genre?: {
      id: number;
      name: string;
    }[];
    series?: {
      id: number;
      name: string;
    }[];
    maker?: {
      id: number;
      name: string;
    }[];
    actress?: {
      id: number;
      name: string;
    }[];
    director?: {
      id: number;
      name: string;
    }[];
    label?: {
      id: number;
      name: string;
    }[];
  };
};

export type DMMApiResponse = {
  request: {
    parameters: Record<string, string>;
  };
  result: {
    status: number;
    result_count: number;
    total_count: number;
    first_position: number;
    items: DMMItem[];
  };
};

const DMM_API_BASE_URL = 'https://api.dmm.com/affiliate/v3/ItemList';

/**
 * 商品検索API
 */
export async function fetchDMMProducts(options: {
  site?: 'FANZA' | 'DMM.com';
  service?: string;
  floor?: string;
  hits?: number;
  offset?: number;
  sort?: 'rank' | 'date' | '-date' | 'price' | '-price' | 'review' | '-review';
  keyword?: string;
  article?: string;
  article_id?: string;
  actress?: string;
} = {}): Promise<DMMApiResponse> {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    throw new Error('DMM API credentials are not configured');
  }

  // デフォルトパラメータ
  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: affiliateId,
    site: options.site || 'FANZA',
    output: 'json',
  });

  // オプションパラメータを追加
  if (options.service) params.append('service', options.service);
  if (options.floor) params.append('floor', options.floor);
  if (options.hits) params.append('hits', options.hits.toString());
  if (options.offset) params.append('offset', options.offset.toString());
  if (options.sort) params.append('sort', options.sort);
  if (options.keyword) params.append('keyword', options.keyword);
  if (options.article) params.append('article', options.article);
  if (options.article_id) params.append('article_id', options.article_id);
  if (options.actress) params.append('actress', options.actress);

  const url = `${DMM_API_BASE_URL}?${params.toString()}`;

  console.log('DMM API Request URL:', url.replace(apiId, 'API_ID').replace(affiliateId, 'AFFILIATE_ID'));

  try {
    const response = await fetch(url, {
      next: { revalidate: 3600 }, // 1時間キャッシュ
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DMM API Error Response:', errorText);
      throw new Error(`DMM API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('DMM API Success! Items:', data?.result?.items?.length || 0);
    return data as DMMApiResponse;
  } catch (error) {
    console.error('DMM API Error:', error);
    throw error;
  }
}

/**
 * ランキングTOP動画を取得
 */
export async function fetchRankingVideos(limit: number = 20): Promise<DMMItem[]> {
  try {
    const response = await fetchDMMProducts({
      site: 'FANZA',
      service: 'digital',
      floor: 'videoa',
      hits: limit,
      sort: 'rank',
    });

    return response.result.items || [];
  } catch (error) {
    console.error('Failed to fetch ranking videos:', error);
    throw error;
  }
}

/**
 * 週間ランキング（過去7日間の人気動画）
 */
export async function fetchWeeklyRanking(limit: number = 20): Promise<DMMItem[]> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const gteDate = sevenDaysAgo.toISOString().split('.')[0]; // ISO8601形式

    const params = new URLSearchParams({
      api_id: process.env.DMM_API_ID!,
      affiliate_id: process.env.DMM_AFFILIATE_ID!,
      site: 'FANZA',
      service: 'digital',
      floor: 'videoa',
      hits: limit.toString(),
      sort: 'rank',
      gte_date: gteDate,
      output: 'json',
    });

    const url = `${DMM_API_BASE_URL}?${params.toString()}`;
    const response = await fetch(url, { next: { revalidate: 3600 } });

    if (!response.ok) {
      throw new Error(`DMM API request failed: ${response.status}`);
    }

    const data = await response.json();
    return (data as DMMApiResponse).result.items || [];
  } catch (error) {
    console.error('Failed to fetch weekly ranking:', error);
    throw error;
  }
}

/**
 * 月間ランキング（過去30日間の人気動画）
 */
export async function fetchMonthlyRanking(limit: number = 20): Promise<DMMItem[]> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const gteDate = thirtyDaysAgo.toISOString().split('.')[0]; // ISO8601形式

    const params = new URLSearchParams({
      api_id: process.env.DMM_API_ID!,
      affiliate_id: process.env.DMM_AFFILIATE_ID!,
      site: 'FANZA',
      service: 'digital',
      floor: 'videoa',
      hits: limit.toString(),
      sort: 'rank',
      gte_date: gteDate,
      output: 'json',
    });

    const url = `${DMM_API_BASE_URL}?${params.toString()}`;
    const response = await fetch(url, { next: { revalidate: 3600 } });

    if (!response.ok) {
      throw new Error(`DMM API request failed: ${response.status}`);
    }

    const data = await response.json();
    return (data as DMMApiResponse).result.items || [];
  } catch (error) {
    console.error('Failed to fetch monthly ranking:', error);
    throw error;
  }
}

/**
 * 全期間ランキング（全期間の人気動画）
 */
export async function fetchAllTimeRanking(limit: number = 20): Promise<DMMItem[]> {
  // 全期間ランキングは fetchRankingVideos と同じ
  return fetchRankingVideos(limit);
}

/**
 * 女優名で検索
 */
export async function searchByActress(actressName: string, limit: number = 20): Promise<DMMItem[]> {
  try {
    const response = await fetchDMMProducts({
      site: 'FANZA',
      service: 'digital',
      floor: 'videoa',
      keyword: actressName,
      hits: limit,
    });

    return response.result.items || [];
  } catch (error) {
    console.error('Failed to search by actress:', error);
    throw error;
  }
}

/**
 * キーワード検索
 */
export async function searchByKeyword(keyword: string, limit: number = 20): Promise<DMMItem[]> {
  try {
    const response = await fetchDMMProducts({
      site: 'FANZA',
      service: 'digital',
      floor: 'videoa',
      keyword: keyword,
      hits: limit,
    });

    return response.result.items || [];
  } catch (error) {
    console.error('Failed to search by keyword:', error);
    throw error;
  }
}

/**
 * ジャンルで検索
 */
export async function searchByGenre(genreId: string, limit: number = 20): Promise<DMMItem[]> {
  try {
    const response = await fetchDMMProducts({
      site: 'FANZA',
      service: 'digital',
      floor: 'videoa',
      article: 'genre',
      article_id: genreId,
      hits: limit,
    });

    return response.result.items || [];
  } catch (error) {
    console.error('Failed to search by genre:', error);
    throw error;
  }
}

/**
 * 新着順で取得
 */
export async function fetchNewReleases(limit: number = 20): Promise<DMMItem[]> {
  try {
    const response = await fetchDMMProducts({
      site: 'FANZA',
      service: 'digital',
      floor: 'videoa',
      sort: 'date',
      hits: limit,
    });

    return response.result.items || [];
  } catch (error) {
    console.error('Failed to fetch new releases:', error);
    throw error;
  }
}

/**
 * ジャンル一覧を取得
 */
export async function fetchGenres(): Promise<Array<{ id: string; name: string }>> {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    throw new Error('DMM API credentials are not configured');
  }

  const url = `https://api.dmm.com/affiliate/v3/GenreSearch?api_id=${apiId}&affiliate_id=${affiliateId}&floor_id=43&hits=100&output=json`;

  try {
    const response = await fetch(url, {
      next: { revalidate: 86400 }, // 24時間キャッシュ
    });

    if (!response.ok) {
      throw new Error(`Genre API request failed: ${response.status}`);
    }

    const data = await response.json();

    return data.result?.genre?.map((g: any) => ({
      id: g.genre_id.toString(),
      name: g.name,
    })) || [];
  } catch (error) {
    console.error('Failed to fetch genres:', error);
    throw error;
  }
}

/**
 * DMMItemをデータベース用の形式に変換
 */
export function convertDMMItemToVideo(item: DMMItem, rankPosition?: number) {
  return {
    id: item.content_id, // idフィールドを追加（いいね機能のため）
    dmm_content_id: item.content_id,
    title: item.title,
    description: item.volume || null,
    thumbnail_url: item.imageURL.large,
    sample_video_url: item.sampleMovieURL?.size_560_360 || null,
    dmm_product_url: item.affiliateURL,
    price: parseInt(item.prices.price) || null,
    release_date: item.date,
    duration: null, // DMMのAPIには含まれていない
    maker: item.iteminfo.maker?.[0]?.name || null,
    label: item.iteminfo.label?.[0]?.name || null,
    series: item.iteminfo.series?.[0]?.name || null,
    genre_ids: null, // 後でマッピングが必要
    actress_ids: null, // 後でマッピングが必要
    view_count: 0,
    click_count: 0,
    rank_position: rankPosition || null,
    is_active: true,
  };
}

/**
 * 女優情報を抽出
 */
export function extractActresses(item: DMMItem) {
  return item.iteminfo.actress?.map((actress) => ({
    id: actress.id,
    name: actress.name,
    slug: actress.id.toString(), // DMM APIのIDをslugとして使用
  })) || [];
}

/**
 * ジャンル情報を抽出
 */
export function extractGenres(item: DMMItem) {
  return item.iteminfo.genre?.map((genre) => ({
    id: genre.id,
    name: genre.name,
    slug: genre.id.toString(), // DMM APIのIDをslugとして使用
  })) || [];
}
