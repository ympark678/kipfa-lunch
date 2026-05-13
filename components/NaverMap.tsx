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
  
  // ✨ 지도가 늦게 켜져도 타겟 가게를 잊지 않도록 기억해두는 메모리!
  const targetShopRef = useRef(targetShopName);

  useEffect(() => {
    targetShopRef.current = targetShopName;
    // 만약 지도가 이미 켜져있는 상태에서 버튼을 누르면 즉시 이동!
    if (targetShopName && mapRef.current && markersRef.current[targetShopName]) {
      const targetMarker = markersRef.current[targetShopName];
      mapRef.current.panTo(targetMarker.getPosition());
      
      Object.values(infoWindowsRef.current).forEach((iw: any) => iw.close());
      if (infoWindowsRef.current[targetShopName]) {
        infoWindowsRef.current[targetShopName].open(mapRef.current, targetMarker);
      }
    }
  }, [targetShopName]);

  const initMap = () => {
    if (!window.naver || !window.naver.maps) return;

    // 초기 화면 시청으로 튀는 현상 방지를 위해 잠실/송파 부근을 기본 중심점으로 설정
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
            
            // 위치보기 버튼으로 지도를 연 게 아닐 때만 회사 위치를 중심으로 잡습니다.
            if (!targetShopRef.current) {
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

        // ✨ 팝업창 길찾기 링크도 '모바일 네이버 지도 앱' 다이렉트 호출용으로 변경
        const infoWindow = new window.naver.maps.InfoWindow({
          content: `<div style="padding:15px; min-width:180px; font-family: Pretendard, sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-radius: 12px; background: white; border: 1px solid #eee;">
                       <div style="font-weight:900; font-size: 15px; margin-bottom: 4px; color: #333;">${menu.shop_name}</div>
                       <div style="font-size: 12px; color: #666; margin-bottom: 10px; word-break: keep-all;">${menu.menu_details || '상세 정보 없음'}</div>
                       <a href="nmap://route/walk?dname=${encodeURIComponent(menu.shop_name)}&appname=KIPFA" style="display: block; text-align: center; padding: 8px 0; background: #2ecc71; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px;">🧭 앱으로 길찾기</a>
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

        // ✨ 지도가 늦게 켜졌을 때: 마커가 준비되자마자 즉시 타겟으로 이동시킵니다!
        if (targetShopRef.current === menu.shop_name) {
          mapRef.current.panTo(point);
          Object.values(infoWindowsRef.current).forEach((iw: any) => iw.close());
          infoWindow.open(mapRef.current, marker);
        }
      });
    });
  };

  useEffect(() => {
    renderMarkers();
  }, [menus]);

  return (
    <div className="w-full flex flex-col items-center my-2" style={{ position: 'relative', zIndex: 10 }}>
      <Script
        strategy="afterInteractive"
        type="text/javascript"
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&submodules=geocoder`}
        onReady={initMap}
      />
      <div
        ref={mapElement}
        style={{ width: '100%', height: '300px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e1e5e8', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)', position: 'relative', zIndex: 10 }}
      />
    </div>
  );
}
