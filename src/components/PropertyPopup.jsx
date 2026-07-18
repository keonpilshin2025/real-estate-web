import { useEffect, useState } from "react";

export default function PropertyPopup({ propertyId, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/properties/${propertyId}`).then((r) => r.json()).then((d) => {
      setData(d);
      setForm(d);
    });
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
              <h3 className="text-sm font-semibold text-slate-800">물건 정보</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">닫기 ✕</button>
            </div>

            {!editing ? (
              <div className="flex flex-col gap-2 text-xs">
                <Row label="구분" value={data.property_type} />
                <Row label="물건지명" value={data.property_name} />
                <Row label="동/호수" value={[data.dong, data.ho].filter(Boolean).join(" ")} />
                <Row label="평형" value={data.unit_type} />
                <Row label="사용유형" value={data.usage_type} />
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
                  placeholder="물건지명" className="border border-slate-200 rounded-lg h-9 px-3" />
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
                <input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="주소" className="border border-slate-200 rounded-lg h-9 px-3" />
                <textarea value={form.features || ""} maxLength={500} onChange={(e) => setForm({ ...form, features: e.target.value })}
                  placeholder="특장점" className="border border-slate-200 rounded-lg p-3 h-20" />
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
      <span className="text-slate-400 w-16 shrink-0">{label}</span>
      <span className={`text-slate-700 ${multiline ? "whitespace-pre-wrap" : ""}`}>{value || "-"}</span>
    </div>
  );
}
