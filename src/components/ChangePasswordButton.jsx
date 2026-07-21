import { useState } from "react";
import { createPortal } from "react-dom";

export default function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  function reset() {
    setCurrent(""); setNext(""); setConfirm(""); setError(""); setSuccess(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (next !== confirm) {
      setError("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setSaving(false);

    if (res.ok) {
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
    } else {
      const data = await res.json();
      setError(data.error || "변경에 실패했습니다.");
    }
  }

  const modal = (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100] p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-slate-800">비밀번호 변경</h3>
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs">닫기 ✕</button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <p className="text-sm text-green-600 mb-4">비밀번호가 변경되었습니다.</p>
            <button onClick={() => setOpen(false)} className="bg-violet-400 text-white rounded-full h-9 px-6 text-xs font-medium hover:bg-violet-500">
              확인
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2 text-xs">
            <input
              type="password"
              placeholder="현재 비밀번호"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="border border-slate-200 rounded-lg h-9 px-3"
              required
            />
            <input
              type="password"
              placeholder="새 비밀번호"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="border border-slate-200 rounded-lg h-9 px-3"
              required
            />
            <input
              type="password"
              placeholder="새 비밀번호 확인"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="border border-slate-200 rounded-lg h-9 px-3"
              required
            />
            {error && <p className="text-red-500">{error}</p>}
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 border border-slate-200 rounded-full h-9 text-xs hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-violet-400 text-white rounded-full h-9 font-medium hover:bg-violet-500 disabled:opacity-50"
              >
                {saving ? "변경 중..." : "변경하기"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => { setOpen(true); reset(); }}
        className="text-[10px] sm:text-xs text-slate-500 border border-slate-200 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 hover:bg-slate-100 transition whitespace-nowrap shrink-0"
      >
        비밀번호 변경
      </button>

      {open && typeof document !== "undefined" && createPortal(modal, document.body)}
    </>
  );
}