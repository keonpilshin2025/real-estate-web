import { useEffect, useState } from "react";
import PhoneInput from "./PhoneInput.jsx";
import SsnInput from "./SsnInput.jsx";

const TRANSACTION_TYPES = ["매매", "전세", "월세"];
const EOK = 100000000;
const MAN = 10000;

function formatEokMan(n) {
  if (!n) return "-";
  const num = Number(n);
  const eok = Math.floor(num / EOK);
  const man = Math.floor((num % EOK) / MAN);
  const parts = [];
  if (eok) parts.push(`${eok}억`);
  if (man) parts.push(`${man.toLocaleString()}만원`);
  return parts.length ? parts.join(" ") : "0원";
}

function EokManInput({ value, onChange }) {
  const raw = Number(value || 0);
  const eok = raw ? Math.floor(raw / EOK) : "";
  const man = raw ? Math.floor((raw % EOK) / MAN) : "";
  function update(eokVal, manVal) {
    const eokInt = parseInt(eokVal, 10) || 0;
    let manInt = parseInt(manVal, 10) || 0;
    if (manInt > 9999) manInt = 9999;
    const total = eokInt * EOK + manInt * MAN;
    onChange(total ? String(total) : "");
  }
  return (
    <div className="flex items-center gap-1">
      <input type="number" min="0" step="1" value={eok} onChange={(e) => update(e.target.value, man)}
        className="border border-slate-200 rounded-lg h-9 px-2 w-full text-right" placeholder="0" />
      <span className="text-slate-400 shrink-0">억</span>
      <input type="number" min="0" max="9999" step="1" value={man} onChange={(e) => update(eok, e.target.value)}
        className="border border-slate-200 rounded-lg h-9 px-2 w-full text-right" placeholder="0" />
      <span className="text-slate-400 shrink-0">만원</span>
    </div>
  );
}

