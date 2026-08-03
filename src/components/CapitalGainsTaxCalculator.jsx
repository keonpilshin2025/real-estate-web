import { useState, useMemo } from "react";

const EOK = 100000000;
const MAN = 10000;

function formatWon(n) {
  if (!n && n !== 0) return "-";
  return Math.round(n).toLocaleString("ko-KR") + "원";
}

function EokManInput({ label, value, onChange, hint }) {
  const raw = Number(value || 0);
  const eok = raw ? Math.floor(raw / EOK) : "";
  const man = raw ? Math.floor((raw % EOK) / MAN) : "";

  function update(eokVal, manVal) {
    const eokInt = parseInt(eokVal, 10) || 0;
    let manInt = parseInt(manVal, 10) || 0;
    if (manInt > 9999) manInt = 9999;
    onChange(String(eokInt * EOK + manInt * MAN));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-600">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          value={eok}
          onChange={(e) => update(e.target.value, man)}
          placeholder="0"
          className="w-full border border-slate-200 rounded-xl h-11 px-3 text-right text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <span className="text-slate-400 shrink-0 text-sm">억</span>
        <input
          type="number"
          min="0"
          max="9999"
          value={man}
          onChange={(e) => update(eok, e.target.value)}
          placeholder="0"
          className="w-full border border-slate-200 rounded-xl h-11 px-3 text-right text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <span className="text-slate-400 shrink-0 text-sm">만원</span>
      </div>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const BRACKETS = [
  { limit: 14_000_000, rate: 0.06, deduction: 0 },
  { limit: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { limit: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { limit: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { limit: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { limit: 500_000_000, rate: 0.4, deduction: 25_940_000 },
  { limit: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { limit: Infinity, rate: 0.45, deduction: 65_940_000 },
];

const SURCHARGE_BY_YEAR = {
  2026: { 2: 0.2, 3: 0.3 },
  2027: { 2: 0.05, 3: 0.1 },
  2028: { 2: 0.05, 3: 0.1 },
  2029: { 2: 0.2, 3: 0.3 },
};

const BASIC_DEDUCTION = 2_500_000;
const ONE_HOUSE_EXEMPT_LIMIT = 1_200_000_000;

function calcBracketTax(base) {
  const b = BRACKETS.find((x) => base <= x.limit);
  return { rate: b.rate, deduction: b.deduction };
}

function calculate({
  transferPrice,
  acquisitionPrice,
  expenses,
  houseCount,
  isRegulatedArea,
  holdingYears,
  residentYears,
  transferYear,
}) {
  const gain = Math.max(transferPrice - acquisitionPrice - expenses, 0);
  const isOneHouse = houseCount === "1";
  const meetsResidency = isOneHouse && residentYears >= 2;

  let taxableGain = gain;
  let exempt = false;
  if (meetsResidency) {
    if (transferPrice <= ONE_HOUSE_EXEMPT_LIMIT) {
      exempt = true;
      taxableGain = 0;
    } else {
      taxableGain = (gain * (transferPrice - ONE_HOUSE_EXEMPT_LIMIT)) / transferPrice;
    }
  }

  if (exempt) {
    return {
      exempt: true,
      gain,
      taxableGain: 0,
      deductionRate: 0,
      base: 0,
      rate: 0,
      surcharge: 0,
      calculatedTax: 0,
      localTax: 0,
      totalTax: 0,
      isShortTerm: false,
    };
  }

  const isShortTerm = holdingYears < 2;
  if (isShortTerm) {
    const shortRate = holdingYears < 1 ? 0.7 : 0.6;
    const base = Math.max(taxableGain - BASIC_DEDUCTION, 0);
    const calculatedTax = base * shortRate;
    const localTax = calculatedTax * 0.1;
    return {
      exempt: false,
      isShortTerm: true,
      gain,
      taxableGain,
      deductionRate: 0,
      base,
      rate: shortRate,
      surcharge: 0,
      calculatedTax,
      localTax,
      totalTax: calculatedTax + localTax,
    };
  }

  const isHeavyTaxed = !isOneHouse && isRegulatedArea && (houseCount === "2" || houseCount === "3+");

  let deductionRate = 0;
  if (meetsResidency) {
    deductionRate = Math.min(holdingYears, 10) * 0.04 + Math.min(residentYears, 10) * 0.04;
  } else if (isHeavyTaxed) {
    deductionRate = 0;
  } else if (holdingYears >= 3) {
    deductionRate = Math.min(holdingYears, 15) * 0.02;
  }

  const incomeAmount = taxableGain * (1 - deductionRate);
  const base = Math.max(incomeAmount - BASIC_DEDUCTION, 0);

  const { rate, deduction } = calcBracketTax(base);

  let surcharge = 0;
  if (isHeavyTaxed) {
    const key = houseCount === "2" ? 2 : 3;
    const yearRates = SURCHARGE_BY_YEAR[transferYear] || SURCHARGE_BY_YEAR[2029];
    surcharge = yearRates[key];
  }

  const finalRate = rate + surcharge;
  const calculatedTax = Math.max(base * finalRate - deduction, 0);
  const localTax = calculatedTax * 0.1;

  return {
    exempt: false,
    isShortTerm: false,
    gain,
    taxableGain,
    deductionRate,
    base,
    rate: finalRate,
    surcharge,
    calculatedTax,
    localTax,
    totalTax: calculatedTax + localTax,
  };
}

export default function CapitalGainsTaxCalculator() {
  const [transferPrice, setTransferPrice] = useState("");
  const [acquisitionPrice, setAcquisitionPrice] = useState("");
  const [expenses, setExpenses] = useState("");
  const [houseCount, setHouseCount] = useState("1");
  const [isRegulatedArea, setIsRegulatedArea] = useState(true);
  const [holdingYears, setHoldingYears] = useState("5");
  const [residentYears, setResidentYears] = useState("2");
  const [transferYear, setTransferYear] = useState(2026);

  const result = useMemo(() => {
    return calculate({
      transferPrice: Number(transferPrice || 0),
      acquisitionPrice: Number(acquisitionPrice || 0),
      expenses: Number(expenses || 0),
      houseCount,
      isRegulatedArea,
      holdingYears: Number(holdingYears || 0),
      residentYears: Number(residentYears || 0),
      transferYear,
    });
  }, [transferPrice, acquisitionPrice, expenses, houseCount, isRegulatedArea, holdingYears, residentYears, transferYear]);

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5">
          <EokManInput label="양도가액 (매매가)" value={transferPrice} onChange={setTransferPrice} />
          <EokManInput label="취득가액" value={acquisitionPrice} onChange={setAcquisitionPrice} />
          <EokManInput
            label="필요경비 (선택)"
            value={expenses}
            onChange={setExpenses}
            hint="취득세, 중개수수료, 자본적 지출(리모델링 등) 등 증빙 가능한 비용"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-600">보유 주택 수</label>
            <div className="flex gap-2">
              {[
                { v: "1", label: "1주택" },
                { v: "2", label: "2주택" },
                { v: "3+", label: "3주택 이상" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setHouseCount(o.v)}
                  className={`flex-1 h-11 rounded-xl text-sm font-medium border transition ${
                    houseCount === o.v
                      ? "bg-violet-500 text-white border-violet-500"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {houseCount !== "1" && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={isRegulatedArea}
                onChange={(e) => setIsRegulatedArea(e.target.checked)}
                className="w-4 h-4 accent-violet-500"
              />
              조정대상지역 소재 주택 (다주택자 중과 대상 여부)
            </label>
          )}

          {houseCount !== "1" && (
            <p className="text-xs text-slate-400">거주기간 공제(1세대1주택 특례)는 1주택자만 해당돼요.</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">보유기간 (년)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={holdingYears}
                onChange={(e) => setHoldingYears(e.target.value)}
                className="border border-slate-200 rounded-xl h-11 px-3 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">거주기간 (년)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                disabled={houseCount !== "1"}
                value={residentYears}
                onChange={(e) => setResidentYears(e.target.value)}
                className="border border-slate-200 rounded-xl h-11 px-3 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:bg-slate-50 disabled:text-slate-300"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-600">양도(예정) 연도</label>
            <select
              value={transferYear}
              onChange={(e) => setTransferYear(Number(e.target.value))}
              className="border border-slate-200 rounded-xl h-11 px-3 focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value={2026}>2026년</option>
              <option value={2027}>2027년</option>
              <option value={2028}>2028년</option>
              <option value={2029}>2029년 이후</option>
            </select>
            <p className="text-xs text-slate-400">
              다주택자 중과세율은 2027~2028년 한시적으로 완화됐다가 2029년부터 원래대로 돌아가요(2026년 세제개편안 기준).
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-violet-400 rounded-2xl p-6 text-white flex flex-col">
          <p className="text-violet-100 text-sm font-medium">예상 납부세액 (지방소득세 포함)</p>
          {result.exempt ? (
            <>
              <p className="mt-2 text-4xl font-[Bricolage_Grotesque] font-extrabold">비과세</p>
              <p className="mt-2 text-violet-100 text-sm">
                1세대1주택(2년 이상 거주) 요건을 충족하고, 양도가액이 12억원 이하라 양도세가 발생하지 않아요.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-4xl font-[Bricolage_Grotesque] font-extrabold">
                {formatWon(result.totalTax)}
              </p>
              {result.isShortTerm && (
                <p className="mt-2 text-sm bg-white/15 rounded-lg px-3 py-2">
                  보유기간이 2년 미만이라 단기보유 단일세율({(result.rate * 100).toFixed(0)}%)이 적용됐어요.
                </p>
              )}
            </>
          )}

          {!result.exempt && (
            <div className="mt-6 flex flex-col gap-2 text-sm">
              <Row label="양도차익" value={formatWon(result.gain)} />
              {result.taxableGain !== result.gain && (
                <Row label="과세대상 양도차익 (고가주택 안분)" value={formatWon(result.taxableGain)} />
              )}
              {!result.isShortTerm && (
                <Row label="장기보유특별공제율" value={`${(result.deductionRate * 100).toFixed(0)}%`} />
              )}
              <Row label="과세표준" value={formatWon(result.base)} />
              <Row
                label="적용세율"
                value={
                  result.surcharge > 0
                    ? `${((result.rate - result.surcharge) * 100).toFixed(0)}% + 중과 ${(result.surcharge * 100).toFixed(0)}%p`
                    : `${(result.rate * 100).toFixed(0)}%`
                }
              />
              <div className="border-t border-white/20 my-1" />
              <Row label="양도소득세" value={formatWon(result.calculatedTax)} />
              <Row label="지방소득세 (10%)" value={formatWon(result.localTax)} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800 leading-relaxed">
        <p className="font-semibold mb-1">⚠️ 참고용 계산기입니다</p>
        <p>
          이 계산기는 기본세율·기본공제·장기보유특별공제·다주택자 중과 등 핵심 항목만 반영한 간편 추정값이에요.
          일시적 2주택 특례, 상속·증여 취득 주택, 분양권·입주권, 비사업용 토지, 지역별 최신 조정대상지역 고시 등은
          반영되지 않았어요. 실제 신고 세액은 홈택스 모의계산 또는 세무사 상담을 통해 반드시 다시 확인해 주세요.
        </p>
      </div>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-violet-100">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}