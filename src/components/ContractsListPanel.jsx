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
// 동 값 끝에 붙은 "동" 글자 제거 (예: "316동" -> "316")
function stripDongSuffix(dong) {
  return dong ? dong.replace(/동$/, "") : dong;
}

function formatDongHo(dong, ho) {
  const d = stripDongSuffix(dong);
  if (d && ho) return `${d}/${ho}`;
  if (d) return d;
  if (ho) return `/${ho}`;
  return "-";
}

function isSellerSide(role) {
  return role === "매도인" || role === "임대인";
}
function isBuyerSide(role) {
  return role === "매수인" || role === "임차인";
}

function sellerDisplayName(c) {
  if (isSellerSide(c.client_role)) return c.client_name;
  // 계약 당시 스냅샷이 있으면 그걸 우선 사용 (소유자가 나중에 바뀌어도 안 바뀜)
  if (c.seller_name_snapshot) return c.seller_name_snapshot;
  const owners = c.property_owners || [];
  if (owners.length === 0) return c.property_owner_name || null;
  if (owners.length === 1) return owners[0].name;
  return `${owners[0].name} 외 ${owners.length - 1}명`;
}

// 매도(임대)인 클릭 시 열어줄 고객 id: 계약에 직접 매도/임대 역할로 등록됐으면 그 고객,
// 아니면 계약 당시 스냅샷에 저장된 고객id(있으면), 없으면(과거 데이터) 매물에 연동된 소유자가 1명일 때만 그 고객
function sellerClientId(c) {
  if (isSellerSide(c.client_role)) return c.client_id;
  if (c.seller_client_id_snapshot) return c.seller_client_id_snapshot;
  const owners = c.property_owners || [];
  return owners.length === 1 ? owners[0].id : null;
}

function computeDealStatus(status, balanceDate) {
  if (status === "완료") return "완료";
  if (balanceDate) {
    const d = new Date(balanceDate);
    if (!isNaN(d.getTime()) && d.getTime() <= Date.now()) return "완료";
  }
  return status || "진행";
}

// 대상 날짜가 "오늘 ~ 현재일+days일" 사이(미래, 아직 안 지난 날짜)인지
function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return false;
  const now = Date.now();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);
  return target.getTime() >= now && target.getTime() <= threshold.getTime();
}

// 대상 날짜가 "오늘 ~ 현재일+months개월" 사이(미래, 아직 안 지난 날짜)인지
function isWithinMonths(dateStr, months) {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return false;
  const now = Date.now();
  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() + months);
  return target.getTime() >= now && target.getTime() <= threshold.getTime();
}

function balanceDateClass(balanceDate) {
  return isWithinDays(balanceDate, 15) ? "font-bold text-slate-800" : "text-slate-600";
}

// 계약만료일: 현재일+1개월 이내면 굵은 빨간색, 현재일+3개월 이내면 굵은 파란색 (이미 지난 날짜는 강조 안 함)
function expiryDateClass(moveInDate) {
  if (isWithinMonths(moveInDate, 1)) return "font-bold text-red-600";
  if (isWithinMonths(moveInDate, 3)) return "font-bold text-blue-600";
  return "text-slate-600";
}

function DealStatusBadge({ status, balanceDate }) {
  const s = computeDealStatus(status, balanceDate);
  const cls =
    s === "완료" ? "bg-green-50 text-green-600" :
    s === "대기" ? "bg-slate-100 text-slate-500" :
    "bg-blue-50 text-blue-500";
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>{s}</span>;
}

const STATUS_ORDER = { "진행": 0, "대기": 1, "완료": 2 };

// 거래상태(진행 우선) → 잔금일시(빠른 순) 정렬
function sortByStatusThenBalanceDate(list) {
  return [...list].sort((a, b) => {
    const sa = computeDealStatus(a.deal_status, a.balance_date);
    const sb = computeDealStatus(b.deal_status, b.balance_date);
    const oa = STATUS_ORDER[sa] ?? 99;
    const ob = STATUS_ORDER[sb] ?? 99;
    if (oa !== ob) return oa - ob;

    if (!a.balance_date && !b.balance_date) return 0;
    if (!a.balance_date) return 1;
    if (!b.balance_date) return -1;
    return new Date(a.balance_date) - new Date(b.balance_date);
  });
}

// 완료 상태인 계약 중 같은 고객(client_id)이 여러 건이면 가장 최근(잔금일 기준) 1건만 남김.
// 진행/대기 상태는 전부 그대로 보여줌.
// 완료 상태인 전세/월세 계약 중 같은 고객(client_id)이 여러 건이면 가장 최근(잔금일 기준) 1건만 남김.
// 매매는 같은 고객이라도 전부 표시하고, 진행/대기 상태도 전부 그대로 보여줌.
function dedupeCompletedByClient(list) {
  const latestByClient = new Map(); // client_id -> { id, time }
  for (const c of list) {
    if (c.contract_type === "매매") continue;
    if (computeDealStatus(c.deal_status, c.balance_date) !== "완료") continue;
    const time = new Date(c.balance_date || c.created_at || 0).getTime();
    const existing = latestByClient.get(c.client_id);
    if (!existing || time > existing.time) {
      latestByClient.set(c.client_id, { id: c.id, time });
    }
  }
  return list.filter((c) => {
    if (c.contract_type === "매매") return true;
    if (computeDealStatus(c.deal_status, c.balance_date) !== "완료") return true;
    return latestByClient.get(c.client_id)?.id === c.id;
  });
}

