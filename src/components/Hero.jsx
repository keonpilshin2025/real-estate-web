export default function Hero({ contact = "031-721-0082" }) {
  return (
    <section className="bg-gradient-to-br from-indigo-50 via-violet-50 to-orange-50 py-16 px-6 text-center rounded-3xl">
      <span className="inline-block bg-white text-violet-500 text-xs font-medium px-4 py-1.5 rounded-full mb-4 border border-violet-100 shadow-sm">
        성남 여수동 전문
      </span>

      <h2 className="text-2xl md:text-4xl font-medium text-slate-900 leading-snug mb-3">
        판교 30분, 분당보다 합리적인
        <br />
        여수동 아파트를 찾으세요
      </h2>

      <p className="text-sm md:text-base text-slate-500 mb-8">
        출퇴근 시간 · 학군 · 시세를 한 곳에서 비교
      </p>

      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <a
          href="#inquiry"
          className="bg-violet-400 text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-violet-500 transition shadow-sm"
        >
          우선 매물 안내받기
        </a>
        <a
          href={`tel:${contact}`}
          className="bg-white text-slate-900 text-sm font-medium px-6 py-3 rounded-full border border-slate-200 hover:bg-slate-50 transition"
        >
          전화 상담
        </a>
      </div>

      <div className="mt-6">
        <a
          href="javascript:void(0);"
          onClick={() => window.goToNaverLand && window.goToNaverLand()}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#03C75A] hover:underline cursor-pointer"
        >
          <span className="bg-[#03C75A] text-white text-xs font-bold w-5 h-5 rounded flex items-center justify-center">N</span>
          네이버 실시간 매물보기
        </a>
      </div>
    </section>
  );
}