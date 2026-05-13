"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    naver: any;
  }
}

export default function NaverMap({ menus = [] }: { menus?: any[] }) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const initMap = () => {
    if (!window.naver || !window.naver.maps) return;

    // KIPFA 협회 근처로 기본 중심점 설정
    const location = new window.naver.maps.LatLng(37.4811, 126.8833);
    const mapOptions = {
      center: location,
      zoom: 15,
      minZoom: 10,
    };

    mapRef.current = new window.naver.maps.Map(mapElement.current, mapOptions);
    renderMarkers();
  };

  const renderMarkers = () => {
    // 지도나 geocoder가 로드되지 않았다면 중단
    if (!mapRef.current || !window.naver || !window.naver.maps || !window.naver.maps.Service) return;

    // 기존에 찍혀있던 핀들 전부 지도에서 지우기
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    menus.forEach(menu => {
      // 도로명 주소 우선, 없으면 지번 주소 사용
      const targetAddress = menu.road_address || menu.address;
      if (!targetAddress) return;

      // 주소를 위도/경도 좌표로 변환하는 마법!
      window.naver.maps.Service.geocode({ query: targetAddress }, function(status: any, response: any) {
        if (status !== window.naver.maps.Service.Status.OK || response.v2.meta.totalCount === 0) return;

        const item = response.v2.addresses[0];
        const point = new window.naver.maps.Point(item.x, item.y);

        // 지도에 핀(마커) 꽂기
        const marker = new window.naver.maps.Marker({
          position: point,
          map: mapRef.current,
          title: menu.shop_name
        });

        // 핀을 눌렀을 때 뜰 예쁜 말풍선(팝업) 디자인
        const infoWindow = new window.naver.maps.InfoWindow({
          content: `<div style="padding:15px; min-width:180px; font-family: Pretendard, sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-radius: 12px; background: white; border: 1px solid #eee;">
                       <div style="font-weight:900; font-size: 15px; margin-bottom: 4px; color: #333;">${menu.shop_name}</div>
                       <div style="font-size: 12px; color: #666; margin-bottom: 10px; word-break: keep-all;">${menu.menu_details?.split(',')[0]}</div>
                       <a href="https://map.naver.com/v5/directions/KIPFA/${encodeURIComponent(menu.shop_name)}/-/walk" target="_blank" style="display: block; text-align: center; padding: 8px 0; background: #2ecc71; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px;">🧭 길찾기</a>
                    </div>`,
          borderWidth: 0,
          disableAnchor: true,
          backgroundColor: "transparent",
          pixelOffset: new window.naver.maps.Point(0, -10)
        });

        // 마커 클릭 시 말풍선 열고 닫기
        window.naver.maps.Event.addListener(marker, "click", function() {
          if (infoWindow.getMap()) {
            infoWindow.close();
          } else {
            infoWindow.open(mapRef.current, marker);
          }
        });

        markersRef.current.push(marker);
      });
    });
  };

  // 메뉴 리스트가 바뀔 때마다 마커 새로 그리기
  useEffect(() => {
    renderMarkers();
  }, [menus]);

  return (
    <div className="w-full flex flex-col items-center my-2">
      <Script
        strategy="afterInteractive"
        type="text/javascript"
        // ⭐️ &submodules=geocoder 추가 (주소 -> 좌표 변환기능)
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&submodules=geocoder`}
        onReady={initMap}
      />
      <div
        ref={mapElement}
        style={{ width: '100%', height: '280px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e1e5e8', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}
      />
    </div>
  );
}