const EXCEL_COLUMNS = [
  { key: "property_name", label: "매물명" },
  { key: "contract_type", label: "거래유형" },
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
  const [baseContracts, setBaseContracts] = useState([]); // 서버에서 받아 dedupe만 적용한 원본
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openClientId, setOpenClientId] = useState(null);
  const [openPropertyId, setOpenPropertyId] = useState(null);
  const [openPropertyContextClientId, setOpenPropertyContextClientId] = useState(null);
  const [openContractId, setOpenContractId] = useState(null);
  const [openAgencyId, setOpenAgencyId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [sortField, setSortField] = useState(null); // null(기본: 진행상태 우선) | "balance_date" | "move_in_date"
  const [sortDir, setSortDir] = useState("asc");

  function applySort(list) {
    if (!sortField) return sortByStatusThenBalanceDate(list);
    return [...list].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      const diff = new Date(av) - new Date(bv);
      return sortDir === "asc" ? diff : -diff;
    });
  }

  function toggleSort(field) {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortField(null); // 세 번째 클릭 시 기본 정렬(진행상태 우선)로 복귀
      setSortDir("asc");
    }
  }

  async function fetchContracts() {
    setLoading(true);
    const params = new URLSearchParams({ q });
    const res = await fetch(`/api/contracts?${params.toString()}`);
    const data = await res.json();
    const deduped = dedupeCompletedByClient(Array.isArray(data) ? data : []);
    setBaseContracts(deduped);
    setContracts(applySort(deduped));
    setLoading(false);
  }

  useEffect(() => {
    setContracts(applySort(baseContracts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDir]);

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
      exportToExcel(sortByStatusThenBalanceDate(Array.isArray(data) ? data : []), EXCEL_COLUMNS, `계약목록(전체)_${todayStr()}.xlsx`);
    } catch (e) {
      alert("엑셀 다운로드에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSearch} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="매물명/동/호수/고객명 검색"
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
      </form>

      <p className="text-slate-400 text-xs px-1">
        전세·월세 계약 중 완료 건은 고객별로 가장 최근 1건만 표시돼요. 잔금일시·계약만료일 헤더를 누르면 정렬을 바꿀 수 있어요.
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-xs min-w-[980px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium">매물명</th>
              <th className="px-4 py-3 font-medium">거래유형</th>
              <th className="px-4 py-3 font-medium">동/호수</th>
              <th className="px-4 py-3 font-medium">중개유형</th>
              <th className="px-4 py-3 font-medium">매도(임대)인</th>
              <th className="px-4 py-3 font-medium">매수(임차)인</th>
              <th className="px-4 py-3 font-medium">
                <button onClick={() => toggleSort("balance_date")} className="flex items-center gap-1 hover:text-slate-700">
                  잔금일시
                  <span className="text-slate-400">
                    {sortField === "balance_date" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </button>
              </th>
              <th className="px-4 py-3 font-medium">
                <button onClick={() => toggleSort("move_in_date")} className="flex items-center gap-1 hover:text-slate-700">
                  계약만료일
                  <span className="text-slate-400">
                    {sortField === "move_in_date" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </button>
              </th>
              <th className="px-4 py-3 font-medium">거래상태</th>
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
            {contracts.map((c) => {
              const sellerName = sellerDisplayName(c);
              const sellerClId = sellerClientId(c);
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { setOpenPropertyId(c.property_id); setOpenPropertyContextClientId(c.client_id); }}
                      className="font-medium text-violet-500 hover:underline"
                    >
                      {c.property_name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.contract_type}</td>
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
                        onClick={() => {
                          if (sellerClId) {
                            setOpenClientId(sellerClId);
                          } else {
                            setOpenPropertyId(c.property_id);
                            setOpenPropertyContextClientId(c.client_id);
                          }
                        }}
                        className="font-medium text-violet-500 hover:underline"
                        title={sellerClId ? "고객 정보 보기" : "매물에 등록된 매도자/임대인 정보 보기"}
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
                  <td className={`px-4 py-3 ${balanceDateClass(c.balance_date)}`}>
                    {c.balance_date ? String(c.balance_date).slice(0, 16).replace("T", " ") : "-"}
                  </td>
                  <td className={`px-4 py-3 ${expiryDateClass(c.move_in_date)}`}>
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
          contractClientId={openPropertyContextClientId}
          onClose={() => { setOpenPropertyId(null); setOpenPropertyContextClientId(null); }}
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