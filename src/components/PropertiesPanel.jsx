import { useEffect, useState } from "react";

const KNOWN_COMPLEXES = ["센트럴타운", "연꽃마을4단지", "산들마을2단지"];
const PROPERTY_TYPES = ["아파트", "빌라", "상가"];
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
    const total = (parseInt(eokVal, 10) || 0) * EOK + (parseInt(manVal, 10) || 0) * MAN;
    onChange(total ? String(total) : "");
  }
  return (
    <div className="col-span-2 flex items-center gap-1">
      <input type="number" min="0" step="1" value={eok} onChange={(e) => update(e.target.value, man)}
        className="border border-slate-200 rounded-lg h-9 px-2 w-full text-right" placeholder="0" />
      <span className="text-slate-400 shrink-0">억</span>
      <input type="number" min="0" step="1" value={man} onChange={(e) => update(eok, e.target.value)}
        className="border border-slate-200 rounded-lg h-9 px-2 w-full text-right" placeholder="0" />
      <span className="text-slate-400 shrink-0">만원</span>
    </div>
  );
}

const emptyForm = {
  property_name: "",
  property_type: "",
  dong: "",
  ho: "",
  address: "",
  unit_type: "",
  usage_type: "",
  features: "",
  memo: "",
  transaction_type: "",
  asking_price: "",
  asking_deposit: "",
  asking_monthly_rent: "",
  owner_name: "",
  owner_phone: "",
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

  const [presets, setPresets] = useState({}); // { 센트럴타운: { address, dongs: {...} } }
  const [isOtherName, setIsOtherName] = useState(false);
  const [agencies, setAgencies] = useState([]);

  async function fetchProperties() {
    setLoading(true);
    const params = new URLSearchParams({ q });
    const res = await fetch(`/api/properties?${params.toString()}`);
    const data = await res.json();
    setProperties(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function fetchPresets() {
    const res = await fetch("/api/complex-presets");
    const data = await res.json();
    setPresets(data || {});
  }

  async function fetchAgencies() {
    const res = await fetch("/api/partner-agencies");
    const data = await res.json();
    setAgencies(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    fetchProperties();
    fetchPresets();
    fetchAgencies();
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    fetchProperties();
  }

  // 매물명 선택
  function handleNameChange(value) {
    if (value === "__other__") {
      setIsOtherName(true);
      setForm({ ...form, property_name: "", dong: "", ho: "", address: "", unit_type: "" });
      return;
    }
    setIsOtherName(false);
    const preset = presets[value];
    setForm({
      ...form,
      property_name: value,
      property_type: "아파트",
      address: preset?.address || "",
      dong: "",
      ho: "",
      unit_type: "",
    });
  }

  const isKnown = !isOtherName && KNOWN_COMPLEXES.includes(form.property_name);
  const dongList = isKnown ? Object.keys(presets[form.property_name]?.dongs || {}) : [];
  const dongInfo = isKnown && form.dong ? presets[form.property_name]?.dongs?.[form.dong] : null;

  function handleDongChange(dong) {
    setForm({ ...form, dong, ho: "", unit_type: "" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const url = editingId ? `/api/properties/${editingId}` : "/api/properties";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (res.ok) {
      setForm(emptyForm);
      setIsOtherName(false);
      setEditingId(null);
      setShowForm(false);
      fetchProperties();
    } else {
      const data = await res.json();
      alert(data.error || "저장에 실패했습니다.");
    }
  }

  function openAddForm() {
    setForm(emptyForm);
    setIsOtherName(false);
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(p) {
    setForm({
      property_name: p.property_name || "",
      property_type: p.property_type || "",
      dong: p.dong || "",
      ho: p.ho || "",
      address: p.address || "",
      unit_type: p.unit_type || "",
      usage_type: p.usage_type || "",
      features: p.features || "",
      memo: p.memo || "",
      transaction_type: p.transaction_type || "",
      asking_price: p.asking_price || "",
      asking_deposit: p.asking_deposit || "",
      asking_monthly_rent: p.asking_monthly_rent || "",
      owner_name: p.owner_name || "",
      owner_phone: p.owner_phone || "",
      partner_agency_id: p.partner_agency_id || "",
    });
    setIsOtherName(!KNOWN_COMPLEXES.includes(p.property_name));
    setEditingId(p.id);
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/properties/${id}`, { method: "DELETE" });
    fetchProperties();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSearch} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-2 items-center">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="매물명/주소 검색"
          className="border border-slate-200 rounded-full h-9 px-3 text-xs flex-1"
        />
        <button type="submit" className="bg-violet-400 text-white rounded-full h-9 px-4 text-xs font-medium hover:bg-violet-500">검색</button>
        <div className="flex-1" />
        <button type="button" onClick={openAddForm} className="bg-slate-900 text-white rounded-full h-9 px-4 text-xs font-medium hover:bg-slate-800">
          + 매물 등록
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">구분</th>
              <th className="px-4 py-3 font-medium">매물명</th>
              <th className="px-4 py-3 font-medium">동</th>
              <th className="px-4 py-3 font-medium">호수</th>
              <th className="px-4 py-3 font-medium">평형</th>
              <th className="px-4 py-3 font-medium">거래유형</th>
              <th className="px-4 py-3 font-medium">희망가</th>
              <th className="px-4 py-3 font-medium">매도자/임대인</th>
              <th className="px-4 py-3 font-medium">물건지부동산</th>
              <th className="px-4 py-3 font-medium">주소</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="11" className="px-4 py-8 text-center text-slate-400">불러오는 중...</td></tr>}
            {!loading && properties.length === 0 && <tr><td colSpan="11" className="px-4 py-8 text-center text-slate-400">등록된 매물이 없습니다.</td></tr>}
            {properties.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{p.property_type}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{p.property_name}</td>
                <td className="px-4 py-3 text-slate-600">{p.dong || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{p.ho || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{p.unit_type || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{p.transaction_type || "-"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {p.transaction_type === "월세"
                    ? `${formatEokMan(p.asking_deposit)} / ${formatEokMan(p.asking_monthly_rent)}`
                    : formatEokMan(p.asking_price)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.owner_name || p.owner_phone
                    ? `${p.owner_name || "-"} ${p.owner_phone ? `(${p.owner_phone})` : ""}`
                    : "-"}
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

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">{editingId ? "매물 정보 수정" : "매물 등록"}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2 text-xs">

              <select
                value={isOtherName ? "__other__" : form.property_name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              >
                <option value="">매물명 선택 *</option>
                {KNOWN_COMPLEXES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__other__">기타 (직접입력)</option>
              </select>

              {isOtherName && (
                <input
                  placeholder="매물명 직접입력 (단지명/상가명/빌라명) *"
                  required
                  value={form.property_name}
                  onChange={(e) => setForm({ ...form, property_name: e.target.value })}
                  className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
                />
              )}

              <select
                required
                value={form.property_type}
                onChange={(e) => setForm({ ...form, property_type: e.target.value, usage_type: e.target.value === "상가" ? form.usage_type : "" })}
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              >
                <option value="">매물구분 선택 *</option>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              <input
                placeholder="사용유형 (상가만 입력)"
                disabled={form.property_type !== "상가"}
                value={form.usage_type}
                onChange={(e) => setForm({ ...form, usage_type: e.target.value })}
                className={`col-span-2 border border-slate-200 rounded-lg h-9 px-3 ${
                  form.property_type === "상가" ? "bg-white text-slate-800" : "bg-slate-100 text-slate-300 cursor-not-allowed"
                }`}
              />

              <label className="text-slate-400 col-span-2 -mb-1">물건지부동산 (공동중개인 경우)</label>
              <select
                value={form.partner_agency_id}
                onChange={(e) => setForm({ ...form, partner_agency_id: e.target.value })}
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              >
                <option value="">없음 (단독중개)</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>{a.agency_name}</option>
                ))}
              </select>

              <label className="text-slate-400 col-span-2 -mb-1">매도자(임대인) 정보</label>
              <input
                placeholder="매도자(임대인) 성명"
                value={form.owner_name}
                onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                className="border border-slate-200 rounded-lg h-9 px-3"
              />
              <input
                placeholder="연락처"
                value={form.owner_phone}
                onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
                className="border border-slate-200 rounded-lg h-9 px-3"
              />

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

              {/* 동 */}
              {isKnown ? (
                <select
                  value={form.dong}
                  onChange={(e) => handleDongChange(e.target.value)}
                  className="border border-slate-200 rounded-lg h-9 px-3"
                >
                  <option value="">동 선택</option>
                  {dongList.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              ) : (
                <input
                  placeholder="동 (예: 101동)"
                  value={form.dong}
                  onChange={(e) => setForm({ ...form, dong: e.target.value })}
                  className="border border-slate-200 rounded-lg h-9 px-3"
                />
              )}

              {/* 호수 */}
              {isKnown ? (
                <select
                  value={form.ho}
                  onChange={(e) => setForm({ ...form, ho: e.target.value })}
                  disabled={!form.dong}
                  className={`border border-slate-200 rounded-lg h-9 px-3 ${!form.dong ? "bg-slate-100 text-slate-300" : ""}`}
                >
                  <option value="">호수 선택</option>
                  {(dongInfo?.ho_list || []).map((h) => <option key={h} value={h}>{h}호</option>)}
                </select>
              ) : (
                <input
                  placeholder="호수 (예: 1502호)"
                  value={form.ho}
                  onChange={(e) => setForm({ ...form, ho: e.target.value })}
                  className="border border-slate-200 rounded-lg h-9 px-3"
                />
              )}

              {/* 평형 */}
              {isKnown ? (
                <select
                  value={form.unit_type}
                  onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                  className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
                >
                  <option value="">평형 선택</option>
                  {(dongInfo?.unit_types || presets[form.property_name]?.dongs?.[dongList[0]]?.unit_types || []).map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              ) : (
                <input
                  placeholder="평형 (예: 30평대)"
                  value={form.unit_type}
                  onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                  className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
                />
              )}

              {/* 주소 */}
              <input
                placeholder="주소"
                readOnly={isKnown}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={`col-span-2 border border-slate-200 rounded-lg h-9 px-3 ${isKnown ? "bg-violet-50 text-violet-600" : ""}`}
              />

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
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="border border-slate-200 rounded-full h-9 px-4 hover:bg-slate-50">취소</button>
                <button type="submit" disabled={saving} className="bg-violet-400 text-white rounded-full h-9 px-4 font-medium hover:bg-violet-500 disabled:opacity-50">
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
