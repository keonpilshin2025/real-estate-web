import { useEffect, useState } from "react";
import ContractPopup from "./ContractPopup.jsx";

const CLIENT_ROLES = ["매도인", "매수인", "임대인", "임차인"];
const CONTRACT_TYPES = ["매매", "전세", "월세"];
const EOK = 100000000;
const MAN = 10000;

function EokManInput({ value, onChange, readOnly }) {
  const raw = Number(value || 0);
  const eok = raw ? Math.floor(raw / EOK) : "";
  const man = raw ? Math.floor((raw % EOK) / MAN) : "";

  function update(eokVal, manVal) {
    const eokInt = parseInt(eokVal, 10) || 0;
    const manInt = parseInt(manVal, 10) || 0;
    const total = eokInt * EOK + manInt * MAN;
    onChange(total ? String(total) : "");
  }

  const cls = readOnly
    ? "bg-violet-50 text-violet-600 font-medium"
    : "bg-white text-slate-800";

  return (
    <div className="col-span-2 flex items-center gap-1">
      <input type="number" min="0" step="1" readOnly={readOnly} value={eok}
        onChange={(e) => update(e.target.value, man)}
        className={`border border-slate-200 rounded-lg h-9 px-2 w-full text-right ${cls}`} placeholder="0" />
      <span className="text-slate-400 shrink-0">억</span>
      <input type="number" min="0" step="1" readOnly={readOnly} value={man}
        onChange={(e) => update(eok, e.target.value)}
        className={`border border-slate-200 rounded-lg h-9 px-2 w-full text-right ${cls}`} placeholder="0" />
      <span className="text-slate-400 shrink-0">만원</span>
    </div>
  );
}

const MINUTE_OPTIONS = ["00", "10", "20", "30", "40", "50"];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

function DateTime10Input({ value, onChange }) {
  const [datePart, timePart] = value ? value.split("T") : ["", ""];
  const [hh, mm] = timePart ? timePart.split(":") : ["", ""];

  function emit(nextDate, nextHh, nextMm) {
    if (nextDate && nextHh && nextMm) onChange(`${nextDate}T${nextHh}:${nextMm}`);
    else onChange("");
  }

  return (
    <div className="col-span-2 flex items-center gap-1">
      <input type="date" value={datePart} onChange={(e) => emit(e.target.value, hh || "00", mm || "00")}
        className="border border-slate-200 rounded-lg h-9 px-2 flex-1" />
      <select value={hh} onChange={(e) => emit(datePart, e.target.value, mm || "00")} className="border border-slate-200 rounded-lg h-9 px-1">
        <option value="">시</option>
        {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}시</option>)}
      </select>
      <select value={mm} onChange={(e) => emit(datePart, hh || "00", e.target.value)} className="border border-slate-200 rounded-lg h-9 px-1">
        <option value="">분</option>
        {MINUTE_OPTIONS.map((m) => <option key={m} value={m}>{m}분</option>)}
      </select>
    </div>
  );
}

