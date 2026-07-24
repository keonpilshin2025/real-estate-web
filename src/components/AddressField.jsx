import { useState } from "react";
import AddressSearchButton from "./AddressSearchButton.jsx";

// value: 부모가 갖고 있는 최종 주소 문자열 (기본주소 + 상세주소가 합쳐진 값)
// onChange: 합쳐진 최종 주소 문자열을 전달
export default function AddressField({ value, onChange, readOnly = false, onSelectRaw }) {
  const [base, setBase] = useState(value || "");
  const [detail, setDetail] = useState("");

  function combine(b, d) {
    return d ? `${b} ${d}`.trim() : b;
  }

  function handleSelect(addr) {
    setBase(addr);
    setDetail("");
    onChange(combine(addr, ""));
  }

  function handleBaseChange(v) {
    setBase(v);
    onChange(combine(v, detail));
  }

  function handleDetailChange(v) {
    setDetail(v);
    onChange(combine(base, v));
  }

  if (readOnly) {
    return (
      <input
        placeholder="주소"
        readOnly
        value={value}
        className="col-span-2 border border-slate-200 rounded-lg h-9 px-3 bg-violet-50 text-violet-600"
      />
    );
  }

  return (
    <div className="col-span-2 flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          placeholder="주소 (검색 버튼으로 찾거나 직접 입력)"
          value={base}
          onChange={(e) => handleBaseChange(e.target.value)}
          className="flex-1 border border-slate-200 rounded-lg h-9 px-3"
        />
        <AddressSearchButton onSelect={handleSelect} onSelectRaw={onSelectRaw} />
      </div>
      <input
        placeholder="상세주소 (동/호수, 층 등)"
        value={detail}
        onChange={(e) => handleDetailChange(e.target.value)}
        className="border border-slate-200 rounded-lg h-9 px-3"
      />
    </div>
  );
}