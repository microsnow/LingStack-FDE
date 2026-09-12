"use client";

import { useRef, useState } from "react";
import { ASSET_STORAGE_KEY, defaultAssets, normalizeAsset, type SmartAsset } from "../lib/smart-assets";
import { collectPreferences, parseSettingsBackup, restorePreferences, serializeSettingsBackup } from "../lib/settings-backup";
import { FdeNavigation, type FdeModule } from "./fde-navigation";

function browserAssets(): SmartAsset[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ASSET_STORAGE_KEY) ?? "[]") as unknown[];
    const assets = Array.isArray(parsed) ? parsed.map(normalizeAsset).filter((asset): asset is SmartAsset => Boolean(asset)) : [];
    return assets.length ? assets : defaultAssets;
  } catch { return defaultAssets; }
}

export default function SettingsCenter({ onNavigate }: { onNavigate: (module: FdeModule) => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const desktop = window.fdeDesktop;

  async function exportBackup() {
    setBusy(true); setMessage("");
    try {
      const stored = await desktop?.loadSmartAssets();
      const assets = stored ? stored.map(normalizeAsset).filter((asset): asset is SmartAsset => Boolean(asset)) : browserAssets();
      const blob = new Blob([serializeSettingsBackup(collectPreferences(localStorage), assets)], { type: "application/json;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `lingstack-fde-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click(); URL.revokeObjectURL(link.href);
      setMessage(`已导出 ${assets.length} 个智能资产和本地偏好。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "备份导出失败"); }
    finally { setBusy(false); }
  }

  async function importBackup(file?: File) {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      const backup = parseSettingsBackup(await file.text());
      restorePreferences(localStorage, backup.preferences);
      localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify(backup.assets));
      await desktop?.saveSmartAssets(backup.assets);
      setMessage(`已恢复 ${backup.assets.length} 个智能资产，重新打开模块后生效。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "备份恢复失败"); }
    finally { setBusy(false); if (importRef.current) importRef.current.value = ""; }
  }

  return <main className="fde-page-shell">
    <header className="fde-page-header">
      <div className="brand"><span className="brand-mark">F_</span><div><strong>灵栈</strong><small>FDE · 开发者工作台</small></div></div>
      <FdeNavigation active="settings" onChange={onNavigate} />
      <span className="local"><i />{desktop ? "桌面本地存储" : "浏览器本地存储"}</span>
    </header>
    <section className="settings-shell">
      <p className="eyebrow">SETTINGS · BACKUP</p><h1>设置与本地数据</h1>
      <p className="settings-intro">备份收藏、最近使用、主题、当前模块以及全部提示词资产。文件只在本机生成和读取。</p>
      <div className="settings-grid">
        <article className="settings-card"><h2>导出完整备份</h2><p>生成可迁移的 JSON 文件，不包含 Skills 源文件或工具输入。</p><button disabled={busy} onClick={() => void exportBackup()}>导出备份</button></article>
        <article className="settings-card"><h2>恢复本地数据</h2><p>仅接受灵栈 FDE 备份格式，并且只恢复白名单设置。</p><button disabled={busy} onClick={() => importRef.current?.click()}>选择备份文件</button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={event => void importBackup(event.target.files?.[0])} /></article>
      </div>
      {message && <p className="settings-message" role="status">{message}</p>}
      <p className="settings-note">Skills 目录配置保存在桌面客户端用户数据目录；备份不会复制或修改任何 Skill 文件。</p>
    </section>
  </main>;
}
