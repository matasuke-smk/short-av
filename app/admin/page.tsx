import { redirect } from 'next/navigation';

// /admin（ホーム画面のアイコンから開いたとき）はアクセス解析を表示する
export default function AdminIndex() {
  redirect('/admin/analytics');
}
