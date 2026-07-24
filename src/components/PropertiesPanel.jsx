import { useEffect, useState } from "react";
import { exportToExcel, todayStr } from "../lib/excelExport.js";
import PropertyPopup from "./PropertyPopup.jsx";
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
    <div className="col-span-2 flex items-center gap-1">
      <input type="number" min="0" step="1" value={eok} onChange={(e) => update(e.target.value, man)}
        className="border border-slate-200 rounded-lg h-9 px-2 w-full text-right" placeholder="0" />
      <span className="text-slate-400 shrink-0">억</span>
      <input type="number" min="0" max="9999" step="1" value={man} onChange={(e) => update(eok, e.target.value)}
        className="border border-slate-200 rounded-lg h-9 px-2 w-full text-right" placeholder="0" />
      <span className="text-slate-400 shrink-0">만원</span>
    </div>
  );
}

// 동 값 끝에 붙은 "동" 글자 제거 (예: "316동" -> "316")
function stripDongSuffix(dong) {
  return dong ? dong.replace(/동$/, "") : dong;
}

const EXCEL_COLUMNS = [
  { key: "property_type", label: "구분" },
  { key: "property_name", label: "매물명" },
  { key: "dong", label: "동", format: (v) => stripDongSuffix(v) || "-" },
  { key: "ho", label: "호수" },
  { key: "unit_type", label: "평형" },
  { key: "transaction_type", label: "거래유형" },
  {
    key: "asking_price",
    label: "희망가",
    format: (_v, row) =>
      row.transaction_type === "월세"
        ? `${formatEokMan(row.asking_deposit)} / ${formatEokMan(row.asking_monthly_rent)}`
        : formatEokMan(row.asking_price),
  },
  {
    key: "owners",
    label: "매도자/임대인 성명",
    format: (v) => (Array.isArray(v) && v.length > 0 ? v.map((o) => o.name).join(", ") : "-"),
  },
  {
    key: "owners",
    label: "매도자/임대인 연락처",
    format: (v) => (Array.isArray(v) && v.length > 0 ? v.map((o) => o.phone || "-").join(", ") : "-"),
  },
  { key: "partner_agency_name", label: "중개유형", format: (v) => (v ? `공동 · ${v}` : "단독") },
  { key: "address", label: "주소" },
  { key: "features", label: "특장점" },
  { key: "memo", label: "비고" },
];

const emptyForm = {
  unit_id: "",
  features: "",
  memo: "",
  transaction_type: "",
  asking_price: "",
  asking_deposit: "",
  asking_monthly_rent: "",
  partner_agency_id: "",
};

