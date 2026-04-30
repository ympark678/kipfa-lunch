"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ⭐️ Supabase 클라이언트 초기화 (금고에서 키 꺼내오기)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ⭐️ URL 크롤링용 구글 마이크로서비스 (기존 유지)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzRoJPOYW8FB1Ck69hOl56aluBxNDjUAPewlsTEgIvK39y6hShhx4SU6K2enx0R29NLAQ/exec";

const CATEGORY_EMOJI: Record<string, string> = {
  "한식": "🍚 한식", "중식": "🥢 중식", "일식": "🍣 일식", "양식": "🍝 양식", "분식": "🥘 분식", "기타": "🍽️ 기타"
};

export default function LunchApp() {
  const [pin, setPin] = useState("");
  const [session, setSession] = useState<{pin: string, name: string} | null>(null);
  const [menus, setMenus] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"pick" | "all">("pick");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [reactionLoading, setReactionLoading] = useState<{id: string, type: string} | null>(null);
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
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("폐업/이전");

  const [formData, setFormData] = useState({
    visitDate: "", category: "한식", shopName: "", shopUrl: "",
    priceMin: "9,000", priceMax: "15,000", menu1: "", menu2: "", menu3: "" 
  });

  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<any>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);

  const dateOptions = useMemo(() => {
    let today = new Date(); today.setHours(0,0,0,0);
    let day = today.getDay(); let diff = today.getDate() - day + (day === 0 ? -6 : 1);
    let start = new Date(today); start.setDate(diff);
    
    const offsets = [{d: 2, l: '이번주 수'}, {d: 4, l: '이번주 금'}, {d: 9, l: '다음주 수'}, {d: 11, l: '다음주 금'}];
    return offsets.map(o => {
      let d = new Date(start); d.setDate(start.getDate() + o.d);
      if (d >= today) {
        let f = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        return { label: `[${o.l}] ${f}`, value: f };
      }
      return null;
    }).filter(Boolean) as {label: string, value: string}[];
  }, []);

  const priceOptions = useMemo(() => {
    const opts = [];
    for (let i = 500; i <= 50000; i += 500) opts.push(i.toLocaleString());
    return opts;
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const savedPin = localStorage.getItem("lunchUserPin");
    const savedName = localStorage.getItem("lunchUserName");
    if (savedPin && savedName) { 
      setSession({ pin: savedPin, name: savedName }); 
      fetchMenus(); 
    } else { setIsInitialLoading(false); }
  }, []);

  useEffect(() => {
    if (dateOptions.length > 0 && !formData.visitDate) {
      setFormData(prev => ({ ...prev, visitDate: dateOptions[0].value }));
    }
  }, [dateOptions]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setIsScrollDown(false); }, [activeTab]);

  useEffect(() => {
    let lastY = window.scrollY;
    const handleScroll = () => {
      const currentY = window.scrollY;
      setIsScrolled(currentY > 10);
      if (currentY > 50 && currentY > lastY + 15) setIsScrollDown(true);
      else if (currentY < lastY - 15 || currentY <= 50) setIsScrollDown(false);
      lastY = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const updateStickyGap = () => { if (headerRef.current) setStickyTop(Math.floor(headerRef.current.getBoundingClientRect().height) - 1); };
    if (session) { updateStickyGap(); window.addEventListener("resize", updateStickyGap); }
    return () => window.removeEventListener("resize", updateStickyGap);
  }, [session, activeTab]);

  const fetchMenus = async (silent = false) => {
    if (!silent && menus.length === 0 && !isRefreshing) setIsInitialLoading(true);
    if (!silent && menus.length > 0 && !isRefreshing) setIsLoading(true);

    try {
      const { data, error } = await supabase.from('menus').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setMenus(data);
    } catch (e) { 
      showToast("🚨 데이터 로딩 실패"); 
    } finally { 
      setIsInitialLoading(false); setIsLoading(false); setIsRefreshing(false); setPullDistance(0);
    }
  };

  const fetchShopNameFromServer = async (url: string) => {
    showToast("🔍 가게 정보 분석 중...");
    try {
      const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "parse_url", url }) });
      const result = await res.json();
      if (result.success && result.shopName) {
        setFormData(prev => ({ ...prev, shopName: result.shopName }));
        showToast(`✨ '${result.shopName}' 정보를 가져왔습니다.`);
        checkDuplicate('name', result.shopName);
      } else { showToast("⚠️ 가게 이름을 불러오지 못했습니다."); }
    } catch (e) { console.error(e); }
  };

  const handleUrlBlur = () => {
    const val = formData.shopUrl;
    if (!val) return;

    const urlMatch = val.match(/(https?:\/\/[^\s]+)/);
    const cleanUrl = urlMatch ? urlMatch[0] : val;

    let newName = formData.shopName;
    let foundLocally = false;

    if (val.includes("[네이버") || val.includes("[카카오맵]")) {
      const lines = val.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length >= 2 && lines[0].includes("[네이버")) { newName = lines[1]; foundLocally = true; } 
      else if (lines.length > 0 && lines[0].includes("[카카오맵]")) { newName = lines[0].replace("[카카오맵]", "").trim(); foundLocally = true; }
    }

    setFormData(prev => ({ ...prev, shopUrl: cleanUrl, shopName: foundLocally ? newName : prev.shopName }));

    if (foundLocally) {
      showToast(`✨ 가게 이름 자동 입력 완료!`); checkDuplicate('name', newName);
    } else if (!newName && (cleanUrl.includes("naver") || cleanUrl.includes("kakao"))) {
      fetchShopNameFromServer(cleanUrl);
    }
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
    } catch (e) { showToast("🚨 서버 연결 실패"); } finally { setIsLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem("lunchUserPin"); localStorage.removeItem("lunchUserName");
    setSession(null); setPin("");
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
      fillFormWithData(found); setModalMode('edit'); setEditTargetId(found.id);
    }
  };

  const fillFormWithData = (m: any) => {
    const ms = String(m.menu_details || '').split(', ');
    const ps = String(m.price || '').match(/[\d,]+/g);
    setFormData(prev => ({
      ...prev, category: m.category || '한식', shopName: m.shop_name || '', shopUrl: m.shop_url || '',
      menu1: ms[0] || '', menu2: ms[1] || '', menu3: ms[2] || '',
      priceMin: (ps && ps[0]) ? ps[0] : "9,000", priceMax: (ps && ps[1]) ? ps[1] : "15,000"
    }));
  };

  const openAddModal = () => {
    setModalMode("add"); setEditTargetId(null);
    setFormData({ visitDate: dateOptions[0]?.value || "", category: "한식", shopName: "", shopUrl: "", priceMin: "9,000", priceMax: "15,000", menu1: "", menu2: "", menu3: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (m: any, isRepick = false) => {
    setModalMode(isRepick ? "repick" : "edit"); setEditTargetId(isRepick ? null : m.id);
    fillFormWithData(m);
    if (!isRepick) setFormData(prev => ({ ...prev, visitDate: m.visit_date }));
    else setFormData(prev => ({ ...prev, visitDate: dateOptions[0]?.value || "" }));
    setIsModalOpen(true);
  };

  const handleModalSubmit = async () => {
    if (!formData.shopName.trim() || !formData.menu1.trim()) return showToast("⚠️ 가게명, 대표메뉴1을 입력하세요.");
    
    const duplicate = menus.find(m => {
      const target = (m.shop_name || '').replace(/\s/g, '');
      const search = formData.shopName.replace(/\s/g, '');
      return (target.includes(search) || search.includes(target)) && m.visit_date === formData.visitDate && m.id !== editTargetId;
    });

    if (duplicate) return showToast(`🚨 이미 ${formData.visitDate}에 등록된 맛집입니다!`);

    setIsLoading(true);
    const urlMatch = formData.shopUrl.match(/(https?:\/\/[^\s]+)/);
    const combinedMenus = [formData.menu1, formData.menu2, formData.menu3].filter(Boolean).join(", ");
    
    try {
      const payload = { 
        author: session?.name, 
        visit_date: formData.visitDate, 
        category: formData.category, 
        shop_name: formData.shopName.trim(), 
        shop_url: urlMatch ? urlMatch[1] : formData.shopUrl, 
        menu_details: combinedMenus, 
        price: `${formData.priceMin}원 ~ ${formData.priceMax}원`
      };
      
      if (modalMode === "edit" && editTargetId) {
        await supabase.from('menus').update(payload).eq('id', editTargetId);
      } else {
        await supabase.from('menus').insert([payload]);
      }
      
      showToast(modalMode === "edit" ? "✨ 수정 완료!" : "✨ 추천 완료!");
      setIsModalOpen(false); fetchMenus(true);
    } catch (e) { showToast("🚨 통신 오류"); } finally { setIsLoading(false); }
  };

  const submitDeleteRequest = async () => {
    setIsLoading(true); setIsDeleteModalOpen(false);
    try {
      await supabase.from('menus').update({ delete_requested: 'Y', delete_reason: deleteReason }).eq('id', deleteTargetId);
      showToast("🗑️ 삭제 요청 접수!"); fetchMenus(true);
    } catch (e) { showToast("🚨 오류 발생"); } finally { setIsLoading(false); }
  };

  // ⭐️ 에러 났던 범인 (filter) 완벽 수정
  const toggleReaction = async (id: string, action: string) => {
    setReactionLoading({ id, type: action });
    try {
      const targetMenu = menus.find(m => m.id === id);
      if (!targetMenu) return;

      let isLike = action === 'toggle_like';
      let listStr = String(isLike ? (targetMenu.likes || '') : (targetMenu.dislikes || ''));
      let arr = listStr.split(',').filter((x: string) => x.trim() !== ''); // 에러 해결!
      
      let isCancel = arr.includes(session?.pin as string);
      if (isCancel) arr = arr.filter(p => p !== session?.pin);
      else arr.push(session?.pin as string);

      const updateData = isLike ? { likes: arr.join(',') } : { dislikes: arr.join(',') };
      
      await supabase.from('menus').update(updateData).eq('id', id);

      fetchMenus(true);
      if (isCancel) showToast(isLike ? "🤍 좋아요가 취소되었습니다." : "👎 싫어요가 취소되었습니다.");
      else showToast(isLike ? "❤️ 좋아요를 눌렀습니다!" : "💔 싫어요를 눌렀습니다.");
      
    } catch (e) { showToast("🚨 오류 발생"); } finally { setReactionLoading(null); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast("📋 링크가 복사되었습니다!")).catch(() => showToast("🚨 복사 실패"));
  };

  const filteredData = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const day = today.getDay(); const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const thisS = new Date(today); thisS.setDate(diff);
    const nextS = new Date(thisS); nextS.setDate(thisS.getDate() + 7);
    const nextN = new Date(nextS); nextN.setDate(nextS.getDate() + 7);

    const tw: any[] = []; const nw: any[] = []; const pickNames: string[] = [];
    
    menus.forEach(m => {
      if (!m.visit_date) return;
      const d = new Date(m.visit_date + "T00:00:00");
      if (d >= thisS && d < nextN) pickNames.push(String(m.shop_name).replace(/\s/g, ""));
      if (d >= thisS && d < nextS) tw.push(m); else if (d >= nextS && d < nextN) nw.push(m);
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
    setIsRouletteOpen(true); setIsSpinning(true);
    let count = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * pickList.length);
      setRouletteResult(pickList[randomIndex]);
      count++;
      if (count > 15) { clearInterval(interval); setIsSpinning(false); }
    }, 100);
  };

  const handleTouchStart = (e: any) => { if (window.scrollY === 0) touchStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e: any) => {
    if (touchStartY.current > 0 && window.scrollY === 0) {
      const y = e.touches[0].clientY; const diff = y - touchStartY.current;
      if (diff > 0 && diff < 150) setPullDistance(diff * 0.4); 
    }
  };
  const handleTouchEnd = () => {
    if (pullDistance > 40) { setIsRefreshing(true); fetchMenus(); } 
    else { setPullDistance(0); }
    touchStartY.current = 0;
  };

  if (!session) return (
    <>
      <style>{`
        @import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");
        :root { --bg-main-rgb: 247, 249, 250; --text-main: #2c3e50; --border: #e1e5e8; --input-bg: #ffffff; }
        @media (prefers-color-scheme: dark) { :root { --bg-main-rgb: 18, 18, 18; --text-main: #e0e0e0; --border: #333333; --input-bg: #2c2c2c; } }
        body { font-family: 'Pretendard', sans-serif; background-color: rgb(var(--bg-main-rgb)); margin: 0; padding: 0; color: var(--text-main); } 
        .container { max-width: 500px; margin: 0 auto; padding: 0 20px 90px 20px; text-align: center; margin-top: 100px; } 
        input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
        .pin-input { font-size: 24px; padding: 12px; width: 160px; text-align: center; border: 2px solid var(--border); border-radius: 12px; margin-bottom: 25px; letter-spacing: 5px; background: var(--input-bg); color: var(--text-main); outline: none; transition: 0.3s; }
        .pin-input:focus { border-color: #3498db; box-shadow: 0 0 0 4px rgba(52,152,219,0.1); }
        .btn { background-color: #3498db; color: white; border: none; padding: 14px 20px; font-size: 16px; border-radius: 10px; cursor: pointer; width: 100%; font-weight: 800; transition: 0.2s; box-shadow: 0 4px 6px rgba(52,152,219,0.2); } 
        .btn:active { transform: scale(0.96); } 
        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: #3498db; color: white; padding: 12px 24px; border-radius: 30px; font-weight: 700; font-size: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 10000; animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        @keyframes slideUp { from { bottom: -50px; opacity: 0; } to { bottom: 30px; opacity: 1; } }
      `}</style>
      {toastMessage && <div className="toast">{toastMessage}</div>}
      <div className="container">
        <h1 style={{marginBottom: '10px', fontSize: '26px', fontWeight: '900', letterSpacing: '-1px'}}>🏢 KIPFA 점심 추천</h1>
        <p style={{color:'var(--text-main)', opacity: 0.7, marginBottom:'30px', fontWeight: '500'}}>휴대폰 뒷자리 4자리를 입력하세요</p>
        <input type="number" className="pin-input" placeholder="0000" value={pin} onChange={e => setPin(e.target.value.slice(0,4))} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        <button className="btn" onClick={handleLogin}>{isLoading ? "확인 중..." : "입장하기"}</button>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        @import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");
        :root { --bg-main-rgb: 247, 249, 250; --text-main: #2c3e50; --text-sub: #7f8c8d; --card-bg: #ffffff; --border: #e1e5e8; --input-bg: #ffffff; --skeleton-bg: linear-gradient(110deg, #ececec 8%, #f5f5f5 18%, #ececec 33%); --modal-bg: #ffffff; --btn-secondary: #ffffff; --empty-bg: #ffffff; --sticky-top: ${stickyTop}px; }
        @media (prefers-color-scheme: dark) { :root { --bg-main-rgb: 18, 18, 18; --text-main: #e0e0e0; --text-sub: #a0a0a0; --card-bg: #1e1e1e; --border: #333333; --input-bg: #2c2c2c; --skeleton-bg: linear-gradient(110deg, #2c2c2c 8%, #3a3a3a 18%, #2c2c2c 33%); --modal-bg: #1e1e1e; --btn-secondary: #2c2c2c; --empty-bg: #1e1e1e; } }
        body { font-family: 'Pretendard', sans-serif; background-color: rgb(var(--bg-main-rgb)); margin: 0; padding: 0; color: var(--text-main); overscroll-behavior-y: contain; transition: background-color 0.3s, color 0.3s; }
        input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
        .ptr-container { position: fixed; top: 0; left: 0; width: 100%; height: 60px; display: flex; justify-content: center; align-items: center; z-index: 50; pointer-events: none; }
        .ptr-icon { width: 30px; height: 30px; background: var(--card-bg); color: var(--text-main); border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: flex; justify-content: center; align-items: center; font-size: 16px; transition: transform 0.3s; }
        .ptr-icon.spinning { animation: spin 1s linear infinite; border: 3px solid var(--border); border-top: 3px solid #3498db; background: transparent; box-shadow: none; font-size: 0; }
        .container { max-width: 500px; margin: 0 auto; padding: 0 20px 90px 20px; } 
        .sticky-top-area { position: sticky; top: 0; z-index: 100; padding: 20px 20px 10px 20px; margin: 0 -20px; background: transparent; border-bottom: 1px solid transparent; transition: all 0.3s ease; }
        .sticky-top-area.scrolled { background: rgba(var(--bg-main-rgb), 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        .section-title { position: sticky; top: var(--sticky-top); z-index: 80; font-size: 16px; color: var(--text-main); border-bottom: 2px solid #3498db; padding: 15px 20px 10px 20px; margin: 0 -20px 15px -20px; font-weight: 800; letter-spacing: -0.5px; background: rgba(var(--bg-main-rgb), 0.90); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
        .filter-section { position: sticky; top: var(--sticky-top); z-index: 80; padding: 10px 20px; margin: 0 -20px 15px -20px; display: flex; flex-direction: column; gap: 12px; background: rgba(var(--bg-main-rgb), 0.90); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .filter-section.hidden { transform: translateY(-150%); pointer-events: none; }
        .pill-scroll-container { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px; scrollbar-width: none; }
        .pill-scroll-container::-webkit-scrollbar { display: none; }
        .pill-btn { padding: 8px 16px; border-radius: 30px; border: 1px solid var(--border); background: var(--card-bg); color: var(--text-sub); font-weight: 700; font-size: 14px; white-space: nowrap; cursor: pointer; transition: 0.2s; }
        .pill-btn.active { background: #3498db; color: white; border-color: #3498db; }
        .btn { background-color: #3498db; color: white; border: none; padding: 14px 20px; font-size: 16px; border-radius: 10px; cursor: pointer; width: 100%; font-weight: 800; transition: 0.2s; box-shadow: 0 4px 6px rgba(52,152,219,0.2); }
        .btn:active { transform: scale(0.96); } .btn:disabled { background-color: #bdc3c7; cursor: not-allowed; box-shadow: none; }
        .btn-secondary { background-color: var(--border); color: var(--text-main); margin-top: 10px; box-shadow: none; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .header h2 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: var(--text-main); }
        .header-loader { border: 3px solid var(--border); border-top: 3px solid #3498db; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; margin-left: 10px;}
        #user-info { font-size: 13px; font-weight: 800; background: #3498db20; color: #3498db; padding: 6px 12px; border-radius: 20px; margin-right: 5px; }
        .logout-btn { background: var(--card-bg); border: 1px solid var(--border); color: var(--text-sub); padding: 5px 12px; border-radius: 20px; font-size: 12px; cursor: pointer; font-weight: 800; transition: 0.2s; }
        .logout-btn:active { transform: scale(0.95); }
        .tabs { display: flex; gap: 10px; margin-bottom: 5px; }
        .tab { flex: 1; text-align: center; padding: 14px; background: var(--card-bg); border-radius: 12px; cursor: pointer; font-weight: 800; font-size: 14px; border: 1px solid var(--border); transition: 0.2s; color: var(--text-sub); }
        .tab.active { background: #3498db; color: white; border-color: #3498db; box-shadow: 0 4px 10px rgba(52,152,219,0.3); transform: translateY(-2px); }
        .search-input, .category-select { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid var(--border); box-sizing: border-box; font-size: 14px; font-weight: 600; background: var(--input-bg); color: var(--text-main); outline: none; transition: 0.3s; }
        .search-input:focus, .category-select:focus { border-color: #3498db; box-shadow: 0 0 0 3px rgba(52,152,219,0.1); }
        .menu-card { background: var(--card-bg); padding: 20px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.04); margin-bottom: 18px; border: 1px solid var(--border); position: relative; transition: 0.2s; }
        .menu-card:active { transform: scale(0.98); opacity: 0.9; }
        .card-top-actions { position: absolute; top: 18px; right: 18px; display: flex; gap: 6px; z-index: 5; }
        .menu-card h3 { margin: 0 0 6px 0; font-size: 18px; color: var(--text-main); padding-right: 90px; word-break: keep-all; font-weight: 800; letter-spacing: -0.5px; }
        .tag-container { margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 5px; padding-right: 90px; position: relative; z-index: 1; }
        .tag { display: inline-flex; align-items: center; background: var(--border); color: var(--text-main); padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; white-space: nowrap; opacity: 0.8;}
        .btn-mini { background: rgb(var(--bg-main-rgb)); border: 1px solid var(--border); padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer; color: var(--text-sub); transition: 0.2s; }
        .btn-mini:active { transform: scale(0.9); }
        .btn-mini.danger { color: #e74c3c; }
        .tag-date { background: #f08c0020; color: #f08c00; border: 1px solid #f08c0040;}
        .tag-status { background: #3498db20; color: #3498db; border: 1px solid #3498db40; } 
        .tag-deleted { background: #e74c3c20; color: #e74c3c; width: 100%; text-align: center; margin-bottom: 12px; font-size: 13px; padding: 8px; border-radius: 8px; font-weight: 800; box-sizing: border-box; }
        .menu-details { font-size: 13px; color: var(--text-sub); line-height: 1.6; margin-bottom: 15px; background: rgb(var(--bg-main-rgb)); padding: 12px; border-radius: 10px; font-weight: 600; }
        .map-link { color: #e67e22; text-decoration: none; font-weight: 800; font-size: 13px; background: #e67e2220; padding: 6px 12px; border-radius: 20px; transition: 0.2s; display: inline-block; }
        .map-link:active { transform: scale(0.95); }
        .reaction-group { display: flex; gap: 8px; }
        @keyframes heartPop { 0% { transform: scale(0.9); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
        .like-btn, .dislike-btn { background: var(--card-bg); color: var(--text-main); border: 1px solid var(--border); padding: 6px 12px; border-radius: 20px; cursor: pointer; font-weight: 800; display: flex; align-items: center; gap: 4px; font-size: 13px; transition: all 0.2s; }
        .like-btn.liked { background: #fa5252; color: white; border-color: #fa5252; animation: heartPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); } 
        .dislike-btn.liked { background: var(--text-sub); color: white; border-color: var(--text-sub); animation: heartPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .like-btn:disabled, .dislike-btn:disabled { opacity: 0.6; cursor: wait; transform: none; }
        .btn-outline { width: 100%; background: var(--card-bg); padding: 12px; font-size: 14px; font-weight: 800; border-radius: 10px; cursor: pointer; border: 1px solid #3498db; color: #3498db; margin-top: 15px; transition: 0.2s; }
        .btn-outline:active { background: #3498db20; transform: scale(0.98); }
        .fab-container { position: fixed; bottom: 25px; right: 25px; display: flex; flex-direction: column; gap: 12px; z-index: 1000; align-items: flex-end; }
        .fab { background: linear-gradient(135deg, #3498db, #2ecc71); color: white; width: 56px; height: 56px; border-radius: 50%; font-size: 28px; border: none; box-shadow: 0 6px 20px rgba(46, 204, 113, 0.4); display: flex; justify-content: center; align-items: center; cursor: pointer; transition: 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .fab:active { transform: scale(0.85); }
        .fab-secondary { background: var(--btn-secondary); color: var(--text-main); font-size: 26px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 2000; backdrop-filter: blur(3px); animation: fadeIn 0.2s ease-out; }
        .modal-content { background: var(--modal-bg); padding: 25px; border-radius: 24px; width: 90%; max-width: 400px; max-height: 85vh; overflow-y: auto; text-align: left; box-shadow: 0 20px 40px rgba(0,0,0,0.4); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); position: relative; }
        .modal-title-sticky { position: sticky; top: -25px; background: var(--modal-bg); z-index: 10; margin: -25px -25px 20px -25px; padding: 25px 25px 12px 25px; border-bottom: 3px solid #3498db; font-size: 22px; font-weight: 900; color: var(--text-main); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { 0% { transform: scale(0.9) translateY(20px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        .form-group { margin-bottom: 18px; } 
        .form-group label { display: block; margin-bottom: 8px; font-weight: 800; font-size: 13px; color: var(--text-main); }
        .form-group input, .form-group select { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 10px; box-sizing: border-box; font-size: 14px; font-weight: 500; outline: none; transition: 0.2s; background: var(--input-bg); color: var(--text-main); }
        .form-group input:focus, .form-group select:focus { border-color: #3498db; box-shadow: 0 0 0 3px rgba(52,152,219,0.1); }
        .spinner { border: 4px solid var(--border); border-top: 4px solid #3498db; border-radius: 50%; width: 45px; height: 45px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .skeleton { background: var(--border); background: var(--skeleton-bg); border-radius: 5px; background-size: 200% 100%; animation: 1.5s shine linear infinite; }
        .skeleton-card { background: var(--card-bg); padding: 20px; border-radius: 16px; border: 1px solid var(--border); margin-bottom: 18px; }
        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: #3498db; color: white; padding: 12px 24px; border-radius: 30px; font-weight: 700; font-size: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 10000; animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); white-space: nowrap; }
        .empty-state { text-align: center; padding: 50px 20px; background: var(--empty-bg); border-radius: 20px; border: 2px dashed var(--border); margin: 20px 0; animation: fadeIn 0.5s ease-out; }
        .empty-icon { font-size: 60px; margin-bottom: 15px; animation: float 3s ease-in-out infinite; }
        .empty-title { font-size: 18px; font-weight: 900; color: var(--text-main); margin-bottom: 8px; }
        .empty-desc { font-size: 14px; color: var(--text-sub); font-weight: 500; line-height: 1.5; }
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
      `}</style>

      {toastMessage && <div className="toast">{toastMessage}</div>}
      <div className="ptr-container" style={{ transform: `translateY(${pullDistance > 0 ? pullDistance - 60 : -60}px)` }}>
        <div className={`ptr-icon ${isRefreshing ? 'spinning' : ''}`} style={{ transform: `rotate(${pullDistance * 2}deg)` }}>{!isRefreshing && '⬇️'}</div>
      </div>
      <div className="container-wrapper" style={pullDistance > 0 ? { transform: `translateY(${pullDistance * 0.5}px)` } : undefined} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className="container">
          <div ref={headerRef} className={`sticky-top-area ${isScrolled ? 'scrolled' : ''}`}>
            <div className="header">
              <div style={{display:'flex', alignItems:'center'}}><h2>KIPFA 점심 추천</h2>{isLoading && !isInitialLoading && !isRefreshing && <div className="header-loader"></div>}</div>
              <div><span id="user-info">👋 {session.name}님</span><button className="logout-btn" onClick={handleLogout}>로그아웃</button></div>
            </div>
            <div className="tabs"><div className={`tab ${activeTab === 'pick' ? 'active' : ''}`} onClick={() => setActiveTab('pick')}>📅 이번주/다음주 Pick</div><div className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>📂 전체 맛집 보기</div></div>
          </div>
          {isInitialLoading ? (
            <div style={{marginTop: '20px'}}><h3 className="section-title">데이터 로딩 중...</h3>{[1, 2, 3].map(i => (<div key={i} className="skeleton-card"><div className="skeleton" style={{width:'60px', height:'24px', marginBottom:'12px'}}></div><div className="skeleton" style={{width:'40%', height:'16px', marginBottom:'10px'}}></div><div className="skeleton" style={{width:'70%', height:'28px', marginBottom:'15px'}}></div><div className="skeleton" style={{width:'100%', height:'40px', borderRadius:'10px'}}></div></div>))}</div>
          ) : (
            <div style={{marginTop: '20px'}}>
              {activeTab === 'pick' && (
                <div><h3 className="section-title">🎯 이번주 수/금 회식 후보</h3>{filteredData.tw.length === 0 ? <div className="empty-state"><div className="empty-icon">🍳</div><div className="empty-title">후보가 없습니다.</div><div className="empty-desc">새로운 맛집을 공유해 주세요.</div></div> : filteredData.tw.map(m => <Card key={m.id} menu={m} type="pick" />)}<h3 className="section-title">🗓️ 다음주 수/금 회식 후보</h3>{filteredData.nw.length === 0 ? <div className="empty-state"><div className="empty-icon">🗓️</div><div className="empty-title">후보가 없습니다.</div><div className="empty-desc">새로운 맛집을 공유해 주세요.</div></div> : filteredData.nw.map(m => <Card key={m.id} menu={m} type="pick" />)}</div>
              )}
              {activeTab === 'all' && (
                <div>
                  <div className={`filter-section ${isScrollDown ? 'hidden' : ''}`}><div style={{ display: 'flex', gap: '10px' }}><input type="text" className="search-input" placeholder="🔍 맛집 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{flex: 1}} /><select className="category-select" style={{width: '120px'}} value={sortOption} onChange={e => setSortOption(e.target.value as any)}><option value="latest">⏱️ 최신순</option><option value="likes">❤️ 인기순</option></select></div><div className="pill-scroll-container"><button className={`pill-btn ${categoryFilter === 'all' ? 'active' : ''}`} onClick={() => setCategoryFilter('all')}>🏷️ 전체</button>{Object.keys(CATEGORY_EMOJI).map(c => <button key={c} className={`pill-btn ${categoryFilter === c ? 'active' : ''}`} onClick={() => setCategoryFilter(c)}>{CATEGORY_EMOJI[c]}</button>)}</div></div>
                  {filteredData.allF.length === 0 ? <div className="empty-state" style={{marginTop: '40px'}}><div className="empty-icon">🔍</div><div className="empty-title">결과가 없습니다.</div></div> : filteredData.allF.map(m => <Card key={m.id} menu={m} type="all" />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="fab-container">{activeTab === 'pick' && <button className="fab fab-secondary" onClick={spinRoulette}>🎲</button>}<button className="fab" onClick={openAddModal}>＋</button></div>
      {isRouletteOpen && (
        <div className="modal" onClick={() => !isSpinning && setIsRouletteOpen(false)}><div className="modal-content" style={{textAlign: 'center', padding: '40px 20px'}} onClick={e => e.stopPropagation()}><div className="modal-title-sticky" style={{textAlign: 'left', marginBottom: '20px'}}>🎲 오늘의 회식 Pick은?</div>{rouletteResult && (<div style={{background: 'rgb(var(--bg-main-rgb))', padding: '30px 20px', borderRadius: '20px', border: '2px solid var(--border)', marginBottom: '20px'}}><div style={{fontSize: '32px', marginBottom: '10px'}}>{CATEGORY_EMOJI[rouletteResult.category]?.split(' ')[0] || '🍽️'}</div><div style={{fontSize: '14px', color: 'var(--text-sub)', fontWeight: '800', marginBottom: '5px'}}>{rouletteResult.shop_name}</div><div style={{fontSize: '22px', fontWeight: '900', color: '#3498db', wordBreak: 'keep-all'}}>{rouletteResult.menu_details}</div></div>)}<button className="btn" onClick={spinRoulette} disabled={isSpinning}>{isSpinning ? '고르는 중...' : '다시 돌리기 🔄'}</button>{!isSpinning && rouletteResult && (<button className="btn-outline" onClick={() => copyToClipboard(`[오늘의 점심 룰렛 결과!]\n🏠 ${rouletteResult.shop_name}\n🍽️ 메뉴: ${rouletteResult.menu_details}\n📍 ${rouletteResult.shop_url}`)}>📤 결과 공유하기</button>)}</div></div>
      )}
      {isModalOpen && (
        <div className="modal" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-title-sticky">{modalMode === 'add' ? '✨ 새로운 메뉴 추천' : modalMode === 'edit' ? '✏️ 추천 정보 수정' : '🔄 다시 Pick 하기'}</div>
            <div className="form-group" style={modalMode === 'repick' ? { background: '#3498db10', padding: '15px', borderRadius: '12px', border: '1px solid #3498db30' } : {}}>
              <label style={modalMode === 'repick' ? { color: '#3498db', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } : {}}>추천 방문일 (수/금){modalMode === 'repick' && <span style={{ fontSize: '11px', backgroundColor: '#3498db20', color: '#3498db', padding: '3px 8px', borderRadius: '10px' }}>날짜 변경 필수!</span>}</label>
              <select value={formData.visitDate} onChange={e => setFormData({...formData, visitDate: e.target.value})} style={modalMode === 'repick' ? { border: '2px solid #3498db' } : {}}>{dateOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            </div>
            
            <div className="form-group"><label>지도 URL</label><input type="text" placeholder="네이버/카카오 지도 링크를 붙여넣으세요" value={formData.shopUrl} onChange={e => setFormData({...formData, shopUrl: e.target.value})} onBlur={handleUrlBlur} /></div>
            
            <div className="form-group"><label>가게명</label><input type="text" placeholder="링크를 붙여넣으면 자동 입력됩니다" value={formData.shopName} onChange={e => setFormData({...formData, shopName: e.target.value})} onBlur={e => checkDuplicate('name', e.target.value)} /></div>
            <div className="form-group"><label>카테고리</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>{Object.keys(CATEGORY_EMOJI).map(c => <option key={c} value={c}>{CATEGORY_EMOJI[c]}</option>)}</select></div>
            <div className="form-group"><label>대표 메뉴</label><input type="text" placeholder="메뉴 1 (필수)" style={{marginBottom:'8px'}} value={formData.menu1} onChange={e => setFormData({...formData, menu1: e.target.value})} /><input type="text" placeholder="메뉴 2 (선택)" style={{marginBottom:'8px'}} value={formData.menu2} onChange={e => setFormData({...formData, menu2: e.target.value})} /><input type="text" placeholder="메뉴 3 (선택)" value={formData.menu3} onChange={e => setFormData({...formData, menu3: e.target.value})} /></div>
            <div className="form-group"><label>가격대</label><div style={{display:'flex', alignItems:'center', gap:'8px'}}><select value={formData.priceMin} onChange={e => setFormData({...formData, priceMin: e.target.value})}>{priceOptions.map(p => <option key={p} value={p}>{p}</option>)}</select><span style={{fontSize:'13px', fontWeight:'800', color:'var(--text-sub)'}}>부터</span><select value={formData.priceMax} onChange={e => setFormData({...formData, priceMax: e.target.value})}>{priceOptions.map(p => <option key={p} value={p}>{p}</option>)}</select><span style={{fontSize:'13px', fontWeight:'800', color:'var(--text-sub)'}}>까지</span></div></div>
            <button className="btn" onClick={handleModalSubmit} style={{marginTop:'20px'}}>{modalMode === 'edit' ? '수정 완료' : '추천 완료'}</button><button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>닫기</button>
          </div>
        </div>
      )}
      {isDeleteModalOpen && (
        <div className="modal" onClick={() => setIsDeleteModalOpen(false)}><div className="modal-content" onClick={e => e.stopPropagation()}><div className="modal-title-sticky" style={{color: '#e74c3c', borderColor: '#e74c3c'}}>🚨 맛집 삭제 요청</div><p style={{fontSize:'13px', color:'var(--text-sub)', marginBottom:'20px', fontWeight:'600'}}>삭제 사유를 선택해 주세요.</p><div className="form-group"><label>삭제 사유</label><select value={deleteReason} onChange={e => setDeleteReason(e.target.value)}><option value="폐업/이전">폐업/이전</option><option value="가격상승">가격상승</option><option value="재방문의사없음">재방문의사없음</option></select></div><button className="btn" style={{background:'#e74c3c', color:'white'}} onClick={submitDeleteRequest}>요청하기</button><button className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>취소</button></div></div>
      )}
    </>
  );

  // ⭐️ 에러 났던 범인 (filter) 완벽 수정
  function Card({ menu: m, type }: { menu: any, type: string }) {
    const likes = String(m.likes || '').split(',').filter((x: string) => x.trim() !== ''); // 에러 해결!
    const dislikes = String(m.dislikes || '').split(',').filter((x: string) => x.trim() !== ''); // 에러 해결!
    const isDeleteRequested = m.delete_requested === 'Y';
    const dateStr = m.visit_date || '미정';
    const cleanName = (m.shop_name || '').replace(/\s/g, '');
    const isPicked = filteredData.pickNames.includes(cleanName);
    const isLiking = reactionLoading?.id === m.id && reactionLoading?.type === 'toggle_like';
    const isDisliking = reactionLoading?.id === m.id && reactionLoading?.type === 'toggle_dislike';
    
    return (
      <div className="menu-card">{type === 'all' && (<div className="card-top-actions"><button className="btn-mini" onClick={() => openEditModal(m, false)}>✏️ 수정</button><button className="btn-mini danger" onClick={() => { setDeleteTargetId(m.id); setIsDeleteModalOpen(true); }} disabled={isDeleteRequested}>{isDeleteRequested ? '요청중' : '🗑️ 삭제'}</button></div>)}{isDeleteRequested && <div className="tag-deleted">🚨 삭제 요청 검토 중: {m.delete_reason || '사유 미상'}</div>}<div className="tag-container"><span className="tag">{CATEGORY_EMOJI[m.category] || m.category}</span><span className="tag tag-date">📅 {dateStr}</span>{type === 'all' && isPicked && <span className="tag tag-status">🎯 Pick 완료</span>}</div><div style={{fontWeight:'800', color:'var(--text-sub)', marginBottom:'5px', fontSize:'12px'}}>🏠 {m.shop_name}</div><h3>{m.menu_details}</h3><div className="menu-details">📍 {m.price}</div><div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}><a href={m.shop_url} target="_blank" className="map-link">🗺️ 지도/정보 보기</a>{type === 'pick' ? (<div className="reaction-group"><button className={`like-btn ${likes.includes(session?.pin as string) ? 'liked' : ''}`} onClick={() => toggleReaction(m.id, 'toggle_like')} disabled={isLiking || isDisliking}>{isLiking ? '⏳' : (likes.includes(session?.pin as string) ? '❤️' : '🤍')} {likes.length}</button><button className={`dislike-btn ${dislikes.includes(session?.pin as string) ? 'liked' : ''}`} onClick={() => toggleReaction(m.id, 'toggle_dislike')} disabled={isLiking || isDisliking}>{isDisliking ? '⏳' : (dislikes.includes(session?.pin as string) ? '💔' : '👎')} {dislikes.length}</button></div>) : (<span style={{fontSize:'12px', color:'#e74c3c', fontWeight:'800', background:'#e74c3c20', padding:'6px 12px', borderRadius:'12px'}}>❤️ 좋아요 {likes.length}개</span>)}</div>{type === 'all' && (<div style={{display: 'flex', gap: '10px', marginTop: '15px'}}><button className="btn-outline" style={{flex: 2}} onClick={() => openEditModal(m, true)}>🔄 다시 Pick 하기</button><button className="btn-outline" style={{flex: 1, borderColor: 'var(--border)', color: 'var(--text-sub)'}} onClick={() => copyToClipboard(`[맛집 추천] ${m.shop_name}\n🍽️ 메뉴: ${m.menu_details}\n📍 ${m.shop_url}`)}>📤 공유</button></div>)}</div>
    );
  }
}