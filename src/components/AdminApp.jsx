import { useState } from "react";
import PartnerAgenciesPanel from "./PartnerAgenciesPanel.jsx";
import PropertiesPanel from "./PropertiesPanel.jsx";
import ClientsPanel from "./ClientsPanel.jsx";
import ContractMapping from "./ContractMapping.jsx";
import ContractsListPanel from "./ContractsListPanel.jsx";

const TABS = [
  { key: "overview", label: "목록" },
  { key: "agencies", label: "부동산" },
  { key: "properties", label: "매물" },
  { key: "clients", label: "고객" },
  { key: "contracts", label: "계약" },
];

export default function AdminApp() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-1.5 flex gap-1.5 w-fit shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs font-medium px-4 py-2 rounded-xl transition ${
              tab === t.key
                ? "bg-gradient-to-r from-violet-400 to-violet-500 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <ContractsListPanel />}
      {tab === "agencies" && <PartnerAgenciesPanel />}
      {tab === "properties" && <PropertiesPanel />}
      {tab === "clients" && <ClientsPanel />}
      {tab === "contracts" && <ContractMapping />}
    </div>
  );
}