export default function PropertyPopup({ propertyId, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [agencies, setAgencies] = useState([]);

  const [ssnRevealed, setSsnRevealed] = useState(null);
  const [ssnLoading, setSsnLoading] = useState(false);
  const [ssnError, setSsnError] = useState("");

  async function handleRevealSsn() {
    if (ssnRevealed) {
      setSsnRevealed(null);
      return;
    }
    setSsnLoading(true);
    setSsnError("");
    const res = await fetch(`/api/properties/${propertyId}/ssn`);
    setSsnLoading(false);
    if (res.ok) {
      const d = await res.json();
      setSsnRevealed(d.ssn);
    } else {
      const d = await res.json();
      setSsnError(d.error || "불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    fetch(`/api/properties/${propertyId}`).then((r) => r.json()).then((d) => {
      setData(d);
      setForm({ ...d, owner_ssn: "" });
    });
    fetch("/api/partner-agencies").then((r) => r.json()).then((d) => setAgencies(Array.isArray(d) ? d : []));
  }, [propertyId]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/properties/${propertyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setData((prev) => ({ ...prev, ...updated }));
      setEditing(false);
      setSsnRevealed(null);
      onSaved && onSaved(updated);
    } else {
      const err = await res.json();
      alert(err.error || "저장에 실패했습니다.");
    }
  }

  const hasFinal = !!data?.active_contract_id;
  const finalDepositText = hasFinal
    ? data.final_contract_type === "월세"
      ? `${formatEokMan(data.final_deposit)} / ${formatEokMan(data.final_monthly_rent)}`
      : formatEokMan(data.final_price)
    : null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {!data ? (
          <p className="text-xs text-slate-400">불러오는 중...</p>
        ) : (
          <>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-semibold text-slate-800">매물 정보</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">닫기 ✕</button>
            </div>

            {!editing ? (
              <div className="flex flex-col gap-2 text-xs">
                <Row label="구분" value={data.property_type} />
                <Row label="매물명" value={data.property_name} />
                <Row label="동/호수" value={[data.dong, data.ho].filter(Boolean).join(" ")} />
                <Row label="평형" value={data.unit_type} />
                <Row label="사용유형" value={data.usage_type} />
                <Row label="매도자/임대인" value={[data.owner_name, data.owner_phone].filter(Boolean).join(" · ")} />
                <div className="flex gap-2 items-start">
                  <span className="text-slate-400 w-24 shrink-0 whitespace-nowrap">주민번호</span>
                  <div className="flex-1">
                    {data.owner_ssn_masked ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700 font-mono">{ssnRevealed || data.owner_ssn_masked}</span>
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
                <Row label="물건지부동산" value={data.partner_agency_name ? `공동 · ${data.partner_agency_name}` : "단독"} />

                {hasFinal ? (
                  <>
                    <Row label="계약유형" value={data.final_contract_type} />
                    <div className="flex gap-2">
                      <span className="text-slate-400 w-16 shrink-0">최종보증금</span>
                      <span className="text-violet-600 font-semibold">{finalDepositText}</span>
                    </div>
                    <Row
                      label="희망가(참고)"
                      value={
                        data.transaction_type === "월세"
                          ? `${formatEokMan(data.asking_deposit)} / ${formatEokMan(data.asking_monthly_rent)}`
                          : formatEokMan(data.asking_price)
                      }
                    />
                  </>
                ) : (
                  <>
                    <Row label="거래유형" value={data.transaction_type} />
                    <Row
                      label="희망가"
                      value={
                        data.transaction_type === "월세"
                          ? `${formatEokMan(data.asking_deposit)} / ${formatEokMan(data.asking_monthly_rent)}`
                          : formatEokMan(data.asking_price)
                      }
                    />
                  </>
                )}

                <Row label="주소" value={data.address} />
                <Row label="특장점" value={data.features} multiline />
                <Row label="비고" value={data.memo} multiline />
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={() => setEditing(true)} className="bg-violet-400 text-white rounded-full h-9 px-4 font-medium hover:bg-violet-500">
                    수정하기
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-xs">
                <input value={form.property_name || ""} onChange={(e) => setForm({ ...form, property_name: e.target.value })}
                  placeholder="매물명" className="border border-slate-200 rounded-lg h-9 px-3" />
                <input value={form.property_type || ""} onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                  placeholder="구분 (아파트/빌라/상가)" className="border border-slate-200 rounded-lg h-9 px-3" />
                <div className="flex gap-2">
                  <input value={form.dong || ""} onChange={(e) => setForm({ ...form, dong: e.target.value })}
                    placeholder="동" className="border border-slate-200 rounded-lg h-9 px-3 flex-1" />
                  <input value={form.ho || ""} onChange={(e) => setForm({ ...form, ho: e.target.value })}
                    placeholder="호수" className="border border-slate-200 rounded-lg h-9 px-3 flex-1" />
                </div>
                <input value={form.unit_type || ""} onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                  placeholder="평형" className="border border-slate-200 rounded-lg h-9 px-3" />
                <input value={form.usage_type || ""} onChange={(e) => setForm({ ...form, usage_type: e.target.value })}
                  placeholder="사용유형 (상가만)" className="border border-slate-200 rounded-lg h-9 px-3" />

                <select value={form.partner_agency_id || ""} onChange={(e) => setForm({ ...form, partner_agency_id: e.target.value })}
                  className="border border-slate-200 rounded-lg h-9 px-3">
                  <option value="">물건지부동산 없음 (단독중개)</option>
                  {agencies.map((a) => <option key={a.id} value={a.id}>{a.agency_name}</option>)}
                </select>

                <div className="flex gap-2">
                  <input value={form.owner_name || ""} onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                    placeholder="매도자(임대인) 성명" className="border border-slate-200 rounded-lg h-9 px-3 flex-1" />
                  <PhoneInput
                    value={form.owner_phone}
                    onChange={(v) => setForm({ ...form, owner_phone: v })}
                    placeholder="연락처"
                    className="border border-slate-200 rounded-lg h-9 px-3 flex-1"
                  />
                </div>

                <label className="text-slate-400 -mb-1">
                  매도자(임대인) 주민번호 {data.owner_ssn_masked && <span className="text-slate-300">(변경 시에만 입력, 비워두면 기존 값 유지)</span>}
                </label>
                <SsnInput
                  value={form.owner_ssn}
                  onChange={(v) => setForm({ ...form, owner_ssn: v })}
                  placeholder={data.owner_ssn_masked ? "등록된 주민번호가 있어요 (변경 시에만 입력)" : "990101-1234567"}
                  className="border border-slate-200 rounded-lg h-9 px-3"
                />

                <select value={form.transaction_type || ""} onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}
                  className="border border-slate-200 rounded-lg h-9 px-3">
                  <option value="">거래유형 선택</option>
                  {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>

                {(form.transaction_type === "매매" || form.transaction_type === "전세") && (
                  <>
                    <span className="text-slate-400">{form.transaction_type === "매매" ? "희망 매매대금" : "희망 전세보증금"}</span>
                    <EokManInput value={form.asking_price} onChange={(v) => setForm({ ...form, asking_price: v })} />
                  </>
                )}

                {form.transaction_type === "월세" && (
                  <>
                    <span className="text-slate-400">희망 월세보증금</span>
                    <EokManInput value={form.asking_deposit} onChange={(v) => setForm({ ...form, asking_deposit: v })} />
                    <span className="text-slate-400">희망 월세</span>
                    <EokManInput value={form.asking_monthly_rent} onChange={(v) => setForm({ ...form, asking_monthly_rent: v })} />
                  </>
                )}

                <input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="주소" className="border border-slate-200 rounded-lg h-9 px-3" />
                <textarea value={form.features || ""} maxLength={500} onChange={(e) => setForm({ ...form, features: e.target.value })}
                  placeholder="특장점" className="border border-slate-200 rounded-lg p-3 h-20" />
                <textarea value={form.memo || ""} onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  placeholder="비고" className="border border-slate-200 rounded-lg p-3 h-16" />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => { setEditing(false); setForm({ ...data, owner_ssn: "" }); }} className="border border-slate-200 rounded-full h-9 px-4 hover:bg-slate-50">취소</button>
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