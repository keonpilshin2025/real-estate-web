import { useState } from "react";
import CapitalGainsTaxCalculator from "./CapitalGainsTaxCalculator.jsx";
import ComprehensiveRealEstateTaxCalculator from "./ComprehensiveRealEstateTaxCalculator.jsx";

const TABS = [
  { key: "capital-gains", label: "양도소득세" },
  { key: "property-tax", label: "종합부동산세" },
];

export default function TaxCalculator() {
  const [tab, setTab] = useState("capital-gains");

  return (
    <>
      <div className="inline-flex bg-slate-100 rounded-full p-1 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              tab === t.key ? "bg-white text-violet-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "capital-gains" ? <CapitalGainsTaxCalculator /> : <ComprehensiveRealEstateTaxCalculator />}
    </>
  );
}