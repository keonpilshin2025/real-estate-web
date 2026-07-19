import { useState } from "react";

const VISIT_MEMO_MAX = 100;
const timeSlots = ["오전 (09:30~12:00)", "오후 (12:00~17:00)", "저녁 (17:00~20:00)"];

export default function VisitReservationButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState("idle"); // idle | success | error

  function resetAndClose() {
    setName("");
    setPhone("");
    setDate("");
    setTimeSlot("");
    setMemo("");
    setStatus("idle");
    setOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!phone.trim()) {
      setStatus("error");
      return;
    }

    try {
      const res = await fetch("/api/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, date, timeSlot, memo }),
      });

      if (!res.ok) throw new Error("전송 실패");

      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-violet-400 text-white px-5 py-2.5 rounded-full font-medium hover:bg-violet-500 transition whitespace-nowrap"
      >
        방문예약
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) resetAndClose();
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
            <button
              type="button"
              onClick={resetAndClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-lg leading-none"
              aria-label="닫기"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-slate-800 mb-1">방문 예약하기</h3>
            <p className="text-xs text-slate-500 mb-4">
              남겨주시면 확인 후 연락드리겠습니다.
            </p>

            {status === "success" ? (
              <div className="flex items-center gap-2 bg-violet-500 text-white text-sm font-medium rounded-xl px-4 py-3">
                <span className="bg-white text-violet-500 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                예약 요청이 접수되었습니다. 곧 연락드리겠습니다.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 ml-1">이름 (선택)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full bg-slate-50 border border-slate-200 rounded-full h-10 px-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 ml-1">휴대폰 번호</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-full h-10 px-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] text-slate-500 mb-1 ml-1">방문 희망일</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full min-w-0 bg-slate-50 border border-slate-200 rounded-full h-10 px-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] text-slate-500 mb-1 ml-1">희망 시간대</label>
                    <select
                      value={timeSlot}
                      onChange={(e) => setTimeSlot(e.target.value)}
                      className="w-full min-w-0 bg-slate-50 border border-slate-200 rounded-full h-10 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-200"
                    >
                      <option value="">선택</option>
                      {timeSlots.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 ml-1">남기실 말씀 (선택)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={memo}
                      onChange={(e) => setMemo(e.target.value.slice(0, VISIT_MEMO_MAX))}
                      maxLength={VISIT_MEMO_MAX}
                      placeholder="예: 주말 오전 방문 희망합니다"
                      className="w-full bg-slate-50 border border-slate-200 rounded-full h-10 pl-4 pr-14 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                      {memo.length}/{VISIT_MEMO_MAX}
                    </span>
                  </div>
                </div>

                {status === "error" && (
                  <p className="text-xs text-red-500">휴대폰 번호를 입력해 주세요.</p>
                )}

                <button
                  type="submit"
                  className="bg-violet-400 text-white text-sm font-medium rounded-full h-10 hover:bg-violet-500 transition mt-1"
                >
                  예약 신청
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}