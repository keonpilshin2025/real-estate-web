const items = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M6 21V7l6-4 6 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1" />
      </svg>
    ),
    label: "단지 비교",
    bg: "bg-violet-50",
    color: "text-violet-500",
    href: "#complex-compare",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />
      </svg>
    ),
    label: "학군 정보",
    bg: "bg-green-50",
    color: "text-green-500",
    href: "#school-district",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
      </svg>
    ),
    label: "개발 호재",
    bg: "bg-indigo-50",
    color: "text-indigo-400",
    href: "#infra-plan",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 018 0v4" />
      </svg>
    ),
    label: "우선매물",
    bg: "bg-orange-50",
    color: "text-orange-500",
    href: "#hidden-listing",
    highlight: true,
  },
];

export default function QuickMenu() {
  return (
    <div className="grid grid-cols-4 gap-3 px-1 py-6">
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          className={`${item.bg} rounded-2xl py-4 px-2 text-center hover:scale-[1.03] transition ${
            item.highlight ? "ring-1 ring-orange-200" : ""
          }`}
        >
          <div className={`${item.color} flex justify-center mb-1.5`}>{item.icon}</div>
          <div className="text-xs font-medium text-slate-800">{item.label}</div>
        </a>
      ))}
    </div>
  );
}