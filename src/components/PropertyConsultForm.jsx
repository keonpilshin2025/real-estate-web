import { useState } from "react";

const PROPERTY_TYPES = [
  { key: "3대장", label: "아파트", desc: "센트럴타운 · 연꽃마을4단지 · 산들마을2단지" },
  { key: "오피스텔", label: "오피스텔", desc: "" },
  { key: "빌라", label: "빌라", desc: "다세대·연립주택" },
  { key: "상가/사무실", label: "상가 · 사무실", desc: "" },
];

const DEAL_TYPES = ["매매", "전세", "월세", "아직 잘 모르겠어요"];

const KNOWN_COMPLEXES = ["센트럴타운", "연꽃마을4단지", "산들마을2단지"];
const COMPLEX_OTHER_MAX = 10;

// deals: undefined면 모든 거래유형에서 표시, 배열이면 그 거래유형일 때만 표시
const SITUATIONS_BY_TYPE = {
  "3대장": [
    { text: "실거주 이사 예정이에요" },
    { text: "초등학생 자녀가 있어요 (학군 중요)" },
    { text: "투자 목적이에요", deals: ["매매"] },
    { text: "지금 사는 집을 팔고 싶어요", deals: ["매매"] },
    { text: "지금 사는 전셋집을 빼야해요", deals: ["전세"] },
    { text: "지금 사는 월세집을 빼야해요", deals: ["월세"] },
    { text: "재계약 시기가 다가와요", deals: ["전세", "월세"] },
    { text: "그냥 시세가 궁금해요" },
  ],
  "오피스텔": [
    { text: "실거주 이사 예정이에요" },
    { text: "임대 수익 목적으로 매입하고 싶어요", deals: ["매매"] },
    { text: "지금 세놓은 오피스텔을 팔고 싶어요", deals: ["매매"] },
    { text: "재계약 시기가 다가와요", deals: ["전세", "월세"] },
    { text: "그냥 시세가 궁금해요" },
  ],
  "빌라": [
    { text: "실거주 이사 예정이에요" },
    { text: "초등학생 자녀가 있어요 (학군 중요)" },
    { text: "건물 전체 매매를 알아보고 있어요", deals: ["매매"] },
    { text: "투자 목적이에요", deals: ["매매"] },
    { text: "지금 사는 집을 팔고 싶어요", deals: ["매매"] },
    { text: "지금 사는 전셋집을 빼야해요", deals: ["전세"] },
    { text: "지금 사는 월세집을 빼야해요", deals: ["월세"] },
    { text: "재계약 시기가 다가와요", deals: ["전세", "월세"] },
    { text: "그냥 시세가 궁금해요" },
  ],
  "상가/사무실": [
    { text: "창업/개업 자리를 찾고 있어요", deals: ["전세", "월세"] },
    { text: "사업장을 이전하려고 해요", deals: ["전세", "월세"] },
    { text: "임대 수익 목적으로 매입하고 싶어요", deals: ["매매"] },
    { text: "권리금 있는 자리도 괜찮아요", deals: ["전세", "월세"] },
    { text: "지금 운영 중인 곳을 내놓고 싶어요(양도)" },
    { text: "그냥 시세가 궁금해요" },
  ],
};

// 거래유형이 아직 안 정해졌거나("", "아직 잘 모르겠어요") 항목에 deals 태그가 없으면 항상 보여줌
function visibleSituations(propertyType, dealType) {
  const list = SITUATIONS_BY_TYPE[propertyType] || SITUATIONS_BY_TYPE["3대장"];
  if (!dealType || dealType === "아직 잘 모르겠어요") return list.map((s) => s.text);
  return list.filter((s) => !s.deals || s.deals.includes(dealType)).map((s) => s.text);
}

function getBudgets(propertyType) {
  return BUDGETS_BY_TYPE[propertyType] || BUDGETS_BY_TYPE["3대장"];
}

