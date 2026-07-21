import { useEffect, useState } from "react";
import { exportToExcel, todayStr } from "../lib/excelExport.js";
import AddressField from "./AddressField.jsx";
import PhoneInput from "./PhoneInput.jsx";
import AreaCodePhoneInput from "./AreaCodePhoneInput.jsx";

const emptyForm = { agency_name: "", phone: "", mobile_phone: "", address: "" };

const EXCEL_COLUMNS = [
  { key: "agency_name", label: "부동산명" },
  { key: "phone", label: "전화번호" },
  { key: "mobile_phone", label: "핸드폰번호" },
  { key: "address", label: "주소" },
];

function sortByAgencyName(list) {
  return [...list].sort((a, b) => (a.agency_name || "").localeCompare(b.agency_name || "", "ko"));
}

export default function PartnerAgenciesPanel() {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);

  async function fetchAgencies() {
    setLoading(true);
    const params = new URLSearchParams({ q });
    const res = await fetch(`/api/partner-agencies?${params.toString()}`);
    const data = await res.json();
    setAgencies(sortByAgencyName(Array.isArray(data) ? data : []));
    setLoading(false);
  }

  useEffect(() => { fetchAgencies(); }, []);

  function handleSearch(e) {
    e.preventDefault();
    fetchAgencies();
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await fetch("/api/partner-agencies?limit=10000");
      const data = await res.json();
      exportToExcel(sortByAgencyName(Array.isArray(data) ? data : []), EXCEL_COLUMNS, `부동산목록_${todayStr()}.xlsx`);
    } catch (e) {
      alert("엑셀 다운로드에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const url = editingId ? `/api/partner-agencies/${editingId}` : "/api/partner-agencies";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (res.ok) {
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      fetchAgencies();
    } else {
      const data = await res.json();
      alert(data.error || "저장에 실패했습니다.");
    }
  }

  function openAddForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(a) {
    setForm({
      agency_name: a.agency_name || "",
      phone: a.phone || "",
      mobile_phone: a.mobile_phone || "",
      address: a.address || "",
    });
    setEditingId(a.id);
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/partner-agencies/${id}`, { method: "DELETE" });
    fetchAgencies();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSearch} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="부동산명 검색"
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
          + 부동산 등록
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">부동산명</th>
              <th className="px-4 py-3 font-medium">전화번호</th>
              <th className="px-4 py-3 font-medium">핸드폰번호</th>
              <th className="px-4 py-3 font-medium">주소</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400">불러오는 중...</td></tr>}
            {!loading && agencies.length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400">등록된 부동산이 없습니다.</td></tr>}
            {agencies.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{a.agency_name}</td>
                <td className="px-4 py-3 text-slate-600">{a.phone || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{a.mobile_phone || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{a.address || "-"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => openEditForm(a)} className="text-violet-400 hover:text-violet-600 text-xs mr-3">수정</button>
                  <button onClick={() => handleDelete(a.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">{editingId ? "부동산 정보 수정" : "부동산 등록"}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2 text-xs">
              <input
                placeholder="부동산명 *"
                required
                value={form.agency_name}
                onChange={(e) => setForm({ ...form, agency_name: e.target.value })}
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              />

              <label className="text-slate-400 col-span-2 -mb-1">전화번호</label>
              <AreaCodePhoneInput
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                className="col-span-2"
              />

              <label className="text-slate-400 col-span-2 -mb-1">핸드폰번호</label>
              <PhoneInput
                value={form.mobile_phone}
                onChange={(v) => setForm({ ...form, mobile_phone: v })}
                placeholder="핸드폰번호"
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              />

              <AddressField value={form.address} onChange={(addr) => setForm((f) => ({ ...f, address: addr }))} />

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