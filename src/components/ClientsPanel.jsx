import { useEffect, useState } from "react";
import { exportToExcel, todayStr } from "../lib/excelExport.js";
import AddressField from "./AddressField.jsx";
import PhoneInput from "./PhoneInput.jsx";
import SsnInput from "./SsnInput.jsx";
import ClientPopup from "./ClientPopup.jsx";

const TRANSACTION_TYPES = ["매매", "전세", "월세"];
const BUDGET_RANGES = [
  "1억대", "2억대", "3억대", "4억대", "5억대",
  "6억대", "7억대", "8억대", "9억대", "10억대", "10억 이상",
];

const EXCEL_COLUMNS = [
  { key: "name", label: "이름" },
  { key: "phone", label: "연락처" },
  { key: "ssn_masked", label: "주민번호", format: (v) => v || "-" },
  { key: "transaction_type", label: "거래유형" },
  { key: "budget_range", label: "예산범위" },
  { key: "desired_move_in_month", label: "희망입주월" },
  { key: "description", label: "고객설명" },
  { key: "address", label: "주소" },
  { key: "created_at", label: "등록일", format: (v) => (v ? String(v).slice(0, 10) : "-") },
  { key: "memo", label: "비고" },
];

const emptyForm = {
  name: "", phone: "", description: "", address: "", memo: "",
  transaction_type: "", budget_range: "", desired_move_in_month: "", ssn: "",
};

// 등록일시 최신순 정렬
// 등록일시 정렬 (dir: "desc" 최신순, "asc" 오래된순)
function sortByCreatedAt(list, dir = "desc") {
  return [...list].sort((a, b) => {
    if (!a.created_at && !b.created_at) return 0;
    if (!a.created_at) return 1;
    if (!b.created_at) return -1;
    const diff = new Date(b.created_at) - new Date(a.created_at);
    return dir === "asc" ? -diff : diff;
  });
}

