import { useEffect, useRef, useState } from "react";

// agencies: [{ id, agency_name, address }], value/onChange는 agency id 문자열
export default function AgencySelect({ agencies, value, onChange, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = agencies.find((a) => String(a.id) === String(value));

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full border border-slate-200 rounded-lg h-9 px-3 text-left flex items-center justify-between bg-white"
      >
        <span className="truncate">
          {selected ? (
            <>
              <span className="text-slate-800 font-medium">{selected.agency_name}</span>
              {selected.address && <span className="text-slate-400"> · {selected.address}</span>}
            </>
          ) : (
            <span className="text-slate-800">없음 (단독중개)</span>
          )}
        </span>
        <span className="text-slate-400 shrink-0 ml-2">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 bg-white border border-slate-200 rounded-lg mt-1 w-full max-h-52 overflow-y-auto shadow-sm">
          <div
            onClick={() => { onChange(""); setOpen(false); }}
            className="px-3 py-2 cursor-pointer hover:bg-violet-50 text-slate-800"
          >
            없음 (단독중개)
          </div>
          {agencies.map((a) => (
            <div
              key={a.id}
              onClick={() => { onChange(String(a.id)); setOpen(false); }}
              className="px-3 py-2 cursor-pointer hover:bg-violet-50"
            >
              <div className="text-slate-800 font-medium">{a.agency_name}</div>
              {a.address && <div className="text-slate-400 text-[11px] truncate">{a.address}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}