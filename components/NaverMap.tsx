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
  
  const pendingPanRef = useRef<string | null>(null);
  const lastPanTimeRef = useRef<number | null>(null);
  const geocodeCache = useRef<{ [key: string]: any }>({});
  const targetShopRef = useRef(targetShop?.name);

  // 말풍선 클릭 감지 리스너
  useEffect(() => {
    const handleMapClick = (e: any) => {
      if (onMarkerClick) onMarkerClick(e.detail);
    };
    window.addEventListener('mapClick', handleMapClick);
    return () => window.removeEventListener('mapClick', handleMapClick);
  }, [onMarkerClick]);

  // ✨ 클릭한 타겟 식당으로 화면 이동 및 강제 지오코딩 처리
  useEffect(() => {
    if (targetShop && targetShop.t !== lastPanTimeRef.current) {
      lastPanTimeRef.current = targetShop.t;
      targetShopRef.current = targetShop.name;
      
      if (mapRef.current && markersRef.current[targetShop.name]) {
        // 이미 핀이 있으면 즉시 이동
        const targetMarker = markersRef.current[targetShop.name];
        mapRef.current.panTo(targetMarker.getPosition());
        
        Object.values(infoWindowsRef.current).forEach((iw: any) => iw.close());
        if (infoWindowsRef.current[targetShop.name]) {
          infoWindowsRef.current[targetShop.name].open(mapRef.current, targetMarker);
        }
      } else {
        // 핀이 아직 없으면 대기열에 올림
        pendingPanRef.current = targetShop.name;
        
        // ✨ 클릭한 가게는 1순위로 강제로 네이버 API에 위치 요청! (새치기)
        const shopData = menus.find(m => m.shop_name === targetShop.name);
        if (shopData && window.naver?.maps?.Service) {
          const targetAddress = shopData.road_address || shopData.address;
          if (targetAddress && !geocodeCache.current[targetAddress]) {
            window.naver.maps.Service.geocode({ query: targetAddress }, (status: any, response: any) => {
              if (status === window.naver.maps.Service.Status.OK && response.v2.meta.totalCount > 0) {
                const point = new window.naver.maps.Point(response.v2.addresses[0].x, response.v2.addresses[0].y);
                geocodeCache.current[targetAddress] = point;
                drawMarker(shopData, point);
              }
            });
          }
        }
      }
    }
  }, [targetShop, menus]);

  const initMap = () => {
    if (!window.naver || !window.naver.maps) return;

    // 잠실 현대타워 절대 좌표
    const officeLocation = new window.naver.maps.LatLng(37.515100, 127.102500);
    
    const mapOptions = {
      center: officeLocation,
      zoom: 16,
      minZoom: 10,
    };

    mapRef.current = new window.naver.maps.Map(mapElement.current, mapOptions);

    const drawOfficeMarker = (point: any) => {
      if (!targetShopRef.current) {
        mapRef.current.setCenter(point);
      }
      new window.naver.maps.Marker({
        position: point,
        map: mapRef.current,
        zIndex: 999,
        icon: {
          content: `
            <div style="width:60px; text-align:center; transform:translateY(-50%); cursor:default;">
              <div style="width:14px; height:14px; background:#e74c3c; border-radius:50%; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3); margin:0 auto;"></div>
              <div style="margin-top:4px; background:#2c3e50; color:white; padding:3px 6px; border-radius:6px; font-size:11px; font-weight:800; box-shadow:0 2px 4px rgba(0,0,0,0.2);">KIPFA</div>
            </div>`,
          anchor: new window.naver.maps.Point(30, 7),
        }
      });
    };

    drawOfficeMarker(officeLocation);
    renderMarkers();
  };

  const drawMarker = (menu: any, point: any) => {
    // 중복 렌더링 방지
    if (markersRef.current[menu.shop_name]) return;

    const marker = new window.naver.maps.Marker({
      position: point,
      map: mapRef.current,
      title: menu.shop_name
    });

    const infoWindow = new window.naver.maps.InfoWindow({
      content: `
        <div style="padding:14px; min-width:140px; font-family: Pretendard; cursor:pointer; text-align:center; background:white; border-radius:12px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border: 1px solid #e1e5e8;" 
             onclick="window.dispatchEvent(new CustomEvent('mapClick', {detail:'${menu.id}'}))">
           <div style="font-weight:900; font-size:15px; color:#333; margin-bottom:6px;">${menu.shop_name}</div>
           <div style="font-size:12px; color:#3498db; font-weight:800; background:#f0f8ff; padding:6px; border-radius:6px;">⬇️ 터치해서 목록으로 이동</div>
        </div>
      `,
      borderWidth: 0,
      disableAnchor: true,
      backgroundColor: "transparent",
      pixelOffset: new window.naver.maps.Point(0, -10)
    });

    window.naver.maps.Event.addListener(marker, "click", () => {
      Object.values(infoWindowsRef.current).forEach((iw: any) => iw.close());
      infoWindow.open(mapRef.current, marker);
    });

    markersRef.current[menu.shop_name] = marker;
    infoWindowsRef.current[menu.shop_name] = infoWindow;

    // 대기열에 있던 가게가 방금 그려졌다면 즉시 이동!
    if (pendingPanRef.current === menu.shop_name) {
      mapRef.current.panTo(point);
      Object.values(infoWindowsRef.current).forEach((iw: any) => iw.close());
      infoWindow.open(mapRef.current, marker);
      pendingPanRef.current = null; 
    }
  };

  const renderMarkers = () => {
    if (!mapRef.current || !window.naver || !window.naver.maps || !window.naver.maps.Service) return;

    Object.values(markersRef.current).forEach((marker: any) => marker.setMap(null));
    markersRef.current = {};
    infoWindowsRef.current = {};

    // ✨ 타겟 가게를 최우선 순위로 끌어올림
    const sortedMenus = [...menus].sort((a, b) => {
      if (a.shop_name === targetShopRef.current) return -1;
      if (b.shop_name === targetShopRef.current) return 1;
      return 0;
    });

    sortedMenus.forEach((menu, index) => {
      const targetAddress = menu.road_address || menu.address;
      if (!targetAddress) return;

      if (geocodeCache.current[targetAddress]) {
        drawMarker(menu, geocodeCache.current[targetAddress]);
      } else {
        // ✨ 네이버 API 트래픽 초과(Rate Limit) 방지를 위해 30ms 간격으로 하나씩 천천히 던짐
        setTimeout(() => {
          if (window.naver?.maps?.Service) {
            window.naver.maps.Service.geocode({ query: targetAddress }, function(status: any, response: any) {
              if (status === window.naver.maps.Service.Status.OK && response.v2.meta.totalCount > 0) {
                const item = response.v2.addresses[0];
                const point = new window.naver.maps.Point(item.x, item.y);
                geocodeCache.current[targetAddress] = point; 
                drawMarker(menu, point);
              }
            });
          }
        }, index * 30);
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
        style={{ width: '100%', height: '320px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e1e5e8', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)', position: 'relative', zIndex: 10 }}
      />
    </div>
  );
}
