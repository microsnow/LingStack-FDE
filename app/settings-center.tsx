"use client";

import { useEffect, useRef, useState } from "react";
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
  const [credentialStatus, setCredentialStatus] = useState({ available: false, backend: "browser", message: "安全凭据仅能在桌面客户端中保存。" });
  const [credentials, setCredentials] = useState<{ id: string; label: string; updatedAt: string }[]>([]);
  const [credentialLabel, setCredentialLabel] = useState("");
  const [credentialSecret, setCredentialSecret] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const desktop = window.fdeDesktop;

  useEffect(() => {
    if (!desktop) return;
    let active = true;
    void Promise.all([desktop.getCredentialStatus(), desktop.listCredentials()]).then(([status, items]) => {
      if (active) { setCredentialStatus(status); setCredentials(items); }
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : "读取安全凭据状态失败");
    });
    const unsubscribe = desktop.onUpdateProgress((progress) => {
      if (progress.status === "downloading") setUpdateMessage(`正在下载更新：${progress.percent ?? 0}%`);
      else if (progress.status === "error") setUpdateMessage(progress.message ?? "更新失败");
    });
    return () => { active = false; unsubscribe(); };
  }, [desktop]);

  async function addCredential() {
    if (!desktop || !credentialStatus.available) return;
    setBusy(true);
    try {
      await desktop.saveCredential(credentialLabel, credentialSecret);
      setCredentials(await desktop.listCredentials());
      setCredentialLabel("");
      setCredentialSecret("");
      setMessage("凭据已加密并保存在系统安全存储中。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "凭据保存失败"); }
    finally { setBusy(false); }
  }

  async function deleteCredential(id: string) {
    if (!desktop || !confirm("确定移除此凭据吗？")) return;
    try {
      await desktop.removeCredential(id);
      setCredentials(await desktop.listCredentials());
      setMessage("凭据已移除。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "凭据移除失败"); }
  }

  async function checkUpdates() {
    if (!desktop) { setUpdateMessage("更新检查仅支持桌面客户端。"); return; }
    setCheckingUpdate(true);
    setUpdateMessage("正在检查更新…");
    try {
      const result = await desktop.checkForUpdates();
      setUpdateMessage(result.message);
    } catch (error) { setUpdateMessage(error instanceof Error ? error.message : "更新检查失败"); }
    finally { setCheckingUpdate(false); }
  }

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
        <article className="settings-card credential-card">
          <h2>安全凭据</h2>
          <p>{credentialStatus.message} 只保存名称和密文到应用数据目录；凭据内容不会写入浏览器存储或备份。</p>
          <label>凭据名称<input value={credentialLabel} maxLength={100} onChange={event => setCredentialLabel(event.target.value)} placeholder="例如：开发环境 API Key" /></label>
          <label>令牌、密钥或连接密码<input type="password" value={credentialSecret} autoComplete="new-password" onChange={event => setCredentialSecret(event.target.value)} placeholder="输入后加密保存" /></label>
          <button disabled={busy || !credentialStatus.available || !credentialLabel.trim() || !credentialSecret} onClick={() => void addCredential()}>加密保存凭据</button>
          {!!credentials.length && <ul className="credential-list">{credentials.map(item => <li key={item.id}><span><b>{item.label}</b><small>更新于 {new Date(item.updatedAt).toLocaleString("zh-CN")}</small></span><button className="credential-remove" onClick={() => void deleteCredential(item.id)}>移除</button></li>)}</ul>}
        </article>
        <article className="settings-card">
          <h2>应用更新</h2>
          <p>从灵栈 FDE GitHub Releases 检查、下载并安装新版本。更新安装前会再次询问。</p>
          <button disabled={checkingUpdate || !desktop} onClick={() => void checkUpdates()}>{checkingUpdate ? "检查中…" : "检查更新"}</button>
          {updateMessage && <p className="settings-inline-message" role="status">{updateMessage}</p>}
        </article>
      </div>
      {message && <p className="settings-message" role="status">{message}</p>}
      <p className="settings-note">Skills 目录配置保存在桌面客户端用户数据目录；备份不会复制或修改任何 Skill 文件。</p>
    </section>
  </main>;
}
