"use client";

import { useState } from "react";
import AssetCenter from "./asset-center";
import { FdeNavigation, type FdeModule } from "./fde-navigation";
import Home from "./page";
import SkillsCenter from "./skills-center";

const MODULE_KEY = "fde.active-module";

function Placeholder({
  module,
  onNavigate,
}: {
  module: "home" | "settings";
  onNavigate: (value: FdeModule) => void;
}) {
  const content = {
    home: [
      "开发现场，一处恢复",
      "灵栈 FDE 正在从 DevKit 工具箱扩展为本地开发工作台。",
      "打开提示词中心",
    ],
    settings: [
      "灵栈设置",
      "桌面目录、智能资产备份、安全权限和外观设置将在这里统一管理。",
      "返回工具中心",
    ],
  }[module];
  const target: FdeModule = module === "settings" ? "devkit" : "prompts";
  return (
    <main className="fde-page-shell">
      <header className="fde-page-header">
        <div className="brand">
          <span className="brand-mark">F_</span>
          <div>
            <strong>灵栈</strong>
            <small>FDE · 开发者工作台</small>
          </div>
        </div>
        <FdeNavigation active={module} onChange={onNavigate} />
        <span className="local">
          <i />
          本地优先
        </span>
      </header>
      <section className="fde-placeholder">
        <p className="eyebrow">LINGSTACK FDE · 0.7</p>
        <h1>{content[0]}</h1>
        <p>{content[1]}</p>
        <button onClick={() => onNavigate(target)}>{content[2]} →</button>
        {module === "home" && (
          <div className="fde-home-grid">
            <article>
              <b>DevKit 工具中心</b>
              <span>74 个本地开发工具</span>
              <button onClick={() => onNavigate("devkit")}>打开</button>
            </article>
            <article>
              <b>提示词</b>
              <span>结构化变量与本地管理</span>
              <button onClick={() => onNavigate("prompts")}>打开</button>
            </article>
            <article>
              <b>媒体提示词</b>
              <span>图片、视频、音频与 TTS</span>
              <button onClick={() => onNavigate("media")}>打开</button>
            </article>
            <article>
              <b>Skills</b>
              <span>由你添加和管理本机 Skills 目录</span>
              <button onClick={() => onNavigate("skills")}>查看</button>
            </article>
          </div>
        )}
      </section>
    </main>
  );
}

export default function Workbench() {
  const [module, setModule] = useState<FdeModule>(() => {
    const saved = localStorage.getItem(MODULE_KEY) as FdeModule | null;
    return [
      "home",
      "prompts",
      "media",
      "skills",
      "devkit",
      "settings",
    ].includes(saved ?? "")
      ? saved!
      : "home";
  });
  function navigate(next: FdeModule) {
    setModule(next);
    localStorage.setItem(MODULE_KEY, next);
    window.scrollTo(0, 0);
  }
  if (module === "devkit") return <Home onNavigate={navigate} />;
  if (module === "prompts")
    return <AssetCenter key={module} kind="prompt" onNavigate={navigate} />;
  if (module === "media")
    return (
      <AssetCenter key={module} kind="media-prompt" onNavigate={navigate} />
    );
  if (module === "skills") return <SkillsCenter onNavigate={navigate} />;
  return <Placeholder module={module} onNavigate={navigate} />;
}
