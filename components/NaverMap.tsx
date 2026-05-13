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
  const targetShopRef = useRef(targetShop?.name);
  const geocodeCache = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    if (targetShop) {
      targetShopRef.current = targetShop.name;
      if (mapRef.current && markersRef.current[targetShop.name]) {
        const targetMarker = markersRef.current[targetShop.name];
        mapRef.current.panTo(targetMarker.getPosition());
        Object.values(infoWindowsRef.current).forEach((iw: any) => iw.close());
        if (infoWindowsRef.current[targetShop.name]) {
          infoWindowsRef.current[targetShop.name].open(mapRef.current, targetMarker);
        }
      }
    }
  }, [targetShop]);

  const initMap = () => {
    if (!window.naver || !window.naver.maps) return;

    const initialLocation = new window.naver.maps.LatLng(37.5147, 127.1042);
    const mapOptions = { center: initialLocation, zoom: 17, minZoom: 10 };
    mapRef.current = new window.naver.maps.Map(mapElement.current, mapOptions);

    const drawOfficeMarker = (point: any) => {
      if (!targetShopRef.current) mapRef.current.setCenter(point);
      // ✨ 사무실을 정확한 빨간 점과 텍스트로 표시
      new window.naver.maps.Marker({
        position: point,
        map: mapRef.current,
        zIndex: 999,
        icon: {
          content: `
            <div style="display:flex; flex-direction:column; align-items:center;">
              <div style="width:10px; height:10px; background:#ff4d4f; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.3);"></div>
              <div style="margin-top:4px; background:rgba(44,62,80,0.9); color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:900;">KIPFA</div>
            </div>`,
          anchor: new window.naver.maps.Point(25, 10),
        }
      });
    };

    if (window.naver.maps.Service) {
      window.naver.maps.Service.geocode({ query: '송파구 올림픽로 293-19' }, (status: any, response: any) => {
        if (status === window.naver.maps.Service.Status.OK && response.v2.meta.totalCount > 0) {
          const item = response.v2.addresses[0];
          drawOfficeMarker(new window.naver.maps.Point(item.x, item.y));
        } else {
          drawOfficeMarker(initialLocation);
        }
      });
    } else {
      drawOfficeMarker(initialLocation);
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
      content: `<div style="padding:12px; min-width:140px; font-family: Pretendard; cursor:pointer;" onclick="window.dispatchEvent(new CustomEvent('mapClick', {detail:'${menu.id}'}))">
                   <div style="font-weight:900; font-size:14px; color:#333; margin-bottom:2px;">${menu.shop_name}</div>
                   <div style="font-size:11px; color:#3498db; font-weight:700;">목록으로 이동 ➔</div>
                </div>`,
      borderWidth: 0,
      disableAnchor: true,
      backgroundColor: "white",
      pixelOffset: new window.naver.maps.Point(0, -10)
    });

    window.naver.maps.Event.addListener(marker, "click", () => {
      Object.values(infoWindowsRef.current).forEach((iw: any) => iw.close());
      infoWindow.open(mapRef.current, marker);
      if (onMarkerClick) onMarkerClick(menu.id); // ✨ 핀 클릭 시 목록 이동
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
    if (!mapRef.current || !window.naver?.maps?.Service) return;
    Object.values(markersRef.current).forEach((marker: any) => marker.setMap(null));
    markersRef.current = {}; infoWindowsRef.current = {};

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
