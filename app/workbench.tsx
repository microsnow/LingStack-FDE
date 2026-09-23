"use client";

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { FdeNavigation, type FdeModule } from "./fde-navigation";
import type { OpenFilePayload } from "./desktop";

const AssetCenter = lazy(() => import("./asset-center"));
const Home = lazy(() => import("./page"));
const SkillsCenter = lazy(() => import("./skills-center"));
const SettingsCenter = lazy(() => import("./settings-center"));

const MODULE_KEY = "fde.active-module";

function ModuleLoading() {
  return (
    <main className="fde-page-shell" aria-busy="true">
      <section className="fde-placeholder">
        <p className="eyebrow">LINGSTACK FDE</p>
        <h1>正在打开模块…</h1>
      </section>
    </main>
  );
}

function Placeholder({
  module,
  onNavigate,
}: {
  module: "home";
  onNavigate: (value: FdeModule) => void;
}) {
  const content = {
    home: [
      "开发现场，一处恢复",
      "灵栈 FDE 正在从 DevKit 工具箱扩展为本地开发工作台。",
      "打开提示词中心",
    ],
  }[module];
  const target: FdeModule = "prompts";
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
              <span>78 个本地开发工具</span>
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
  const [openedFile, setOpenedFile] = useState<(OpenFilePayload & { requestId: number }) | null>(null);
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
  const navigate = useCallback((next: FdeModule) => {
    setModule(next);
    if (next !== "devkit") setOpenedFile(null);
    localStorage.setItem(MODULE_KEY, next);
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => window.fdeDesktop?.onOpenFile((file) => {
    setOpenedFile({ ...file, requestId: Date.now() });
    navigate("devkit");
  }), [navigate]);
  if (module === "devkit") return <Suspense fallback={<ModuleLoading />}><Home onNavigate={navigate} initialFile={openedFile} /></Suspense>;
  if (module === "prompts") return <Suspense fallback={<ModuleLoading />}><AssetCenter key={module} kind="prompt" onNavigate={navigate} /></Suspense>;
  if (module === "media") return <Suspense fallback={<ModuleLoading />}><AssetCenter key={module} kind="media-prompt" onNavigate={navigate} /></Suspense>;
  if (module === "skills") return <Suspense fallback={<ModuleLoading />}><SkillsCenter onNavigate={navigate} /></Suspense>;
  if (module === "settings") return <Suspense fallback={<ModuleLoading />}><SettingsCenter onNavigate={navigate} /></Suspense>;
  return <Placeholder module={module} onNavigate={navigate} />;
}
