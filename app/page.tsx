"use client";

// ⭐️ useRef를 추가로 가져옵니다.
import { useState, useEffect, useMemo, useRef } from "react";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzRoJPOYW8FB1Ck69hOl56aluBxNDjUAPewlsTEgIvK39y6hShhx4SU6K2enx0R29NLAQ/exec";
const USER_MAP: Record<string, string> = {
  "4488": "유인호", "7991": "송선애", "4611": "신동철", "1121": "이소영",
  "5555": "문진곤", "4946": "유광열", "5015": "박영민", "2253": "조은지", "8830": "이수연",
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

  // ⭐️ 1. 자동 용접(틈새 제거)을 위한 Ref와 State
  const headerRef = useRef<HTMLDivElement>(null);
  const [stickyTop, setStickyTop] = useState(130); // 기본값

  // ⭐️ 2. 상단 헤더의 실제 높이를 계산해서 틈새 없이 딱 붙여주는 마법의 로직
  useEffect(() => {
    const updateStickyGap = () => {
      if (headerRef.current) {
        // 실제 높이를 소수점 버림하고 1px 빼서 아주 타이트하게 붙임
        setStickyTop(Math.floor(headerRef.current.getBoundingClientRect().height) - 1);
      }
    };

    if (currentUser) {
      updateStickyGap();
      setTimeout(updateStickyGap, 100); // 렌더링 직후 한 번 더 꽉 조여줌
      window.addEventListener("resize", updateStickyGap);
      return () => window.removeEventListener("resize", updateStickyGap);
    }
  }, [currentUser]);

  useEffect(() => {
    const savedPin = localStorage.getItem("lunchUserPin");
    if (savedPin && USER_MAP[savedPin]) {
      setCurrentUser(savedPin);
      fetchMenus(false);
    }
  }, []);

  const fetchMenus = async (silent = false) => {
    if (!silent) showLoader("데이터 로딩 중...");
    try {
      const res = await fetch(SCRIPT_URL);
      const data = await res.json();
      setMenus(data);
    } catch (e) {
      alert("데이터를 불러오지 못했습니다. 네트워크 상태를 확인해주세요.");
    } finally {
      hideLoader();
    }
  };

  const handleLogin = () => {
    if (USER_MAP[pin]) {
      localStorage.setItem("lunchUserPin", pin);
      setCurrentUser(pin);
      fetchMenus(false);
    } else {
      alert("등록되지 않은 번호입니다.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("lunchUserPin");
    setCurrentUser(null);
    setPin("");
  };

  const toggleReaction = async (id: string, action: string) => {
    showLoader("반영 중...");
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action, id, userPin: currentUser }),
      });
      const result = await res.json();
      if (result.success) fetchMenus(true);
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      hideLoader();
    }
  };

  const showLoader = (text: string) => {
    setLoadingText(text);
    setIsLoading(true);
  };
  const hideLoader = () => setIsLoading(false);

  const { thisWeekMenus, nextWeekMenus, allMenusFiltered, activePickNames } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    
    const thisStart = new Date(today); thisStart.setDate(diff);
    const nextStart = new Date(thisStart); nextStart.setDate(thisStart.getDate() + 7);
    const nextNext = new Date(nextStart); nextNext.setDate(nextStart.getDate() + 7);

    const tw: any[] = [];
    const nw: any[] = [];
    const pickNames: string[] = [];

    menus.forEach((m) => {
      if (!m["추천방문일"]) return;
      const dStr = String(m["추천방문일"]).split("T")[0];
      const d = new Date(dStr + "T00:00:00");

      if (d >= thisStart && d < nextNext) {
        pickNames.push(String(m["가게명"] || "").replace(/\s/g, ""));
      }

      if (d >= thisStart && d < nextStart) tw.push(m);
      else if (d >= nextStart && d < nextNext) nw.push(m);
    });

    const uniqueMap = new Map();
    menus.forEach((m) => {
      const cleanName = String(m["가게명"] || "").replace(/\s/g, "");
      uniqueMap.set(cleanName, m);
    });

    const allFiltered = Array.from(uniqueMap.values())
      .reverse()
      .filter((m) => {
        const matchCat = categoryFilter === "all" || m["카테고리"] === categoryFilter;
        const matchSearch =
          String(m["가게명"]).toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(m["대표메뉴"]).toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
      });

    return { thisWeekMenus: tw, nextWeekMenus: nw, allMenusFiltered: allFiltered, activePickNames: pickNames };
  }, [menus, searchQuery, categoryFilter]);


  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <h1 className="text-2xl font-bold mb-2">🏢 KIPFA 점심 추천</h1>
        <p className="text-gray-500 mb-8">휴대폰 뒷자리 4자리를 입력하세요</p>
        
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="0000"
          className="text-2xl p-4 w-40 text-center border-2 border-gray-300 rounded-xl mb-6 tracking-widest outline-none focus:border-blue-500"
        />
        
        <button onClick={handleLogin} className="w-full max-w-xs bg-blue-500 text-white font-bold py-4 rounded-xl shadow-md active:scale-95 transition">
          입장하기
        </button>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: "body { overflow-y: scroll; overflow-x: hidden; }" }} />
      
      <div className="w-full max-w-lg mx-auto bg-gray-50 min-h-screen pb-24">
        {isLoading && (
          <div className="fixed inset-0 bg-white/90 z-[9999] flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="mt-4 font-bold text-gray-700">{loadingText}</p>
          </div>
        )}

        {/* ⭐️ 3. ref를 부착하여 높이를 측정할 수 있게 합니다. */}
        <div ref={headerRef} className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-50 px-5 pt-6 pb-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-extrabold text-gray-800">KIPFA 점심 추천</h2>
            <div className="flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full text-xs">
                👋 {USER_MAP[currentUser]}님
              </span>
              <button onClick={handleLogout} className="bg-white border border-gray-300 text-gray-500 font-bold px-3 py-1 rounded-full text-xs">
                로그아웃
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("pick")}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition shadow-sm ${activeTab === "pick" ? "bg-blue-500 text-white" : "bg-white text-gray-500 border border-gray-200"}`}
            >
              📅 이번주/다음주 Pick
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition shadow-sm ${activeTab === "all" ? "bg-blue-500 text-white" : "bg-white text-gray-500 border border-gray-200"}`}
            >
              📂 전체 맛집 보기
            </button>
          </div>
        </div>

        <div className="px-5">
          {activeTab === "pick" && (
            <div>
              {/* ⭐️ 4. top-[125px]를 제거하고 style={{ top: `${stickyTop}px` }} 로 자동 측정된 높이를 부여합니다. */}
              <h3 
                className="sticky z-40 bg-gray-50/95 backdrop-blur-sm py-3 text-lg font-bold text-gray-700 border-b-2 border-blue-500 mb-4"
                style={{ top: `${stickyTop}px` }}
              >
                🎯 이번주 수/금 회식 후보
              </h3>
              {thisWeekMenus.map((m) => <MenuCard key={m.ID} menu={m} type="pick" currentUser={currentUser} toggleReaction={toggleReaction} />)}

              <h3 
                className="sticky z-40 bg-gray-50/95 backdrop-blur-sm py-3 text-lg font-bold text-gray-700 border-b-2 border-blue-500 mb-4 mt-8"
                style={{ top: `${stickyTop}px` }}
              >
                🗓️ 다음주 수/금 회식 후보
              </h3>
              {nextWeekMenus.map((m) => <MenuCard key={m.ID} menu={m} type="pick" currentUser={currentUser} toggleReaction={toggleReaction} />)}
            </div>
          )}

          {activeTab === "all" && (
            <div>
              {/* ⭐️ 여기도 마찬가지로 style을 통해 빈틈을 제거합니다. */}
              <div 
                className="sticky z-40 bg-gray-50/95 backdrop-blur-sm py-3 mb-4 flex flex-col gap-2"
                style={{ top: `${stickyTop}px` }}
              >
                <input
                  type="text"
                  placeholder="🔍 맛집 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-blue-500 text-sm"
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl outline-none text-sm bg-white"
                >
                  <option value="all">전체 카테고리</option>
                  <option value="한식">한식</option><option value="중식">중식</option>
                  <option value="일식">일식</option><option value="양식">양식</option>
                  <option value="분식">분식</option><option value="기타">기타</option>
                </select>
              </div>
              
              {allMenusFiltered.map((m) => (
                <MenuCard 
                  key={m.ID} 
                  menu={m} 
                  type="all" 
                  currentUser={currentUser} 
                  isPicked={activePickNames.includes(String(m["가게명"]).replace(/\s/g, ""))}
                />
              ))}
            </div>
          )}
        </div>

        <button className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-blue-500 to-green-400 text-white rounded-full shadow-lg text-3xl font-light flex items-center justify-center hover:scale-105 transition z-50">
          ＋
        </button>
      </div>
    </>
  );
}

