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
  const targetShopRef = useRef(targetShopName);
  
  // ✨ 성능 개선의 핵심! 한 번 찾은 좌표를 기억하는 캐시 메모리
  const geocodeCache = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    targetShopRef.current = targetShopName;
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

  const drawMarker = (menu: any, point: any) => {
    const marker = new window.naver.maps.Marker({
      position: point,
      map: mapRef.current,
      title: menu.shop_name
    });

    const infoWindow = new window.naver.maps.InfoWindow({
      content: `<div style="padding:15px; min-width:180px; font-family: Pretendard, sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-radius: 12px; background: white; border: 1px solid #eee;">
                   <div style="font-weight:900; font-size: 15px; margin-bottom: 4px; color: #333;">${menu.shop_name}</div>
                   <div style="font-size: 12px; color: #666; word-break: keep-all;">${menu.menu_details || '상세 정보 없음'}</div>
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

    if (targetShopRef.current === menu.shop_name) {
      mapRef.current.panTo(point);
      Object.values(infoWindowsRef.current).forEach((iw: any) => iw.close());
      infoWindow.open(mapRef.current, marker);
    }
  };

  const renderMarkers = () => {
    if (!mapRef.current || !window.naver || !window.naver.maps || !window.naver.maps.Service) return;

    Object.values(markersRef.current).forEach((marker: any) => marker.setMap(null));
    markersRef.current = {};
    infoWindowsRef.current = {};

    menus.forEach(menu => {
      const targetAddress = menu.road_address || menu.address;
      if (!targetAddress) return;

      // ✨ 캐시에 좌표가 있으면 API 호출 없이 즉시 그리기 (속도 개선)
      if (geocodeCache.current[targetAddress]) {
        drawMarker(menu, geocodeCache.current[targetAddress]);
      } else {
        window.naver.maps.Service.geocode({ query: targetAddress }, function(status: any, response: any) {
          if (status === window.naver.maps.Service.Status.OK && response.v2.meta.totalCount > 0) {
            const item = response.v2.addresses[0];
            const point = new window.naver.maps.Point(item.x, item.y);
            geocodeCache.current[targetAddress] = point; // 찾은 좌표 저장
            drawMarker(menu, point);
          }
        });
      }
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
