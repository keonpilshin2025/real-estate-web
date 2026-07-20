const AREA_CODES = [
  "02", "031", "032", "033", "041", "042", "043", "044",
  "051", "052", "053", "054", "055", "061", "062", "063", "064",
  "070", "010",
];

// 저장된 숫자 전체(예: "0311234567")를 지역번호 + 나머지로 분리
function splitPhoneParts(rawDigits) {
  if (!rawDigits) return { areaCode: "", rest: "" };
  const sorted = [...AREA_CODES].sort((a, b) => b.length - a.length);
  for (const code of sorted) {
    if (rawDigits.startsWith(code)) {
      return { areaCode: code, rest: rawDigits.slice(code.length) };
    }
  }
  return { areaCode: "", rest: rawDigits };
}

function formatRest(digits) {
  if (!digits) return "";
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
}

// value/onChange는 항상 숫자만(구분자 없이, 지역번호+나머지 합친 값) 주고받습니다.
export default function AreaCodePhoneInput({ value, onChange, className = "" }) {
  const { areaCode, rest } = splitPhoneParts(value || "");

  function handleAreaChange(e) {
    onChange(e.target.value + rest);
  }

  function handleRestChange(e) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    onChange(areaCode + digits);
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      <select
        value={areaCode}
        onChange={handleAreaChange}
        className="border border-slate-200 rounded-lg h-9 px-2 w-24 shrink-0"
      >
        <option value="">지역번호</option>
        {AREA_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input
        type="tel"
        inputMode="numeric"
        placeholder="1234-5678"
        value={formatRest(rest)}
        onChange={handleRestChange}
        className="flex-1 border border-slate-200 rounded-lg h-9 px-3"
      />
    </div>
  );
}