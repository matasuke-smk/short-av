import 'dotenv/config';
import { supabase } from '../lib/supabase';

async function checkSampleUrls() {
  const { data, error } = await supabase
    .from('videos')
    .select('id, title, sample_video_url')
    .order('rank_position', { ascending: true })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n📹 Sample video URLs check:\n`);
  data?.forEach((v, idx) => {
    console.log(`#${idx + 1}: ${v.title.substring(0, 50)}...`);
    console.log(`   URL: ${v.sample_video_url || '❌ NO URL'}\n`);
  });
}

checkSampleUrls();