const BUDGETS_BY_TYPE = {
  "3대장": {
    sale: ["3억대", "5억대", "7억대", "9억대", "11억대", "13억대", "15억 이상"],
    jeonse: ["2억대", "3억대", "4억대", "5억대", "6억대", "7억대", "8억 이상"],
    monthlyDeposit: ["1천대", "3천대", "5천대", "1억대", "2억대", "2억 이상"],
    monthlyRent: ["50만원대", "70만원대", "100만원대", "150만원대", "150만원 이상"],
  },
  "오피스텔": {
    sale: ["1억대", "2억대", "3억대", "4억대", "5억 이상"],
    jeonse: ["5천대", "1억대", "1억5천대", "2억대", "2억 이상"],
    monthlyDeposit: ["500만원대", "1천대", "2천대", "3천대", "5천 이상"],
    monthlyRent: ["30만원대", "50만원대", "70만원대", "100만원대", "100만원 이상"],
  },
  "빌라": {
    sale: ["1억대", "2억대", "3억대", "4억대", "5억대", "6억 이상"],
    jeonse: ["5천대", "1억대", "2억대", "3억대", "4억 이상"],
    monthlyDeposit: ["1천대", "3천대", "5천대", "1억 이상"],
    monthlyRent: ["30만원대", "50만원대", "70만원대", "100만원 이상"],
  },
  "상가/사무실": {
    sale: ["3억대", "5억대", "7억대", "10억대", "15억 이상"],
    jeonse: ["3천대", "5천대", "1억대", "2억대", "3억 이상"],
    monthlyDeposit: ["500만원대", "1천대", "2천대", "3천대", "5천 이상"],
    monthlyRent: ["50만원대", "100만원대", "150만원대", "200만원대", "200만원 이상"],
  },
};

const MEMO_MAX = 200;

