import { useEffect, useState } from "react";

const CLIENT_ROLES = ["매도인", "매수인", "임대인", "임차인"];
const CONTRACT_TYPES = ["매매", "전세", "월세"];
const EOK = 100000000;
const MAN = 10000;

function formatWon(n) {
  if (n === null || n === undefined || n === "") return "-";
  return Number(n).toLocaleString("ko-KR") + "원";
}

function calcExpiry(contractType, balanceDate) {
  if (contractType === "매매" || !balanceDate) return null;
  const d = new Date(balanceDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 이미 계산되어 저장된 값(move_in_date 등)도 혹시 ISO 문자열이면 날짜만 잘라서 보여줌
function formatDateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function EokManInput({ value, onChange, readOnly }) {
  const raw = Number(value || 0);
  const eok = raw ? Math.floor(raw / EOK) : "";
  const man = raw ? Math.floor((raw % EOK) / MAN) : "";
  function update(eokVal, manVal) {
    const total = (parseInt(eokVal, 10) || 0) * EOK + (parseInt(manVal, 10) || 0) * MAN;
    onChange(total ? String(total) : "");
  }
  const cls = readOnly ? "bg-violet-50 text-violet-600 font-medium" : "bg-white text-slate-800";
  return (
    <div className="flex items-center gap-1 flex-1">
      <input type="number" min="0" step="1" readOnly={readOnly} value={eok} onChange={(e) => update(e.target.value, man)}
        className={`border border-slate-200 rounded-lg h-9 px-2 w-full text-right ${cls}`} placeholder="0" />
      <span className="text-slate-400 shrink-0">억</span>
      <input type="number" min="0" step="1" readOnly={readOnly} value={man} onChange={(e) => update(eok, e.target.value)}
        className={`border border-slate-200 rounded-lg h-9 px-2 w-full text-right ${cls}`} placeholder="0" />
      <span className="text-slate-400 shrink-0">만원</span>
    </div>
  );
}

const MINUTE_OPTIONS = ["00", "10", "20", "30", "40", "50"];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

function DateTime10Input({ value, onChange }) {
  const [datePart, timePart] = value ? String(value).slice(0, 16).split("T") : ["", ""];
  const [hh, mm] = timePart ? timePart.split(":") : ["", ""];
  function emit(nextDate, nextHh, nextMm) {
    if (nextDate && nextHh && nextMm) onChange(`${nextDate}T${nextHh}:${nextMm}`);
    else onChange("");
  }
  return (
    <div className="flex items-center gap-1 flex-1">
      <input type="date" value={datePart} onChange={(e) => emit(e.target.value, hh || "00", mm || "00")}
        className="border border-slate-200 rounded-lg h-9 px-2 flex-1" />
      <select value={hh} onChange={(e) => emit(datePart, e.target.value, mm || "00")} className="border border-slate-200 rounded-lg h-9 px-1">
        <option value="">시</option>
        {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}시</option>)}
      </select>
      <select value={mm} onChange={(e) => emit(datePart, hh || "00", e.target.value)} className="border border-slate-200 rounded-lg h-9 px-1">
        <option value="">분</option>
        {MINUTE_OPTIONS.map((m) => <option key={m} value={m}>{m}분</option>)}
      </select>
    </div>
  );
}

