import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function checkGenre1017() {
  const { data } = await supabase
    .from('genres')
    .select('id, name, slug')
    .eq('slug', '1017');

  console.log('slug=1017のジャンル:', data);

  if (data && data.length > 0) {
    for (const g of data) {
      const { count } = await supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .contains('genre_ids', [g.id]);

      console.log(`${g.name} (${g.slug}): ${count}件`);
    }
  }
}

checkGenre1017();
