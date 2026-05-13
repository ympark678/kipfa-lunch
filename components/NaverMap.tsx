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

    // 1. 지도 생성 (처음엔 임의의 위치로 생성)
    const mapOptions = {
      zoom: 16, // 부장님 회사 근처가 더 잘 보이게 줌 레벨을 살짝 올렸습니다
      minZoom: 10,
    };

    mapRef.current = new window.naver.maps.Map(mapElement.current, mapOptions);

    // 2. 부장님 회사 주소(송파구 올림픽로 293-19)로 지도의 중심을 정확히 이동!
    if (window.naver.maps.Service) {
      window.naver.maps.Service.geocode(
        { query: '서울시 송파구 올림픽로 293-19' },
        function (status: any, response: any) {
          if (status === window.naver.maps.Service.Status.OK && response.v2.meta.totalCount > 0) {
            const item = response.v2.addresses[0];
            const companyLocation = new window.naver.maps.Point(item.x, item.y);
            mapRef.current.setCenter(companyLocation);
            
            // (선택) 회사 위치에도 특별한 마커(집 모양)를 하나 찍어줄 수 있습니다.
            new window.naver.maps.Marker({
              position: companyLocation,
              map: mapRef.current,
              icon: {
                content: '<div style="background: #e74c3c; color: white; padding: 4px 8px; border-radius: 8px; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🏢 KIPFA</div>',
                anchor: new window.naver.maps.Point(30, 15),
              }
            });
          } else {
            // 만약 주소 검색이 실패하면 대략적인 잠실역 근처로 이동
            mapRef.current.setCenter(new window.naver.maps.LatLng(37.5151, 127.1040));
          }
        }
      );
    }

    renderMarkers();
  };

  const renderMarkers = () => {
    if (!mapRef.current || !window.naver || !window.naver.maps || !window.naver.maps.Service) return;

    // 기존 핀 지우기
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    menus.forEach(menu => {
      const targetAddress = menu.road_address || menu.address;
      if (!targetAddress) return;

      window.naver.maps.Service.geocode({ query: targetAddress }, function(status: any, response: any) {
        if (status !== window.naver.maps.Service.Status.OK || response.v2.meta.totalCount === 0) return;

        const item = response.v2.addresses[0];
        const point = new window.naver.maps.Point(item.x, item.y);

        const marker = new window.naver.maps.Marker({
          position: point,
          map: mapRef.current,
          title: menu.shop_name
        });

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

  useEffect(() => {
    renderMarkers();
  }, [menus]);

  return (
    <div className="w-full flex flex-col items-center my-2">
      <Script
        strategy="afterInteractive"
        type="text/javascript"
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
