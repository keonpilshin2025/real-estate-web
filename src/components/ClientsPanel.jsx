import { useEffect, useState } from "react";

const TRANSACTION_TYPES = ["매매", "전세", "월세"];
const BUDGET_RANGES = [
  "1억대", "2억대", "3억대", "4억대", "5억대",
  "6억대", "7억대", "8억대", "9억대", "10억대", "10억 이상",
];

const emptyForm = {
  name: "", phone: "", description: "", address: "", memo: "",
  transaction_type: "", budget_range: "", desired_move_in_month: "",
};

export default function ClientsPanel() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [q, setQ] = useState("");
  const [nameError, setNameError] = useState("");

  async function fetchClients() {
    setLoading(true);
    const params = new URLSearchParams({ q });
    const res = await fetch(`/api/clients?${params.toString()}`);
    const data = await res.json();
    setClients(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { fetchClients(); }, []);

  function handleSearch(e) {
    e.preventDefault();
    fetchClients();
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
    });
    setEditingId(c.id);
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    fetchClients();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSearch} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-2 items-center">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름/연락처 검색"
          className="border border-slate-200 rounded-full h-9 px-3 text-xs flex-1"
        />
        <button type="submit" className="bg-violet-400 text-white rounded-full h-9 px-4 text-xs font-medium hover:bg-violet-500">검색</button>
        <div className="flex-1" />
        <button type="button" onClick={openAddForm} className="bg-slate-900 text-white rounded-full h-9 px-4 text-xs font-medium hover:bg-slate-800">
          + 고객 등록
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">연락처</th>
              <th className="px-4 py-3 font-medium">거래유형</th>
              <th className="px-4 py-3 font-medium">예산범위</th>
              <th className="px-4 py-3 font-medium">희망입주월</th>
              <th className="px-4 py-3 font-medium">고객설명</th>
              <th className="px-4 py-3 font-medium">주소</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">불러오는 중...</td></tr>}
            {!loading && clients.length === 0 && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">등록된 고객이 없습니다.</td></tr>}
            {clients.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-3 text-slate-600">{c.phone || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.transaction_type || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.budget_range || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.desired_move_in_month || "-"}</td>
                <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{c.description || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.address || "-"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => openEditForm(c)} className="text-violet-400 hover:text-violet-600 text-xs mr-3">수정</button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

              <input
                placeholder="연락처"
                type="tel"
                inputMode="numeric"
                maxLength={11}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 11) })}
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

              <input
                placeholder="(현) 주소 - 계약서용"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              />

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