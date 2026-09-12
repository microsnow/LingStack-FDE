"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ScannedSkill,
  SkillRisk,
  SkillRoot,
  SkillScanResult,
} from "./desktop";
import { FdeNavigation, type FdeModule } from "./fde-navigation";

type SkillFilter = "all" | "valid" | "warnings" | "duplicates";
const riskLabel = (risk: SkillRisk) =>
  risk === "high" ? "高关注" : risk === "medium" ? "需留意" : "低风险";

export default function SkillsCenter({
  onNavigate,
}: {
  onNavigate: (module: FdeModule) => void;
}) {
  const [roots, setRoots] = useState<SkillRoot[]>([]);
  const [result, setResult] = useState<SkillScanResult | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SkillFilter>("all");
  const [risk, setRisk] = useState<"all" | SkillRisk>("all");
  const [source, setSource] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [editing, setEditing] = useState<SkillRoot | null>(null);
  const [lastChange, setLastChange] = useState("");
  const [loading, setLoading] = useState(Boolean(window.fdeDesktop));
  const [error, setError] = useState(
    window.fdeDesktop ? "" : "Skills 索引需要在 FDE 桌面客户端中运行。",
  );

  const applyResult = useCallback(
    (nextRoots: SkillRoot[], next: SkillScanResult) => {
      const status = new Map(next.roots.map((root) => [root.id, root]));
      setRoots(nextRoots.map((root) => ({ ...root, ...status.get(root.id) })));
      setResult(next);
      setSelectedId((current) =>
        next.skills.some((skill) => skill.id === current)
          ? current
          : (next.skills[0]?.id ?? ""),
      );
    },
    [],
  );

  const load = useCallback(async () => {
    const desktop = window.fdeDesktop;
    if (!desktop) return;
    setLoading(true);
    setError("");
    try {
      const [nextRoots, next] = await Promise.all([
        desktop.listSkillRoots(),
        desktop.scanSkills(),
      ]);
      applyResult(nextRoots, next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "扫描失败");
    } finally {
      setLoading(false);
    }
  }, [applyResult]);

  useEffect(() => {
    const desktop = window.fdeDesktop;
    if (!desktop) return;
    let active = true;
    Promise.all([desktop.listSkillRoots(), desktop.scanSkills()])
      .then(([nextRoots, next]) => {
        if (active) applyResult(nextRoots, next);
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "扫描失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyResult]);

  useEffect(() => {
    const desktop = window.fdeDesktop;
    if (!desktop) return;
    let timer = 0;
    const unsubscribe = desktop.onSkillsChanged((event) => {
      setLastChange(event.changedAt ?? new Date().toISOString());
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 900);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [load]);

  async function addRoot() {
    if (await window.fdeDesktop?.addSkillRoot()) await load();
  }
  async function toggleRoot(root: SkillRoot) {
    await window.fdeDesktop?.updateSkillRoot(root.id, {
      enabled: !root.enabled,
    });
    await load();
  }
  async function removeRoot(root: SkillRoot) {
    if (root.isDefault) return;
    await window.fdeDesktop?.removeSkillRoot(root.id);
    if (source === root.id) setSource("all");
    await load();
  }
  async function saveRoot() {
    if (!editing) return;
    await window.fdeDesktop?.updateSkillRoot(editing.id, {
      label: editing.label,
      platform: editing.platform,
      priority: editing.priority,
      maxDepth: editing.maxDepth,
    });
    setEditing(null);
    await load();
  }

  const visible = useMemo(
    () =>
      (result?.skills ?? []).filter((skill) => {
        if (filter === "valid" && skill.warnings.length) return false;
        if (filter === "warnings" && !skill.warnings.length) return false;
        if (
          filter === "duplicates" &&
          !skill.warnings.some((warning) => warning.startsWith("名称重复"))
        )
          return false;
        if (risk !== "all" && skill.risk !== risk) return false;
        if (source !== "all" && skill.rootId !== source) return false;
        if (platform !== "all" && skill.platform !== platform) return false;
        const term = query.trim().toLocaleLowerCase();
        return (
          !term ||
          [
            skill.name,
            skill.description,
            skill.relativePath,
            skill.rootLabel,
            skill.platform,
            ...skill.capabilities,
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(term)
        );
      }),
    [filter, platform, query, result, risk, source],
  );
  const selected =
    result?.skills.find((skill) => skill.id === selectedId) ?? visible[0];

  return (
    <main className="app-shell skills-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">F_</span>
          <div>
            <strong>灵栈</strong>
            <small>FDE · Skills 管理中心</small>
          </div>
        </div>
        <FdeNavigation active="skills" onChange={onNavigate} />
        <label className="search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`搜索 ${result?.summary.total ?? 0} 个 Skills...`}
          />
        </label>
        <div className="top-actions">
          <span className="local">
            <i />
            自动监听
          </span>
          <button onClick={() => void load()} title="重新扫描">
            ↻
          </button>
        </div>
      </header>
      <aside className="sidebar skill-sidebar">
        <div className="root-heading">
          <span>SKILLS 目录</span>
          <button onClick={() => void addRoot()}>＋ 添加</button>
        </div>
        <div className="skill-roots">
          {roots.map((root) => (
            <div
              className={`skill-root ${root.enabled ? "" : "disabled"}`}
              key={root.id}
            >
              <div>
                <span>{root.platform}</span>
                <b>{root.label}</b>
              </div>
              <button
                className={`root-toggle ${root.enabled ? "on" : ""}`}
                onClick={() => void toggleRoot(root)}
              >
                {root.enabled ? "开" : "关"}
              </button>
              <small title={root.path}>{root.path}</small>
              <em>
                {!root.enabled
                  ? "已禁用"
                  : root.available === false
                    ? "未找到"
                    : `${root.count ?? 0} 个 · 深度 ${root.maxDepth}`}
              </em>
              <div className="root-actions">
                <button
                  disabled={root.available === false}
                  onClick={() =>
                    void window.fdeDesktop?.openSkillPath(root.path)
                  }
                >
                  打开
                </button>
                <button onClick={() => setEditing(root)}>编辑</button>
                {!root.isDefault && (
                  <button
                    className="root-remove"
                    onClick={() => void removeRoot(root)}
                  >
                    移除索引
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <nav>
          <button
            className={filter === "all" ? "selected" : ""}
            onClick={() => setFilter("all")}
          >
            <span>◇</span>全部<em>{result?.summary.total ?? 0}</em>
          </button>
          <button
            className={filter === "valid" ? "selected" : ""}
            onClick={() => setFilter("valid")}
          >
            <span>✓</span>结构正常<em>{result?.summary.valid ?? 0}</em>
          </button>
          <button
            className={filter === "warnings" ? "selected" : ""}
            onClick={() => setFilter("warnings")}
          >
            <span>!</span>需要检查<em>{result?.summary.warnings ?? 0}</em>
          </button>
          <button
            className={filter === "duplicates" ? "selected" : ""}
            onClick={() => setFilter("duplicates")}
          >
            <span>≡</span>名称重复<em>{result?.summary.duplicates ?? 0}</em>
          </button>
        </nav>
        <div className="privacy">
          <span>◉</span>
          <div>
            <b>只读索引</b>
            <p>目录变化自动刷新，不移动、不编辑、不执行源文件。</p>
          </div>
        </div>
      </aside>
      <section className="content skills-content">
        <div className="skill-heading">
          <div>
            <p className="eyebrow">MULTI-SOURCE SKILLS · READ ONLY</p>
            <h1>Skills 资产索引</h1>
            <p>
              {result
                ? `${result.summary.total} 个 Skills · ${roots.filter((root) => root.enabled && root.available !== false).length} 个有效目录 · ${result.durationMs} ms${lastChange ? " · 已自动刷新" : ""}`
                : "正在等待桌面客户端扫描"}
            </p>
          </div>
          <select
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
          >
            <option value="all">全部平台</option>
            {[...new Set(roots.map((root) => root.platform))].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="all">全部目录</option>
            {roots
              .filter((root) => root.enabled && root.available !== false)
              .map((root) => (
                <option key={root.id} value={root.id}>
                  {root.label}
                </option>
              ))}
          </select>
          <select
            value={risk}
            onChange={(event) =>
              setRisk(event.target.value as "all" | SkillRisk)
            }
          >
            <option value="all">全部风险</option>
            <option value="low">低风险</option>
            <option value="medium">需留意</option>
            <option value="high">高关注</option>
          </select>
          <button onClick={() => void load()} disabled={loading}>
            {loading ? "扫描中…" : "重新扫描"}
          </button>
        </div>
        {error && <div className="skill-error">{error}</div>}
        {!error && !result && (
          <div className="skill-loading">正在建立本地 Skills 索引…</div>
        )}
        {result && roots.length === 0 && (
          <section className="skill-onboarding">
            <span>＋</span>
            <h2>添加你的第一个 Skills 目录</h2>
            <p>
              灵栈不会自动扫描本机目录。你可以主动添加 Codex、WorkBuddy、
              CodeBuddy 或自己的 Skills 文件夹。
            </p>
            <button onClick={() => void addRoot()}>选择目录</button>
            <small>移除索引不会删除目录或其中的文件。</small>
          </section>
        )}
        {result && roots.length > 0 && (
          <div className="skill-layout">
            <section className="skill-list">
              <div className="skill-list-head">
                <b>{visible.length} 个结果</b>
                <span>
                  {result.truncated
                    ? "结果已截断"
                    : new Date(result.scannedAt).toLocaleString("zh-CN")}
                </span>
              </div>
              {visible.map((skill) => (
                <button
                  key={skill.id}
                  className={`skill-row ${selected?.id === skill.id ? "active" : ""}`}
                  onClick={() => setSelectedId(skill.id)}
                >
                  <span className={`skill-risk ${skill.risk}`}>
                    {skill.risk === "low"
                      ? "✓"
                      : skill.risk === "medium"
                        ? "!"
                        : "!!"}
                  </span>
                  <span>
                    <b>{skill.name}</b>
                    <small>{skill.description || "没有描述"}</small>
                    <em>
                      {skill.rootLabel} · {skill.relativePath}
                    </em>
                  </span>
                  {skill.warnings.length > 0 && <i>{skill.warnings.length}</i>}
                </button>
              ))}
              {!visible.length && (
                <div className="asset-empty">没有符合筛选条件的 Skill</div>
              )}
            </section>
            <SkillDetail skill={selected} />
          </div>
        )}
      </section>
      {editing && (
        <RootEditor
          root={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => void saveRoot()}
        />
      )}
    </main>
  );
}

function RootEditor({
  root,
  onChange,
  onCancel,
  onSave,
}: {
  root: SkillRoot;
  onChange: (root: SkillRoot) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="skill-modal" role="dialog" aria-modal="true">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <header>
          <div>
            <span>目录配置</span>
            <h2>{root.label}</h2>
          </div>
          <button type="button" onClick={onCancel}>
            ×
          </button>
        </header>
        <label>
          显示名称
          <input
            value={root.label}
            onChange={(event) =>
              onChange({ ...root, label: event.target.value })
            }
          />
        </label>
        <label>
          平台
          <input
            value={root.platform}
            onChange={(event) =>
              onChange({ ...root, platform: event.target.value })
            }
          />
        </label>
        <div>
          <label>
            加载优先级
            <input
              type="number"
              min="0"
              max="999"
              value={root.priority}
              onChange={(event) =>
                onChange({ ...root, priority: Number(event.target.value) })
              }
            />
          </label>
          <label>
            扫描深度
            <input
              type="number"
              min="1"
              max="12"
              value={root.maxDepth}
              onChange={(event) =>
                onChange({ ...root, maxDepth: Number(event.target.value) })
              }
            />
          </label>
        </div>
        <small>
          {root.path}
          <br />
          只读模式固定开启，保存不会修改目录内容。
        </small>
        <footer>
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <button type="submit">保存配置</button>
        </footer>
      </form>
    </div>
  );
}

function SkillDetail({ skill }: { skill?: ScannedSkill }) {
  if (!skill)
    return (
      <section className="skill-detail">
        <div className="asset-empty editor-empty">选择一个 Skill 查看详情</div>
      </section>
    );
  return (
    <section className="skill-detail">
      <header>
        <div>
          <span>
            {skill.platform.toLocaleUpperCase()} · {skill.rootLabel}
          </span>
          <h2>{skill.name}</h2>
          <p>{skill.description || "没有提供 description"}</p>
        </div>
        <button
          className="open-skill"
          onClick={() => void window.fdeDesktop?.openSkillPath(skill.directory)}
        >
          在文件管理器中打开
        </button>
        <b className={`risk-badge ${skill.risk}`}>{riskLabel(skill.risk)}</b>
      </header>
      <div className="skill-meta">
        <div>
          <span>源目录</span>
          <code>{skill.directory}</code>
        </div>
        <div>
          <span>更新时间</span>
          <b>{new Date(skill.modifiedAt).toLocaleString("zh-CN")}</b>
        </div>
        <div>
          <span>SKILL.md</span>
          <b>{(skill.size / 1024).toFixed(1)} KB</b>
        </div>
      </div>
      <section className="skill-checks">
        <div className="panel-title">
          <b>结构与能力提示</b>
          <span>
            {skill.warnings.length
              ? `${skill.warnings.length} 项需要检查`
              : "结构正常"}
          </span>
        </div>
        <div className="skill-tags">
          {skill.capabilities.length ? (
            skill.capabilities.map((value) => <span key={value}>{value}</span>)
          ) : (
            <span className="ok">未发现额外能力说明</span>
          )}
        </div>
        {skill.warnings.length > 0 && (
          <ul>
            {skill.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="skill-tree">
        <div className="panel-title">
          <b>目录结构</b>
          <span>最多展示 80 项、3 层</span>
        </div>
        <div>
          {skill.tree.map((item) => (
            <code
              key={item.path}
              style={{ paddingLeft: `${item.depth * 14 + 4}px` }}
            >
              <span>{item.type === "directory" ? "▸" : "·"}</span>
              {item.path}
            </code>
          ))}
        </div>
      </section>
      <section className="skill-preview">
        <div className="panel-title">
          <b>SKILL.md 只读预览</b>
          <span>最多 20 KB</span>
        </div>
        <pre>{skill.preview}</pre>
      </section>
    </section>
  );
}
