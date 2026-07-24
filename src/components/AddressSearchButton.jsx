import { useState } from "react";

function loadDaumPostcodeScript() {
  return new Promise((resolve, reject) => {
    if (window.daum && window.daum.Postcode) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("우편번호 서비스를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

export default function AddressSearchButton({ onSelect, onSelectRaw, className = "" }) {
  const [loading, setLoading] = useState(false);

  async function openSearch() {
    setLoading(true);
    try {
      await loadDaumPostcodeScript();
      new window.daum.Postcode({
        oncomplete: (data) => {
          const addr = data.roadAddress || data.jibunAddress;
          onSelect(addr);
          if (onSelectRaw) onSelectRaw(data);
        },
      }).open();
    } catch (e) {
      alert("주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={openSearch}
      disabled={loading}
      className={`shrink-0 border border-slate-200 rounded-lg h-9 px-3 text-slate-600 hover:bg-slate-50 disabled:opacity-50 ${className}`}
    >
      {loading ? "불러오는 중..." : "주소 검색"}
    </button>
  );
}