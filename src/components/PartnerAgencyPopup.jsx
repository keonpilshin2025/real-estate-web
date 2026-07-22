import { useEffect, useState } from "react";

export default function PartnerAgencyPopup({ agencyId, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/partner-agencies/${agencyId}`).then((r) => r.json()).then((d) => {
      setData(d);
      setForm(d);
    });
  }, [agencyId]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/partner-agencies/${agencyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setData(updated);
      setEditing(false);
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
              <h3 className="text-sm font-semibold text-slate-800">부동산 정보</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">닫기 ✕</button>
            </div>

            {!editing ? (
              <div className="flex flex-col gap-2 text-xs">
                <Row label="부동산명" value={data.agency_name} />
                <Row label="전화번호" value={data.phone} />
                <Row label="핸드폰번호" value={data.mobile_phone} />
                <Row label="주소" value={data.address} />
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={() => setEditing(true)} className="bg-violet-400 text-white rounded-full h-9 px-4 font-medium hover:bg-violet-500">
                    수정하기
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-xs">
                <input value={form.agency_name || ""} onChange={(e) => setForm({ ...form, agency_name: e.target.value })}
                  placeholder="부동산명" className="border border-slate-200 rounded-lg h-9 px-3" />
                <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="전화번호" className="border border-slate-200 rounded-lg h-9 px-3" />
                <input value={form.mobile_phone || ""} onChange={(e) => setForm({ ...form, mobile_phone: e.target.value })}
                  placeholder="핸드폰번호" className="border border-slate-200 rounded-lg h-9 px-3" />
                <input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="주소" className="border border-slate-200 rounded-lg h-9 px-3" />
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

function Row({ label, value }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-slate-400 w-24 shrink-0 whitespace-nowrap">{label}</span>
      <span className="text-slate-700">{value || "-"}</span>
    </div>
  );
}