export default function PropertiesPanel() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);
  const [openDetailId, setOpenDetailId] = useState(null);

  const [agencies, setAgencies] = useState([]);

  // 물건 검색 (등록/수정 시 사용)
  const [unitQuery, setUnitQuery] = useState("");
  const [unitResults, setUnitResults] = useState([]);
  const [unitHighlight, setUnitHighlight] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState(null); // { id, property_name, property_type, dong, ho, unit_type, address, property_id }

  // 매도자(임대인) 고객 검색
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerResults, setOwnerResults] = useState([]);
  const [ownerHighlight, setOwnerHighlight] = useState(0);
  const [selectedOwners, setSelectedOwners] = useState([]);
  const [primaryOwnerId, setPrimaryOwnerId] = useState(null);

  async function fetchProperties() {
    setLoading(true);
    const params = new URLSearchParams({ q });
    const res = await fetch(`/api/properties?${params.toString()}`);
    const data = await res.json();
    setProperties(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function fetchAgencies() {
    const res = await fetch("/api/partner-agencies");
    const data = await res.json();
    setAgencies(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    fetchProperties();
    fetchAgencies();
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    fetchProperties();
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await fetch("/api/properties?limit=10000");
      const data = await res.json();
      exportToExcel(data, EXCEL_COLUMNS, `매물목록_${todayStr()}.xlsx`);
    } catch (e) {
      alert("엑셀 다운로드에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }

  // ===== 물건 검색 =====
  async function searchUnits(q) {
    setUnitQuery(q);
    const res = await fetch(`/api/units?q=${encodeURIComponent(q)}`);
    setUnitResults(await res.json());
    setUnitHighlight(0);
  }

  async function handleUnitFocus() {
    if (unitResults.length === 0) {
      const res = await fetch(`/api/units?q=${encodeURIComponent(unitQuery)}`);
      setUnitResults(await res.json());
      setUnitHighlight(0);
    }
  }

  function handleUnitKeyDown(e) {
    if (unitResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setUnitHighlight((i) => Math.min(i + 1, unitResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setUnitHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pickUnit(unitResults[unitHighlight]);
    } else if (e.key === "Escape") {
      setUnitResults([]);
    }
  }

  function pickUnit(u) {
    setSelectedUnit(u);
    setForm((f) => ({ ...f, unit_id: u.id }));
    setUnitResults([]);
    setUnitQuery("");
  }

  // ===== 매도자(임대인) 검색 =====
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.unit_id) {
      alert("물건을 먼저 검색해서 선택해주세요.");
      return;
    }
    setSaving(true);

    const url = editingId ? `/api/properties/${editingId}` : "/api/properties";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, owner_client_ids: selectedOwners.map((o) => o.id), primary_owner_client_id: primaryOwnerId }),
    });

    setSaving(false);

    if (res.ok) {
      closeForm();
      fetchProperties();
    } else {
      const data = await res.json();
      alert(data.error || "저장에 실패했습니다.");
    }
  }

  function closeForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setSelectedUnit(null);
    setUnitQuery("");
    setUnitResults([]);
    setSelectedOwners([]);
    setPrimaryOwnerId(null);
    setOwnerQuery("");
    setOwnerResults([]);
  }

  function openAddForm() {
    setForm(emptyForm);
    setEditingId(null);
    setSelectedUnit(null);
    setUnitQuery("");
    setUnitResults([]);
    setSelectedOwners([]);
    setPrimaryOwnerId(null);
    setOwnerQuery("");
    setOwnerResults([]);
    setShowForm(true);
  }

  function openEditForm(p) {
    setForm({
      unit_id: p.unit_id,
      features: p.features || "",
      memo: p.memo || "",
      transaction_type: p.transaction_type || "",
      asking_price: p.asking_price || "",
      asking_deposit: p.asking_deposit || "",
      asking_monthly_rent: p.asking_monthly_rent || "",
      partner_agency_id: p.partner_agency_id || "",
    });
    setSelectedUnit({
      id: p.unit_id,
      property_name: p.property_name,
      property_type: p.property_type,
      dong: p.dong,
      ho: p.ho,
      unit_type: p.unit_type,
      address: p.address,
    });
    setUnitQuery("");
    setUnitResults([]);
    const owners = Array.isArray(p.owners) ? p.owners : [];
    setSelectedOwners(owners);
    setPrimaryOwnerId(owners.find((o) => o.is_primary)?.id ?? (owners[0]?.id ?? null));
    setOwnerQuery("");
    setOwnerResults([]);
    setEditingId(p.id);
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/properties/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchProperties();
    } else {
      const data = await res.json();
      alert(data.error || "삭제에 실패했습니다.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSearch} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="매물명/동/호수/주소 검색"
          className="border border-slate-200 rounded-full h-9 px-3 text-xs flex-1 min-w-[160px]"
        />
        <button type="submit" className="bg-violet-400 text-white rounded-full h-9 px-4 text-xs font-medium hover:bg-violet-500 whitespace-nowrap shrink-0">검색</button>
        <button
          type="button"
          onClick={handleExportExcel}
          disabled={exporting}
          className="border border-slate-200 text-slate-600 rounded-full h-9 px-4 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {exporting ? "다운로드 중..." : "엑셀 다운로드"}
        </button>
        <button type="button" onClick={openAddForm} className="bg-slate-900 text-white rounded-full h-9 px-4 text-xs font-medium hover:bg-slate-800 whitespace-nowrap shrink-0">
          + 매물 등록
        </button>
      </form>

      <p className="text-slate-400 text-xs px-1">
        등록하려는 물건이 목록에 없으면, 먼저 "물건" 탭에서 그 부동산 정보를 등록해주세요.
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">매물명</th>
              <th className="px-4 py-3 font-medium">동</th>
              <th className="px-4 py-3 font-medium">평형</th>
              <th className="px-4 py-3 font-medium">거래유형</th>
              <th className="px-4 py-3 font-medium">희망가</th>
              <th className="px-4 py-3 font-medium">중개유형</th>
              <th className="px-4 py-3 font-medium">주소</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">불러오는 중...</td></tr>}
            {!loading && properties.length === 0 && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">등록된 매물이 없습니다.</td></tr>}
            {properties.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <button
                    onClick={() => setOpenDetailId(p.id)}
                    className="font-medium text-violet-500 hover:underline"
                  >
                    {p.property_name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{stripDongSuffix(p.dong) || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{p.unit_type || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{p.transaction_type || "-"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {p.transaction_type === "월세"
                    ? `${formatEokMan(p.asking_deposit)} / ${formatEokMan(p.asking_monthly_rent)}`
                    : formatEokMan(p.asking_price)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.partner_agency_name ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-500">
                      공동 · {p.partner_agency_name}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">단독</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{p.address || "-"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => openEditForm(p)} className="text-violet-400 hover:text-violet-600 text-xs mr-3">수정</button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openDetailId && (
        <PropertyPopup
          propertyId={openDetailId}
          onClose={() => setOpenDetailId(null)}
          onSaved={fetchProperties}
        />
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">{editingId ? "매물 정보 수정" : "매물 등록"}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2 text-xs">

              <label className="text-slate-400 col-span-2 -mb-1">
                물건 검색 * <span className="text-slate-300">(클릭하면 전체 목록, 방향키로 선택 가능)</span>
              </label>
              <div className="col-span-2 relative">
                <input
                  placeholder="물건명/동/호수/주소로 검색"
                  value={unitQuery}
                  onChange={(e) => searchUnits(e.target.value)}
                  onFocus={handleUnitFocus}
                  onKeyDown={handleUnitKeyDown}
                  className="w-full border border-slate-200 rounded-lg h-9 px-3"
                />
                {unitResults.length > 0 && (
                  <div className="absolute z-10 bg-white border border-slate-200 rounded-lg mt-1 w-full max-h-40 overflow-y-auto shadow-sm">
                    {unitResults.map((u, i) => (
                      <div
                        key={u.id}
                        onMouseEnter={() => setUnitHighlight(i)}
                        onClick={() => pickUnit(u)}
                        className={`px-3 py-2 cursor-pointer ${i === unitHighlight ? "bg-violet-100" : "hover:bg-violet-50"} ${u.property_id && u.property_id !== editingId ? "opacity-50" : ""}`}
                      >
                        {u.property_name} · {[stripDongSuffix(u.dong), u.ho, u.unit_type].filter(Boolean).join(" ")}
                        {u.property_id && <span className="text-red-400 ml-1">(이미 매물 연결됨)</span>}
                      </div>
                    ))}
                  </div>
                )}

                {selectedUnit ? (
                  <div className={`mt-2 border rounded-lg p-3 ${selectedUnit.property_id && selectedUnit.property_id !== editingId ? "bg-red-50 border-red-200" : "bg-violet-50 border-violet-100"}`}>
                    <p className={`font-medium ${selectedUnit.property_id && selectedUnit.property_id !== editingId ? "text-red-700" : "text-violet-700"}`}>{selectedUnit.property_name}</p>
                    <p className={selectedUnit.property_id && selectedUnit.property_id !== editingId ? "text-red-500" : "text-violet-500"}>
                      {[selectedUnit.property_type, stripDongSuffix(selectedUnit.dong), selectedUnit.ho, selectedUnit.unit_type].filter(Boolean).join(" · ")}
                    </p>
                    <p className={selectedUnit.property_id && selectedUnit.property_id !== editingId ? "text-red-400" : "text-violet-400"}>{selectedUnit.address}</p>
                    {selectedUnit.property_id && selectedUnit.property_id !== editingId && (
                      <p className="text-red-500 font-medium mt-1">⚠ 이 물건은 이미 다른 매물에 연결되어 있어요. 다른 물건을 선택해주세요.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 mt-1">
                    목록에 없으면 먼저 "물건" 탭에서 등록해주세요.
                  </p>
                )}
              </div>

              <label className="text-slate-400 col-span-2 -mb-1">중개유형 (공동중개 시 부동산 선택)</label>
              <AgencySelect
                agencies={agencies}
                value={form.partner_agency_id}
                onChange={(v) => setForm({ ...form, partner_agency_id: v })}
                className="col-span-2"
              />

              <label className="text-slate-400 col-span-2 -mb-1">
                매도자(임대인) 고객 검색 <span className="text-slate-300">(공동명의면 여러 명 추가 가능, 방향키로 선택 가능)</span>
              </label>
              <div className="col-span-2 relative">
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

                <p className="text-slate-400 mt-1">
                  목록에 없으면 먼저 "고객" 탭에서 등록해주세요. 성명/연락처/주민번호는 연결된 고객 정보를 그대로 사용해요.
                </p>
              </div>

              <label className="text-slate-400 col-span-2 -mb-1">거래유형 / 희망가</label>
              <select
                value={form.transaction_type}
                onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              >
                <option value="">거래유형 선택</option>
                {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              {(form.transaction_type === "매매" || form.transaction_type === "전세") && (
                <>
                  <span className="col-span-2 text-slate-400 -mb-1">
                    {form.transaction_type === "매매" ? "희망 매매대금" : "희망 전세보증금"}
                  </span>
                  <EokManInput value={form.asking_price} onChange={(v) => setForm({ ...form, asking_price: v })} />
                </>
              )}

              {form.transaction_type === "월세" && (
                <>
                  <span className="col-span-2 text-slate-400 -mb-1">희망 월세보증금</span>
                  <EokManInput value={form.asking_deposit} onChange={(v) => setForm({ ...form, asking_deposit: v })} />
                  <span className="col-span-2 text-slate-400 -mb-1">희망 월세</span>
                  <EokManInput value={form.asking_monthly_rent} onChange={(v) => setForm({ ...form, asking_monthly_rent: v })} />
                </>
              )}

              <label className="text-slate-400 col-span-2 -mb-1">특장점 (최대 500자)</label>
              <textarea
                maxLength={500}
                placeholder="이 매물만의 장점을 적어주세요"
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                className="col-span-2 border border-slate-200 rounded-lg p-3 h-20"
              />

              <label className="text-slate-400 col-span-2 -mb-1">비고</label>
              <textarea
                placeholder="그 외 예외 사항"
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                className="col-span-2 border border-slate-200 rounded-lg p-3 h-16"
              />

              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={closeForm} className="border border-slate-200 rounded-full h-9 px-4 hover:bg-slate-50">취소</button>
                <button
                  type="submit"
                  disabled={saving || (selectedUnit && selectedUnit.property_id && selectedUnit.property_id !== editingId)}
                  className="bg-violet-400 text-white rounded-full h-9 px-4 font-medium hover:bg-violet-500 disabled:opacity-50"
                >
                  {saving ? "저장 중..." : editingId ? "수정 완료" : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}