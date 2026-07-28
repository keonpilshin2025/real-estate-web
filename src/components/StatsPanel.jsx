import { useEffect, useState } from "react";

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

const SECTIONS = [
  {
    label: "사업 현황",
    desc: "운영 관리용 — 거래량/매출 흐름을 파악해요",
    tabs: [
      { key: "overview", label: "개요" },
      { key: "trend", label: "기간별 추이" },
      { key: "deal-type", label: "거래유형" },
    ],
  },
  {
    label: "시세 분석",
    desc: "고객 상담용 — 손님께 바로 보여줄 수 있는 자료예요",
    tabs: [
      { key: "by-complex", label: "단지별" },
      { key: "by-dong", label: "동별" },
      { key: "by-floor", label: "층별" },
      { key: "by-unit-type", label: "평형별" },
      { key: "price-trend", label: "가격 동향" },
    ],
  },
];

function BarRow({ label, sub, value, max, colorClass = "bg-violet-400" }) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-400">{sub}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-3">
        <div className={`${colorClass} h-3 rounded-full transition-all`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export default function StatsPanel() {
  const [subTab, setSubTab] = useState("overview");
  const [pricePeriod, setPricePeriod] = useState("month"); // week | month (가격 동향 전용)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ view: subTab });
    if (subTab === "price-trend") params.set("period", pricePeriod);
    fetch(`/api/stats?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [subTab, pricePeriod]);

  return (
    <div className="flex flex-col gap-6">
      {SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="text-xs font-semibold text-slate-400 mb-2">
            {section.label} <span className="font-normal text-slate-300">· {section.desc}</span>
          </p>
          <div className="flex gap-2 flex-wrap">
            {section.tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                  subTab === t.key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {loading && <p className="text-slate-400 text-xs">불러오는 중...</p>}

      {/* 개요 */}
      {!loading && subTab === "overview" && data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-xs text-slate-400 mb-1">이번달 거래건수 (잔금 기준)</p>
            <p className="text-2xl font-bold text-slate-800">{data.deal_count_this_month}건</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-xs text-slate-400 mb-1">평균 매매가 (완료건)</p>
            <p className="text-2xl font-bold text-slate-800">{formatEokMan(data.avg_price)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-xs text-slate-400 mb-1">진행중 계약</p>
            <p className="text-2xl font-bold text-slate-800">{data.ongoing_count}건</p>
          </div>
        </div>
      )}

      {/* 기간별 추이 (거래건수/매출, 월별) */}
      {!loading && subTab === "trend" && Array.isArray(data) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          {data.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-8">최근 6개월 안에 완료된 거래가 없어요.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {(() => {
                const maxCount = Math.max(...data.map((d) => Number(d.deal_count) || 0));
                return data.map((d) => (
                  <BarRow
                    key={d.period}
                    label={d.period}
                    sub={`${d.deal_count}건 · 매매 총액 ${formatEokMan(d.total_sale_amount)}`}
                    value={Number(d.deal_count) || 0}
                    max={maxCount}
                  />
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* 거래유형/중개유형 비중 */}
      {!loading && subTab === "deal-type" && data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs font-medium text-slate-500 mb-4">거래유형</p>
            {data.byType?.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-6">데이터가 없어요.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {(() => {
                  const max = Math.max(...(data.byType || []).map((d) => Number(d.cnt) || 0));
                  return (data.byType || []).map((d) => (
                    <BarRow key={d.contract_type} label={d.contract_type} sub={`${d.cnt}건`} value={Number(d.cnt)} max={max} />
                  ));
                })()}
              </div>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs font-medium text-slate-500 mb-4">중개유형</p>
            {data.byBrokerage?.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-6">데이터가 없어요.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {(() => {
                  const max = Math.max(...(data.byBrokerage || []).map((d) => Number(d.cnt) || 0));
                  return (data.byBrokerage || []).map((d) => (
                    <BarRow key={d.brokerage_type} label={d.brokerage_type} sub={`${d.cnt}건`} value={Number(d.cnt)} max={max} colorClass="bg-blue-400" />
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 단지별 시세 */}
      {!loading && subTab === "by-complex" && Array.isArray(data) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          {data.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-8">완료된 매매 데이터가 없어요.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {(() => {
                const max = Math.max(...data.map((d) => Number(d.avg_price) || 0));
                return data.map((d) => (
                  <BarRow
                    key={d.property_name}
                    label={d.property_name}
                    sub={`${d.deal_count}건 · 평균 ${formatEokMan(d.avg_price)} · ${formatEokMan(d.min_price)}~${formatEokMan(d.max_price)}`}
                    value={Number(d.avg_price)}
                    max={max}
                  />
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* 동별 시세 (같은 단지 안에서도 동마다 다름) */}
      {!loading && subTab === "by-dong" && Array.isArray(data) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          {data.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-8">완료된 매매 데이터가 없어요.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {(() => {
                const max = Math.max(...data.map((d) => Number(d.avg_price) || 0));
                return data.map((d) => (
                  <BarRow
                    key={`${d.property_name}-${d.dong}`}
                    label={`${d.property_name} ${d.dong}`}
                    sub={`${d.deal_count}건 · 평균 ${formatEokMan(d.avg_price)} · ${formatEokMan(d.min_price)}~${formatEokMan(d.max_price)}`}
                    value={Number(d.avg_price)}
                    max={max}
                    colorClass="bg-pink-400"
                  />
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* 층대별 시세 - 호수가 순수 숫자(표준 넘버링)인 데이터만 집계됨 */}
      {!loading && subTab === "by-floor" && Array.isArray(data) && (
        <div>
          <p className="text-[11px] text-slate-400 mb-2">
            * 호수 표기가 표준방식(끝 2자리=호, 앞자리=층)인 물건만 집계돼요. 3대장 아파트 기준으로 정확해요.
          </p>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            {data.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-8">완료된 매매 데이터가 없어요.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {(() => {
                  const max = Math.max(...data.map((d) => Number(d.avg_price) || 0));
                  return data.map((d) => (
                    <BarRow
                      key={d.floor_band}
                      label={d.floor_band}
                      sub={`${d.deal_count}건 · 평균 ${formatEokMan(d.avg_price)}`}
                      value={Number(d.avg_price)}
                      max={max}
                      colorClass="bg-amber-400"
                    />
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 평형별 시세 */}
      {!loading && subTab === "by-unit-type" && Array.isArray(data) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          {data.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-8">완료된 매매 데이터가 없어요.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {(() => {
                const max = Math.max(...data.map((d) => Number(d.avg_price) || 0));
                return data.map((d) => (
                  <BarRow
                    key={d.unit_type}
                    label={d.unit_type}
                    sub={`${d.deal_count}건 · 평균 ${formatEokMan(d.avg_price)}`}
                    value={Number(d.avg_price)}
                    max={max}
                    colorClass="bg-teal-400"
                  />
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* 가격 동향 (주별/월별) */}
      {!loading && subTab === "price-trend" && (
        <div>
          <div className="flex gap-2 mb-3">
            {[
              { key: "week", label: "주별 (최근 12주)" },
              { key: "month", label: "월별 (최근 12개월)" },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPricePeriod(p.key)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition ${
                  pricePeriod === p.key ? "bg-violet-400 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            {!Array.isArray(data) || data.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-8">해당 기간에 완료된 매매 데이터가 없어요.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {(() => {
                  const max = Math.max(...data.map((d) => Number(d.avg_price) || 0));
                  return data.map((d) => (
                    <BarRow
                      key={d.period}
                      label={d.period}
                      sub={`${d.deal_count}건 · 평균 ${formatEokMan(d.avg_price)}`}
                      value={Number(d.avg_price)}
                      max={max}
                      colorClass="bg-orange-400"
                    />
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}