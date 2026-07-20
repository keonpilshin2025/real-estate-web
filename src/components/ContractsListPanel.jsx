import { useEffect, useState } from "react";
import ClientPopup from "./ClientPopup.jsx";
import PropertyPopup from "./PropertyPopup.jsx";
import ContractPopup from "./ContractPopup.jsx";
import PartnerAgencyPopup from "./PartnerAgencyPopup.jsx";
import { exportToExcel, todayStr } from "../lib/excelExport.js";

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

function formatDateTimeStr(v) {
  if (!v) return "-";
  return String(v).slice(0, 16).replace("T", " ");
}

// 동/호수 표기: 동이 있으면 "동/호수", 동이 없으면 "/호수"
function formatDongHo(dong, ho) {
  if (dong && ho) return `${dong}/${ho}`;
  if (dong) return dong;
  if (ho) return `/${ho}`;
  return "-";
}

function isSellerSide(role) {
  return role === "매도인" || role === "임대인";
}
function isBuyerSide(role) {
  return role === "매수인" || role === "임차인";
}

// 매도(임대)인 표시명: 계약에 매도/임대 역할로 직접 등록된 고객이 있으면 그걸 우선,
// 없으면 매물 등록 시 입력해둔 매도자/임대인 정보를 사용
function sellerDisplayName(c) {
  if (isSellerSide(c.client_role)) return c.client_name;
  return c.property_owner_name || null;
}

// 잔금일이 지났으면 자동으로 "완료"로 간주 (수동으로 미리 완료 처리한 것도 그대로 유지)
function computeDealStatus(status, balanceDate) {
  if (status === "완료") return "완료";
  if (balanceDate) {
    const d = new Date(balanceDate);
    if (!isNaN(d.getTime()) && d.getTime() <= Date.now()) return "완료";
  }
  return status || "진행";
}

function DealStatusBadge({ status, balanceDate }) {
  const s = computeDealStatus(status, balanceDate);
  const cls =
    s === "완료" ? "bg-green-50 text-green-600" :
    s === "대기" ? "bg-slate-100 text-slate-500" :
    "bg-blue-50 text-blue-500";
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>{s}</span>;
}

const EXCEL_COLUMNS = [
  { key: "property_name", label: "매물명" },
  { key: "property_dong", label: "동/호수", format: (_v, row) => formatDongHo(row.property_dong, row.property_ho) },
  { key: "brokerage_type", label: "중개유형" },
  { key: "partner_agency_name", label: "물건지부동산", format: (v) => v || "-" },
  { key: "client_name", label: "매도(임대)인", format: (_v, row) => sellerDisplayName(row) || "-" },
  { key: "client_name_buyer", label: "매수(임차)인", format: (_v, row) => (isBuyerSide(row.client_role) ? row.client_name : "-") },
  { key: "client_phone", label: "연락처" },
  {
    key: "price",
    label: "금액",
    format: (_v, row) => formatEokMan(row.contract_type === "월세" ? row.deposit : row.price),
  },
  { key: "balance_date", label: "잔금일시", format: (v) => formatDateTimeStr(v) },
  { key: "move_in_date", label: "계약만료일", format: (v) => (v ? String(v).slice(0, 10) : "-") },
  { key: "deal_status", label: "거래상태", format: (v, row) => computeDealStatus(v, row.balance_date) },
];

export default function ContractsListPanel() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openClientId, setOpenClientId] = useState(null);
  const [openPropertyId, setOpenPropertyId] = useState(null);
  const [openContractId, setOpenContractId] = useState(null);
  const [openAgencyId, setOpenAgencyId] = useState(null);
  const [exporting, setExporting] = useState(false);

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

  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await fetch("/api/contracts");
      const data = await res.json();
      exportToExcel(data, EXCEL_COLUMNS, `계약목록(전체)_${todayStr()}.xlsx`);
    } catch (e) {
      alert("엑셀 다운로드에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSearch} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-2 items-center">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="매물명/고객명 검색"
          className="border border-slate-200 rounded-full h-9 px-3 text-xs flex-1"
        />
        <button type="submit" className="bg-violet-400 text-white rounded-full h-9 px-4 text-xs font-medium hover:bg-violet-500">검색</button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleExportExcel}
          disabled={exporting}
          className="border border-slate-200 text-slate-600 rounded-full h-9 px-4 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {exporting ? "다운로드 중..." : "엑셀 다운로드"}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">매물명</th>
              <th className="px-4 py-3 font-medium">동/호수</th>
              <th className="px-4 py-3 font-medium">중개유형</th>
              <th className="px-4 py-3 font-medium">매도(임대)인</th>
              <th className="px-4 py-3 font-medium">매수(임차)인</th>
              <th className="px-4 py-3 font-medium">잔금일시</th>
              <th className="px-4 py-3 font-medium">계약만료일</th>
              <th className="px-4 py-3 font-medium">거래상태</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-400">불러오는 중...</td></tr>
            )}
            {!loading && contracts.length === 0 && (
              <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-400">등록된 계약이 없습니다.</td></tr>
            )}
            {contracts.map((c) => {
              const sellerName = sellerDisplayName(c);
              const sellerIsClient = isSellerSide(c.client_role);
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setOpenPropertyId(c.property_id)}
                      className="font-medium text-violet-500 hover:underline"
                    >
                      {c.property_name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDongHo(c.property_dong, c.property_ho)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.brokerage_type === "공동" ? (
                      <button
                        onClick={() => setOpenAgencyId(c.partner_agency_id)}
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-500 hover:bg-blue-100"
                      >
                        공동{c.partner_agency_name ? ` · ${c.partner_agency_name}` : ""}
                      </button>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">단독</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {sellerName ? (
                      <button
                        onClick={() => (sellerIsClient ? setOpenClientId(c.client_id) : setOpenPropertyId(c.property_id))}
                        className="font-medium text-violet-500 hover:underline"
                        title={sellerIsClient ? "고객 정보 보기" : "매물에 등록된 매도자/임대인 정보 보기"}
                      >
                        {sellerName}
                      </button>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isBuyerSide(c.client_role) ? (
                      <button
                        onClick={() => setOpenClientId(c.client_id)}
                        className="font-medium text-violet-500 hover:underline"
                      >
                        {c.client_name}
                      </button>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.balance_date ? String(c.balance_date).slice(0, 16).replace("T", " ") : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.move_in_date ? String(c.move_in_date).slice(0, 10) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <DealStatusBadge status={c.deal_status} balanceDate={c.balance_date} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setOpenContractId(c.id)} className="text-violet-400 hover:text-violet-600 text-xs">수정</button>
                  </td>
                </tr>
              );
            })}
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
      {openAgencyId && (
        <PartnerAgencyPopup
          agencyId={openAgencyId}
          onClose={() => setOpenAgencyId(null)}
          onSaved={fetchContracts}
        />
      )}
    </div>
  );
}