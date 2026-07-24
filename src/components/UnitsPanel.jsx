import { useEffect, useState } from "react";
import { exportToExcel, todayStr } from "../lib/excelExport.js";
import AddressField from "./AddressField.jsx";

const KNOWN_COMPLEXES = ["센트럴타운", "연꽃마을4단지", "산들마을2단지"];
const PROPERTY_TYPES = ["아파트", "빌라", "오피스텔", "상가", "기타"];

// 동 값 끝에 붙은 "동" 글자 제거 (예: "316동" -> "316")
function stripDongSuffix(dong) {
  return dong ? dong.replace(/동$/, "") : dong;
}

const EXCEL_COLUMNS = [
  { key: "property_type", label: "구분" },
  { key: "property_name", label: "물건명" },
  { key: "dong", label: "동", format: (v) => stripDongSuffix(v) || "-" },
  { key: "ho", label: "호수" },
  { key: "unit_type", label: "평형" },
  { key: "unit_sqm", label: "전용면적(㎡)" },
  { key: "usage_type", label: "사용유형" },
  { key: "address", label: "주소" },
  { key: "property_id", label: "매물 연결여부", format: (v) => (v ? "연결됨" : "미연결") },
];

const emptyForm = {
  property_name: "", property_type: "", dong: "", ho: "",
  address: "", unit_type: "", unit_sqm: "", usage_type: "",
};

