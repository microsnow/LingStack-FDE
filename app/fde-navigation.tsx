export type FdeModule = "home" | "prompts" | "media" | "skills" | "devkit" | "settings";

const modules: { id: FdeModule; label: string }[] = [
  { id: "home", label: "首页" },
  { id: "prompts", label: "提示词" },
  { id: "media", label: "媒体提示词" },
  { id: "skills", label: "Skills" },
  { id: "devkit", label: "DevKit" },
  { id: "settings", label: "设置" },
];

export function FdeNavigation({ active, onChange }: { active: FdeModule; onChange: (module: FdeModule) => void }) {
  return <nav className="module-nav" aria-label="FDE 功能导航">
    {modules.map(module => <button key={module.id} className={active === module.id ? "active" : ""} onClick={() => onChange(module.id)}>{module.label}</button>)}
  </nav>;
}
