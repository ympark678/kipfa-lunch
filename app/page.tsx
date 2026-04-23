"use client";

import { useState, useEffect, useMemo, useRef } from "react";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzRoJPOYW8FB1Ck69hOl56aluBxNDjUAPewlsTEgIvK39y6hShhx4SU6K2enx0R29NLAQ/exec";
const USER_MAP: Record<string, string> = {
  "4488": "유인호", "7991": "송선애", "4611": "신동철", "1121": "이소영",
  "5555": "문진곤", "4946": "유광열", "5015": "박영민", "2253": "조은지", "8830": "이수연",
};

// ⭐️ 카테고리별 직관적인 이모지 매핑
const CATEGORY_EMOJI: Record<string, string> = {
  "한식": "🍚 한식",
  "중식": "🥢 중식",
  "일식": "🍣 일식",
  "양식": "🍝 양식",
  "분식": "🥘 분식",
  "기타": "🍽️ 기타"
};

export default function LunchApp() {
  const [pin, setPin] = useState("");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [menus, setMenus] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"pick" | "all">("pick");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("처리 중...");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  const headerRef = useRef<HTMLDivElement>(null);
  const [stickyTop, setStickyTop] = useState(135);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit" | "repick">("add");
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("폐업/이전");

  const [formData, setFormData] = useState({
    visitDate: "", category: "한식", shopName: "", shopUrl: "",
    priceMin: "9,000", priceMax: "15,000",
    menu1: "", menu2: "", menu3: "" 
  });

  const [showA2HS, setShowA2HS] = useState(false);

  const dateOptions = useMemo(() => {
    let today = new Date(); today.setHours(0,0,0,0);
    let day = today.getDay(), diff = today.getDate() - day + (day === 0 ? -6 : 1);
    let start = new Date(today); start.setDate(diff);
    const offsets = [{d:2, l:'이번주 수'}, {d:4, l:'이번주 금'}, {d:9, l:'다음주 수'}, {d:11, l:'다음주 금'}];
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

  const showLoader = (text: string) => { setLoadingText(text); setIsLoading(true); };
  const hideLoader = () => setIsLoading(false);

  useEffect(() => {
    const hideA2HS = localStorage.getItem('hideA2HS');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (!isStandalone && hideA2HS !== 'true') {
      if (/iphone|ipad|ipod|android/.test(window.navigator.userAgent.toLowerCase())) {
        setTimeout(() => setShowA2HS(true), 2000);
      }
    }
  }, []);

  useEffect(() => {
    const updateStickyGap = () => { if (headerRef.current) setStickyTop(Math.floor(headerRef.current.getBoundingClientRect().height) - 1); };
    if (currentUser) { updateStickyGap(); window.addEventListener("resize", updateStickyGap); }
    return () => window.removeEventListener("resize", updateStickyGap);
  }, [currentUser, activeTab]);

  useEffect(() => {
    const savedPin = localStorage.getItem("lunchUserPin");
    if (savedPin && USER_MAP[savedPin]) { setCurrentUser(savedPin); fetchMenus(false); }
  }, []);

  useEffect(() => {
    if (dateOptions.length > 0 && !formData.visitDate) {
      setFormData(prev => ({ ...prev, visitDate: dateOptions[0].value }));
    }
  }, [dateOptions]);

  const fetchMenus = async (silent = false) => {
    if (!silent) showLoader("데이터 로딩 중...");
    try {
      const res = await fetch(SCRIPT_URL);
      const data = await res.json();
      setMenus(data);
    } catch (e) { alert("데이터 로딩 실패"); } finally { hideLoader(); }
  };

  const handleLogin = () => {
    if (USER_MAP[pin]) { localStorage.setItem("lunchUserPin", pin); setCurrentUser(pin); fetchMenus(false); }
    else alert("등록되지 않은 번호입니다.");
  };

  const checkDuplicate = (type: 'name' | 'url', value: string) => {
    if (modalMode === 'edit' || modalMode === 'repick') return;
    if (value.trim().length < 2) return;
    const search = value.replace(/\s/g, '');
    const found = menus.find(m => {
      const target = (type === 'name' ? m['가게명'] : (m['가게URL'] || '')).replace(/\s/g, '');
      return target.includes(search) || search.includes(target);
    });

    if (found && confirm(`이미 등록된 맛집인 것 같아요. [${found['가게명']}]\n정보를 불러올까요?`)) {
      fillFormWithData(found);
      setModalMode('edit');
      setEditTargetId(found['ID']);
    }
  };

  const fillFormWithData = (m: any) => {
    const ms = String(m['대표메뉴'] || '').split(', ');
    const ps = String(m['가격대'] || '').match(/[\d,]+/g);
    setFormData(prev => ({
      ...prev,
      category: m['카테고리'] || '한식',
      shopName: m['가게명'] || '',
      shopUrl: m['가게URL'] || '',
      menu1: ms[0] || '', menu2: ms[1] || '', menu3: ms[2] || '',
      priceMin: (ps && ps[0]) ? ps[0] : "9,000",
      priceMax: (ps && ps[1]) ? ps[1] : "15,000"
    }));
  };

  const openAddModal = () => {
    setModalMode("add");
    setEditTargetId(null);
    setFormData({ visitDate: dateOptions[0]?.value || "", category: "한식", shopName: "", shopUrl: "", priceMin: "9,000", priceMax: "15,000", menu1: "", menu2: "", menu3: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (m: any, isRepick = false) => {
    setModalMode(isRepick ? "repick" : "edit");
    setEditTargetId(isRepick ? null : m.ID);
    fillFormWithData(m);
    if (!isRepick) {
      setFormData(prev => ({ ...prev, visitDate: String(m["추천방문일"]).split("T")[0] }));
    }
    setIsModalOpen(true);
  };

  const handleModalSubmit = async () => {
    if (!formData.shopName.trim() || !formData.menu1.trim()) return alert("필수 항목(가게명, 대표메뉴1)을 입력하세요.");

    const duplicate = menus.find(m => {
      const target = (m['가게명'] || '').replace(/\s/g, '');
      const search = formData.shopName.replace(/\s/g, '');
      const dStr = String(m['추천방문일']).split('T')[0];
      return (target.includes(search) || search.includes(target)) && dStr === formData.visitDate && m['ID'] !== editTargetId;
    });

    if (duplicate) return alert(`🚨 이미 ${formData.visitDate}에 등록된 맛집입니다!`);

    showLoader("처리 중...");
    const urlMatch = formData.shopUrl.match(/(https?:\/\/[^\s]+)/);
    const combinedMenus = [formData.menu1, formData.menu2, formData.menu3].filter(Boolean).join(", ");
    
    try {
      const action = (modalMode === "edit") ? "edit_menu" : "add_menu";
      const payload = { 
        action, id: editTargetId, author: currentUser, visitDate: formData.visitDate, 
        category: formData.category, shopName: formData.shopName.trim(), shopUrl: urlMatch ? urlMatch[1] : '', 
        menus: combinedMenus, price: `${formData.priceMin}원 ~ ${formData.priceMax}원`
      };
      const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
      const result = await res.json();
      if (result.success) {
        alert(modalMode === "edit" ? "수정 완료!" : "추천 완료!");
        setIsModalOpen(false);
        fetchMenus(true);
      }
    } catch (e) { alert("통신 오류"); } finally { hideLoader(); }
  };

  const submitDeleteRequest = async () => {
    showLoader("삭제 요청 처리 중...");
    setIsDeleteModalOpen(false);
    try {
      const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "request_delete", id: deleteTargetId, reason: deleteReason }) });
      const result = await res.json();
      if (result.success) { alert("삭제 요청 접수!"); fetchMenus(true); }
    } catch (e) { alert("오류"); } finally { hideLoader(); }
  };

  const toggleReaction = async (id: string, action: string) => {
    showLoader("반영 중...");
    try {
      const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action, id, userPin: currentUser }) });
      const result = await res.json();
      if (result.success) fetchMenus(true);
    } catch (e) { alert("오류"); } finally { hideLoader(); }
  };

  const filteredData = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const day = today.getDay(); const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const thisS = new Date(today); thisS.setDate(diff);
    const nextS = new Date(thisS); nextS.setDate(thisS.getDate() + 7);
    const nextN = new Date(nextS); nextN.setDate(nextS.getDate() + 7);

    const tw: any[] = []; const nw: any[] = []; const pickNames: string[] = [];
    menus.forEach(m => {
      if (!m["추천방문일"]) return;
      const d = new Date(String(m["추천방문일"]).split("T")[0] + "T00:00:00");
      if (d >= thisS && d < nextN) pickNames.push(String(m["가게명"]).replace(/\s/g, ""));
      if (d >= thisS && d < nextS) tw.push(m); else if (d >= nextS && d < nextN) nw.push(m);
    });

    const uniqueMap = new Map();
    menus.forEach(m => uniqueMap.set(String(m["가게명"]).replace(/\s/g, ""), m));
    const allF = Array.from(uniqueMap.values()).reverse().filter(m => {
      const matchC = categoryFilter === "all" || m["카테고리"] === categoryFilter;
      const matchS = String(m["가게명"]).includes(searchQuery) || String(m["대표메뉴"]).includes(searchQuery);
      return matchC && matchS;
    });
    return { tw, nw, allF, pickNames };
  }, [menus, searchQuery, categoryFilter]);

  if (!currentUser) return (
    <>
      <style>{`body { font-family: 'Pretendard', -apple-system, sans-serif; background-color: #f7f9fa; margin: 0; padding: 0; color: #2c3e50; } .container { max-width: 500px; margin: 0 auto; padding: 0 20px 90px 20px; text-align: center; margin-top: 100px; } .pin-input { font-size: 24px; padding: 12px; width: 160px; text-align: center; border: 2px solid #ddd; border-radius: 12px; margin-bottom: 25px; letter-spacing: 5px; background: white; } .btn { background-color: #3498db; color: white; border: none; padding: 14px 20px; font-size: 16px; border-radius: 10px; cursor: pointer; width: 100%; font-weight: bold; transition: 0.2s; box-shadow: 0 4px 6px rgba(52,152,219,0.2); } .btn:active { transform: scale(0.98); } #a2hs-banner { position: fixed; bottom: -150px; left: 50%; transform: translateX(-50%); width: 90%; max-width: 400px; background: rgba(44, 62, 80, 0.95); color: white; padding: 16px 20px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: space-between; z-index: 10000; transition: bottom 0.5s; backdrop-filter: blur(5px); box-sizing: border-box; } #a2hs-banner.show { bottom: 25px; }`}</style>
      <div className="container">
        <h1 style={{marginBottom: '10px', fontSize: '26px'}}>🏢 KIPFA 점심 추천</h1>
        <p style={{color:'#7f8c8d', marginBottom:'30px'}}>휴대폰 뒷자리 4자리를 입력하세요</p>
        <input type="number" className="pin-input" placeholder="0000" value={pin} onChange={e => setPin(e.target.value.slice(0,4))} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        <button className="btn" onClick={handleLogin}>입장하기</button>
      </div>
      <div id="a2hs-banner" className={showA2HS ? "show" : ""}>
        <div style={{fontSize:'14px'}}>💡 <b>앱처럼 편리하게 쓰세요!</b><br/>브라우저 메뉴에서 <b>[홈 화면에 추가]</b>를 선택하세요.</div>
        <button style={{background:'none', border:'none', color:'white', fontSize:'20px', cursor:'pointer'}} onClick={() => {setShowA2HS(false); localStorage.setItem('hideA2HS', 'true');}}>×</button>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        :root { --sticky-top: ${stickyTop}px; }
        body { font-family: 'Pretendard', -apple-system, sans-serif; background-color: #f7f9fa; margin: 0; padding: 0; color: #2c3e50; }
        .container { max-width: 500px; margin: 0 auto; padding: 0 20px 90px 20px; } 
        .sticky-top-area { position: sticky; top: 0; background: #f7f9fa; z-index: 100; padding-top: 20px; padding-bottom: 5px; }
        .section-title { position: sticky; top: var(--sticky-top); background: rgba(247, 249, 250, 0.95); backdrop-filter: blur(5px); z-index: 90; font-size: 16px; color: #34495e; border-bottom: 2px solid #3498db; padding: 15px 0 10px 0; margin: 0 0 15px 0; font-weight: bold; }
        .filter-section { position: sticky; top: var(--sticky-top); background: rgba(247, 249, 250, 0.95); backdrop-filter: blur(5px); z-index: 90; padding: 10px 0; margin-bottom: 15px; display: flex; flex-direction: column; gap: 10px; }
        .btn { background-color: #3498db; color: white; border: none; padding: 14px 20px; font-size: 16px; border-radius: 10px; cursor: pointer; width: 100%; font-weight: bold; transition: 0.2s; box-shadow: 0 4px 6px rgba(52,152,219,0.2); }
        .btn:active { transform: scale(0.98); } .btn:disabled { background-color: #bdc3c7; cursor: not-allowed; box-shadow: none; }
        .btn-secondary { background-color: #95a5a6; margin-top: 10px; box-shadow: none; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .header h2 { margin: 0; font-size: 20px; font-weight: 800; }
        #user-info { font-size: 13px; font-weight: bold; background: #e8f4f8; color: #2980b9; padding: 6px 12px; border-radius: 20px; margin-right: 5px; }
        .logout-btn { background: white; border: 1px solid #ddd; color: #7f8c8d; padding: 5px 12px; border-radius: 20px; font-size: 12px; cursor: pointer; font-weight: bold; }
        .tabs { display: flex; gap: 10px; margin-bottom: 10px; }
        .tab { flex: 1; text-align: center; padding: 14px; background: white; border-radius: 12px; cursor: pointer; font-weight: bold; font-size: 14px; border: 1px solid #eee; transition: 0.3s; color: #7f8c8d; }
        .tab.active { background: #3498db; color: white; border-color: #3498db; box-shadow: 0 4px 10px rgba(52,152,219,0.3); }
        .search-input, .category-select { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid #e1e5e8; box-sizing: border-box; font-size: 14px; background: white; outline: none; }
        
        .menu-card { background: white; padding: 20px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.04); margin-bottom: 18px; border: 1px solid #e1e5e8; position: relative; }
        
        .card-top-actions { position: absolute; top: 18px; right: 18px; display: flex; gap: 6px; z-index: 5; }
        .menu-card h3 { margin: 0 0 6px 0; font-size: 18px; color: #2c3e50; padding-right: 90px; word-break: keep-all; }
        .tag-container { margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 5px; padding-right: 90px; position: relative; z-index: 1; }
        .tag { display: inline-flex; align-items: center; background: #f0f3f5; color: #555; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; }
        
        .btn-mini { background: #f1f3f5; border: none; padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; color: #7f8c8d; transition: 0.2s; }
        .btn-mini.danger { color: #e74c3c; }
        .tag-date { background: #fff9db; color: #f08c00; }
        .tag-status { background: #e3f2fd; color: #1976d2; border: 1px solid #bbdefb; } 
        .tag-deleted { background: #fee2e2; color: #e74c3c; width: 100%; text-align: center; margin-bottom: 12px; font-size: 12px; padding: 8px; border-radius: 8px; font-weight: bold; box-sizing: border-box; }
        .menu-details { font-size: 13px; color: #555; line-height: 1.6; margin-bottom: 15px; background: #f8f9fa; padding: 12px; border-radius: 10px; }
        .map-link { color: #e67e22; text-decoration: none; font-weight: bold; font-size: 13px; background: #fdf3e9; padding: 6px 12px; border-radius: 20px; }
        .reaction-group { display: flex; gap: 8px; }
        .like-btn, .dislike-btn { background: white; border: 1px solid #eee; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 4px; font-size: 13px; transition: 0.2s; }
        .like-btn.liked { background: #fa5252; color: white; border-color: #fa5252; } .dislike-btn.liked { background: #7f8c8d; color: white; border-color: #7f8c8d; }
        .btn-outline { width: 100%; background: white; padding: 12px; font-size: 14px; font-weight: bold; border-radius: 10px; cursor: pointer; border: 1px solid #3498db; color: #3498db; margin-top: 15px; transition: 0.2s; }
        .fab { position: fixed; bottom: 25px; right: 25px; background: linear-gradient(135deg, #3498db, #2ecc71); color: white; width: 64px; height: 64px; border-radius: 50%; font-size: 30px; border: none; box-shadow: 0 6px 20px rgba(46, 204, 113, 0.4); display: flex; justify-content: center; align-items: center; z-index: 1000; cursor: pointer; }
        .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 2000; backdrop-filter: blur(2px); }
        .modal-content { background: white; padding: 25px; border-radius: 20px; width: 90%; max-width: 400px; max-height: 85vh; overflow-y: auto; text-align: left; }
        .form-group { margin-bottom: 18px; } .form-group label { display: block; margin-bottom: 8px; font-weight: bold; font-size: 13px; color: #34495e; }
        .form-group input, .form-group select { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 10px; box-sizing: border-box; font-size: 14px; }
        #global-loader { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.9); z-index: 9999; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 45px; height: 45px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      {isLoading && <div id="global-loader"><div className="spinner"></div><div style={{fontWeight: 'bold', marginTop:'15px', color: '#2c3e50'}}>{loadingText}</div></div>}

      <div className="container">
        <div ref={headerRef} className="sticky-top-area">
          <div className="header">
            <h2>KIPFA 점심 추천</h2>
            <div><span id="user-info">👋 {USER_MAP[currentUser as string]}님</span><button className="logout-btn" onClick={() => { localStorage.removeItem("lunchUserPin"); setCurrentUser(null); }}>로그아웃</button></div>
          </div>
          <div className="tabs">
            <div className={`tab ${activeTab === 'pick' ? 'active' : ''}`} onClick={() => setActiveTab('pick')}>📅 이번주/다음주 Pick</div>
            <div className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>📂 전체 맛집 보기</div>
          </div>
        </div>

        {activeTab === 'pick' && (
          <div>
            <h3 className="section-title">🎯 이번주 수/금 회식 후보</h3>
            {filteredData.tw.map(m => <Card key={m.ID} menu={m} type="pick" />)}
            <h3 className="section-title">🗓️ 다음주 수/금 회식 후보</h3>
            {filteredData.nw.map(m => <Card key={m.ID} menu={m} type="pick" />)}
          </div>
        )}

        {activeTab === 'all' && (
          <div>
            <div className="filter-section">
              <input type="text" className="search-input" placeholder="🔍 맛집 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              {/* ⭐️ 상단 필터에도 이모지 적용 */}
              <select className="category-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">🏷️ 전체 카테고리</option>
                <option value="한식">🍚 한식</option>
                <option value="중식">🥢 중식</option>
                <option value="일식">🍣 일식</option>
                <option value="양식">🍝 양식</option>
                <option value="분식">🥘 분식</option>
                <option value="기타">🍽️ 기타</option>
              </select>
            </div>
            {filteredData.allF.map(m => <Card key={m.ID} menu={m} type="all" />)}
          </div>
        )}

        <button className="fab" onClick={openAddModal}>＋</button>
      </div>

      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3 style={{marginTop:0, marginBottom:'20px'}}>{modalMode === 'add' ? '메뉴 추천' : modalMode === 'edit' ? '정보 수정' : '다시 Pick 하기'}</h3>
            <div className="form-group"><label>추천 방문일 (수/금)</label>
              <select value={formData.visitDate} onChange={e => setFormData({...formData, visitDate: e.target.value})}>
                {dateOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group"><label>가게명</label><input type="text" placeholder="가게명 입력" value={formData.shopName} onChange={e => setFormData({...formData, shopName: e.target.value})} onBlur={e => checkDuplicate('name', e.target.value)} /></div>
            <div className="form-group"><label>지도 URL</label><input type="text" placeholder="주소를 붙여넣으세요" value={formData.shopUrl} onChange={e => setFormData({...formData, shopUrl: e.target.value})} onBlur={e => checkDuplicate('url', e.target.value)} /></div>
            <div className="form-group"><label>카테고리</label>
              {/* ⭐️ 입력 모달창에도 이모지 적용 */}
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                <option value="한식">🍚 한식</option>
                <option value="중식">🥢 중식</option>
                <option value="일식">🍣 일식</option>
                <option value="양식">🍝 양식</option>
                <option value="분식">🥘 분식</option>
                <option value="기타">🍽️ 기타</option>
              </select>
            </div>
            <div className="form-group"><label>대표 메뉴</label>
              <input type="text" placeholder="메뉴 1 (필수)" style={{marginBottom:'8px'}} value={formData.menu1} onChange={e => setFormData({...formData, menu1: e.target.value})} />
              <input type="text" placeholder="메뉴 2 (선택)" style={{marginBottom:'8px'}} value={formData.menu2} onChange={e => setFormData({...formData, menu2: e.target.value})} />
              <input type="text" placeholder="메뉴 3 (선택)" value={formData.menu3} onChange={e => setFormData({...formData, menu3: e.target.value})} />
            </div>
            <div className="form-group"><label>가격대</label>
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                <select value={formData.priceMin} onChange={e => setFormData({...formData, priceMin: e.target.value})}>{priceOptions.map(p => <option key={p} value={p}>{p}</option>)}</select>
                <span style={{fontSize:'12px', fontWeight:'bold', color:'#7f8c8d'}}>부터</span>
                <select value={formData.priceMax} onChange={e => setFormData({...formData, priceMax: e.target.value})}>{priceOptions.map(p => <option key={p} value={p}>{p}</option>)}</select>
                <span style={{fontSize:'12px', fontWeight:'bold', color:'#7f8c8d'}}>까지</span>
              </div>
            </div>
            <button className="btn" onClick={handleModalSubmit} style={{marginTop:'20px'}}>{modalMode === 'edit' ? '수정 완료' : '추천 완료'}</button>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>닫기</button>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3 style={{marginTop:0, marginBottom:'15px', color:'#e74c3c'}}>🚨 맛집 삭제 요청</h3>
            <p style={{fontSize:'13px', color:'#555', marginBottom:'20px'}}>삭제 사유를 선택해 주세요.</p>
            <div className="form-group"><label>삭제 사유</label>
              <select value={deleteReason} onChange={e => setDeleteReason(e.target.value)}>
                <option value="폐업/이전">폐업/이전</option>
                <option value="가격상승">가격상승</option>
                <option value="재방문의사없음">재방문의사없음</option>
              </select>
            </div>
            <button className="btn" style={{background:'#e74c3c'}} onClick={submitDeleteRequest}>요청하기</button>
            <button className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>취소</button>
          </div>
        </div>
      )}
    </>
  );

  function Card({ menu: m, type }: { menu: any, type: string }) {
    const likes = String(m['좋아요누른사람'] || '').split(',').filter(x=>x);
    const dislikes = String(m['싫어요누른사람'] || '').split(',').filter(x=>x);
    const isDeleteRequested = m['삭제요청상태'] === 'Y';
    const dateStr = String(m['추천방문일']).split('T')[0] || '미정';
    const cleanName = (m['가게명'] || '').replace(/\s/g, '');
    const isPicked = filteredData.pickNames.includes(cleanName);

    return (
      <div className="menu-card">
        {type === 'all' && (
          <div className="card-top-actions">
            <button className="btn-mini" onClick={() => openEditModal(m, false)}>✏️ 수정</button>
            <button className="btn-mini danger" onClick={() => { setDeleteTargetId(m.ID); setIsDeleteModalOpen(true); }} disabled={isDeleteRequested}>
              {isDeleteRequested ? '요청중' : '🗑️ 삭제'}
            </button>
          </div>
        )}
        {isDeleteRequested && <div className="tag-deleted">🚨 삭제 요청 검토 중: {m['삭제요청사유'] || '사유 미상'}</div>}
        <div className="tag-container">
          {/* ⭐️ 개별 메뉴 카드 태그에도 이모지 적용 */}
          <span className="tag">{CATEGORY_EMOJI[m['카테고리']] || m['카테고리']}</span>
          <span className="tag tag-date">📅 {dateStr}</span>
          {type === 'all' && isPicked && <span className="tag tag-status">🎯 Pick 완료</span>}
        </div>
        <div style={{fontWeight:'bold', color:'#7f8c8d', marginBottom:'5px'}}>🏠 {m['가게명']}</div>
        <h3>{m['대표메뉴']}</h3>
        <div className="menu-details">📍 {m['가격대']}</div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <a href={m['가게URL']} target="_blank" className="map-link">🗺️ 지도/가게정보 보기</a>
          {type === 'pick' ? (
            <div className="reaction-group">
              <button className={`like-btn ${likes.includes(currentUser as string) ? 'liked' : ''}`} onClick={() => toggleReaction(m.ID, 'toggle_like')}>
                {likes.includes(currentUser as string) ? '❤️' : '🤍'} {likes.length}
              </button>
              <button className={`dislike-btn ${dislikes.includes(currentUser as string) ? 'liked' : ''}`} onClick={() => toggleReaction(m.ID, 'toggle_dislike')}>
                {dislikes.includes(currentUser as string) ? '💔' : '👎'} {dislikes.length}
              </button>
            </div>
          ) : (
            <span style={{fontSize:'12px', color:'#e74c3c', fontWeight:'bold', background:'#fff0f0', padding:'6px 12px', borderRadius:'12px'}}>❤️ 누적 좋아요 {likes.length}개</span>
          )}
        </div>
        {type === 'all' && (
          <button className="btn-outline" onClick={() => openEditModal(m, true)}>🔄 다시 Pick 하기</button>
        )}
      </div>
    );
  }
}