export default function ContractPopup({ contractId, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/contracts/${contractId}`).then((r) => r.json()).then((d) => {
      setData(d);
      setForm(d);
    });
  }, [contractId]);

  function recalcBalance(next) {
    const base = next.contract_type === "월세" ? next.deposit : next.price;
    if (base && next.down_payment) {
      next.balance_amount = String(Math.max(Number(base) - Number(next.down_payment), 0));
    } else {
      next.balance_amount = "";
    }
    next.move_in_date = calcExpiry(next.contract_type, next.balance_date) || "";
    return next;
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/contracts/${contractId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setData({ ...data, ...updated });
      setEditing(false);
      onSaved && onSaved();
    } else {
      const err = await res.json();
      alert(err.error || "저장에 실패했습니다.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {!data ? (
          <p className="text-xs text-slate-400">불러오는 중...</p>
        ) : (
          <>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-semibold text-slate-800">계약 정보</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">닫기 ✕</button>
            </div>

            {!editing ? (
              <div className="flex flex-col gap-2 text-xs">
                <Row label="물건" value={`${data.property_name} ${data.property_dong || ""} ${data.property_ho || ""}`} />
                <Row label="고객" value={`${data.client_name} · ${data.client_phone || "-"}`} />
                <Row label="구분" value={data.client_role} />
                <Row label="계약유형" value={data.contract_type} />
                <Row label="금액" value={formatWon(data.contract_type === "월세" ? data.deposit : data.price)} />
                {data.contract_type === "월세" && <Row label="월세" value={formatWon(data.monthly_rent)} />}
                <Row label="계약금" value={formatWon(data.down_payment)} />
                <Row label="잔금" value={formatWon(data.balance_amount)} />
                <Row label="계약일시" value={data.contract_date ? String(data.contract_date).slice(0, 16).replace("T", " ") : "-"} />
                <Row label="잔금일시" value={data.balance_date ? String(data.balance_date).slice(0, 16).replace("T", " ") : "-"} />
                {data.contract_type !== "매매" && (
                  <Row label="계약만료일" value={calcExpiry(data.contract_type, data.balance_date) || "-"} />
                )}
                <Row label="비고" value={data.memo} multiline />
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={() => setEditing(true)} className="bg-violet-400 text-white rounded-full h-9 px-4 font-medium hover:bg-violet-500">
                    수정하기
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-xs">
                <div className="bg-slate-50 rounded-lg p-2 text-slate-500">
                  물건: {data.property_name} {data.property_dong} {data.property_ho} · 고객: {data.client_name}
                </div>

                <select value={form.client_role} onChange={(e) => setForm({ ...form, client_role: e.target.value })}
                  className="border border-slate-200 rounded-lg h-9 px-3">
                  {CLIENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>

                <select value={form.contract_type} onChange={(e) => setForm((prev) => recalcBalance({ ...prev, contract_type: e.target.value }))}
                  className="border border-slate-200 rounded-lg h-9 px-3">
                  {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>

                {(form.contract_type === "매매" || form.contract_type === "전세") && (
                  <>
                    <span className="text-slate-400">{form.contract_type === "매매" ? "매매대금" : "전세보증금"}</span>
                    <EokManInput value={form.price} onChange={(v) => setForm((prev) => recalcBalance({ ...prev, price: v }))} />
                  </>
                )}

                {form.contract_type === "월세" && (
                  <>
                    <span className="text-slate-400">월세보증금</span>
                    <EokManInput value={form.deposit} onChange={(v) => setForm((prev) => recalcBalance({ ...prev, deposit: v }))} />
                    <span className="text-slate-400">월세</span>
                    <EokManInput value={form.monthly_rent} onChange={(v) => setForm({ ...form, monthly_rent: v })} />
                  </>
                )}

                <span className="text-slate-400">계약일시</span>
                <DateTime10Input value={form.contract_date} onChange={(v) => setForm({ ...form, contract_date: v })} />

                <span className="text-slate-400">계약금</span>
                <EokManInput value={form.down_payment} onChange={(v) => setForm((prev) => recalcBalance({ ...prev, down_payment: v }))} />

                <span className="text-slate-400">잔금일시</span>
                <DateTime10Input value={form.balance_date} onChange={(v) => setForm((prev) => recalcBalance({ ...prev, balance_date: v }))} />

                <span className="text-slate-400">잔금 (자동계산)</span>
                <EokManInput value={form.balance_amount} onChange={() => {}} readOnly />

                {form.contract_type !== "매매" && (
                  <>
                    <span className="text-slate-400">계약만료일 (자동계산)</span>
                    <input
                      type="text"
                      readOnly
                      value={calcExpiry(form.contract_type, form.balance_date) || formatDateOnly(form.move_in_date)}
                      placeholder="잔금일시 입력 시 자동으로 계산됩니다"
                      className="border border-slate-200 rounded-lg h-9 px-3 bg-violet-50 text-violet-600 font-medium"
                    />
                  </>
                )}

                <textarea value={form.memo || ""} onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  placeholder="비고" className="border border-slate-200 rounded-lg p-3 h-16" />

                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => { setEditing(false); setForm(data); }} className="border border-slate-200 rounded-full h-9 px-4 hover:bg-slate-50">취소</button>
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
    <div className="flex gap-2">
      <span className="text-slate-400 w-20 shrink-0">{label}</span>
      <span className={`text-slate-700 ${multiline ? "whitespace-pre-wrap" : ""}`}>{value || "-"}</span>
    </div>
  );
}