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
  targetShop, 
  onMarkerClick 
}: { 
  menus?: any[], 
  targetShop?: { name: string, t: number } | null, 
  onMarkerClick?: (id: string) => void 
}) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const infoWindowsRef = useRef<{ [key: string]: any }>({});
  
  // ✨ 버그 수정: 무한 스냅 현상 방지를 위한 큐(Queue) 메모리
  const pendingPanRef = useRef<string | null>(null);
  const lastPanTimeRef = useRef<number | null>(null);
  const geocodeCache = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    // 타겟 가게가 바뀌었을(새로 클릭했을) 때만 딱 한 번 실행됩니다!
    if (targetShop && targetShop.t !== lastPanTimeRef.current) {
      lastPanTimeRef.current = targetShop.t;
      
      if (mapRef.current && markersRef.current[targetShop.name]) {
        const targetMarker = markersRef.current[targetShop.name];
        mapRef.current.panTo(targetMarker.getPosition());
        
        Object.values(infoWindowsRef.current).forEach((iw: any) => iw.close());
        if (infoWindowsRef.current[targetShop.name]) {
          infoWindowsRef.current[targetShop.name].open(mapRef.current, targetMarker);
        }
      } else {
        // 아직 핀이 안 찍혔다면, 찍히는 즉시 이동하라고 메모를 남깁니다.
        pendingPanRef.current = targetShop.name;
      }
    }
  }, [targetShop]);

  const initMap = () => {
    if (!window.naver || !window.naver.maps) return;

    // ✨ KIPFA 사무실의 정확한 절대 좌표 (송파구 올림픽로 293-19 현대타워 부근)
    const officeLocation = new window.naver.maps.LatLng(37.516513, 127.100654);
    
    const mapOptions = {
      center: officeLocation,
      zoom: 16,
      minZoom: 10,
    };

    mapRef.current = new window.naver.maps.Map(mapElement.current, mapOptions);

    // ✨ 빨간 점과 KIPFA 글씨가 어우러진 직관적인 오피스 마커
    new window.naver.maps.Marker({
      position: officeLocation,
      map: mapRef.current,
      zIndex: 999, // 다른 마커보다 무조건 위에 표시
      icon: {
        content: `
          <div style="width:60px; text-align:center; transform:translateY(-50%);">
            <div style="width:14px; height:14px; background:#e74c3c; border-radius:50%; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3); margin:0 auto;"></div>
            <div style="margin-top:4px; background:#2c3e50; color:white; padding:3px 6px; border-radius:6px; font-size:11px; font-weight:800; box-shadow:0 2px 4px rgba(0,0,0,0.2);">KIPFA</div>
          </div>`,
        anchor: new window.naver.maps.Point(30, 7), // 빨간 점 중앙을 정확히 좌표에 꽂음
      }
    });

    renderMarkers();
  };

  const drawMarker = (menu: any, point: any) => {
    const marker = new window.naver.maps.Marker({
      position: point,
      map: mapRef.current,
      title: menu.shop_name
    });

    const infoWindow = new window.naver.maps.InfoWindow({
      content: `<div style="padding:12px; min-width:140px; font-family: Pretendard; cursor:pointer; text-align:center;">
                   <div style="font-weight:900; font-size:15px; color:#333; margin-bottom:4px;">${menu.shop_name}</div>
                   <div style="font-size:12px; color:#3498db; font-weight:800;">⬇️ 터치해서 목록 보기</div>
                </div>`,
      borderWidth: 0,
      disableAnchor: true,
      backgroundColor: "white",
      pixelOffset: new window.naver.maps.Point(0, -10)
    });

    // 지도에서 마커를 누르면 말풍선이 열리며 부드럽게 카드로 스크롤 이동
    window.naver.maps.Event.addListener(marker, "click", () => {
      Object.values(infoWindowsRef.current).forEach((iw: any) => iw.close());
      infoWindow.open(mapRef.current, marker);
      if (onMarkerClick) onMarkerClick(menu.id); 
    });

    markersRef.current[menu.shop_name] = marker;
    infoWindowsRef.current[menu.shop_name] = infoWindow;

    // 만약 방금 밖에서 누른 카드가 이 마커라면 즉시 화면 이동!
    if (pendingPanRef.current === menu.shop_name) {
      mapRef.current.panTo(point);
      Object.values(infoWindowsRef.current).forEach((iw: any) => iw.close());
      infoWindow.open(mapRef.current, marker);
      pendingPanRef.current = null; // 처리 완료 후 큐 삭제
    }
  };

  const renderMarkers = () => {
    if (!mapRef.current || !window.naver?.maps?.Service) return;
    
    Object.values(markersRef.current).forEach((marker: any) => marker.setMap(null));
    markersRef.current = {}; 
    infoWindowsRef.current = {};

    menus.forEach(menu => {
      const targetAddress = menu.road_address || menu.address;
      if (!targetAddress) return;

      if (geocodeCache.current[targetAddress]) {
        drawMarker(menu, geocodeCache.current[targetAddress]);
      } else {
        window.naver.maps.Service.geocode({ query: targetAddress }, (status: any, response: any) => {
          if (status === window.naver.maps.Service.Status.OK && response.v2.meta.totalCount > 0) {
            const point = new window.naver.maps.Point(response.v2.addresses[0].x, response.v2.addresses[0].y);
            geocodeCache.current[targetAddress] = point;
            drawMarker(menu, point);
          }
        });
      }
    });
  };

  useEffect(() => { renderMarkers(); }, [menus]);

  return (
    <div className="w-full" style={{ position: 'relative', zIndex: 10 }}>
      <Script
        strategy="afterInteractive"
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}&submodules=geocoder`}
        onReady={initMap}
      />
      <div ref={mapElement} style={{ width: '100%', height: '300px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e1e5e8' }} />
    </div>
  );
}
