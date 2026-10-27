import { fetchDMMProducts, type DMMItem } from '@/lib/dmm-api';
import { SALE_10YEN } from '@/config/sale-10yen';

export type SaleWork = {
  cid: string;
  title: string;
  image: string;
  url: string; // 紹介リンク（FANZA の作品ページ）
  price: string; // DMM の商品情報 API の値段（セール中は 10）
  saleEnds: string | null; // セールの終わり（campaign.date_end、日本時間）
  hasSample: boolean;
  actresses: string[];
};

type ItemWithCampaign = DMMItem & { campaign?: { date_begin: string; date_end: string; title: string }[] };

/** 設定の作品番号ごとに DMM の商品情報 API から情報を取り、セールの期間内のものだけを返す（1時間ごとに取り直す） */
export async function loadSaleWorks(now = Date.now()): Promise<SaleWork[]> {
  const works = await Promise.all(
    SALE_10YEN.items.map(async ({ cid, floor }): Promise<SaleWork | null> => {
      try {
        const res = await fetchDMMProducts({ service: 'digital', floor, cid, hits: 1 });
        const item = res.result?.items?.[0] as ItemWithCampaign | undefined;
        if (!item) return null;
        const end = item.campaign?.[0]?.date_end ?? null;
        // セールの期間が終わった作品は出さない（API の日時は日本時間）
        if (end && new Date(`${end.replace(' ', 'T')}+09:00`).getTime() < now) return null;
        return {
          cid,
          title: item.title,
          image: item.imageURL?.large ?? item.imageURL?.list ?? '',
          url: item.affiliateURL,
          price: String(item.prices?.price ?? ''),
          saleEnds: end,
          hasSample: !!item.sampleMovieURL,
          actresses: (item.iteminfo?.actress ?? []).map((a) => a.name).slice(0, 3),
        };
      } catch (error) {
        console.error('[sale-10yen]', cid, error);
        return null;
      }
    }),
  );
  return works.filter((w): w is SaleWork => w !== null);
}
