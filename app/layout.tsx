import "./globals.css";

// ⭐️ 검색 엔진이 수집하지 못하도록 강력한 메타데이터를 추가했습니다.
export const metadata = {
  title: "KIPFA 점심 추천",
  description: "내부 전용 점심 추천 앱",
  robots: {
    index: false, // 검색 결과에 노출 안 함
    follow: false, // 링크 추적 안 함
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* 추가적인 방어막: 브라우저 레벨에서 수집 차단 */}
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}