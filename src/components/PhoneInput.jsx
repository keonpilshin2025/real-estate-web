// value/onChange는 항상 숫자만(구분자 없이) 주고받습니다. 화면 표시만 자동으로 하이픈이 붙습니다.
function formatMobile(digits) {
  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

export default function PhoneInput({ value, onChange, placeholder = "연락처", className = "" }) {
  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    onChange(digits);
  }

  return (
    <input
      type="tel"
      inputMode="numeric"
      placeholder={placeholder}
      value={formatMobile(value || "")}
      onChange={handleChange}
      className={className}
    />
  );
}