function calcExpiry(contractType, balanceDate) {
  if (contractType === "매매" || !balanceDate) return null;
  const d = new Date(balanceDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const emptyForm = {
  property_id: "", client_id: "", client_role: "", contract_type: "",
  price: "", deposit: "", monthly_rent: "", down_payment: "", balance_amount: "",
  contract_date: "", balance_date: "", move_in_date: "", memo: "",
};

export default function ContractMapping() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [clientHighlight, setClientHighlight] = useState(0);

  const [propQuery, setPropQuery] = useState("");
  const [propResults, setPropResults] = useState([]);
  const [propHighlight, setPropHighlight] = useState(0);
  const [openContractId, setOpenContractId] = useState(null);

  const [blockingRows, setBlockingRows] = useState([]);
  const [warningRows, setWarningRows] = useState([]);

  async function fetchContracts() {
    setLoading(true);
    const res = await fetch("/api/contracts");
    const data = await res.json();
    setContracts(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { fetchContracts(); }, []);

  // 매물 + 계약유형이 정해지면 충돌 여부 체크
  useEffect(() => {
    if (!form.property_id || !form.contract_type) {
      setBlockingRows([]);
      setWarningRows([]);
      return;
    }
    const params = new URLSearchParams({
      property_id: String(form.property_id),
      contract_type: form.contract_type,
    });
    fetch(`/api/contracts/check?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setBlockingRows(Array.isArray(data?.blockingRows) ? data.blockingRows : []);
        setWarningRows(Array.isArray(data?.warningRows) ? data.warningRows : []);
      })
      .catch(() => {
        setBlockingRows([]);
        setWarningRows([]);
      });
  }, [form.property_id, form.contract_type]);

  async function searchClients(q) {
    setClientQuery(q);
    const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`);
    setClientResults(await res.json());
    setClientHighlight(0);
  }

  async function handleClientFocus() {
    if (clientResults.length === 0) {
      const res = await fetch(`/api/clients?q=${encodeURIComponent(clientQuery)}`);
      setClientResults(await res.json());
      setClientHighlight(0);
    }
  }

  function handleClientKeyDown(e) {
    if (clientResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setClientHighlight((i) => Math.min(i + 1, clientResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setClientHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pickClient(clientResults[clientHighlight]);
    } else if (e.key === "Escape") {
      setClientResults([]);
    }
  }

  async function searchProps(q) {
    setPropQuery(q);
    const res = await fetch(`/api/properties?q=${encodeURIComponent(q)}`);
    setPropResults(await res.json());
    setPropHighlight(0);
  }

  async function handlePropFocus() {
    if (propResults.length === 0) {
      const res = await fetch(`/api/properties?q=${encodeURIComponent(propQuery)}`);
      setPropResults(await res.json());
      setPropHighlight(0);
    }
  }

  function handlePropKeyDown(e) {
    if (propResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPropHighlight((i) => Math.min(i + 1, propResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPropHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pickProp(propResults[propHighlight]);
    } else if (e.key === "Escape") {
      setPropResults([]);
    }
  }

  function pickClient(c) {
    setForm({ ...form, client_id: c.id });
    setClientResults([]);
    setClientQuery(`${c.name} (${c.phone || "연락처 없음"})`);
  }

  // 매물 선택 시, 그 매물에 등록된 거래유형/희망가를 계약 폼에 기본값으로 채워줌
  // (계약 시점에 실제 협의된 금액으로 그대로 수정 가능)
  function pickProp(p) {
    setForm((prev) => {
      let next = {
        ...prev,
        property_id: p.id,
        contract_type: p.transaction_type || prev.contract_type,
        price: p.transaction_type !== "월세" ? (p.asking_price ? String(p.asking_price) : prev.price) : prev.price,
        deposit: p.transaction_type === "월세" ? (p.asking_deposit ? String(p.asking_deposit) : prev.deposit) : prev.deposit,
        monthly_rent: p.transaction_type === "월세" ? (p.asking_monthly_rent ? String(p.asking_monthly_rent) : prev.monthly_rent) : prev.monthly_rent,
      };
      return recalcBalance(next);
    });
    setPropResults([]);
    setPropQuery(`${p.property_name} ${p.dong || ""} ${p.ho || ""}`.trim());
  }

  function recalcBalance(next) {
    const base = next.contract_type === "월세" ? next.deposit : next.price;
    if (base && next.down_payment) {
      next.balance_amount = String(Math.max(Number(base) - Number(next.down_payment), 0));
    } else {
      next.balance_amount = "";
    }
    next.move_in_date = calcExpiry(next.contract_type, next.balance_date) || "";
    return next;
  }

  function updateField(field, value) {
    setForm((prev) => {
      let next = { ...prev, [field]: value };
      // 매매대금/보증금 입력 시, 계약금이 비어있으면 10%로 자동 선처리 (직접 수정 가능)
      if ((field === "price" || field === "deposit") && !prev.down_payment) {
        const base = Number(value || 0);
        if (base) {
          next.down_payment = String(Math.round((base * 0.1) / 10000) * 10000);
        }
      }
      return recalcBalance(next);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (blockingRows.length > 0) return; // 방어적 체크 (버튼은 이미 비활성화되어 있음)

    if (warningRows.length > 0) {
      const names = warningRows.map((d) => `${d.contract_type}·${d.client_name}(${d.client_role})`).join(", ");
      const ok = confirm(
        `이 매물에 이미 진행중인 다른 유형의 계약이 있습니다: ${names}\n\n그래도 등록하시겠습니까?`
      );
      if (!ok) return;
    }

    setSaving(true);

    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (res.ok) {
      closeForm();
      fetchContracts();
    } else {
      const data = await res.json();
      alert(data.error || "저장에 실패했습니다.");
    }
  }

  async function handleDelete(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    fetchContracts();
  }

  function closeForm() {
    setShowForm(false);
    setForm(emptyForm);
    setClientQuery("");
    setPropQuery("");
    setBlockingRows([]);
    setWarningRows([]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="bg-slate-900 text-white rounded-full h-9 px-4 text-xs font-medium hover:bg-slate-800"
        >
          + 계약 등록
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">구분</th>
              <th className="px-4 py-3 font-medium">매물명</th>
              <th className="px-4 py-3 font-medium">동/호수</th>
              <th className="px-4 py-3 font-medium">고객명</th>
              <th className="px-4 py-3 font-medium">역할</th>
              <th className="px-4 py-3 font-medium">잔금일시</th>
              <th className="px-4 py-3 font-medium">계약만료일</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">불러오는 중...</td></tr>}
            {!loading && contracts.length === 0 && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">등록된 계약이 없습니다.</td></tr>}
            {contracts.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{c.contract_type}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{c.property_name}</td>
                <td className="px-4 py-3 text-slate-600">{[c.property_dong, c.property_ho].filter(Boolean).join(" ") || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.client_name}</td>
                <td className="px-4 py-3 text-slate-600">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    c.client_role === "매도인" || c.client_role === "임대인" ? "bg-blue-50 text-blue-500" : "bg-orange-50 text-orange-500"
                  }`}>
                    {c.client_role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.balance_date ? String(c.balance_date).slice(0, 16).replace("T", " ") : "-"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {calcExpiry(c.contract_type, c.balance_date) || "-"}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setOpenContractId(c.id)} className="text-violet-400 hover:text-violet-600 text-xs mr-3">수정</button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openContractId && (
        <ContractPopup
          contractId={openContractId}
          onClose={() => setOpenContractId(null)}
          onSaved={fetchContracts}
        />
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">계약 등록</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2 text-xs">

              <label className="text-slate-400 col-span-2 -mb-1">고객 검색 * <span className="text-slate-300">(클릭하면 전체 목록, 방향키로 선택 가능)</span></label>
              <div className="col-span-2 relative">
                <input
                  placeholder="이름 또는 연락처로 검색, 또는 클릭해서 목록 보기"
                  value={clientQuery}
                  onChange={(e) => searchClients(e.target.value)}
                  onFocus={handleClientFocus}
                  onKeyDown={handleClientKeyDown}
                  className="w-full border border-slate-200 rounded-lg h-9 px-3"
                  required
                />
                {clientResults.length > 0 && (
                  <div className="absolute z-10 bg-white border border-slate-200 rounded-lg mt-1 w-full max-h-40 overflow-y-auto shadow-sm">
                    {clientResults.map((c, i) => (
                      <div
                        key={c.id}
                        onMouseEnter={() => setClientHighlight(i)}
                        onClick={() => pickClient(c)}
                        className={`px-3 py-2 cursor-pointer ${i === clientHighlight ? "bg-violet-100" : "hover:bg-violet-50"}`}
                      >
                        {c.name} · {c.phone || "연락처 없음"}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <select
                required
                value={form.client_role}
                onChange={(e) => setForm({ ...form, client_role: e.target.value })}
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              >
                <option value="">고객 구분 (매도/매수 등) 선택 *</option>
                {CLIENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>

              <label className="text-slate-400 col-span-2 -mb-1">매물 검색 * <span className="text-slate-300">(클릭하면 전체 목록, 방향키로 선택 가능)</span></label>
              <div className="col-span-2 relative">
                <input
                  placeholder="매물명으로 검색, 또는 클릭해서 목록 보기"
                  value={propQuery}
                  onChange={(e) => searchProps(e.target.value)}
                  onFocus={handlePropFocus}
                  onKeyDown={handlePropKeyDown}
                  className="w-full border border-slate-200 rounded-lg h-9 px-3"
                  required
                />
                {propResults.length > 0 && (
                  <div className="absolute z-10 bg-white border border-slate-200 rounded-lg mt-1 w-full max-h-40 overflow-y-auto shadow-sm">
                    {propResults.map((p, i) => (
                      <div
                        key={p.id}
                        onMouseEnter={() => setPropHighlight(i)}
                        onClick={() => pickProp(p)}
                        className={`px-3 py-2 cursor-pointer ${i === propHighlight ? "bg-violet-100" : "hover:bg-violet-50"}`}
                      >
                        {p.property_name} {p.dong} {p.ho}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {form.property_id && (
                <p className="col-span-2 text-slate-400 -mt-1">
                  매물에 등록된 거래유형/희망가가 있으면 아래 값이 자동으로 채워집니다. 실제 협의 금액으로 자유롭게 수정하세요.
                </p>
              )}

              {blockingRows.length > 0 && (
                <div className="col-span-2 bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 flex gap-2 items-start">
                  <span className="shrink-0">🚫</span>
                  <span>
                    이 매물은 이미 진행중인 같은 성격의 계약({blockingRows.map((d) => `${d.contract_type}·${d.client_name}(${d.client_role})`).join(", ")})이 있어
                    등록할 수 없습니다. 기존 계약을 먼저 종료(삭제)하거나 내용을 확인해 주세요.
                  </span>
                </div>
              )}

              {warningRows.length > 0 && (
                <div className="col-span-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 flex gap-2 items-start">
                  <span className="shrink-0">⚠️</span>
                  <span>
                    이 매물에 이미 진행중인 다른 유형의 계약이 있어요:{" "}
                    {warningRows.map((d) => `${d.contract_type}·${d.client_name}(${d.client_role})`).join(", ")}
                  </span>
                </div>
              )}

              <select
                required
                value={form.contract_type}
                onChange={(e) => setForm((prev) => recalcBalance({ ...prev, contract_type: e.target.value }))}
                className="col-span-2 border border-slate-200 rounded-lg h-9 px-3"
              >
                <option value="">계약 유형 선택 *</option>
                {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              {(form.contract_type === "매매" || form.contract_type === "전세") && (
                <>
                  <label className="text-slate-400 col-span-2 -mb-1">
                    {form.contract_type === "매매" ? "매매대금" : "전세보증금"}
                  </label>
                  <EokManInput value={form.price} onChange={(v) => updateField("price", v)} />
                </>
              )}

              {form.contract_type === "월세" && (
                <>
                  <label className="text-slate-400 col-span-2 -mb-1">월세보증금</label>
                  <EokManInput value={form.deposit} onChange={(v) => updateField("deposit", v)} />
                  <label className="text-slate-400 col-span-2 -mb-1">월세</label>
                  <EokManInput value={form.monthly_rent} onChange={(v) => setForm({ ...form, monthly_rent: v })} />
                </>
              )}

              {form.contract_type && (
                <>
                  <label className="text-slate-400 col-span-2 -mb-1">계약일시</label>
                  <DateTime10Input value={form.contract_date} onChange={(v) => setForm({ ...form, contract_date: v })} />

                  <label className="text-slate-400 col-span-2 -mb-1">계약금</label>
                  <EokManInput value={form.down_payment} onChange={(v) => updateField("down_payment", v)} />

                  <label className="text-slate-400 col-span-2 -mb-1">잔금일시</label>
                  <DateTime10Input value={form.balance_date} onChange={(v) => setForm((prev) => recalcBalance({ ...prev, balance_date: v }))} />

                  <label className="text-slate-400 col-span-2 -mb-1">잔금 (자동계산)</label>
                  <EokManInput value={form.balance_amount} onChange={() => {}} readOnly />

                  {form.contract_type !== "매매" && (
                    <>
                      <label className="text-slate-400 col-span-2 -mb-1">계약만료일 (잔금일 -1일, 자동계산)</label>
                      <input
                        type="text"
                        readOnly
                        value={form.move_in_date || ""}
                        placeholder="잔금일시 입력 시 자동으로 계산됩니다"
                        className="col-span-2 border border-slate-200 rounded-lg h-9 px-3 bg-violet-50 text-violet-600 font-medium"
                      />
                    </>
                  )}
                </>
              )}

              <textarea
                placeholder="비고"
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                className="col-span-2 border border-slate-200 rounded-lg p-3 h-16"
              />

              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={closeForm} className="border border-slate-200 rounded-full h-9 px-4 hover:bg-slate-50">취소</button>
                <button
                  type="submit"
                  disabled={saving || blockingRows.length > 0}
                  className="bg-violet-400 text-white rounded-full h-9 px-4 font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "저장 중..." : blockingRows.length > 0 ? "등록 불가" : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}