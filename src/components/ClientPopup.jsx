import { useEffect, useState } from "react";
import PhoneInput from "./PhoneInput.jsx";
import SsnInput from "./SsnInput.jsx";

const TRANSACTION_TYPES = ["매매", "전세", "월세"];
const BUDGET_RANGES = [
  "1억대", "2억대", "3억대", "4억대", "5억대",
  "6억대", "7억대", "8억대", "9억대", "10억대", "10억 이상",
];

export default function ClientPopup({ clientId, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const [ssnRevealed, setSsnRevealed] = useState(null); // 복호화된 평문, 숨기면 null로 초기화
  const [ssnLoading, setSsnLoading] = useState(false);
  const [ssnError, setSsnError] = useState("");

  useEffect(() => {
    fetch(`/api/clients/${clientId}`).then((r) => r.json()).then((d) => {
      setData(d);
      setForm({ ...d, ssn: "" }); // 보안상 수정폼엔 항상 빈 값으로 시작
    });
  }, [clientId]);

  async function handleRevealSsn() {
    if (ssnRevealed) {
      setSsnRevealed(null); // 다시 누르면 숨김
      return;
    }
    setSsnLoading(true);
    setSsnError("");
    const res = await fetch(`/api/clients/${clientId}/ssn`);
    setSsnLoading(false);
    if (res.ok) {
      const d = await res.json();
      setSsnRevealed(d.ssn);
    } else {
      const d = await res.json();
      setSsnError(d.error || "불러오지 못했습니다.");
    }
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/clients/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setData(updated);
      setEditing(false);
      setSsnRevealed(null);
      onSaved && onSaved(updated);
    } else {
      const err = await res.json();
      alert(err.error || "저장에 실패했습니다.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {!data ? (
          <p className="text-xs text-slate-400">불러오는 중...</p>
        ) : (
          <>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-semibold text-slate-800">고객 정보</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">닫기 ✕</button>
            </div>

            {!editing ? (
              <div className="flex flex-col gap-2 text-xs">
                <Row label="이름" value={data.name} />
                <Row label="연락처" value={data.phone} />

                <div className="flex gap-2 items-start">
                  <span className="text-slate-400 w-24 shrink-0 whitespace-nowrap">주민번호</span>
                  <div className="flex-1">
                    {data.ssn_masked ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700 font-mono">{ssnRevealed || data.ssn_masked}</span>
                        <button
                          onClick={handleRevealSsn}
                          disabled={ssnLoading}
                          className="text-[11px] text-violet-500 hover:text-violet-600 border border-violet-200 rounded-full px-2 py-0.5 disabled:opacity-50"
                        >
                          {ssnLoading ? "불러오는 중..." : ssnRevealed ? "숨기기" : "주민번호 보기"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-700">-</span>
                    )}
                    {ssnError && <p className="text-red-400 mt-1">{ssnError}</p>}
                  </div>
                </div>

                <Row label="거래유형" value={data.transaction_type} />
                <Row label="예산범위" value={data.budget_range} />
                <Row label="희망입주월" value={data.desired_move_in_month} />
                <Row label="고객설명" value={data.description} multiline />
                <Row label="주소" value={data.address} />
                <Row label="비고" value={data.memo} multiline />
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={() => setEditing(true)} className="bg-violet-400 text-white rounded-full h-9 px-4 font-medium hover:bg-violet-500">
                    수정하기
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-xs">
                <input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^가-힣]/g, "") })}
                  placeholder="이름" className="border border-slate-200 rounded-lg h-9 px-3" />
                <PhoneInput
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  placeholder="연락처"
                  className="border border-slate-200 rounded-lg h-9 px-3"
                />

                <label className="text-slate-400 -mb-1">
                  주민번호 {data.ssn_masked && <span className="text-slate-300">(변경 시에만 입력, 비워두면 기존 값 유지)</span>}
                </label>
                <SsnInput
                  value={form.ssn}
                  onChange={(v) => setForm({ ...form, ssn: v })}
                  placeholder={data.ssn_masked ? "등록된 주민번호가 있어요 (변경 시에만 입력)" : "990101-1234567"}
                  className="border border-slate-200 rounded-lg h-9 px-3"
                />

                <select value={form.transaction_type || ""} onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}
                  className="border border-slate-200 rounded-lg h-9 px-3">
                  <option value="">거래유형 선택</option>
                  {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={form.budget_range || ""} onChange={(e) => setForm({ ...form, budget_range: e.target.value })}
                  className="border border-slate-200 rounded-lg h-9 px-3">
                  <option value="">예산범위 선택</option>
                  {BUDGET_RANGES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <input type="month" value={form.desired_move_in_month || ""} onChange={(e) => setForm({ ...form, desired_move_in_month: e.target.value })}
                  className="border border-slate-200 rounded-lg h-9 px-3" />

                <textarea value={form.description || ""} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="고객설명" className="border border-slate-200 rounded-lg p-3 h-20" />
                <input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="주소" className="border border-slate-200 rounded-lg h-9 px-3" />
                <textarea value={form.memo || ""} onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  placeholder="비고" className="border border-slate-200 rounded-lg p-3 h-16" />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => { setEditing(false); setForm({ ...data, ssn: "" }); }} className="border border-slate-200 rounded-full h-9 px-4 hover:bg-slate-50">취소</button>
                  <button onClick={handleSave} disabled={saving} className="bg-violet-400 text-white rounded-full h-9 px-4 font-medium hover:bg-violet-500 disabled:opacity-50">
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, multiline }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-slate-400 w-24 shrink-0 whitespace-nowrap">{label}</span>
      <span className={`text-slate-700 ${multiline ? "whitespace-pre-wrap" : ""}`}>{value || "-"}</span>
    </div>
  );
}