export default function ClientsPanel() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [q, setQ] = useState("");
  const [nameError, setNameError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [editingHasSsn, setEditingHasSsn] = useState(false);
  const [openClientId, setOpenClientId] = useState(null);
  const [createdAtSortDir, setCreatedAtSortDir] = useState("desc");

  async function fetchClients() {
    setLoading(true);
    const params = new URLSearchParams({ q });
    const res = await fetch(`/api/clients?${params.toString()}`);
    const data = await res.json();
    setClients(sortByCreatedAt(Array.isArray(data) ? data : [], createdAtSortDir));
    setLoading(false);
  }

  useEffect(() => { fetchClients(); }, []);

  function toggleCreatedAtSort() {
    const nextDir = createdAtSortDir === "desc" ? "asc" : "desc";
    setCreatedAtSortDir(nextDir);
    setClients((prev) => sortByCreatedAt(prev, nextDir));
  }

  function handleSearch(e) {
    e.preventDefault();
    fetchClients();
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await fetch("/api/clients?limit=10000");
      const data = await res.json();
      exportToExcel(sortByCreatedAt(Array.isArray(data) ? data : [], createdAtSortDir), EXCEL_COLUMNS, `고객목록_${todayStr()}.xlsx`);
    } catch (e) {
      alert("엑셀 다운로드에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }

  const [composing, setComposing] = useState(false);

  function handleNameChange(value) {
    // 한글 조합(IME) 중에는 필터링하지 않고 그대로 반영 (조합이 끊기는 것 방지)
    if (composing) {
      setForm({ ...form, name: value });
      return;
    }
    const filtered = value.replace(/[^가-힣]/g, "");
    setForm({ ...form, name: filtered });
    setNameError(value !== filtered ? "이름은 한글만 입력 가능합니다." : "");
  }

  function handleNameCompositionEnd(value) {
    setComposing(false);
    const filtered = value.replace(/[^가-힣]/g, "");
    setForm({ ...form, name: filtered });
    setNameError(value !== filtered ? "이름은 한글만 입력 가능합니다." : "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const url = editingId ? `/api/clients/${editingId}` : "/api/clients";
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
      fetchClients();
    } else {
      const data = await res.json();
      alert(data.error || "저장에 실패했습니다.");
    }
  }

  function openAddForm() {
    setForm(emptyForm);
    setEditingId(null);
    setEditingHasSsn(false);
    setShowForm(true);
  }

  function openEditForm(c) {
    setForm({
      name: c.name || "",
      phone: c.phone || "",
      description: c.description || "",
      address: c.address || "",
      memo: c.memo || "",
      transaction_type: c.transaction_type || "",
      budget_range: c.budget_range || "",
      desired_move_in_month: c.desired_move_in_month || "",
      ssn: "", // 보안상 기존 주민번호는 수정폼에 절대 채워넣지 않음. 비워두면 기존 값 유지.
    });
    setEditingId(c.id);
    setEditingHasSsn(!!c.ssn_masked);
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchClients();
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
          placeholder="이름/연락처 검색"
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
          + 고객 등록
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-xs min-w-[820px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">연락처</th>
              <th className="px-4 py-3 font-medium">거래유형</th>
              <th className="px-4 py-3 font-medium">예산범위</th>
              <th className="px-4 py-3 font-medium">희망입주월</th>
              <th className="px-4 py-3 font-medium">주소</th>
              <th className="px-4 py-3 font-medium">
                <button
                  onClick={toggleCreatedAtSort}
                  className="flex items-center gap-1 hover:text-slate-700"
                >
                  등록일 <span className="text-slate-400">{createdAtSortDir === "desc" ? "▼" : "▲"}</span>
                </button>
              </th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">불러오는 중...</td></tr>}
            {!loading && clients.length === 0 && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">등록된 고객이 없습니다.</td></tr>}
            {clients.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <button onClick={() => setOpenClientId(c.id)} className="font-medium text-violet-500 hover:underline">
                    {c.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{c.phone || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.transaction_type || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.budget_range || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.desired_move_in_month || "-"}</td>
                <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate" title={c.address || ""}>{c.address || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.created_at ? String(c.created_at).slice(0, 10) : "-"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => openEditForm(c)} className="text-violet-400 hover:text-violet-600 text-xs mr-3">수정</button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openClientId && (
        <ClientPopup
          clientId={openClientId}
          onClose={() => setOpenClientId(null)}
          onSaved={fetchClients}
        />
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">{editingId ? "고객 정보 수정" : "고객 등록"}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2 text-xs">
              <input
                placeholder="이름 (한글만) *"
                required
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={(e) => handleNameCompositionEnd(e.target.value)}
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              />
              {nameError && <p className="col-span-2 text-red-400 -mt-1">{nameError}</p>}

              <PhoneInput
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                placeholder="연락처"
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              />

              <label className="text-slate-400 col-span-2 -mb-1">
                주민번호 {editingHasSsn && <span className="text-slate-300">(변경 시에만 입력, 비워두면 기존 값 유지)</span>}
              </label>
              <SsnInput
                value={form.ssn}
                onChange={(v) => setForm({ ...form, ssn: v })}
                placeholder={editingHasSsn ? "등록된 주민번호가 있어요 (변경 시에만 입력)" : "990101-1234567"}
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              />

              <label className="text-slate-400 col-span-2 -mb-1">희망 조건</label>
              <select
                value={form.transaction_type}
                onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}
                className="border border-slate-200 rounded-lg h-9 px-3"
              >
                <option value="">거래유형 선택</option>
                {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={form.budget_range}
                onChange={(e) => setForm({ ...form, budget_range: e.target.value })}
                className="border border-slate-200 rounded-lg h-9 px-3"
              >
                <option value="">예산범위 선택</option>
                {BUDGET_RANGES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>

              <label className="text-slate-400 col-span-2 -mb-1">희망입주월</label>
              <input
                type="month"
                value={form.desired_move_in_month}
                onChange={(e) => setForm({ ...form, desired_move_in_month: e.target.value })}
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              />

              <label className="text-slate-400 col-span-2 -mb-1">고객설명 (통화내용/기억할 부분, 최대 500자)</label>
              <textarea
                maxLength={500}
                placeholder="예: 판교 직장, 30평대 희망, 8월 이사 예정 등"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="col-span-2 border border-slate-200 rounded-lg p-3 h-24"
              />
              <p className="col-span-2 text-right text-slate-300 -mt-1">{form.description.length}/500</p>

              <label className="text-slate-400 col-span-2 -mb-1">(현) 주소 - 계약서용</label>
              <AddressField value={form.address} onChange={(addr) => setForm((f) => ({ ...f, address: addr }))} />

              <label className="text-slate-400 col-span-2 -mb-1">비고</label>
              <textarea
                placeholder="기타 참고사항"
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