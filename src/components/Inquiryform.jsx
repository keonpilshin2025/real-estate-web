import { useState } from "react";

const complexes = ["센트럴타운", "연꽃마을", "산들마을"];
const budgets = ["3억대", "4억대", "5억 이상"];

export default function InquiryForm() {
  const [complex, setComplex] = useState("");
  const [budget, setBudget] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("idle"); // idle | success | error

  function handleSubmit(e) {
    e.preventDefault();

    if (!phone.trim()) {
      setStatus("error");
      return;
    }

    // TODO: 실제 저장 로직 연결 (구글시트 API, 이메일 발송 등)
    console.log({ complex, budget, phone });

    setStatus("success");
    setComplex("");
    setBudget("");
    setPhone("");
  }

  return (
    <div id="inquiry" className="bg-violet-50/40 border border-violet-100 rounded-2xl p-5 md:p-6">
      <h3 className="text-sm font-medium text-slate-800 mb-3">희망 조건 매물 신청</h3>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
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

        <button
          type="submit"
          className="bg-violet-400 text-white text-xs font-medium rounded-full h-10 px-6 hover:bg-violet-500 transition whitespace-nowrap"
        >
          신청
        </button>
      </form>

      {status === "success" && (
        <p className="text-xs text-green-600 mt-3">
          신청이 접수되었습니다. 24시간 내 연락드리겠습니다.
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-500 mt-3">휴대폰 번호를 입력해 주세요.</p>
      )}
    </div>
  );
}