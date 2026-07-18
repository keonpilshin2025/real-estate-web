import { useEffect, useState } from "react";
import ClientPopup from "./ClientPopup.jsx";
import PropertyPopup from "./PropertyPopup.jsx";
import ContractPopup from "./ContractPopup.jsx";

// 전세/월세만: 잔금일(YYYY-MM-DDTHH:mm...) 기준 하루 전 날짜(YYYY-MM-DD)를 계약만료일로 계산
function calcExpiry(contractType, balanceDate) {
  if (contractType === "매매" || !balanceDate) return null;
  const d = new Date(balanceDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function ContractsListPanel() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openClientId, setOpenClientId] = useState(null);
  const [openPropertyId, setOpenPropertyId] = useState(null);
  const [openContractId, setOpenContractId] = useState(null);

  async function fetchContracts() {
    setLoading(true);
    const params = new URLSearchParams({ q });
    const res = await fetch(`/api/contracts?${params.toString()}`);
    const data = await res.json();
    setContracts(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { fetchContracts(); }, []);

  function handleSearch(e) {
    e.preventDefault();
    fetchContracts();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSearch} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-2 items-center">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="물건지명/고객명 검색"
          className="border border-slate-200 rounded-full h-9 px-3 text-xs flex-1"
        />
        <button type="submit" className="bg-violet-400 text-white rounded-full h-9 px-4 text-xs font-medium hover:bg-violet-500">검색</button>
      </form>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">계약유형</th>
              <th className="px-4 py-3 font-medium">물건지명</th>
              <th className="px-4 py-3 font-medium">동/호수</th>
              <th className="px-4 py-3 font-medium">평형</th>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">연락처</th>
              <th className="px-4 py-3 font-medium">구분</th>
              <th className="px-4 py-3 font-medium">잔금일시</th>
              <th className="px-4 py-3 font-medium">계약만료일</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="10" className="px-4 py-8 text-center text-slate-400">불러오는 중...</td></tr>
            )}
            {!loading && contracts.length === 0 && (
              <tr><td colSpan="10" className="px-4 py-8 text-center text-slate-400">등록된 계약이 없습니다.</td></tr>
            )}
            {contracts.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{c.contract_type}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setOpenPropertyId(c.property_id)}
                    className="font-medium text-violet-500 hover:underline"
                  >
                    {c.property_name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{[c.property_dong, c.property_ho].filter(Boolean).join(" ") || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.property_unit_type || "-"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setOpenClientId(c.client_id)}
                    className="font-medium text-violet-500 hover:underline"
                  >
                    {c.client_name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{c.client_phone || "-"}</td>
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
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setOpenContractId(c.id)} className="text-violet-400 hover:text-violet-600 text-xs">수정</button>
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
          onSaved={fetchContracts}
        />
      )}
      {openPropertyId && (
        <PropertyPopup
          propertyId={openPropertyId}
          onClose={() => setOpenPropertyId(null)}
          onSaved={fetchContracts}
        />
      )}
      {openContractId && (
        <ContractPopup
          contractId={openContractId}
          onClose={() => setOpenContractId(null)}
          onSaved={fetchContracts}
        />
      )}
    </div>
  );
}