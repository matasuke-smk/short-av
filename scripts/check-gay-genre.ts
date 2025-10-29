import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function checkGayGenre() {
  const { data } = await supabase
    .from('genres')
    .select('id, name, slug')
    .ilike('name', '%ゲイ%');

  console.log('ゲイ関連ジャンル:', data);

  for (const g of data || []) {
    const { count } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .contains('genre_ids', [g.id]);

    console.log(`${g.name} (${g.slug}): ${count}件`);
  }
}

checkGayGenre();
