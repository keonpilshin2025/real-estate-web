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

// 2026년 현재 시행 중인 종합부동산세법 기준(현행법). 2026년 세제개편안(2026.8.3 발표)은
// 국회 통과 전 '제안' 단계이며 핵심 내용은 2027년부터 순차 적용 예정이라 아직 반영하지 않음.
const FAIR_MARKET_RATIO = 0.6;

const NORMAL_BRACKETS = [
  { limit: 300_000_000, rate: 0.005, deduction: 0 },
  { limit: 600_000_000, rate: 0.007, deduction: 600_000 },
  { limit: 1_200_000_000, rate: 0.01, deduction: 2_400_000 },
  { limit: 2_500_000_000, rate: 0.013, deduction: 6_000_000 },
  { limit: 5_000_000_000, rate: 0.015, deduction: 11_000_000 },
  { limit: 9_400_000_000, rate: 0.02, deduction: 36_000_000 },
  { limit: Infinity, rate: 0.027, deduction: 101_800_000 },
];

const HEAVY_BRACKETS = [
  { limit: 300_000_000, rate: 0.005, deduction: 0 },
  { limit: 600_000_000, rate: 0.007, deduction: 600_000 },
  { limit: 1_200_000_000, rate: 0.01, deduction: 2_400_000 },
  { limit: 2_500_000_000, rate: 0.02, deduction: 14_400_000 },
  { limit: 5_000_000_000, rate: 0.03, deduction: 39_400_000 },
  { limit: 9_400_000_000, rate: 0.04, deduction: 89_400_000 },
  { limit: Infinity, rate: 0.05, deduction: 183_400_000 },
];

function calculate({ officialPriceSum, houseCount, age, holdingYears }) {
  const isOneHouse = houseCount === "1";
  const basicDeduction = isOneHouse ? 1_200_000_000 : 900_000_000;
  const taxBase = Math.max(officialPriceSum - basicDeduction, 0) * FAIR_MARKET_RATIO;

  if (taxBase <= 0) {
    return { taxBase: 0, calculatedTax: 0, taxCreditRate: 0, afterCredit: 0, specialTax: 0, totalTax: 0 };
  }

  const brackets = houseCount === "3+" ? HEAVY_BRACKETS : NORMAL_BRACKETS;
  const b = brackets.find((x) => taxBase <= x.limit);
  const calculatedTax = Math.max(taxBase * b.rate - b.deduction, 0);

  let taxCreditRate = 0;
  if (isOneHouse) {
    const ageRate = age >= 70 ? 0.4 : age >= 65 ? 0.3 : age >= 60 ? 0.2 : 0;
    const holdRate = holdingYears >= 15 ? 0.5 : holdingYears >= 10 ? 0.4 : holdingYears >= 5 ? 0.2 : 0;
    taxCreditRate = Math.min(ageRate + holdRate, 0.8);
  }

  const afterCredit = calculatedTax * (1 - taxCreditRate);
  const specialTax = afterCredit * 0.2;

  return {
    taxBase,
    calculatedTax,
    taxCreditRate,
    afterCredit,
    specialTax,
    totalTax: afterCredit + specialTax,
  };
}

export default function ComprehensiveRealEstateTaxCalculator() {
  const [officialPriceSum, setOfficialPriceSum] = useState("");
  const [houseCount, setHouseCount] = useState("1");
  const [age, setAge] = useState("50");
  const [holdingYears, setHoldingYears] = useState("5");

  const isOneHouse = houseCount === "1";

  const result = useMemo(() => {
    return calculate({
      officialPriceSum: Number(officialPriceSum || 0),
      houseCount,
      age: Number(age || 0),
      holdingYears: Number(holdingYears || 0),
    });
  }, [officialPriceSum, houseCount, age, holdingYears]);

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5">
          <EokManInput
            label="보유 주택 공시가격 합계"
            value={officialPriceSum}
            onChange={setOfficialPriceSum}
            hint="실거래가(시가)가 아니라 국토부/위택스에서 확인 가능한 '공시가격'이에요. 여러 채면 전부 더한 합계를 입력하세요."
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
            <p className="text-xs text-slate-400">
              기본공제: 1주택 12억원 · 2주택 이상 9억원. 3주택 이상은 과세표준 12억원 초과분부터 중과세율이 적용돼요.
            </p>
          </div>

          {!isOneHouse && (
            <p className="text-xs text-slate-400">고령자·장기보유 세액공제는 1주택자만 해당돼요.</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">만 나이</label>
              <input
                type="number"
                min="0"
                disabled={!isOneHouse}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="border border-slate-200 rounded-xl h-11 px-3 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:bg-slate-50 disabled:text-slate-300"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">보유기간 (년)</label>
              <input
                type="number"
                min="0"
                disabled={!isOneHouse}
                value={holdingYears}
                onChange={(e) => setHoldingYears(e.target.value)}
                className="border border-slate-200 rounded-xl h-11 px-3 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:bg-slate-50 disabled:text-slate-300"
              />
            </div>
          </div>
          {isOneHouse && (
            <p className="text-xs text-slate-400 -mt-3">
              1세대1주택자는 고령자(만 60세~)·장기보유(5년~) 세액공제가 합산 최대 80%까지 적용돼요.
            </p>
          )}
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-violet-400 rounded-2xl p-6 text-white flex flex-col">
          <p className="text-violet-100 text-sm font-medium">2026년 예상 납부세액 (농어촌특별세 포함)</p>
          {result.totalTax <= 0 ? (
            <>
              <p className="mt-2 text-4xl font-[Bricolage_Grotesque] font-extrabold">0원</p>
              <p className="mt-2 text-violet-100 text-sm">
                기본공제({isOneHouse ? "12억원" : "9억원"}) 이하라 종부세 과세 대상이 아니에요.
              </p>
            </>
          ) : (
            <p className="mt-2 text-4xl font-[Bricolage_Grotesque] font-extrabold">{formatWon(result.totalTax)}</p>
          )}

          {result.totalTax > 0 && (
            <div className="mt-6 flex flex-col gap-2 text-sm">
              <Row label="과세표준" value={formatWon(result.taxBase)} />
              <Row label="산출세액" value={formatWon(result.calculatedTax)} />
              {result.taxCreditRate > 0 && (
                <Row label="고령자·장기보유 세액공제" value={`${(result.taxCreditRate * 100).toFixed(0)}%`} />
              )}
              <Row label="공제 적용 후 세액" value={formatWon(result.afterCredit)} />
              <div className="border-t border-white/20 my-1" />
              <Row label="농어촌특별세 (20%)" value={formatWon(result.specialTax)} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800 leading-relaxed">
        <p className="font-semibold mb-1">⚠️ 참고용 계산기입니다 (2026년 현행법 기준)</p>
        <p>
          이 계산기는 2026년 현재 시행 중인 종합부동산세법 기준으로 계산해요. 이미 납부한 재산세 중 종부세와
          중복되는 부분을 빼주는 &apos;재산세 공제&apos;, 전년 대비 세부담 상한(150%), 공동명의 1주택 특례 등은
          반영되지 않았어요. 실제 고지세액은 국세청 홈택스 또는 세무사 상담으로 다시 확인해 주세요.
        </p>
        <p className="mt-2">
          참고로 2026년 8월 3일 발표된 &apos;2026년 세제개편안&apos;은 아직 국회 통과 전 단계이고, 종부세
          기본공제·세율 변경은 대부분 2027년부터 적용될 예정이에요. 개편안이 확정되면 이 계산기도 업데이트할게요.
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