import { useEffect, useState } from "react";
import AgencySelect from "./AgencySelect.jsx";

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

// 소유자 1명에 대한 주민번호 보기/숨기기 (매도자/임대인 목록 각 항목에 사용)
function formatHistoryDate(v) {
  if (!v) return null;
  return String(v).slice(0, 10);
}

// 소유자 변경 이력 (지금 소유자 포함 전체, 시간순) - 접었다 펼 수 있음
function OwnerHistorySection({ history }) {
  const [open, setOpen] = useState(false);
  const sorted = [...history].sort((a, b) => new Date(a.since) - new Date(b.since));

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-slate-400 text-left hover:text-slate-600 flex items-center gap-1"
      >
        소유자 변경 이력 ({history.length}건) <span className="text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 border-l-2 border-slate-100 pl-3 ml-1">
          {sorted.map((h, i) => (
            <div key={`${h.id}-${h.since}`} className="text-slate-600">
              <span className={h.until ? "text-slate-500" : "text-violet-600 font-medium"}>{h.name}</span>
              <span className="text-slate-400"> · {h.phone || "연락처 없음"}</span>
              <div className="text-[11px] text-slate-400">
                {formatHistoryDate(h.since)} ~ {h.until ? formatHistoryDate(h.until) : "현재"}
                {!h.until && <span className="text-violet-400 ml-1">(현재 소유자)</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OwnerSsnRow({ owner }) {
  const [revealed, setRevealed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleReveal() {
    if (revealed) {
      setRevealed(null);
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch(`/api/clients/${owner.id}/ssn`);
    setLoading(false);
    if (res.ok) {
      const d = await res.json();
      setRevealed(d.ssn);
    } else {
      const d = await res.json();
      setError(d.error || "불러오지 못했습니다.");
    }
  }

  return (
    <div className={`flex flex-col gap-0.5 border rounded-lg px-3 py-2 ${owner.is_primary ? "border-violet-200 bg-violet-50" : "border-slate-100 bg-slate-50"}`}>
      <div className="flex items-center justify-between">
        <span className="text-slate-700 font-medium">
          {owner.is_primary && <span title="주 계약자" className="text-violet-500 mr-1">★</span>}
          {owner.name} · {owner.phone || "연락처 없음"}
          {owner.is_primary && <span className="text-violet-500 text-[10px] ml-1">(주 계약자)</span>}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-500 font-mono">{owner.ssn_masked ? (revealed || owner.ssn_masked) : "-"}</span>
        {owner.ssn_masked && (
          <button
            onClick={handleReveal}
            disabled={loading}
            className="text-[11px] text-violet-500 hover:text-violet-600 border border-violet-200 rounded-full px-2 py-0.5 disabled:opacity-50"
          >
            {loading ? "불러오는 중..." : revealed ? "숨기기" : "주민번호 보기"}
          </button>
        )}
      </div>
      {error && <p className="text-red-400">{error}</p>}
    </div>
  );
}

export default function PropertyPopup({ propertyId, contractClientId, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [agencies, setAgencies] = useState([]);

  // 매도자(임대인) 고객 검색 (수정 모드, 공동명의 다수 가능)
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerResults, setOwnerResults] = useState([]);
  const [ownerHighlight, setOwnerHighlight] = useState(0);
  const [selectedOwners, setSelectedOwners] = useState([]); // [{ id, name, phone }]
  const [primaryOwnerId, setPrimaryOwnerId] = useState(null); // 주 계약자(대표)

  async function searchOwners(q) {
    setOwnerQuery(q);
    const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`);
    setOwnerResults(await res.json());
    setOwnerHighlight(0);
  }

  async function handleOwnerFocus() {
    if (ownerResults.length === 0) {
      const res = await fetch(`/api/clients?q=${encodeURIComponent(ownerQuery)}`);
      setOwnerResults(await res.json());
      setOwnerHighlight(0);
    }
  }

  function handleOwnerKeyDown(e) {
    if (ownerResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOwnerHighlight((i) => Math.min(i + 1, ownerResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOwnerHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pickOwner(ownerResults[ownerHighlight]);
    } else if (e.key === "Escape") {
      setOwnerResults([]);
    }
  }

  function pickOwner(c) {
    setSelectedOwners((prev) => {
      if (prev.some((o) => o.id === c.id)) return prev;
      const next = [...prev, c];
      if (prev.length === 0) setPrimaryOwnerId(c.id);
      return next;
    });
    setOwnerResults([]);
    setOwnerQuery("");
  }

  function removeOwner(id) {
    setSelectedOwners((prev) => {
      const next = prev.filter((o) => o.id !== id);
      if (primaryOwnerId === id) setPrimaryOwnerId(next.length > 0 ? next[0].id : null);
      return next;
    });
  }

  useEffect(() => {
    const url = contractClientId
      ? `/api/properties/${propertyId}?client_id=${contractClientId}`
      : `/api/properties/${propertyId}`;
    fetch(url).then((r) => r.json()).then((d) => {
      setData(d);
      setForm(d);
      const owners = Array.isArray(d.owners) ? d.owners : [];
      setSelectedOwners(owners);
      setPrimaryOwnerId(owners.find((o) => o.is_primary)?.id ?? (owners[0]?.id ?? null));
    });
    fetch("/api/partner-agencies").then((r) => r.json()).then((d) => setAgencies(Array.isArray(d) ? d : []));
  }, [propertyId, contractClientId]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/properties/${propertyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, owner_client_ids: selectedOwners.map((o) => o.id), primary_owner_client_id: primaryOwnerId }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      const refreshed = await fetch(`/api/properties/${propertyId}`).then((r) => r.json());
      setData(refreshed);
      setForm(refreshed);
      const owners = Array.isArray(refreshed.owners) ? refreshed.owners : [];
      setSelectedOwners(owners);
      setPrimaryOwnerId(owners.find((o) => o.is_primary)?.id ?? (owners[0]?.id ?? null));
      setEditing(false);
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
  const finalAmountLabel = data?.final_contract_type === "매매" ? "최종매매가" : "최종보증금";

  // 최종 계약의 거래상태 계산 (완료면 잔금일이 지난 것도 포함)
  function computeFinalDealStatus() {
    if (!hasFinal) return null;
    if (data.final_deal_status === "완료") return "완료";
    if (data.final_balance_date) {
      const d = new Date(data.final_balance_date);
      if (!isNaN(d.getTime()) && d.getTime() <= Date.now()) return "완료";
    }
    return data.final_deal_status || "진행";
  }
  const finalDealStatus = computeFinalDealStatus();

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 whitespace-nowrap">
                    매도자/임대인
                    {!contractClientId && data.owners && data.owners.length > 1 && (
                      <span className="text-violet-400"> (공동명의 {data.owners.length}인)</span>
                    )}
                    {contractClientId && <span className="text-violet-400"> (해당 계약 당시)</span>}
                  </span>
                  {contractClientId ? (
                    data.final_seller_name ? (
                      <OwnerSsnRow
                        owner={{
                          id: data.final_seller_client_id,
                          name: data.final_seller_name,
                          phone: data.final_seller_phone,
                          ssn_masked: data.final_seller_ssn_masked,
                        }}
                      />
                    ) : (
                      <span className="text-slate-700">-</span>
                    )
                  ) : data.owners && data.owners.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {data.owners.map((o) => <OwnerSsnRow key={o.id} owner={o} />)}
                    </div>
                  ) : (
                    <span className="text-slate-700">
                      {[data.owner_name, data.owner_phone].filter(Boolean).join(" · ") || "-"}
                    </span>
                  )}
                </div>

                {!contractClientId && data.owner_history && data.owner_history.length > 1 && (
                  <OwnerHistorySection history={data.owner_history} />
                )}

                <Row label="물건지부동산" value={data.partner_agency_name ? `공동 · ${data.partner_agency_name}` : "단독"} />

                {hasFinal ? (
                  <>
                    <Row label="계약유형" value={data.final_contract_type} />
                    <div className="flex gap-2 items-start">
                      <span className="text-slate-400 w-24 shrink-0">{finalAmountLabel}</span>
                      <span className="text-violet-600 font-semibold">
                        {finalDepositText}
                        {contractClientId && <span className="text-slate-400 font-normal text-[11px] ml-1">(해당 계약)</span>}
                      </span>
                    </div>
                    {finalDealStatus !== "완료" && (
                      <Row
                        label="희망가(참고)"
                        value={
                          data.transaction_type === "월세"
                            ? `${formatEokMan(data.asking_deposit)} / ${formatEokMan(data.asking_monthly_rent)}`
                            : formatEokMan(data.asking_price)
                        }
                      />
                    )}
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
                  placeholder="구분 (아파트/빌라/오피스텔/상가/기타)" className="border border-slate-200 rounded-lg h-9 px-3" />
                <div className="flex gap-2">
                  <input value={form.dong || ""} onChange={(e) => setForm({ ...form, dong: e.target.value })}
                    placeholder="동" className="border border-slate-200 rounded-lg h-9 px-3 flex-1" />
                  <input value={form.ho || ""} onChange={(e) => setForm({ ...form, ho: e.target.value })}
                    placeholder="호수" className="border border-slate-200 rounded-lg h-9 px-3 flex-1" />
                </div>
                <input value={form.unit_type || ""} onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (/^\d+(\.\d+)?$/.test(v)) setForm((f) => ({ ...f, unit_type: v + "평" }));
                  }}
                  placeholder="평형 (숫자만 입력하면 자동으로 '평' 붙어요)" className="border border-slate-200 rounded-lg h-9 px-3" />
                <input value={form.usage_type || ""} onChange={(e) => setForm({ ...form, usage_type: e.target.value })}
                  placeholder="사용유형 (상가만)" className="border border-slate-200 rounded-lg h-9 px-3" />

                <AgencySelect
                  agencies={agencies}
                  value={form.partner_agency_id || ""}
                  onChange={(v) => setForm({ ...form, partner_agency_id: v })}
                />

                <label className="text-slate-400 -mb-1">매도자(임대인) 고객 검색 (공동명의면 여러 명 추가 가능)</label>
                <div className="relative">
                  <input
                    placeholder="이름 또는 연락처로 검색, 또는 클릭해서 목록 보기"
                    value={ownerQuery}
                    onChange={(e) => searchOwners(e.target.value)}
                    onFocus={handleOwnerFocus}
                    onKeyDown={handleOwnerKeyDown}
                    className="w-full border border-slate-200 rounded-lg h-9 px-3"
                  />
                  {ownerResults.length > 0 && (
                    <div className="absolute z-10 bg-white border border-slate-200 rounded-lg mt-1 w-full max-h-40 overflow-y-auto shadow-sm">
                      {ownerResults.map((c, i) => (
                        <div
                          key={c.id}
                          onMouseEnter={() => setOwnerHighlight(i)}
                          onClick={() => pickOwner(c)}
                          className={`px-3 py-2 cursor-pointer ${i === ownerHighlight ? "bg-violet-100" : "hover:bg-violet-50"}`}
                        >
                          {c.name} · {c.phone || "연락처 없음"}
                          {selectedOwners.some((o) => o.id === c.id) && <span className="text-violet-400 ml-1">✓ 추가됨</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedOwners.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedOwners.map((o) => (
                        <span
                          key={o.id}
                          className={`inline-flex items-center gap-1 rounded-full pl-3 pr-2 py-1 ${
                            primaryOwnerId === o.id ? "bg-violet-100 text-violet-700 ring-1 ring-violet-300" : "bg-violet-50 text-violet-600"
                          }`}
                        >
                          {primaryOwnerId === o.id && <span title="주 계약자">★</span>}
                          {o.name} ({o.phone || "연락처 없음"})
                          {selectedOwners.length > 1 && primaryOwnerId !== o.id && (
                            <button
                              type="button"
                              onClick={() => setPrimaryOwnerId(o.id)}
                              className="text-violet-400 hover:text-violet-700 ml-1 underline decoration-dotted"
                            >
                              대표로 지정
                            </button>
                          )}
                          <button type="button" onClick={() => removeOwner(o.id)} className="text-violet-400 hover:text-violet-700 ml-1">✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {selectedOwners.length > 1 && (
                    <p className="text-slate-400 mt-1">★ 표시된 사람이 주 계약자예요.</p>
                  )}
                </div>

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
                  <button onClick={() => {
                    setEditing(false);
                    setForm(data);
                    const owners = Array.isArray(data.owners) ? data.owners : [];
                    setSelectedOwners(owners);
                    setPrimaryOwnerId(owners.find((o) => o.is_primary)?.id ?? (owners[0]?.id ?? null));
                    setOwnerQuery("");
                    setOwnerResults([]);
                  }} className="border border-slate-200 rounded-full h-9 px-4 hover:bg-slate-50">취소</button>
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