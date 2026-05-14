"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import NaverMap from "../components/NaverMap";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CATEGORY_EMOJI: Record<string, string> = {
  "한식": "🍚 한식",
  "중식": "🥢 중식",
  "일식": "🍣 일식",
  "양식": "🍝 양식",
  "분식": "🥘 분식",
  "기타": "🍽️ 기타"
};

const mapCategory = (naverCategory: string) => {
  if (naverCategory.includes('한식')) return '한식';
  if (naverCategory.includes('중식')) return '중식';
  if (naverCategory.includes('일식')) return '일식';
  if (naverCategory.includes('양식') || naverCategory.includes('이탈리아')) return '양식';
  if (naverCategory.includes('분식')) return '분식';
  return '기타';
};

export default function LunchApp() {
  const [session, setSession] = useState<{ pin: string, name: string } | null>(null);
  const [pin, setPin] = useState("");
  const [menus, setMenus] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"pick" | "all">("pick");

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [reactionLoading, setReactionLoading] = useState<{ id: string, type: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOption, setSortOption] = useState<"latest" | "likes">("latest");

  const headerRef = useRef<HTMLDivElement>(null);
  const [stickyTop, setStickyTop] = useState(135);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isScrollDown, setIsScrollDown] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit" | "repick">("add");
  const [editTargetId, setEditTargetId] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [mapTargetShop, setMapTargetShop] = useState<{ name: string, t: number } | null>(null);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("폐업/이전");

  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<any>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  // 당겨서 새로고침 관련 State
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);

  // ✨ PC 버전 카테고리 마우스 드래그를 위한 Ref 및 State
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const [formData, setFormData] = useState({
    visitDate: "",
    category: "한식",
    shopName: "",
    shopUrl: "",
    address: "",
    road_address: "",
    menu1: "",
    menu2: "",
    menu3: ""
  });

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const dateOptions = useMemo(() => {
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    let day = today.getDay();
    let diff = today.getDate() - day + (day === 0 ? -6 : 1);
    let start = new Date(today);
    start.setDate(diff);

    const offsets = [
      { d: 2, l: '이번주 수' },
      { d: 4, l: '이번주 금' },
      { d: 9, l: '다음주 수' },
      { d: 11, l: '다음주 금' }
    ];
    return offsets.map(o => {
      let d = new Date(start);
      d.setDate(start.getDate() + o.d);
      if (d >= today) {
        let f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { label: `[${o.l}] ${f}`, value: f };
      }
      return null;
    }).filter(Boolean) as { label: string, value: string }[];
  }, []);

  useEffect(() => {
    const savedPin = localStorage.getItem("lunchUserPin");
    const savedName = localStorage.getItem("lunchUserName");
    if (savedPin && savedName) {
      setSession({ pin: savedPin, name: savedName });
      fetchMenus();
    } else {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dateOptions.length > 0 && !formData.visitDate) {
      setFormData(prev => ({ ...prev, visitDate: dateOptions[0].value }));
    }
  }, [dateOptions]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsScrollDown(false);
    setIsMapOpen(false);
  }, [activeTab]);

  useEffect(() => {
    let lastY = window.scrollY;
    const handleScroll = () => {
      const currentY = window.scrollY;
      setIsScrolled(currentY > 10);
      if (currentY > 50 && currentY > lastY + 15) {
        setIsScrollDown(true);
      } else if (currentY < lastY - 15 || currentY <= 50) {
        setIsScrollDown(false);
      }
      lastY = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const updateStickyGap = () => {
      if (headerRef.current) {
        setStickyTop(Math.floor(headerRef.current.getBoundingClientRect().height) - 1);
      }
    };
    if (session) {
      updateStickyGap();
      window.addEventListener("resize", updateStickyGap);
    }
    return () => window.removeEventListener("resize", updateStickyGap);
  }, [session, activeTab]);

  const fetchMenus = async (silent = false) => {
    if (!silent && menus.length === 0 && !isRefreshing) setIsInitialLoading(true);
    try {
      const { data, error } = await supabase.from('menus').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setMenus(data);
    } catch (e) {
      showToast("🚨 데이터 로딩 실패");
    } finally {
      setIsInitialLoading(false);
      setIsLoading(false);
      setIsRefreshing(false);
      setPullDistance(0);
    }
  };

  const searchShop = async () => {
    if (!keyword.trim()) return;
    setIsSearching(true);
    let finalKeyword = keyword.trim();
    if (!finalKeyword.includes('송파') && !finalKeyword.includes('잠실') && !finalKeyword.includes('방이') && !finalKeyword.includes('가락')) {
      finalKeyword = `송파구 ${finalKeyword}`;
    }
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(finalKeyword)}`);
      const data = await res.json();
      setSearchResults(data.items || []);
      if (data.items?.length === 0) showToast("검색 결과가 없습니다.");
    } catch (e) {
      showToast("검색 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectShop = (item: any) => {
    const cleanTitle = item.title.replace(/<[^>]*>?/gm, '');
    setFormData(prev => ({
      ...prev,
      shopName: cleanTitle,
      category: mapCategory(item.category),
      shopUrl: `https://map.naver.com/v5/search/${encodeURIComponent(cleanTitle)}`,
      address: item.address || '',
      road_address: item.roadAddress || ''
    }));
    setSearchResults([]);
    setKeyword("");
    showToast(`✅ ${cleanTitle} 정보 입력 완료!`);
    checkDuplicate('name', cleanTitle);
  };

  const handleLogin = async () => {
    if (pin.length !== 4) return showToast("⚠️ 4자리 번호를 입력해주세요.");
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('users').select('name').eq('pin', pin).single();
      if (data) {
        localStorage.setItem("lunchUserPin", pin);
        localStorage.setItem("lunchUserName", data.name);
        setSession({ pin: pin, name: data.name });
        showToast(`환영합니다, ${data.name}님! 👋`);
        fetchMenus();
      } else {
        showToast("❌ 등록되지 않은 번호입니다.");
      }
    } catch (e) {
      showToast("🚨 서버 연결 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("lunchUserPin");
    localStorage.removeItem("lunchUserName");
    setSession(null);
    setPin("");
  };

  const checkDuplicate = (type: 'name' | 'url', value: string) => {
    if (modalMode === 'edit' || modalMode === 'repick') return;
    if (value.trim().length < 2) return;
    const search = value.replace(/\s/g, '');
    const found = menus.find(m => {
      const target = (type === 'name' ? m.shop_name : (m.shop_url || '')).replace(/\s/g, '');
      return target.includes(search) || search.includes(target);
    });
    if (found && confirm(`이미 등록된 맛집인 것 같아요. [${found.shop_name}]\n정보를 불러올까요?`)) {
      fillFormWithData(found);
      setModalMode('edit');
      setEditTargetId(found.id);
    }
  };

  const fillFormWithData = (m: any) => {
    const ms = String(m.menu_details || '').split(', ');
    let formattedDate = m.visit_date || dateOptions[0]?.value || "";
    if (formattedDate && formattedDate.includes('.')) formattedDate = formattedDate.replace(/\./g, '-');

    setFormData(prev => ({
      ...prev,
      category: m.category || '한식',
      shopName: m.shop_name || '',
      shopUrl: m.shop_url || '',
      visitDate: formattedDate,
      address: m.address || '',
      road_address: m.road_address || '',
      menu1: ms[0] || '',
      menu2: ms[1] || '',
      menu3: ms[2] || ''
    }));
  };

  const openAddModal = () => {
    setModalMode("add");
    setEditTargetId(null);
    setFormData({
      visitDate: dateOptions[0]?.value || "",
      category: "한식",
      shopName: "",
      shopUrl: "",
      address: "",
      road_address: "",
      menu1: "",
      menu2: "",
      menu3: ""
    });
    setIsModalOpen(true);
  };

  const openEditModal = (m: any, isRepick = false) => {
    setModalMode(isRepick ? "repick" : "edit");
    setEditTargetId(isRepick ? null : m.id);
    fillFormWithData(m);
    if (!isRepick) {
      let vd = m.visit_date;
      if (vd && vd.includes('.')) vd = vd.replace(/\./g, '-');
      setFormData(prev => ({ ...prev, visitDate: vd }));
    } else {
      setFormData(prev => ({ ...prev, visitDate: dateOptions[0]?.value || "" }));
    }
    setIsModalOpen(true);
  };

  const handleModalSubmit = async () => {
    if (!formData.shopName.trim() || !formData.menu1.trim()) return showToast("⚠️ 가게명과 메뉴 1개는 필수입니다.");
    const cleanDate = formData.visitDate.replace(/\./g, '-').trim();

    const duplicate = menus.find(m => {
      const target = (m.shop_name || '').replace(/\s/g, '');
      const search = formData.shopName.replace(/\s/g, '');
      return (target.includes(search) || search.includes(target)) && m.visit_date === cleanDate && m.id !== editTargetId;
    });

    if (duplicate) return showToast(`🚨 이미 ${cleanDate}에 등록된 맛집입니다!`);

    setIsLoading(true);
    const combinedMenus = [formData.menu1, formData.menu2, formData.menu3].filter(Boolean).join(", ");
    const autoUrl = formData.shopUrl || `https://map.naver.com/v5/search/${encodeURIComponent(formData.shopName)}`;
    
    try {
      const payload = {
        author: session?.name,
        visit_date: cleanDate,
        category: formData.category,
        shop_name: formData.shopName.trim(),
        shop_url: autoUrl,
        menu_details: combinedMenus,
        price: "",
        address: formData.address,
        road_address: formData.road_address
      };

      if (modalMode === "edit" && editTargetId) {
        await supabase.from('menus').update(payload).eq('id', editTargetId);
      } else {
        await supabase.from('menus').insert([payload]);
      }
      
      showToast(modalMode === "edit" ? "✨ 수정 완료!" : "✨ 추천 완료!");
      setIsModalOpen(false);
      fetchMenus(true);
    } catch (e: any) {
      showToast("🚨 통신 오류: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const submitDeleteRequest = async () => {
    setIsLoading(true);
    setIsDeleteModalOpen(false);
    try {
      await supabase.from('menus').update({ delete_requested: 'Y', delete_reason: deleteReason }).eq('id', deleteTargetId);
      showToast("🗑️ 삭제 요청 접수!");
      fetchMenus(true);
    } catch (e) {
      showToast("🚨 오류 발생");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleReaction = async (id: string, action: string) => {
    setReactionLoading({ id, type: action });
    try {
      const targetMenu = menus.find(m => m.id === id);
      if (!targetMenu) return;

      const userPin = session?.pin as string;
      let isLikeAction = action === 'toggle_like';
      
      let likesArr = String(targetMenu.likes || '').split(',').filter(Boolean);
      let dislikesArr = String(targetMenu.dislikes || '').split(',').filter(Boolean);
      
      if (isLikeAction) {
        if (likesArr.includes(userPin)) {
          likesArr = likesArr.filter(p => p !== userPin);
        } else {
          likesArr.push(userPin);
          dislikesArr = dislikesArr.filter(p => p !== userPin);
        }
      } else {
        if (dislikesArr.includes(userPin)) {
          dislikesArr = dislikesArr.filter(p => p !== userPin);
        } else {
          dislikesArr.push(userPin);
          likesArr = likesArr.filter(p => p !== userPin);
        }
      }

      await supabase.from('menus').update({ likes: likesArr.join(','), dislikes: dislikesArr.join(',') }).eq('id', id);

      fetchMenus(true);
    } catch (e) {
      showToast("🚨 오류 발생");
    } finally {
      setReactionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast("📋 링크가 복사되었습니다!"))
      .catch(() => showToast("🚨 복사 실패"));
  };

  const handleShowLocationOnMap = (shopName: string) => {
    setIsMapOpen(true);
    setMapTargetShop({ name: shopName, t: Date.now() });
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const filteredData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    
    const thisS = new Date(today); thisS.setDate(diff);
    const nextS = new Date(thisS); nextS.setDate(thisS.getDate() + 7);
    const nextN = new Date(nextS); nextN.setDate(nextS.getDate() + 7);

    const tw: any[] = [];
    const nw: any[] = [];
    const pickNames: string[] = [];
    
    menus.forEach(m => {
      if (!m.visit_date) return;
      const cleanDateStr = String(m.visit_date).replace(/\./g, '-');
      const d = new Date(`${cleanDateStr}T00:00:00`);
      
      if (d >= thisS && d < nextN) pickNames.push(String(m.shop_name).replace(/\s/g, ""));
      if (d >= thisS && d < nextS) tw.push(m);
      else if (d >= nextS && d < nextN) nw.push(m);
    });

    const uniqueMap = new Map();
    menus.forEach(m => uniqueMap.set(String(m.shop_name).replace(/\s/g, ""), m));
    
    const allF = Array.from(uniqueMap.values()).reverse().filter(m => {
      const matchC = categoryFilter === "all" || m.category === categoryFilter;
      const matchS = String(m.shop_name).includes(searchQuery) || String(m.menu_details).includes(searchQuery);
      return matchC && matchS;
    }).sort((a, b) => {
      if (sortOption === 'likes') {
        const likesA = String(a.likes || '').split(',').filter(Boolean).length;
        const likesB = String(b.likes || '').split(',').filter(Boolean).length;
        return likesB - likesA;
      }
      return 0;
    });
    
    return { tw, nw, allF, pickNames };
  }, [menus, searchQuery, categoryFilter, sortOption]);

  const spinRoulette = () => {
    const pickList = [...filteredData.tw, ...filteredData.nw];
    if (pickList.length === 0) return showToast("⚠️ 추천된 회식 후보가 없습니다.");
    setIsRouletteOpen(true);
    setIsSpinning(true);
    
    let count = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * pickList.length);
      setRouletteResult(pickList[randomIndex]);
      count++;
      if (count > 15) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 100);
  };

  // ✨ iOS PWA에서의 당겨서 새로고침 민감도 완화
  const handleTouchStart = (e: any) => {
    if (window.scrollY <= 10) touchStartY.current = e.touches[0].clientY;
  };
  
  const handleTouchMove = (e: any) => {
    if (touchStartY.current > 0 && window.scrollY <= 10) {
      const y = e.touches[0].clientY;
      const diff = y - touchStartY.current;
      if (diff > 0 && diff < 150) setPullDistance(diff * 0.4);
    }
  };
  
  const handleTouchEnd = () => {
    if (pullDistance > 40) {
      setIsRefreshing(true);
      fetchMenus();
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  };

  // ✨ PC 가로 스크롤(드래그) 마우스 이벤트
  const onDragStart = (e: React.MouseEvent) => {
    if (!categoryScrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - categoryScrollRef.current.offsetLeft);
    setScrollLeft(categoryScrollRef.current.scrollLeft);
  };
  
  const onDragEnd = () => setIsDragging(false);
  
  const onDragMove = (e: React.MouseEvent) => {
    if (!isDragging || !categoryScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - categoryScrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // 스크롤 속도
    categoryScrollRef.current.scrollLeft = scrollLeft - walk;
  };

  // 로그인 화면
  if (!session) return (
    <div className="container" style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center', padding: '20px' }}>
      <h2 style={{ fontWeight: 900, marginBottom: '30px' }}>🏢 KIPFA 점심 추천</h2>
      {toastMessage && (
        <div className="toast" style={{ position: 'fixed', top: '40px', left: '50%', transform: 'translateX(-50%)', background: '#2c3e50', color: 'white', padding: '12px 24px', borderRadius: '30px', fontWeight: 700, zIndex: 100000, boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }}>
          {toastMessage}
        </div>
      )}
      <input 
        type="number" 
        className="pin-input" 
        placeholder="0000" 
        value={pin} 
        onChange={e => setPin(e.target.value.slice(0, 4))} 
        onKeyDown={e => e.key === 'Enter' && handleLogin()}
        style={{ fontSize: '24px', padding: '12px', width: '140px', textAlign: 'center', border: '2px solid #ddd', borderRadius: '12px', marginBottom: '20px' }} 
      />
      <button 
        className="btn" 
        onClick={handleLogin} 
        style={{ background: '#3498db', color: 'white', width: '100%', padding: '14px', borderRadius: '12px', border: 'none', fontWeight: 800 }}
      >
        {isLoading ? "확인중..." : "입장하기"}
      </button>
    </div>
  );

  return (
    <>
      <style>{`
        @import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");
        :root {
          --bg-main-rgb: 248, 249, 250;
          --text-main: #2c3e50;
          --text-sub: #7f8c8d;
          --card-bg: #ffffff;
          --border: #e1e5e8;
        }
        body { font-family: 'Pretendard', sans-serif; background: rgb(var(--bg-main-rgb)); margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        .container { max-width: 500px; margin: 0 auto; padding: 20px 20px 100px; }
        
        .sticky-top-area { position: sticky; top: 0; z-index: 9999; background: rgba(var(--bg-main-rgb), 0.95); backdrop-filter: blur(10px); padding: 20px 20px 5px; margin: 0 -20px 10px; transition: all 0.3s ease; border-bottom: 1px solid rgba(0,0,0,0.03); }
        
        .tabs { display: flex; background: #e9ecef; border-radius: 12px; padding: 4px; margin-bottom: 10px; }
        .tab { flex: 1; padding: 10px; text-align: center; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 14px; color: #868e96; transition: 0.2s; }
        .tab.active { background: #ffffff; color: #3498db; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        
        .section-title { position: sticky; z-index: 9998; font-size: 16px; color: var(--text-main); padding: 15px 20px 10px 20px; margin: 0 -20px 15px -20px; font-weight: 800; letter-spacing: -0.5px; background: rgba(var(--bg-main-rgb), 0.95); backdrop-filter: blur(12px); display: flex; align-items: center; }
        .section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); margin-left: 12px; }
        
        .filter-section { position: sticky; z-index: 9998; padding: 10px 20px; margin: 0 -20px 15px -20px; display: flex; flex-direction: column; gap: 12px; background: rgba(var(--bg-main-rgb), 0.95); backdrop-filter: blur(12px); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .filter-section.hidden { transform: translateY(-150%); pointer-events: none; }
        
        .pill-scroll-container { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px; scrollbar-width: none; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; width: 100%; cursor: grab; }
        .pill-scroll-container:active { cursor: grabbing; }
        .pill-scroll-container::-webkit-scrollbar { display: none; }
        .pill-btn { flex-shrink: 0; padding: 8px 16px; border-radius: 30px; border: 1px solid var(--border); background: var(--card-bg); color: var(--text-sub); font-weight: 700; font-size: 14px; white-space: nowrap; cursor: pointer; transition: 0.2s; }
        .pill-btn.active { background: #3498db; color: white; border-color: #3498db; }
        
        .menu-card { background: white; padding: 20px; border-radius: 18px; border: 1px solid #eee; margin-bottom: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: 0.2s; position: relative; cursor: pointer; }
        .menu-card.highlight { border-color: #3498db; box-shadow: 0 0 15px rgba(52,152,219,0.3); transform: scale(1.02); }
        .tag { background: #f1f3f5; padding: 4px 10px; border-radius: 6px; font-size: 11px; margin-right: 5px; font-weight: 800; color: #495057; }
        
        .reaction-group { display: flex; gap: 6px; }
        .like-btn { background: white; border: 1.5px solid #ffc9c9; color: #fa5252; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 5px; cursor: pointer; transition: 0.2s; }
        .like-btn.active { background: #fa5252; color: white; border-color: #fa5252; }
        .dislike-btn { background: white; border: 1.5px solid #e1e5e8; color: #7f8c8d; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 5px; cursor: pointer; transition: 0.2s; }
        .dislike-btn.active { background: #868e96; border-color: #868e96; color: white; }
        
        .naver-map-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: #fff; border: 1px solid #eee; padding: 8px 14px; border-radius: 12px; text-decoration: none; color: #333; font-weight: 800; font-size: 13px; }
        
        .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #2c3e50; color: white; padding: 12px 24px; border-radius: 30px; font-weight: 700; font-size: 14px; z-index: 100000; animation: slideDown 0.3s; box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
        @keyframes slideDown { from { top: -50px; } to { top: 20px; } }
        
        .map-floating-toggle { position: fixed; bottom: calc(30px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); background: #2c3e50; color: white; border: none; padding: 14px 28px; border-radius: 30px; font-weight: 900; box-shadow: 0 8px 20px rgba(0,0,0,0.2); z-index: 9999; cursor: pointer; transition: 0.2s; }
        
        .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; }
        .modal-content { background: white; padding: 25px; border-radius: 24px; width: 90%; max-width: 400px; max-height: 85vh; overflow-y: auto; }
        
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; font-weight: 800; margin-bottom: 6px; font-size: 13px; }
        .form-group input, .form-group select { width: 100%; padding: 12px; border: 1px solid #eee; border-radius: 10px; box-sizing: border-box; font-weight: 600; }
        
        .search-res { margin-top: 10px; border: 1px solid #eee; border-radius: 10px; overflow: hidden; }
        .search-item { padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; font-size: 13px; }
        .search-item:last-child { border-bottom: none; }
        .search-item:active { background: #f8f9fa; }
        
        .ptr-container { position: fixed; top: 0; left: 0; width: 100%; height: 60px; display: flex; justify-content: center; align-items: center; z-index: 9995; pointer-events: none; }
        .ptr-icon { width: 30px; height: 30px; background: white; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: flex; justify-content: center; align-items: center; font-size: 16px; transition: transform 0.3s; }
      `}</style>

      {toastMessage && <div className="toast">{toastMessage}</div>}

      <button 
        className={`map-floating-toggle ${isMapOpen ? 'open' : ''}`}
        style={isMapOpen ? { background: 'white', color: '#2c3e50', border: '2px solid #2c3e50' } : {}}
        onClick={() => {
          setIsMapOpen(!isMapOpen);
          if (!isMapOpen) {
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
          }
        }}
      >
        {isMapOpen ? '📄 목록 보기' : '🗺️ 지도 보기'}
      </button>

      <div className="ptr-container" style={{ transform: `translateY(${pullDistance > 0 ? pullDistance - 60 : -60}px)` }}>
        <div className="ptr-icon" style={{ transform: `rotate(${pullDistance * 2}deg)` }}>
          {isRefreshing ? '⏳' : '⬇️'}
        </div>
      </div>

      <div 
        className="container-wrapper" 
        style={pullDistance > 0 ? { transform: `translateY(${pullDistance * 0.5}px)` } : undefined} 
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleTouchEnd}
      >
        <div className="container">
          <div ref={headerRef} className="sticky-top-area">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontWeight: 900, fontSize: '20px' }}>🏢 KIPFA 점심 추천</h2>
                {/* ✨ PWA용 직관적인 새로고침 버튼 (항상 노출) */}
                <button onClick={() => fetchMenus()} style={{ background: '#f1f3f5', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px' }}>🔄</button>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#888' }}>
                {session.name}님 👋 
                <button onClick={handleLogout} style={{ border: 'none', background: '#e9ecef', padding: '4px 8px', borderRadius: '10px', marginLeft: '5px', fontWeight: 800, color: '#495057' }}>로그아웃</button>
              </div>
            </div>
            <div className="tabs">
              <div className={`tab ${activeTab === 'pick' ? 'active' : ''}`} onClick={() => setActiveTab('pick')}>📅 이번/다음주 Pick</div>
              <div className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>📂 전체 맛집</div>
            </div>
          </div>

          {isMapOpen && (
            <div style={{ marginBottom: '20px' }}>
              <NaverMap 
                menus={activeTab === 'pick' ? [...filteredData.tw, ...filteredData.nw] : filteredData.allF} 
                targetShop={mapTargetShop}
                onMarkerClick={(shopId) => {
                  const el = document.getElementById(`shop-card-${shopId}`);
                  if (el) {
                    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 150, behavior: 'smooth' });
                    setHighlightedCardId(shopId); 
                    setTimeout(() => setHighlightedCardId(null), 2000);
                  }
                }}
              />
            </div>
          )}

          <div>
            {activeTab === 'pick' && (
              <>
                <h3 className="section-title" style={{ top: stickyTop }}>🎯 이번주 수/금 회식 후보</h3>
                {filteredData.tw.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px', border: '2px dashed #dce0e5', borderRadius: '16px', color: '#adb5bd', fontWeight: 700, margin: '10px 0 20px 0' }}>
                    아직 등록된 후보가 없어요 🥲
                  </div>
                ) : (
                  filteredData.tw.map(m => <Card key={m.id} menu={m} type="pick" />)
                )}

                <h3 className="section-title" style={{ top: stickyTop }}>🗓️ 다음주 수/금 회식 후보</h3>
                {filteredData.nw.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px', border: '2px dashed #dce0e5', borderRadius: '16px', color: '#adb5bd', fontWeight: 700, margin: '10px 0 20px 0' }}>
                    아직 등록된 후보가 없어요 🥲
                  </div>
                ) : (
                  filteredData.nw.map(m => <Card key={m.id} menu={m} type="pick" />)
                )}
              </>
            )}
            
            {activeTab === 'all' && (
              <>
                <div className={`filter-section ${isScrollDown ? 'hidden' : ''}`} style={{ top: stickyTop }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="text" 
                      placeholder="🔍 가게명 검색..." 
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)} 
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #eee', boxSizing: 'border-box' }} 
                    />
                    <select value={sortOption} onChange={e => setSortOption(e.target.value as any)} style={{ width: '110px', padding: '12px', borderRadius: '10px', border: '1px solid #eee' }}>
                      <option value="latest">⏱️ 최신순</option>
                      <option value="likes">❤️ 인기순</option>
                    </select>
                  </div>
                  {/* ✨ PC 환경 마우스 드래그 스크롤 추가 완료 */}
                  <div 
                    className="pill-scroll-container" 
                    ref={categoryScrollRef}
                    onMouseDown={onDragStart}
                    onMouseLeave={onDragEnd}
                    onMouseUp={onDragEnd}
                    onMouseMove={onDragMove}
                    onTouchStart={e => e.stopPropagation()} 
                    onTouchMove={e => e.stopPropagation()}
                  >
                    <button className={`pill-btn ${categoryFilter === 'all' ? 'active' : ''}`} onClick={() => setCategoryFilter('all')}>🏷️ 전체</button>
                    {Object.keys(CATEGORY_EMOJI).map(c => (
                      <button key={c} className={`pill-btn ${categoryFilter === c ? 'active' : ''}`} onClick={() => setCategoryFilter(c)}>{CATEGORY_EMOJI[c]}</button>
                    ))}
                  </div>
                </div>
                {filteredData.allF.map(m => <Card key={m.id} menu={m} type="all" />)}
              </>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'pick' && (
        <button onClick={spinRoulette} style={{ position: 'fixed', bottom: 'calc(100px + env(safe-area-inset-bottom))', right: '20px', width: '56px', height: '56px', borderRadius: '50%', background: '#fff', color: '#333', border: '1px solid #ddd', fontSize: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 9998 }}>🎲</button>
      )}
      <button onClick={openAddModal} style={{ position: 'fixed', bottom: 'calc(30px + env(safe-area-inset-bottom))', right: '20px', width: '56px', height: '56px', borderRadius: '50%', background: '#3498db', color: 'white', border: 'none', fontSize: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 9998 }}>＋</button>

      {/* 모달 창들 */}
      {isRouletteOpen && (
        <div className="modal" onClick={() => !isSpinning && setIsRouletteOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <h3 style={{ marginTop: 0, fontWeight: 900 }}>🎲 오늘의 회식 Pick은?</h3>
            {rouletteResult && (
              <div style={{ background: '#f8f9fa', padding: '30px 20px', borderRadius: '20px', marginBottom: '20px' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>{CATEGORY_EMOJI[rouletteResult.category]?.split(' ')[0] || '🍽️'}</div>
                <div style={{ fontSize: '14px', color: '#888', fontWeight: 800, marginBottom: '5px' }}>{rouletteResult.category}</div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#3498db', wordBreak: 'keep-all' }}>{rouletteResult.shop_name}</div>
              </div>
            )}
            <button onClick={spinRoulette} disabled={isSpinning} style={{ width: '100%', background: '#3498db', color: 'white', padding: '15px', borderRadius: '12px', border: 'none', fontWeight: 900 }}>
              {isSpinning ? '고르는 중...' : '다시 돌리기 🔄'}
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, fontWeight: 900 }}>{modalMode === 'edit' ? '✏️ 맛집 수정' : '✨ 새로운 맛집 추천'}</h3>
            
            <div className="form-group" style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px' }}>
              <label>🔍 가게 검색</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" placeholder="예: 돈까스" value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchShop()} style={{ flex: 1 }} />
                <button onClick={searchShop} style={{ background: '#3498db', color: 'white', border: 'none', width: '46px', height: '46px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                   <span style={{ fontSize: '20px' }}>🔍</span>
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="search-res">
                  {searchResults.map((item, idx) => (
                    <div key={idx} className="search-item" onClick={() => selectShop(item)}>
                      <b dangerouslySetInnerHTML={{ __html: item.title }}></b><br />
                      <small style={{ color: '#888' }}>{item.category} | {item.address}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>📅 방문 예정일</label>
              <select value={formData.visitDate} onChange={e => setFormData({ ...formData, visitDate: e.target.value })}>
                {dateOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label>🏠 가게명</label>
              <input type="text" value={formData.shopName} disabled style={{ background: '#f1f3f5' }} />
            </div>
            
            <div className="form-group">
              <label>🍽️ 대표 메뉴 (필수 1개)</label>
              <input type="text" placeholder="메뉴 1" style={{ marginBottom: '5px' }} value={formData.menu1} onChange={e => setFormData({ ...formData, menu1: e.target.value })} />
              <input type="text" placeholder="메뉴 2 (선택)" style={{ marginBottom: '5px' }} value={formData.menu2} onChange={e => setFormData({ ...formData, menu2: e.target.value })} />
              <input type="text" placeholder="메뉴 3 (선택)" value={formData.menu3} onChange={e => setFormData({ ...formData, menu3: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={handleModalSubmit} style={{ flex: 2, background: '#3498db', color: 'white', padding: '15px', borderRadius: '12px', border: 'none', fontWeight: 900 }}>
                {modalMode === 'edit' ? '수정 완료!' : '추천 완료!'}
              </button>
              <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, background: '#f1f3f5', color: '#495057', padding: '15px', borderRadius: '12px', border: 'none', fontWeight: 900 }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="modal" onClick={() => setIsDeleteModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#e74c3c', marginTop: 0, fontWeight: 900 }}>🚨 맛집 삭제 요청</h3>
            <div className="form-group">
              <label>삭제 사유</label>
              <select value={deleteReason} onChange={e => setDeleteReason(e.target.value)}>
                <option value="폐업/이전">폐업/이전</option>
                <option value="가격상승">가격상승</option>
                <option value="재방문의사없음">재방문의사없음</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={submitDeleteRequest} style={{ flex: 1, background: '#e74c3c', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 800 }}>요청하기</button>
              <button onClick={() => setIsDeleteModalOpen(false)} style={{ flex: 1, background: '#eee', color: '#333', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 800 }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  function Card({ menu: m, type }: { menu: any, type: string }) {
    const likes = String(m.likes || '').split(',').filter(Boolean);
    const dislikes = String(m.dislikes || '').split(',').filter(Boolean);
    const isLiked = likes.includes(session?.pin || "");
    const isDisliked = dislikes.includes(session?.pin || "");

    return (
      <div 
        id={`shop-card-${m.id}`} 
        className={`menu-card ${highlightedCardId === m.id ? 'highlight' : ''}`} 
        onClick={() => handleShowLocationOnMap(m.shop_name)}
      >
        {type === 'all' && (
          <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '5px' }}>
            <button onClick={(e) => { e.stopPropagation(); openEditModal(m, false); }} style={{ background: '#f8f9fa', border: '1px solid #ddd', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>수정</button>
            <button onClick={(e) => { e.stopPropagation(); setDeleteTargetId(m.id); setIsDeleteModalOpen(true); }} style={{ background: '#fff5f5', color: '#e74c3c', border: '1px solid #ffc9c9', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>삭제</button>
          </div>
        )}

        <div style={{ marginBottom: '10px' }}>
          <span className="tag">{CATEGORY_EMOJI[m.category] || m.category}</span>
          <span className="tag" style={{ background: '#fff9db', color: '#f08c00' }}>📅 {m.visit_date}</span>
        </div>
        
        <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 900 }}>{m.shop_name}</h3>
        <p style={{ margin: 0, color: '#555', fontSize: '14px', fontWeight: 600 }}>{m.menu_details}</p>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
          <a href={m.shop_url} target="_blank" onClick={e => e.stopPropagation()} className="naver-map-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16.0718 0H7.92817C3.54921 0 0 3.54921 0 7.92817V16.0718C0 20.4508 3.54921 24 7.92817 24H16.0718C20.4508 24 24 20.4508 24 16.0718V7.92817C24 3.54921 20.4508 0 16.0718 0Z" fill="#03C75A"/>
              <path d="M16.9242 17.5255H13.6702L9.42152 11.2335V17.5255H6.38818V6.47449H9.64219L13.8909 12.7665V6.47449H16.9242V17.5255Z" fill="white"/>
            </svg>
            네이버 지도
          </a>

          <div className="reaction-group">
            <button className={`like-btn ${isLiked ? 'active' : ''}`} onClick={e => { e.stopPropagation(); toggleReaction(m.id, 'toggle_like'); }} disabled={reactionLoading?.id === m.id}>
              {isLiked ? '❤️' : '🤍'} {likes.length}
            </button>
            <button className={`dislike-btn ${isDisliked ? 'active' : ''}`} onClick={e => { e.stopPropagation(); toggleReaction(m.id, 'toggle_dislike'); }} disabled={reactionLoading?.id === m.id}>
              👎 {dislikes.length}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