export default function PropertyConsultForm() {
  const [propertyType, setPropertyType] = useState("");
  const [dealType, setDealType] = useState("");
  const [budgetMain, setBudgetMain] = useState(""); // 매매 예산 / 전세 보증금 / 월세 보증금
  const [budgetRent, setBudgetRent] = useState(""); // 월세일 때만: 월세 금액
  const [complexChoice, setComplexChoice] = useState("");
  const [complexOther, setComplexOther] = useState("");
  const [situations, setSituations] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  function toggleSituation(s) {
    setSituations((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!propertyType) {
      setStatus("error");
      setErrorMsg("관심 있는 매물 종류를 선택해주세요.");
      return;
    }
    if (!phone.trim()) {
      setStatus("error");
      setErrorMsg("연락받으실 전화번호를 입력해주세요.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/property-consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyType,
          complex: propertyType === "3대장" ? (complexChoice === "기타" ? complexOther : complexChoice) : "",
          dealType,
          budgetMain,
          budgetRent,
          situations,
          name,
          phone,
          memo,
        }),
      });
      if (!res.ok) throw new Error("전송 실패");
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMsg("전송에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center text-center py-16 px-6">
        <div className="w-16 h-16 rounded-full bg-violet-100 text-violet-500 flex items-center justify-center text-3xl mb-4">
          ✓
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">상담 신청이 접수되었어요</h2>
        <p className="text-slate-500 text-sm">확인 후 빠르게 연락드릴게요. 감사합니다!</p>
        <a
          href="/"
          className="mt-8 bg-slate-900 text-white text-sm font-medium rounded-full h-11 px-6 flex items-center hover:bg-slate-800 transition"
        >
          홈으로 돌아가기
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 pb-28">
      {/* 1. 관심 매물 유형 */}
      <section>
        <h2 className="text-base font-bold text-slate-800 mb-1">어떤 매물을 찾으세요?</h2>
        <p className="text-xs text-slate-400 mb-3">하나만 골라주세요</p>
        <div className="grid grid-cols-2 gap-3">
          {PROPERTY_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setPropertyType(t.key);
                setSituations([]);
                setBudgetMain("");
                setBudgetRent("");
                if (t.key !== "3대장") {
                  setComplexChoice("");
                  setComplexOther("");
                }
              }}
              className={`text-left rounded-2xl border p-4 transition ${
                propertyType === t.key
                  ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                  : "border-slate-200 bg-white hover:border-violet-200"
              }`}
            >
              <p className="font-bold text-sm text-slate-800">{t.label}</p>
              {t.desc && <p className="text-[11px] text-slate-400 mt-1 leading-snug">{t.desc}</p>}
            </button>
          ))}
        </div>
      </section>

      {/* 1-1. 아파트 선택 시에만: 어떤 단지인지 세부 선택 */}
      {propertyType === "3대장" && (
        <section>
          <h2 className="text-base font-bold text-slate-800 mb-1">어떤 아파트에 관심 있으세요?</h2>
          <p className="text-xs text-slate-400 mb-3">하나만 골라주세요</p>
          <div className="flex flex-wrap gap-2">
            {KNOWN_COMPLEXES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setComplexChoice(c)}
                className={`px-4 py-2.5 rounded-full text-sm font-medium border transition ${
                  complexChoice === c
                    ? "bg-violet-400 text-white border-violet-400"
                    : "bg-white text-slate-600 border-slate-200 hover:border-violet-200"
                }`}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setComplexChoice("기타")}
              className={`px-4 py-2.5 rounded-full text-sm font-medium border transition ${
                complexChoice === "기타"
                  ? "bg-violet-400 text-white border-violet-400"
                  : "bg-white text-slate-600 border-slate-200 hover:border-violet-200"
              }`}
            >
              기타
            </button>
          </div>
          {complexChoice === "기타" && (
            <div className="relative mt-2">
              <input
                type="text"
                value={complexOther}
                onChange={(e) => setComplexOther(e.target.value.slice(0, COMPLEX_OTHER_MAX))}
                maxLength={COMPLEX_OTHER_MAX}
                placeholder="단지명을 짧게 적어주세요"
                className="w-full bg-white border border-slate-200 rounded-xl h-11 pl-4 pr-14 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                {complexOther.length}/{COMPLEX_OTHER_MAX}
              </span>
            </div>
          )}
        </section>
      )}

      {/* 2. 거래유형 */}
      <section>
        <h2 className="text-base font-bold text-slate-800 mb-1">거래 형태는요?</h2>
        <p className="text-xs text-slate-400 mb-3">하나만 골라주세요</p>
        <div className="flex flex-wrap gap-2">
          {DEAL_TYPES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDealType(d);
                setSituations([]);
                setBudgetMain("");
                setBudgetRent("");
              }}
              className={`px-4 py-2.5 rounded-full text-sm font-medium border transition ${
                dealType === d
                  ? "bg-violet-400 text-white border-violet-400"
                  : "bg-white text-slate-600 border-slate-200 hover:border-violet-200"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </section>

      {/* 2-2. 예산 (거래유형 선택 후, "잘 모르겠어요" 제외) */}
      {dealType && dealType !== "아직 잘 모르겠어요" && (
        <section>
          <h2 className="text-base font-bold text-slate-800 mb-1">
            {dealType === "매매" ? "예산은 어느 정도세요?" : dealType === "전세" ? "보증금 예산은요?" : "예산은요?"}
          </h2>
          <p className="text-xs text-slate-400 mb-3">대략적이어도 괜찮아요 (선택)</p>

          {dealType === "매매" && (
            <div className="flex flex-wrap gap-2">
              {getBudgets(propertyType).sale.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBudgetMain(b)}
                  className={`px-4 py-2.5 rounded-full text-sm font-medium border transition ${
                    budgetMain === b
                      ? "bg-violet-400 text-white border-violet-400"
                      : "bg-white text-slate-600 border-slate-200 hover:border-violet-200"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          {dealType === "전세" && (
            <div className="flex flex-wrap gap-2">
              {getBudgets(propertyType).jeonse.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBudgetMain(b)}
                  className={`px-4 py-2.5 rounded-full text-sm font-medium border transition ${
                    budgetMain === b
                      ? "bg-violet-400 text-white border-violet-400"
                      : "bg-white text-slate-600 border-slate-200 hover:border-violet-200"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          {dealType === "월세" && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-2">보증금</p>
                <div className="flex flex-wrap gap-2">
                  {getBudgets(propertyType).monthlyDeposit.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBudgetMain(b)}
                      className={`px-4 py-2.5 rounded-full text-sm font-medium border transition ${
                        budgetMain === b
                          ? "bg-violet-400 text-white border-violet-400"
                          : "bg-white text-slate-600 border-slate-200 hover:border-violet-200"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-2">월세</p>
                <div className="flex flex-wrap gap-2">
                  {getBudgets(propertyType).monthlyRent.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBudgetRent(b)}
                      className={`px-4 py-2.5 rounded-full text-sm font-medium border transition ${
                        budgetRent === b
                          ? "bg-violet-400 text-white border-violet-400"
                          : "bg-white text-slate-600 border-slate-200 hover:border-violet-200"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. 지금 상황 */}
      <section>
        <h2 className="text-base font-bold text-slate-800 mb-1">지금 상황을 알려주시면 더 정확히 도와드려요</h2>
        <p className="text-xs text-slate-400 mb-3">해당하는 거 다 골라도 돼요 (선택)</p>
        <div className="flex flex-wrap gap-2">
          {visibleSituations(propertyType, dealType).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSituation(s)}
              className={`px-4 py-2.5 rounded-full text-sm font-medium border transition ${
                situations.includes(s)
                  ? "bg-violet-400 text-white border-violet-400"
                  : "bg-white text-slate-600 border-slate-200 hover:border-violet-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* 4. 하고 싶은 말 */}
      <section>
        <h2 className="text-base font-bold text-slate-800 mb-1">더 하고 싶은 말이 있으면 적어주세요</h2>
        <p className="text-xs text-slate-400 mb-3">선택이에요, 안 쓰셔도 돼요</p>
        <div className="relative">
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, MEMO_MAX))}
            maxLength={MEMO_MAX}
            rows={4}
            placeholder="예: 초등학교 근처였으면 좋겠어요"
            className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none"
          />
          <span className="absolute right-3 bottom-3 text-[10px] text-slate-400">
            {memo.length}/{MEMO_MAX}
          </span>
        </div>
      </section>

      {/* 귀찮으면 그냥 전화 */}
      <a
        href="tel:031-721-0082"
        className="flex items-center justify-center gap-2 text-slate-500 text-sm font-medium border border-dashed border-slate-300 rounded-xl h-12 hover:bg-slate-50 hover:text-violet-500 hover:border-violet-200 transition"
      >
        📞 그냥 전화로 상담할게요 (눌러주세요^^)
      </a>

      {/* 5. 연락처 */}
      <section>
        <h2 className="text-base font-bold text-slate-800 mb-3">연락처를 남겨주세요</h2>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 (선택)"
            className="w-full bg-white border border-slate-200 rounded-xl h-12 px-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="연락받을 전화번호 *"
            className="w-full bg-white border border-slate-200 rounded-xl h-12 px-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </div>
      </section>

      {status === "error" && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm font-medium rounded-xl px-4 py-3 border border-red-200">
          <span className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">
            !
          </span>
          {errorMsg}
        </div>
      )}

      {/* 하단 고정 제출 버튼 (모바일 친화) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-100 p-4 z-40">
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full max-w-lg mx-auto flex items-center justify-center bg-violet-400 text-white text-sm font-bold rounded-full h-13 py-3.5 hover:bg-violet-500 transition disabled:opacity-50"
        >
          {status === "loading" ? "보내는 중..." : "상담 신청하기"}
        </button>
      </div>
    </form>
  );
}