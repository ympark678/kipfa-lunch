"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

export default function NaverMap() {
  const mapElement = useRef<HTMLDivElement | null>(null);

  const initMap = () => {
    // 네이버 지도가 제대로 로드되었는지 확인
    if (!window.naver || !window.naver.maps) return;

    // KIPFA 협회 근처 좌표로 기본 중심점 설정 (원하시는 위경도로 나중에 수정 가능)
    const location = new window.naver.maps.LatLng(37.4811, 126.8833);

    const mapOptions = {
      center: location,
      zoom: 15,
      minZoom: 10,
    };
    
    // 지도를 화면에 그리기
    new window.naver.maps.Map(mapElement.current, mapOptions);
  };

  return (
    <div className="w-full flex flex-col items-center my-4">
      <h2 className="text-xl font-bold mb-4">🗺️ KIPFA 맛집 지도</h2>
      
      {/* Vercel에 등록해둔 API 키를 자동으로 불러옵니다 */}
      <Script
        strategy="afterInteractive"
        type="text/javascript"
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}`}
        onReady={initMap}
      />

      <div 
        ref={mapElement} 
        className="w-full max-w-2xl h-[400px] bg-gray-100 rounded-lg shadow-md"
      />
    </div>
  );
}
