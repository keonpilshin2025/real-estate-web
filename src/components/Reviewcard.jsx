export default function ReviewCard({
  title = "수지→여수동 이사, 출퇴근 20분 단축",
  subtitle = "판교 IT기업 재직 · 센트럴타운 매매 후기",
  thumbnail,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
      <div
        className="w-11 h-11 rounded-xl bg-violet-50 shrink-0 bg-cover bg-center"
        style={thumbnail ? { backgroundImage: `url(${thumbnail})` } : undefined}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">{title}</p>
        <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
      </div>
      <span className="bg-green-100 text-green-700 text-[10px] font-medium px-2.5 py-1 rounded-full shrink-0">
        계약완료
      </span>
    </div>
  );
}