import AddressSearchButton from "./AddressSearchButton.jsx";

// address: 기본주소, addressDetail: 상세주소 (동/호수, 층 등) - 서로 완전히 분리된 값으로 관리
// onAddressChange / onAddressDetailChange: 각각 따로 바뀔 때 호출
// 이렇게 분리해야, 나중에 다시 불러올 때도 상세주소가 상세주소 칸에 정확히 들어감
export default function AddressField({
  address,
  addressDetail,
  onAddressChange,
  onAddressDetailChange,
  readOnly = false,
  onSelectRaw,
}) {
  function handleSelect(addr) {
    onAddressChange(addr);
  }

  if (readOnly) {
    return (
      <input
        placeholder="주소"
        readOnly
        value={[address, addressDetail].filter(Boolean).join(" ")}
        className="col-span-2 border border-slate-200 rounded-lg h-9 px-3 bg-violet-50 text-violet-600"
      />
    );
  }

  return (
    <div className="col-span-2 flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          placeholder="주소 (검색 버튼으로 찾거나 직접 입력)"
          value={address || ""}
          onChange={(e) => onAddressChange(e.target.value)}
          className="flex-1 border border-slate-200 rounded-lg h-9 px-3"
        />
        <AddressSearchButton onSelect={handleSelect} onSelectRaw={onSelectRaw} />
      </div>
      <input
        placeholder="상세주소 (동/호수, 층 등)"
        value={addressDetail || ""}
        onChange={(e) => onAddressDetailChange(e.target.value)}
        className="border border-slate-200 rounded-lg h-9 px-3"
      />
    </div>
  );
}