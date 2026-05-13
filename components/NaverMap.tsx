"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    naver: any;
  }
}

export default function NaverMap({ 
  menus = [], 
  targetShopName, 
  onMarkerClick 
}: { 
  menus?: any[], 
  targetShopName?: string | null,
  onMarkerClick?: (id: string) => void 
}) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const infoWindowsRef = useRef<{ [key: string]: any }>({});

  const initMap = () => {
    if (!window.naver || !window.naver.maps) return;

    // ✨ 1. 기본 위치를 시청이 아닌 KIPFA 근처(송파구)로 고정하여 깜빡임 방지!
    const initialLocation = new window.naver.maps.LatLng(37.5147, 127.1042);
    
    const mapOptions = {
      center: initialLocation,
      zoom: 16,
      minZoom: 10,
    };

    mapRef.current = new window.naver.maps.Map(mapElement.current, mapOptions);

    if (window.naver.maps.Service) {
      window.naver.maps.Service.geocode(
        { query: '서울시 송파구 올림픽로 293-19' },
        function (status: any, response: any) {
          if (status === window.naver.maps.Service.Status.OK && response.v2.meta.totalCount > 0) {
            const item = response.v2.addresses[0];
            const companyLocation = new window.naver.maps.Point(item.x, item.y);
            
            // 만약 밖에서 특정 가게를 지목하지 않았을 때만 회사 위치를 중심으로 잡습니다.
            if (!targetShopName) {
              mapRef.current.setCenter(companyLocation);
            }
            
            new window.naver.maps.Marker({
              position: companyLocation,
              map: mapRef.current,
              icon: {
                content: '<div style="background: #e74c3c; color: white; padding: 4px 8px; border-radius: 8px; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🏢 KIPFA</div>',
                anchor: new window.naver.maps.Point(30, 15),
              }
            });
          }
        }
      );
    }
    renderMarkers();
  };

  const renderMarkers = () => {
    if (!mapRef.current || !window.naver || !window.naver.maps || !window.naver.maps.Service) return;

    Object.values(markersRef.current).forEach((marker: any) => marker.setMap(null));
    markersRef.current = {};
    infoWindowsRef.current = {};

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

        // ✨ 길찾기 링크도 모바일 경로 안내 링크로 안정화했습니다.
        const infoWindow = new window.naver.maps.InfoWindow({
          content: `<div style="padding:15px; min-width:180px; font-family: Pretendard, sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-radius: 12px; background: white; border: 1px solid #eee;">
                       <div style="font-weight:900; font-size: 15px; margin-bottom: 4px; color: #333;">${menu.shop_name}</div>
                       <div style="font-size: 12px; color: #666; margin-bottom: 10px; word-break: keep-all;">${menu.menu_details || '상세 정보 없음'}</div>
                       <a href="https://m.map.naver.com/route.nhn?menu=route&ename=${encodeURIComponent(menu.shop_name)}" target="_blank" style="display: block; text-align: center; padding: 8px 0; background: #2ecc71; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px;">🧭 길찾기</a>
                    </div>`,
          borderWidth: 0,
          disableAnchor: true,
          backgroundColor: "transparent",
          pixelOffset: new window.naver.maps.Point(0, -10)
        });

        window.naver.maps.Event.addListener(marker, "click", function() {
          Object.values(infoWindowsRef.current).forEach((iw: any) => iw.close());
          infoWindow.open(mapRef.current, marker);
          if (onMarkerClick) onMarkerClick(menu.id);
        });

        markersRef.current[menu.shop_name] = marker;
        infoWindowsRef.current[menu.shop_name] = infoWindow;

        // ✨ 핵심: 마커가 그려지는 순간, 만약 이 마커가 타겟 샵이면 즉시 화면을 이동시킵니다!
        if (targetShopName === menu.shop_name) {
          mapRef.current.setCenter(point);
          infoWindow.open(mapRef.current, marker);
        }
      });
    });
  };

  useEffect(() => {
    renderMarkers();
  }, [menus]);

  useEffect(() => {
    if (targetShopName && mapRef.current && markersRef.current[targetShopName]) {
      const targetMarker = markersRef.current[targetShopName];
      const targetInfoWindow = infoWindowsRef.current[targetShopName];
      
      mapRef.current.panTo(targetMarker.getPosition());
      
      Object.values(infoWindowsRef.current).forEach((iw: any) => iw.close());
      targetInfoWindow.open(mapRef.current, targetMarker);
    }
  }, [targetShopName]);

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
        style={{ width: '100%', height: '300px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e1e5e8', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}
      />
    </div>
  );
}