export default function UnitsPanel() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);

  const [presets, setPresets] = useState({});
  const [isOtherName, setIsOtherName] = useState(false);

  async function fetchUnits() {
    setLoading(true);
    const params = new URLSearchParams({ q });
    const res = await fetch(`/api/units?${params.toString()}`);
    const data = await res.json();
    setUnits(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function fetchPresets() {
    const res = await fetch("/api/complex-presets");
    const data = await res.json();
    setPresets(data || {});
  }

  useEffect(() => {
    fetchUnits();
    fetchPresets();
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    fetchUnits();
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await fetch("/api/units?limit=10000");
      const data = await res.json();
      exportToExcel(Array.isArray(data) ? data : [], EXCEL_COLUMNS, `물건목록_${todayStr()}.xlsx`);
    } catch (e) {
      alert("엑셀 다운로드에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }

  function handleNameChange(value) {
    if (value === "__other__") {
      setIsOtherName(true);
      setForm({ ...form, property_name: "", dong: "", ho: "", address: "", unit_type: "", unit_sqm: "" });
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
      unit_sqm: "",
    });
  }

  const isKnown = !isOtherName && KNOWN_COMPLEXES.includes(form.property_name);
  const dongList = isKnown ? Object.keys(presets[form.property_name]?.dongs || {}) : [];
  const dongInfo = isKnown && form.dong ? presets[form.property_name]?.dongs?.[form.dong] : null;

  function handleDongChange(dong) {
    setForm({ ...form, dong, ho: "", unit_type: "", unit_sqm: "" });
  }

  // 평형(unit_type) 선택 시, 알려진 단지면 그 평형의 평방미터를 자동으로 채움
  function handleUnitTypeChange(label) {
    const typeList = dongInfo?.unit_types || presets[form.property_name]?.dongs?.[dongList[0]]?.unit_types || [];
    const matched = typeList.find((t) => t.label === label);
    setForm({ ...form, unit_type: label, unit_sqm: matched ? matched.sqm : form.unit_sqm });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const url = editingId ? `/api/units/${editingId}` : "/api/units";
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
      fetchUnits();
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

  function openEditForm(u) {
    setForm({
      property_name: u.property_name || "",
      property_type: u.property_type || "",
      dong: u.dong || "",
      ho: u.ho || "",
      address: u.address || "",
      unit_type: u.unit_type || "",
      unit_sqm: u.unit_sqm || "",
      usage_type: u.usage_type || "",
    });
    setIsOtherName(!KNOWN_COMPLEXES.includes(u.property_name));
    setEditingId(u.id);
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/units/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUnits();
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
          placeholder="물건명/동/호수/주소 검색"
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
          + 물건 등록
        </button>
      </form>

      <p className="text-slate-400 text-xs px-1">
        여기서는 부동산 자체(단지/동/호수/평형/주소) 정보만 등록해요. 매도자·거래유형·희망가는 "매물" 탭에서 이 물건을 연결해 등록합니다.
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">물건명</th>
              <th className="px-4 py-3 font-medium">구분</th>
              <th className="px-4 py-3 font-medium">동</th>
              <th className="px-4 py-3 font-medium">호수</th>
              <th className="px-4 py-3 font-medium">평형</th>
              <th className="px-4 py-3 font-medium">전용면적</th>
              <th className="px-4 py-3 font-medium">주소</th>
              <th className="px-4 py-3 font-medium">매물 연결</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-400">불러오는 중...</td></tr>}
            {!loading && units.length === 0 && <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-400">등록된 물건이 없습니다.</td></tr>}
            {units.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.property_name}</td>
                <td className="px-4 py-3 text-slate-600">{u.property_type || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{stripDongSuffix(u.dong) || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{u.ho || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{u.unit_type || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{u.unit_sqm ? `${u.unit_sqm}㎡` : "-"}</td>
                <td className="px-4 py-3 text-slate-600">{u.address || "-"}</td>
                <td className="px-4 py-3">
                  {u.property_id ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-600">연결됨</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">미연결</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => openEditForm(u)} className="text-violet-400 hover:text-violet-600 text-xs mr-3">수정</button>
                  <button onClick={() => handleDelete(u.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">{editingId ? "물건 정보 수정" : "물건 등록"}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2 text-xs">

              <select
                value={isOtherName ? "__other__" : form.property_name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              >
                <option value="">물건명 선택 *</option>
                {KNOWN_COMPLEXES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__other__">기타 (직접입력)</option>
              </select>

              {isOtherName && (
                <input
                  placeholder="물건명 직접입력 (단지명/상가명/빌라명) *"
                  required
                  value={form.property_name}
                  onChange={(e) => setForm({ ...form, property_name: e.target.value })}
                  className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
                />
              )}

              <select
                required
                value={form.property_type}
                onChange={(e) => setForm({
                  ...form,
                  property_type: e.target.value,
                  usage_type: (e.target.value === "상가" || e.target.value === "기타") ? form.usage_type : "",
                })}
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              >
                <option value="">매물구분 선택 *</option>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              <input
                placeholder={form.property_type === "기타" ? "매물구분 직접입력 (예: 타운하우스, 단독주택 등)" : "사용유형 (상가만 입력)"}
                disabled={form.property_type !== "상가" && form.property_type !== "기타"}
                value={form.usage_type}
                onChange={(e) => setForm({ ...form, usage_type: e.target.value })}
                className={`col-span-2 border border-slate-200 rounded-lg h-9 px-3 ${
                  (form.property_type === "상가" || form.property_type === "기타") ? "bg-white text-slate-800" : "bg-slate-100 text-slate-300 cursor-not-allowed"
                }`}
              />

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
                  placeholder="동 (숫자만 입력하면 자동으로 '동' 붙어요)"
                  value={form.dong}
                  onChange={(e) => setForm({ ...form, dong: e.target.value })}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && !v.endsWith("동")) setForm((f) => ({ ...f, dong: v + "동" }));
                  }}
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

              {/* 평형 + 전용면적(㎡) */}
              {isKnown ? (
                <>
                  <select
                    value={form.unit_type}
                    onChange={(e) => handleUnitTypeChange(e.target.value)}
                    className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
                  >
                    <option value="">평형 선택</option>
                    {(dongInfo?.unit_types || presets[form.property_name]?.dongs?.[dongList[0]]?.unit_types || []).map((u) => (
                      <option key={u.label} value={u.label}>{u.label} ({u.sqm}㎡)</option>
                    ))}
                  </select>
                  {form.unit_type && (
                    <p className="col-span-2 text-slate-400 -mt-1">
                      전용면적 {form.unit_sqm}㎡ (자동 입력됨 · 틀리면 직접 고칠 수 있어요)
                    </p>
                  )}
                  <input
                    type="number"
                    step="0.01"
                    placeholder="전용면적(㎡) 확인/수정"
                    value={form.unit_sqm}
                    onChange={(e) => setForm({ ...form, unit_sqm: e.target.value })}
                    className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
                  />
                </>
              ) : (
                <>
                  <input
                    placeholder="평형 (숫자만 입력하면 자동으로 '평' 붙어요)"
                    value={form.unit_type}
                    onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (/^\d+(\.\d+)?$/.test(v)) setForm((f) => ({ ...f, unit_type: v + "평" }));
                    }}
                    className="border border-slate-200 rounded-lg h-9 px-3"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="전용면적(㎡)"
                    value={form.unit_sqm}
                    onChange={(e) => setForm({ ...form, unit_sqm: e.target.value })}
                    className="border border-slate-200 rounded-lg h-9 px-3"
                  />
                </>
              )}

              {/* 주소 */}
              <AddressField
                value={form.address}
                onChange={(addr) => setForm((f) => ({ ...f, address: addr }))}
                readOnly={isKnown}
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