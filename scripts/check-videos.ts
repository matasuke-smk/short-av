import 'dotenv/config';
import { supabase } from '../lib/supabase';

async function checkVideos() {
  const { data, error } = await supabase
    .from('videos')
    .select('id, title, rank_position')
    .order('rank_position', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n📊 Total videos in database: ${data?.length}\n`);
  data?.forEach(v => {
    console.log(`#${v.rank_position}: ${v.title.substring(0, 60)}...`);
  });
}

checkVideos();
