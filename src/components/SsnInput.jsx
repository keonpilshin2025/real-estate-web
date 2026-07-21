// value/onChange는 항상 숫자만(구분자 없이) 주고받습니다. 화면 표시만 자동으로 하이픈이 붙습니다.
function formatSsn(digits) {
  if (!digits) return "";
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6, 13)}`;
}

export default function SsnInput({ value, onChange, placeholder = "990101-1234567", className = "" }) {
  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
    onChange(digits);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={formatSsn(value || "")}
      onChange={handleChange}
      className={className}
      autoComplete="off"
    />
  );
}