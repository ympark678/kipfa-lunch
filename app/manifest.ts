// app/manifest.ts
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KIPFA 점심 추천',
    short_name: '점심추천',
    description: 'KIPFA 내부 전용 점심 추천 앱',
    start_url: '/',
    display: 'standalone', // ⭐️ 핵심: 브라우저 주소창을 없애고 진짜 앱처럼 보이게 함
    background_color: '#f9fafb',
    theme_color: '#3b82f6',
    icons: [
      {
        src: '/apple-icon.png', // 아까 만드신 아이폰용 아이콘을 공용으로 씁니다!
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}