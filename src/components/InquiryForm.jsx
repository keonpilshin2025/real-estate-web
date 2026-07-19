import { useState } from "react";

const complexes = ["센트럴타운", "연꽃마을", "산들마을", "상가", "빌라", "기타"];
const budgets = [
  "1억대",
  "2억대",
  "3억대",
  "4억대",
  "5억대",
  "6억대",
  "7억대",
  "8억대",
  "9억대",
  "10억대",
  "10억 이상",
];
const MEMO_MAX = 100;
const COMPLEX_OTHER_MAX = 20;

export default function InquiryForm() {
  const [complex, setComplex] = useState("");
  const [complexOther, setComplexOther] = useState("");
  const [budget, setBudget] = useState("");
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState("idle"); // idle | success | error

  async function handleSubmit(e) {
    e.preventDefault();

    if (!phone.trim()) {
      setStatus("error");
      return;
    }

    const complexValue = complex === "기타" ? complexOther.trim() : complex;

    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complex: complexValue, budget, phone, memo }),
      });

      if (!res.ok) throw new Error("전송 실패");

      setStatus("success");
      setComplex("");
      setComplexOther("");
      setBudget("");
      setPhone("");
      setMemo("");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  return (
    <div id="inquiry" className="bg-violet-50/40 border border-violet-100 rounded-2xl p-5 md:p-6">
      <h3 className="text-sm font-medium text-slate-800 mb-3">희망 매물 상담 신청</h3>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={complex}
            onChange={(e) => setComplex(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-full h-10 px-4 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-200"
          >
            <option value="">단지 선택</option>
            {complexes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {complex === "기타" && (
            <div className="flex-1 relative">
              <input
                type="text"
                value={complexOther}
                onChange={(e) => setComplexOther(e.target.value.slice(0, COMPLEX_OTHER_MAX))}
                maxLength={COMPLEX_OTHER_MAX}
                placeholder="단지/건물명을 입력해 주세요"
                className="w-full bg-white border border-slate-200 rounded-full h-10 pl-4 pr-12 text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                {complexOther.length}/{COMPLEX_OTHER_MAX}
              </span>
            </div>
          )}

          <select
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-full h-10 px-4 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-200"
          >
            <option value="">예산 범위</option>
            {budgets.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="휴대폰 번호"
            className="flex-1 bg-white border border-slate-200 rounded-full h-10 px-4 text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex-1 w-full relative">
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value.slice(0, MEMO_MAX))}
              maxLength={MEMO_MAX}
              placeholder="상담 내용을 간단히 남겨주세요 (선택)"
              className="w-full bg-white border border-slate-200 rounded-full h-10 pl-4 pr-14 text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
              {memo.length}/{MEMO_MAX}
            </span>
          </div>

          <button
            type="submit"
            className="bg-violet-400 text-white text-xs font-medium rounded-full h-10 px-6 hover:bg-violet-500 transition whitespace-nowrap w-full sm:w-auto"
          >
            신청
          </button>
        </div>

        {status === "success" && (
          <div className="flex items-center gap-2 bg-violet-500 text-white text-sm font-medium rounded-xl px-4 py-3 mt-1 shadow-md animate-[fadeIn_0.3s_ease-out]">
            <span className="bg-white text-violet-500 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">
              ✓
            </span>
            상담 신청이 접수되었습니다. 24시간 내 연락드리겠습니다.
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm font-medium rounded-xl px-4 py-3 mt-1 border border-red-200 animate-[fadeIn_0.3s_ease-out]">
            <span className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">
              !
            </span>
            휴대폰 번호를 입력해 주세요.
          </div>
        )}
      </form>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}