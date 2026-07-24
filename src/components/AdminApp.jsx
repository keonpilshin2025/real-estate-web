import { useEffect, useState } from "react";
import PartnerAgenciesPanel from "./PartnerAgenciesPanel.jsx";
import PropertiesPanel from "./PropertiesPanel.jsx";
import UnitsPanel from "./UnitsPanel.jsx";
import ClientsPanel from "./ClientsPanel.jsx";
import ContractMapping from "./ContractMapping.jsx";
import ContractsListPanel from "./ContractsListPanel.jsx";

const TABS = [
  { key: "overview", label: "목록" },
  { key: "clients", label: "고객" },
  { key: "units", label: "물건" },
  { key: "properties", label: "매물" },
  { key: "contracts", label: "계약" },
  { key: "agencies", label: "부동산" },
];

export default function AdminApp() {
  const [tab, setTab] = useState("overview");

  // 세션이 만료돼서 API가 401을 돌려주면, 어떤 화면에서든 자동으로 로그인 페이지로 보냄
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        alert("로그인이 만료되었어요. 다시 로그인해주세요.");
        window.location.href = "/admin/login";
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-1.5 flex gap-1.5 w-fit shadow-sm flex-wrap">
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
      {tab === "clients" && <ClientsPanel />}
      {tab === "units" && <UnitsPanel />}
      {tab === "properties" && <PropertiesPanel />}
      {tab === "contracts" && <ContractMapping />}
      {tab === "agencies" && <PartnerAgenciesPanel />}
    </div>
  );
}