function MenuCard({ menu, type, currentUser, toggleReaction, isPicked }: any) {
  const likes = String(menu["좋아요누른사람"] || "").split(",").filter(Boolean);
  const dislikes = String(menu["싫어요누른사람"] || "").split(",").filter(Boolean);
  const dateStr = String(menu["추천방문일"] || "").split("T")[0] || "미정";

  return (
    <div className="bg-white p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100 mb-4 relative break-keep">
      <div className="flex flex-wrap gap-2 mb-3 pr-20">
        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-[11px] font-bold">{menu["카테고리"]}</span>
        <span className="bg-yellow-50 text-yellow-600 px-2 py-1 rounded-md text-[11px] font-bold">📅 {dateStr}</span>
        {isPicked && <span className="bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded-md text-[11px] font-bold">🎯 이번주/다음주 Pick</span>}
      </div>

      <div className="font-bold text-gray-500 text-xs mb-1">🏠 {menu["가게명"]}</div>
      <h3 className="text-lg font-bold text-gray-800 mb-3 pr-20">{menu["대표메뉴"]}</h3>
      
      <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-600 mb-4">📍 {menu["가격대"]}</div>

      <div className="flex justify-between items-center">
        <a href={menu["가게URL"]} target="_blank" className="bg-orange-50 text-orange-600 font-bold text-xs px-3 py-2 rounded-full no-underline">
          🗺️ 지도/가게정보 보기
        </a>

        {type === "pick" ? (
          <div className="flex gap-2">
            <button onClick={() => toggleReaction(menu.ID, "toggle_like")} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold border transition ${likes.includes(currentUser) ? "bg-red-500 text-white border-red-500" : "bg-white text-gray-700 border-gray-200"}`}>
              {likes.includes(currentUser) ? "❤️" : "🤍"} {likes.length}
            </button>
            <button onClick={() => toggleReaction(menu.ID, "toggle_dislike")} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold border transition ${dislikes.includes(currentUser) ? "bg-gray-500 text-white border-gray-500" : "bg-white text-gray-700 border-gray-200"}`}>
              {dislikes.includes(currentUser) ? "💔" : "👎"} {dislikes.length}
            </button>
          </div>
        ) : (
          <span className="bg-red-50 text-red-500 font-bold text-xs px-3 py-2 rounded-full">❤️ 누적 좋아요 {likes.length}개</span>
        )}
      </div>

      {type === "all" && (
        <button className="w-full mt-4 py-3 border border-blue-500 text-blue-500 font-bold rounded-xl text-sm hover:bg-blue-50 transition">
          🔄 다시 Pick 하기
        </button>
      )}
    </div>
  );
}