"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ASSET_STORAGE_KEY,
  createAsset,
  defaultAssets,
  mergeAssets,
  normalizeAsset,
  parseAssetBundle,
  renderAsset,
  serializeAssetBundle,
  serializeAssetMarkdown,
  serializeAssetsYaml,
  syncAssetVariables,
  type AssetRun,
  type AssetKind,
  type MediaKind,
  type SmartAsset,
} from "../lib/smart-assets";
import { FdeNavigation, type FdeModule } from "./fde-navigation";

const defaultCategories: Record<AssetKind, string[]> = {
  prompt: [
    "编程开发",
    "代码审查",
    "Bug 排查",
    "产品设计",
    "内容写作",
    "翻译润色",
    "数据分析",
  ],
  "media-prompt": [
    "图片生成",
    "图片编辑",
    "视频生成",
    "音乐音效",
    "TTS 配音",
    "Logo 与 UI",
    "商品 Mockup",
  ],
};

function loadAssets(): SmartAsset[] {
  const saved = localStorage.getItem(ASSET_STORAGE_KEY);
  if (!saved) return defaultAssets;
  try {
    const values = JSON.parse(saved) as unknown[];
    return Array.isArray(values)
      ? values
          .map(normalizeAsset)
          .filter((asset): asset is SmartAsset => Boolean(asset))
      : defaultAssets;
  } catch {
    return defaultAssets;
  }
}

export default function AssetCenter({
  kind,
  onNavigate,
}: {
  kind: AssetKind;
  onNavigate: (module: FdeModule) => void;
}) {
  const [assets, setAssets] = useState<SmartAsset[]>(loadAssets);
  const [selectedId, setSelectedId] = useState(
    () => loadAssets().find((asset) => asset.kind === kind)?.id ?? "",
  );
  const [filter, setFilter] = useState("全部");
  const [showArchived, setShowArchived] = useState(false);
  const [sensitiveRun, setSensitiveRun] = useState(false);
  const [comparisonRunIds, setComparisonRunIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [desktopStorageReady, setDesktopStorageReady] = useState(
    !window.fdeDesktop,
  );
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify(assets));
    if (desktopStorageReady) {
      void window.fdeDesktop
        ?.saveSmartAssets(assets)
        .catch((error) =>
          setMessage(
            error instanceof Error ? error.message : "桌面智能资产保存失败",
          ),
        );
    }
  }, [assets, desktopStorageReady]);

  useEffect(() => {
    const desktop = window.fdeDesktop;
    if (!desktop) return;
    let active = true;
    void desktop
      .loadSmartAssets()
      .then(async (stored) => {
        if (!active) return;
        if (stored === null) {
          await desktop.saveSmartAssets(assets);
          return;
        }
        const normalized = stored
          .map(normalizeAsset)
          .filter((asset): asset is SmartAsset => Boolean(asset));
        const next = normalized.length ? normalized : defaultAssets;
        setAssets(next);
        setSelectedId(next.find((asset) => asset.kind === kind)?.id ?? "");
      })
      .catch((error) => {
        if (active)
          setMessage(
            error instanceof Error ? error.message : "桌面智能资产加载失败",
          );
      })
      .finally(() => {
        if (active) setDesktopStorageReady(true);
      });
    return () => {
      active = false;
    };
    // The initial browser snapshot is intentionally migrated only once per module mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const kindAssets = useMemo(
    () =>
      assets.filter(
        (asset) => asset.kind === kind && asset.archived === showArchived,
      ),
    [assets, kind, showArchived],
  );
  const categories = useMemo(
    () => [
      ...new Set([
        ...defaultCategories[kind],
        ...kindAssets.map((asset) => asset.category),
      ]),
    ],
    [kind, kindAssets],
  );
  const folders = useMemo(
    () =>
      [
        ...new Set(
          kindAssets
            .map((asset) => asset.folder)
            .filter((folder): folder is string => Boolean(folder)),
        ),
      ].sort(),
    [kindAssets],
  );
  const duplicateIds = useMemo(() => {
    const names = new Map<string, string>();
    const contents = new Map<string, string>();
    const duplicates = new Set<string>();
    for (const asset of kindAssets) {
      const nameKey = asset.name.trim().toLocaleLowerCase();
      const contentKey = asset.userPrompt.trim();
      for (const [map, key] of [
        [names, nameKey],
        [contents, contentKey],
      ] as const) {
        if (!key) continue;
        const existing = map.get(key);
        if (existing) {
          duplicates.add(existing);
          duplicates.add(asset.id);
        } else map.set(key, asset.id);
      }
    }
    return duplicates;
  }, [kindAssets]);
  const visible = useMemo(
    () =>
      kindAssets
        .filter((asset) => {
          if (filter === "收藏" && !asset.favorite) return false;
          if (
            filter.startsWith("目录/")
              ? asset.folder !== filter.slice(3)
              : filter !== "全部" &&
                filter !== "收藏" &&
                asset.category !== filter
          )
            return false;
          const term = query.trim().toLocaleLowerCase();
          return (
            !term ||
            [
              asset.name,
              asset.description,
              asset.category,
              asset.folder ?? "",
              ...asset.tags,
            ]
              .join(" ")
              .toLocaleLowerCase()
              .includes(term)
          );
        })
        .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))),
    [filter, kindAssets, query],
  );
  const selected = assets.find(
    (asset) => asset.id === selectedId && asset.kind === kind,
  );
  const rendered = selected ? renderAsset(selected) : null;
  const latestRevision = selected?.revisions?.at(-1);
  const diffFields = [
    "name",
    "description",
    "category",
    "tags",
    "folder",
    "systemPrompt",
    "userPrompt",
    "media",
  ] as const;
  const changedFields =
    latestRevision && selected
      ? diffFields.filter(
          (field) =>
            JSON.stringify(latestRevision.snapshot[field]) !==
            JSON.stringify(selected[field]),
        )
      : [];

  function update(patch: Partial<SmartAsset>) {
    setAssets((current) =>
      current.map((asset) =>
        asset.id === selectedId
          ? syncAssetVariables({
              ...asset,
              ...patch,
              updatedAt: new Date().toISOString(),
            })
          : asset,
      ),
    );
  }

  function addAsset() {
    const asset = createAsset(kind);
    setAssets((current) => [asset, ...current]);
    setSelectedId(asset.id);
    setFilter("全部");
    setMessage("已创建新资产");
  }

  function saveRevision() {
    if (!selected) return;
    const now = new Date().toISOString();
    const snapshot = { ...selected, runs: undefined, revisions: undefined };
    update({
      version: selected.version + 1,
      revisions: [
        ...(selected.revisions ?? []),
        {
          version: selected.version,
          createdAt: now,
          note: window.prompt("版本备注", "手动保存") ?? "手动保存",
          snapshot,
        },
      ],
    });
    setMessage(`已保存为 v${selected.version + 1}`);
  }

  function restoreRevision() {
    const revision = selected?.revisions?.at(-1);
    if (!selected || !revision) return;
    const restored = {
      ...revision.snapshot,
      id: selected.id,
      revisions: selected.revisions,
      runs: selected.runs,
      version: selected.version + 1,
      updatedAt: new Date().toISOString(),
    };
    setAssets((current) =>
      current.map((asset) =>
        asset.id === selected.id ? syncAssetVariables(restored) : asset,
      ),
    );
    setMessage(
      `已回滚到 v${revision.version} 内容，并创建 v${selected.version + 1}`,
    );
  }

  async function saveExternalRun() {
    if (!selected || !rendered) return;
    const output = window.prompt("粘贴模型生成结果（取消则不保存）");
    if (output === null) return;
    if (sensitiveRun) {
      setMessage("敏感运行结果已在本次会话中丢弃，没有写入本地历史");
      return;
    }
    const model =
      window.prompt(
        "模型名称",
        selected.recommendedModel || selected.media?.model || "外部模型",
      ) ?? "外部模型";
    const durationInput = window.prompt("耗时（毫秒，未知可留空）", "");
    const tokensInput = window.prompt("Token 数（未知可留空）", "");
    const run: AssetRun = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      input: {
        systemPrompt: rendered.systemPrompt,
        userPrompt: rendered.userPrompt,
        negativePrompt: rendered.negativePrompt,
        ...Object.fromEntries(
          selected.variables.map((variable) => [
            `variable:${variable.name}`,
            variable.value,
          ]),
        ),
      },
      output,
      model,
      durationMs: Math.max(0, Number(durationInput) || 0),
      ...(Number(tokensInput) > 0
        ? { tokens: Math.floor(Number(tokensInput)) }
        : {}),
      parameters: selected.media
        ? {
            aspectRatio: selected.media.aspectRatio,
            quality: selected.media.quality ?? "",
            negativePrompt: selected.media.negativePrompt,
          }
        : {},
      seed: selected.media?.seed ?? "",
      attachmentIds: (selected.attachments ?? []).map(
        (attachment) => attachment.id,
      ),
      assetVersion: selected.version,
    };
    update({ runs: [...(selected.runs ?? []), run] });
    setMessage("已保存外部结果、输入、模型和生成参数");
  }

  function deriveFromRun(runId: string) {
    if (!selected) return;
    const now = new Date().toISOString();
    const derived = {
      ...selected,
      id: crypto.randomUUID(),
      name: `${selected.name} · 派生版本`,
      favorite: false,
      pinned: false,
      archived: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
      runs: [],
      revisions: [],
      derivedFrom: { assetId: selected.id, runId },
    };
    setAssets((current) => [derived, ...current]);
    setSelectedId(derived.id);
    setMessage("已从该运行记录创建派生资产，来源关系已记录");
  }

  function exportAsSkill() {
    if (!selected || selected.kind !== "prompt") return;
    const body = `---\nname: ${JSON.stringify(
      selected.name
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-|-$/g, "") || "prompt-skill",
    )}\ndescription: ${JSON.stringify(selected.description || selected.name)}\n---\n\n# ${selected.name}\n\n${selected.description}\n\n${selected.systemPrompt ? `## System Prompt\n\n${selected.systemPrompt}\n\n` : ""}## Instructions\n\n${selected.userPrompt}\n`;
    download(body, "SKILL.md", "text/markdown;charset=utf-8");
    setMessage("已下载可继续编辑的 SKILL.md");
  }

  function duplicateAsset() {
    if (!selected) return;
    const now = new Date().toISOString();
    const copy = {
      ...selected,
      id: crypto.randomUUID(),
      name: `${selected.name} 副本`,
      favorite: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    setAssets((current) => [copy, ...current]);
    setSelectedId(copy.id);
    setMessage("已创建副本");
  }

  function removeAsset() {
    if (!selected || !confirm(`确定删除“${selected.name}”吗？`)) return;
    const remaining = assets.filter((asset) => asset.id !== selected.id);
    setAssets(remaining);
    setSelectedId(remaining.find((asset) => asset.kind === kind)?.id ?? "");
    setMessage("已删除");
  }

  async function copyRendered() {
    if (!rendered) return;
    const text = [
      rendered.systemPrompt && `System:\n${rendered.systemPrompt}`,
      rendered.userPrompt,
      rendered.negativePrompt && `Negative:\n${rendered.negativePrompt}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setMessage("最终提示词已复制");
  }

  async function fillFromClipboard() {
    if (!selected?.variables.length) return;
    try {
      const value = window.fdeDesktop
        ? await window.fdeDesktop.readClipboardText()
        : await navigator.clipboard.readText();
      const target =
        selected.variables.find((variable) => !variable.value) ??
        selected.variables[0];
      update({
        variables: selected.variables.map((variable) =>
          variable.name === target.name ? { ...variable, value } : variable,
        ),
      });
      setMessage(`已将剪贴板内容填入「${target.name}」`);
    } catch {
      setMessage("无法读取剪贴板，请检查系统权限");
    }
  }

  function exportAssets() {
    const blob = new Blob([serializeAssetBundle(kindAssets)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fde-${kind}-assets.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`已导出 ${kindAssets.length} 项资产`);
  }

  function download(content: string, filename: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importAssets(file?: File) {
    if (!file) return;
    try {
      const extension = file.name.split(".").at(-1)?.toLowerCase();
      const incoming = parseAssetBundle(
        await file.text(),
        extension === "md" || extension === "markdown"
          ? "markdown"
          : extension === "yaml" || extension === "yml"
            ? "yaml"
            : "json",
      );
      const conflicts = incoming.filter((item) =>
        assets.some(
          (existing) =>
            existing.id !== item.id &&
            existing.kind === item.kind &&
            existing.name.trim().toLocaleLowerCase() ===
              item.name.trim().toLocaleLowerCase(),
        ),
      );
      setAssets((current) => mergeAssets(current, incoming));
      setMessage(
        `已导入 ${incoming.length} 项资产${conflicts.length ? `；检测到 ${conflicts.length} 个同名冲突，已按 ID 保留为独立资产` : ""}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败");
    }
    if (importRef.current) importRef.current.value = "";
  }

  const title = kind === "prompt" ? "提示词中心" : "媒体提示词中心";
  return (
    <main className="app-shell asset-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">F_</span>
          <div>
            <strong>灵栈</strong>
            <small>FDE · {title}</small>
          </div>
        </div>
        <FdeNavigation
          active={kind === "prompt" ? "prompts" : "media"}
          onChange={onNavigate}
        />
        <label className="search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`搜索 ${kindAssets.length} 项资产...`}
          />
        </label>
        <div className="top-actions">
          <span className="local">
            <i />
            仅保存在本机
          </span>
          <button onClick={exportAssets} title="导出 JSON">
            JSON
          </button>
          <button
            onClick={() =>
              download(
                serializeAssetsYaml(kindAssets),
                `fde-${kind}-assets.yaml`,
                "application/yaml;charset=utf-8",
              )
            }
            title="导出 YAML"
          >
            YAML
          </button>
          <button
            disabled={!selected}
            onClick={() =>
              selected &&
              download(
                serializeAssetMarkdown(selected),
                `fde-${selected.id}.md`,
                "text/markdown;charset=utf-8",
              )
            }
            title="导出所选 Markdown"
          >
            MD
          </button>
          <button onClick={() => importRef.current?.click()} title="导入资产">
            ⇧
          </button>
          <input
            ref={importRef}
            hidden
            type="file"
            accept="application/json,.json,.yaml,.yml,.md,.markdown"
            onChange={(event) => void importAssets(event.target.files?.[0])}
          />
        </div>
      </header>
      <aside className="sidebar asset-sidebar">
        <button className="asset-create" onClick={addAsset}>
          ＋ 新建{kind === "prompt" ? "提示词" : "媒体提示词"}
        </button>
        <nav>
          <button
            className={filter === "全部" ? "selected" : ""}
            onClick={() => setFilter("全部")}
          >
            <span>◇</span>全部<em>{kindAssets.length}</em>
          </button>
          <button
            className={showArchived ? "selected" : ""}
            onClick={() => {
              setShowArchived(!showArchived);
              setFilter("全部");
            }}
          >
            <span>▣</span>
            {showArchived ? "已归档" : "归档箱"}
            <em>
              {
                assets.filter((asset) => asset.kind === kind && asset.archived)
                  .length
              }
            </em>
          </button>
          <button
            className={filter === "收藏" ? "selected" : ""}
            onClick={() => setFilter("收藏")}
          >
            <span>★</span>收藏
            <em>{kindAssets.filter((asset) => asset.favorite).length}</em>
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={filter === category ? "selected" : ""}
              onClick={() => setFilter(category)}
            >
              <span>·</span>
              {category}
              <em>
                {
                  kindAssets.filter((asset) => asset.category === category)
                    .length
                }
              </em>
            </button>
          ))}
          {folders.map((folder) => (
            <button
              key={`folder:${folder}`}
              className={filter === `目录/${folder}` ? "selected" : ""}
              onClick={() => setFilter(`目录/${folder}`)}
            >
              <span>↳</span>
              {folder}
              <em>
                {kindAssets.filter((asset) => asset.folder === folder).length}
              </em>
            </button>
          ))}
        </nav>
        <div className="privacy">
          <span>◉</span>
          <div>
            <b>本地智能资产</b>
            <p>提示词内容不会自动发送到任何模型或服务。</p>
          </div>
        </div>
      </aside>
      <section className="content asset-content">
        <div className="asset-heading">
          <div>
            <p className="eyebrow">SMART ASSETS · LOCAL FIRST</p>
            <h1>{title}</h1>
            <p>
              {kind === "prompt"
                ? "管理、组合和复用你的提示词。"
                : "统一管理图片、视频、音频和 TTS 创作指令。"}
            </p>
          </div>
          <button onClick={addAsset}>＋ 新建</button>
        </div>
        {message && (
          <div className="asset-message" role="status">
            {message}
            <button onClick={() => setMessage("")}>×</button>
          </div>
        )}
        <div className="asset-layout">
          <section className="asset-list">
            <div className="asset-list-head">
              <b>
                {showArchived ? "归档" : filter} · {visible.length}
              </b>
              <button
                className="asset-bulk"
                disabled={!visible.length}
                onClick={() => {
                  const ids = new Set(visible.map((asset) => asset.id));
                  setAssets((current) =>
                    current.map((asset) =>
                      ids.has(asset.id)
                        ? {
                            ...asset,
                            archived: !showArchived,
                            updatedAt: new Date().toISOString(),
                          }
                        : asset,
                    ),
                  );
                  setMessage(
                    `${showArchived ? "已恢复" : "已归档"} ${visible.length} 项资产`,
                  );
                }}
              >
                {showArchived ? "批量恢复" : "归档当前结果"}
              </button>
              <span>自动保存</span>
            </div>
            {visible.length ? (
              visible.map((asset) => (
                <button
                  key={asset.id}
                  className={`asset-row ${selectedId === asset.id ? "active" : ""}`}
                  onClick={() => setSelectedId(asset.id)}
                >
                  <span className="asset-kind">
                    {asset.kind === "prompt"
                      ? "P"
                      : asset.media?.kind.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <b>{asset.name}</b>
                    <small>{asset.description || "暂无描述"}</small>
                    <em>
                      {asset.category} · v{asset.version}
                    </em>
                  </span>
                  <i
                    title={
                      duplicateIds.has(asset.id)
                        ? "发现同名或提示词重复资产"
                        : undefined
                    }
                  >
                    {duplicateIds.has(asset.id)
                      ? "⚠"
                      : asset.pinned
                        ? "置顶"
                        : asset.favorite
                          ? "★"
                          : ""}
                  </i>
                </button>
              ))
            ) : (
              <div className="asset-empty">没有符合条件的资产</div>
            )}
          </section>
          <section className="asset-editor">
            {selected ? (
              <>
                <div className="asset-editor-head">
                  <div>
                    <span>
                      {selected.kind === "prompt" ? "PROMPT" : "MEDIA PROMPT"}
                    </span>
                    <b>{selected.name}</b>
                    {selected.derivedFrom && (
                      <small className="asset-lineage">
                        派生自「
                        {assets.find(
                          (asset) => asset.id === selected.derivedFrom?.assetId,
                        )?.name ?? "已删除资产"}
                        」· 记录 {selected.derivedFrom.runId.slice(0, 8)}
                      </small>
                    )}
                  </div>
                  <button
                    className={selected.favorite ? "favorite-active" : ""}
                    onClick={() => update({ favorite: !selected.favorite })}
                  >
                    ★
                  </button>
                  <button
                    className={selected.pinned ? "favorite-active" : ""}
                    onClick={() => update({ pinned: !selected.pinned })}
                  >
                    {selected.pinned ? "已置顶" : "置顶"}
                  </button>
                  <button
                    onClick={() => update({ archived: !selected.archived })}
                  >
                    {selected.archived ? "恢复" : "归档"}
                  </button>
                  <button onClick={duplicateAsset}>创建副本</button>
                  <button onClick={saveRevision}>保存版本</button>
                  <button
                    disabled={!selected.revisions?.length}
                    onClick={restoreRevision}
                  >
                    回滚
                  </button>
                  {selected.kind === "prompt" && (
                    <button onClick={exportAsSkill}>导出为 Skill</button>
                  )}
                  <button className="danger" onClick={removeAsset}>
                    删除
                  </button>
                </div>
                <div className="asset-form">
                  <label>
                    <span>名称</span>
                    <input
                      value={selected.name}
                      onChange={(event) => update({ name: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>分类</span>
                    <input
                      list="asset-categories"
                      value={selected.category}
                      onChange={(event) =>
                        update({ category: event.target.value })
                      }
                    />
                    <datalist id="asset-categories">
                      {defaultCategories[kind].map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </label>
                  <label className="wide">
                    <span>简介</span>
                    <input
                      value={selected.description}
                      onChange={(event) =>
                        update({ description: event.target.value })
                      }
                      placeholder="这个提示词解决什么问题？"
                    />
                  </label>
                  <label>
                    <span>标签</span>
                    <input
                      value={selected.tags.join(", ")}
                      onChange={(event) =>
                        update({
                          tags: event.target.value
                            .split(/[,，]/)
                            .map((tag) => tag.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="开发, 审查"
                    />
                  </label>
                  <label>
                    <span>范围</span>
                    <select
                      value={selected.scope}
                      onChange={(event) =>
                        update({
                          scope: event.target.value as SmartAsset["scope"],
                        })
                      }
                    >
                      <option value="global">全局</option>
                      <option value="project">项目</option>
                    </select>
                  </label>
                  <label>
                    <span>目录（用 / 分级）</span>
                    <input
                      value={selected.folder ?? ""}
                      onChange={(event) =>
                        update({
                          folder: event.target.value.replace(/^\/+|\/+$/g, ""),
                        })
                      }
                      placeholder="项目/代码审查"
                    />
                  </label>
                  {kind === "prompt" && (
                    <>
                      <label>
                        <span>作者</span>
                        <input
                          value={selected.author ?? ""}
                          onChange={(event) =>
                            update({ author: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>来源</span>
                        <input
                          value={selected.origin ?? ""}
                          onChange={(event) =>
                            update({ origin: event.target.value })
                          }
                          placeholder="自建 / 文档链接"
                        />
                      </label>
                      <label className="wide">
                        <span>使用场景</span>
                        <input
                          value={selected.useCase ?? ""}
                          onChange={(event) =>
                            update({ useCase: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>推荐模型</span>
                        <input
                          value={selected.recommendedModel ?? ""}
                          onChange={(event) =>
                            update({ recommendedModel: event.target.value })
                          }
                        />
                      </label>
                      <label className="wide">
                        <span>模型参数（JSON 或自由文本）</span>
                        <input
                          value={selected.modelParameters ?? ""}
                          onChange={(event) =>
                            update({ modelParameters: event.target.value })
                          }
                          placeholder="temperature: 0.2, max_tokens: 2000"
                        />
                      </label>
                      <label className="wide">
                        <span>运行备注</span>
                        <textarea
                          value={selected.runNotes ?? ""}
                          onChange={(event) =>
                            update({ runNotes: event.target.value })
                          }
                        />
                      </label>
                      <label className="wide">
                        <span>示例输入</span>
                        <textarea
                          value={selected.examples?.[0]?.input ?? ""}
                          onChange={(event) =>
                            update({
                              examples: [
                                {
                                  input: event.target.value,
                                  output: selected.examples?.[0]?.output ?? "",
                                },
                              ],
                            })
                          }
                        />
                      </label>
                      <label className="wide">
                        <span>示例输出</span>
                        <textarea
                          value={selected.examples?.[0]?.output ?? ""}
                          onChange={(event) =>
                            update({
                              examples: [
                                {
                                  input: selected.examples?.[0]?.input ?? "",
                                  output: event.target.value,
                                },
                              ],
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                  {kind === "media-prompt" && selected.media && (
                    <>
                      <label>
                        <span>媒体类型</span>
                        <select
                          value={selected.media.kind}
                          onChange={(event) =>
                            update({
                              media: {
                                ...selected.media!,
                                kind: event.target.value as MediaKind,
                              },
                            })
                          }
                        >
                          <option value="image">图片</option>
                          <option value="video">视频</option>
                          <option value="audio">音乐/音效</option>
                          <option value="tts">TTS 配音</option>
                        </select>
                      </label>
                      <label>
                        <span>模板类型</span>
                        <select
                          value={selected.media.template ?? "text-to-image"}
                          onChange={(event) => {
                            const template = event.target.value as NonNullable<
                              typeof selected.media
                            >["template"];
                            const kindFor: Record<string, MediaKind> = {
                              "text-to-image": "image",
                              "image-to-image": "image",
                              "image-edit": "image",
                              "style-transfer": "image",
                              "text-to-video": "video",
                              "first-last-frame-video": "video",
                              music: "audio",
                              "sound-effect": "audio",
                              tts: "tts",
                            };
                            update({
                              media: {
                                ...selected.media!,
                                template,
                                kind: kindFor[template ?? "text-to-image"],
                              },
                            });
                          }}
                        >
                          <option value="text-to-image">文生图</option>
                          <option value="image-to-image">图生图</option>
                          <option value="image-edit">图片编辑</option>
                          <option value="style-transfer">图片风格化</option>
                          <option value="text-to-video">文生视频</option>
                          <option value="first-last-frame-video">
                            首尾帧视频
                          </option>
                          <option value="music">音乐生成</option>
                          <option value="sound-effect">音效生成</option>
                          <option value="tts">TTS 配音</option>
                        </select>
                      </label>
                      <label>
                        <span>模型适配</span>
                        <input
                          value={selected.media.model}
                          onChange={(event) =>
                            update({
                              media: {
                                ...selected.media!,
                                model: event.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <label className="wide">
                        <span>
                          模型专属适配版本（当前 User Prompt 作为通用母提示词）
                        </span>
                        <div className="asset-variant-list">
                          {(selected.media.modelVariants ?? []).map(
                            (variant, index) => (
                              <div
                                className="asset-variant"
                                key={`${variant.model}-${index}`}
                              >
                                <input
                                  aria-label="模型名称"
                                  value={variant.model}
                                  placeholder="模型名称"
                                  onChange={(event) =>
                                    update({
                                      media: {
                                        ...selected.media!,
                                        modelVariants:
                                          selected.media!.modelVariants!.map(
                                            (item, at) =>
                                              at === index
                                                ? {
                                                    ...item,
                                                    model: event.target.value,
                                                  }
                                                : item,
                                          ),
                                      },
                                    })
                                  }
                                />
                                <textarea
                                  aria-label="模型适配提示词"
                                  value={variant.prompt}
                                  placeholder="模型专属提示词"
                                  onChange={(event) =>
                                    update({
                                      media: {
                                        ...selected.media!,
                                        modelVariants:
                                          selected.media!.modelVariants!.map(
                                            (item, at) =>
                                              at === index
                                                ? {
                                                    ...item,
                                                    prompt: event.target.value,
                                                  }
                                                : item,
                                          ),
                                      },
                                    })
                                  }
                                />
                                <input
                                  aria-label="模型参数"
                                  value={variant.parameters}
                                  placeholder="专属参数"
                                  onChange={(event) =>
                                    update({
                                      media: {
                                        ...selected.media!,
                                        modelVariants:
                                          selected.media!.modelVariants!.map(
                                            (item, at) =>
                                              at === index
                                                ? {
                                                    ...item,
                                                    parameters:
                                                      event.target.value,
                                                  }
                                                : item,
                                          ),
                                      },
                                    })
                                  }
                                />
                                <button
                                  onClick={() =>
                                    update({
                                      media: {
                                        ...selected.media!,
                                        modelVariants:
                                          selected.media!.modelVariants!.filter(
                                            (_item, at) => at !== index,
                                          ),
                                      },
                                    })
                                  }
                                >
                                  删除
                                </button>
                              </div>
                            ),
                          )}
                          <button
                            onClick={() =>
                              update({
                                media: {
                                  ...selected.media!,
                                  modelVariants: [
                                    ...(selected.media!.modelVariants ?? []),
                                    { model: "", prompt: "", parameters: "" },
                                  ],
                                },
                              })
                            }
                          >
                            ＋ 添加模型版本
                          </button>
                        </div>
                      </label>
                      <label>
                        <span>画面比例</span>
                        <select
                          value={selected.media.aspectRatio}
                          onChange={(event) =>
                            update({
                              media: {
                                ...selected.media!,
                                aspectRatio: event.target.value,
                              },
                            })
                          }
                        >
                          <option>1:1</option>
                          <option>16:9</option>
                          <option>9:16</option>
                          <option>4:3</option>
                          <option>3:2</option>
                        </select>
                      </label>
                      <label>
                        <span>Seed</span>
                        <input
                          value={selected.media.seed ?? ""}
                          onChange={(event) =>
                            update({
                              media: {
                                ...selected.media!,
                                seed: event.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>质量 / 尺寸</span>
                        <input
                          value={selected.media.quality ?? ""}
                          onChange={(event) =>
                            update({
                              media: {
                                ...selected.media!,
                                quality: event.target.value,
                              },
                            })
                          }
                          placeholder="高质量 · 1024×1024"
                        />
                      </label>
                      {selected.media.kind === "video" && (
                        <>
                          <label>
                            <span>时长</span>
                            <input
                              value={selected.media.duration ?? ""}
                              onChange={(event) =>
                                update({
                                  media: {
                                    ...selected.media!,
                                    duration: event.target.value,
                                  },
                                })
                              }
                              placeholder="8 秒"
                            />
                          </label>
                          <label>
                            <span>节奏</span>
                            <input
                              value={selected.media.pace ?? ""}
                              onChange={(event) =>
                                update({
                                  media: {
                                    ...selected.media!,
                                    pace: event.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            <span>镜头运动</span>
                            <input
                              value={selected.media.cameraMotion ?? ""}
                              onChange={(event) =>
                                update({
                                  media: {
                                    ...selected.media!,
                                    cameraMotion: event.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            <span>场景变化</span>
                            <input
                              value={selected.media.sceneChanges ?? ""}
                              onChange={(event) =>
                                update({
                                  media: {
                                    ...selected.media!,
                                    sceneChanges: event.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            <span>对白</span>
                            <input
                              value={selected.media.dialogue ?? ""}
                              onChange={(event) =>
                                update({
                                  media: {
                                    ...selected.media!,
                                    dialogue: event.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            <span>音效</span>
                            <input
                              value={selected.media.soundEffects ?? ""}
                              onChange={(event) =>
                                update({
                                  media: {
                                    ...selected.media!,
                                    soundEffects: event.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                        </>
                      )}
                      {selected.media.kind === "image" && (
                        <label className="wide">
                          <span>
                            图片结构化字段（主体、动作、场景、构图、镜头、光线、色彩、材质、风格、情绪）
                          </span>
                          <textarea
                            value={Object.entries(
                              selected.media.structured ?? {},
                            )
                              .map(([key, value]) => `${key}: ${value}`)
                              .join("\n")}
                            onChange={(event) => {
                              const structured = Object.fromEntries(
                                event.target.value
                                  .split("\n")
                                  .map((line) => {
                                    const split = line.indexOf(":");
                                    return split < 0
                                      ? [line.trim(), ""]
                                      : [
                                          line.slice(0, split).trim(),
                                          line.slice(split + 1).trim(),
                                        ];
                                  })
                                  .filter(([key]) => key),
                              );
                              update({
                                media: { ...selected.media!, structured },
                              });
                            }}
                            placeholder={
                              "主体: \n动作: \n场景: \n构图: \n镜头: \n光线: \n色彩: \n材质: \n风格: \n情绪:"
                            }
                          />
                        </label>
                      )}
                      <div className="asset-shots wide">
                        <div className="panel-title">
                          <b>镜头清单</b>
                          <button
                            onClick={() =>
                              update({
                                media: {
                                  ...selected.media!,
                                  shots: [
                                    ...(selected.media!.shots ?? []),
                                    {
                                      id: crypto.randomUUID(),
                                      name: `镜头 ${(selected.media!.shots?.length ?? 0) + 1}`,
                                      duration: "",
                                      prompt: "",
                                      attachmentIds: [],
                                    },
                                  ],
                                },
                              })
                            }
                          >
                            ＋ 添加镜头
                          </button>
                        </div>
                        {(selected.media.shots ?? []).map((shot, index) => (
                          <div className="asset-shot" key={shot.id}>
                            <input
                              aria-label="镜头名称"
                              value={shot.name}
                              onChange={(event) =>
                                update({
                                  media: {
                                    ...selected.media!,
                                    shots: selected.media!.shots!.map(
                                      (item, at) =>
                                        at === index
                                          ? {
                                              ...item,
                                              name: event.target.value,
                                            }
                                          : item,
                                    ),
                                  },
                                })
                              }
                            />
                            <input
                              aria-label="镜头时长"
                              value={shot.duration}
                              placeholder="时长"
                              onChange={(event) =>
                                update({
                                  media: {
                                    ...selected.media!,
                                    shots: selected.media!.shots!.map(
                                      (item, at) =>
                                        at === index
                                          ? {
                                              ...item,
                                              duration: event.target.value,
                                            }
                                          : item,
                                    ),
                                  },
                                })
                              }
                            />
                            <textarea
                              aria-label="镜头提示词"
                              value={shot.prompt}
                              placeholder="此镜头的独立提示词"
                              onChange={(event) =>
                                update({
                                  media: {
                                    ...selected.media!,
                                    shots: selected.media!.shots!.map(
                                      (item, at) =>
                                        at === index
                                          ? {
                                              ...item,
                                              prompt: event.target.value,
                                            }
                                          : item,
                                    ),
                                  },
                                })
                              }
                            />
                            <select
                              aria-label="镜头参考附件"
                              multiple
                              value={shot.attachmentIds}
                              onChange={(event) =>
                                update({
                                  media: {
                                    ...selected.media!,
                                    shots: selected.media!.shots!.map(
                                      (item, at) =>
                                        at === index
                                          ? {
                                              ...item,
                                              attachmentIds: [
                                                ...event.currentTarget
                                                  .selectedOptions,
                                              ].map((option) => option.value),
                                            }
                                          : item,
                                    ),
                                  },
                                })
                              }
                            >
                              {(selected.attachments ?? []).map(
                                (attachment) => (
                                  <option
                                    key={attachment.id}
                                    value={attachment.id}
                                  >
                                    {attachment.name}
                                  </option>
                                ),
                              )}
                            </select>
                            <button
                              onClick={() =>
                                update({
                                  media: {
                                    ...selected.media!,
                                    shots: selected.media!.shots!.filter(
                                      (item) => item.id !== shot.id,
                                    ),
                                  },
                                })
                              }
                            >
                              删除
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <label className="wide">
                    <span>System Prompt</span>
                    <textarea
                      value={selected.systemPrompt}
                      onChange={(event) =>
                        update({ systemPrompt: event.target.value })
                      }
                      placeholder="可选：定义角色、约束和输出要求"
                    />
                  </label>
                  <label className="wide">
                    <span>
                      {kind === "prompt" ? "User Prompt" : "创作提示词"}
                    </span>
                    <textarea
                      value={selected.userPrompt}
                      onChange={(event) =>
                        update({ userPrompt: event.target.value })
                      }
                      placeholder="使用 {{变量名}} 插入可填写变量"
                    />
                  </label>
                  {kind === "media-prompt" && selected.media && (
                    <label className="wide">
                      <span>负面提示词</span>
                      <textarea
                        value={selected.media.negativePrompt}
                        onChange={(event) =>
                          update({
                            media: {
                              ...selected.media!,
                              negativePrompt: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  )}
                </div>
                <section className="variable-panel">
                  <div className="panel-title">
                    <b>变量</b>
                    <span>{selected.variables.length} 个</span>
                    <button
                      disabled={!selected.variables.length}
                      onClick={() => void fillFromClipboard()}
                    >
                      从剪贴板填入
                    </button>
                  </div>
                  {selected.variables.length ? (
                    <div className="variable-grid">
                      {selected.variables.map((variable) => (
                        <label key={variable.name}>
                          <span>{variable.name}</span>
                          <select
                            value={variable.type ?? "text"}
                            onChange={(event) =>
                              update({
                                variables: selected.variables.map((item) =>
                                  item.name === variable.name
                                    ? {
                                        ...item,
                                        type: event.target.value as NonNullable<
                                          typeof item.type
                                        >,
                                      }
                                    : item,
                                ),
                              })
                            }
                          >
                            <option value="text">文本</option>
                            <option value="number">数字</option>
                            <option value="select">单选</option>
                            <option value="multiselect">多选</option>
                            <option value="file">文件</option>
                            <option value="image">图片</option>
                            <option value="project-file">项目文件</option>
                          </select>
                          {(variable.type === "select" ||
                            variable.type === "multiselect") && (
                            <input
                              value={(variable.options ?? []).join(", ")}
                              placeholder="选项，以逗号分隔"
                              onChange={(event) =>
                                update({
                                  variables: selected.variables.map((item) =>
                                    item.name === variable.name
                                      ? {
                                          ...item,
                                          options: event.target.value
                                            .split(/[,，]/)
                                            .map((value) => value.trim())
                                            .filter(Boolean),
                                        }
                                      : item,
                                  ),
                                })
                              }
                            />
                          )}
                          {variable.type === "select" ||
                          variable.type === "multiselect" ? (
                            <select
                              multiple={variable.type === "multiselect"}
                              value={
                                variable.type === "multiselect"
                                  ? variable.value.split(",").filter(Boolean)
                                  : variable.value
                              }
                              onChange={(event) => {
                                const value =
                                  variable.type === "multiselect"
                                    ? [...event.currentTarget.selectedOptions]
                                        .map((option) => option.value)
                                        .join(",")
                                    : event.target.value;
                                update({
                                  variables: selected.variables.map((item) =>
                                    item.name === variable.name
                                      ? { ...item, value }
                                      : item,
                                  ),
                                });
                              }}
                            >
                              <option value="">选择…</option>
                              {(variable.options ?? []).map((option) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          ) : variable.type === "number" ? (
                            <input
                              type="number"
                              value={variable.value}
                              onChange={(event) =>
                                update({
                                  variables: selected.variables.map((item) =>
                                    item.name === variable.name
                                      ? { ...item, value: event.target.value }
                                      : item,
                                  ),
                                })
                              }
                            />
                          ) : variable.type === "file" ||
                            variable.type === "image" ||
                            variable.type === "project-file" ? (
                            <>
                              <input
                                type="file"
                                accept={
                                  variable.type === "image"
                                    ? "image/*"
                                    : undefined
                                }
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    const value =
                                      variable.type === "image"
                                        ? `[图片附件：${file.name}]`
                                        : String(reader.result ?? "");
                                    update({
                                      variables: selected.variables.map(
                                        (item) =>
                                          item.name === variable.name
                                            ? { ...item, value }
                                            : item,
                                      ),
                                      ...(variable.type === "image"
                                        ? {
                                            attachments: [
                                              ...(selected.attachments ?? []),
                                              {
                                                id: crypto.randomUUID(),
                                                name: file.name,
                                                type: file.type,
                                                dataUrl: String(
                                                  reader.result ?? "",
                                                ),
                                              },
                                            ],
                                          }
                                        : {}),
                                    });
                                  };
                                  if (variable.type === "image")
                                    reader.readAsDataURL(file);
                                  else reader.readAsText(file);
                                }}
                              />
                              <textarea
                                value={variable.value}
                                onChange={(event) =>
                                  update({
                                    variables: selected.variables.map((item) =>
                                      item.name === variable.name
                                        ? { ...item, value: event.target.value }
                                        : item,
                                    ),
                                  })
                                }
                              />
                            </>
                          ) : (
                            <textarea
                              value={variable.value}
                              onChange={(event) =>
                                update({
                                  variables: selected.variables.map((item) =>
                                    item.name === variable.name
                                      ? { ...item, value: event.target.value }
                                      : item,
                                  ),
                                })
                              }
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p>
                      在提示词中输入 <code>{"{{变量名}}"}</code> 即可创建变量。
                    </p>
                  )}
                </section>
                <section className="variable-panel">
                  <div className="panel-title">
                    <b>数据权限</b>
                    <span>运行前需按所选模型确认发送范围</span>
                  </div>
                  <div className="asset-permissions">
                    {(["fileAccess", "network", "ai"] as const).map((key) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={Boolean(selected.permissions?.[key])}
                          onChange={(event) =>
                            update({
                              permissions: {
                                fileAccess: false,
                                network: false,
                                ai: false,
                                ...selected.permissions,
                                [key]: event.target.checked,
                              },
                            })
                          }
                        />
                        {key === "fileAccess"
                          ? "读取文件"
                          : key === "network"
                            ? "访问网络"
                            : "向 AI 发送内容"}
                      </label>
                    ))}
                  </div>
                </section>
                <section className="variable-panel">
                  <div className="panel-title">
                    <b>附件</b>
                    <button
                      onClick={() =>
                        document.getElementById("asset-attachments")?.click()
                      }
                    >
                      添加附件
                    </button>
                    <input
                      id="asset-attachments"
                      hidden
                      type="file"
                      multiple
                      onChange={(event) => {
                        const files = [...(event.target.files ?? [])];
                        void Promise.all(
                          files.map(
                            (file) =>
                              new Promise<
                                NonNullable<SmartAsset["attachments"]>[number]
                              >((resolve) => {
                                const reader = new FileReader();
                                reader.onload = () =>
                                  resolve({
                                    id: crypto.randomUUID(),
                                    name: file.name,
                                    type: file.type,
                                    dataUrl: String(reader.result ?? ""),
                                  });
                                reader.readAsDataURL(file);
                              }),
                          ),
                        ).then((items) =>
                          update({
                            attachments: [
                              ...(selected.attachments ?? []),
                              ...items,
                            ],
                          }),
                        );
                        event.currentTarget.value = "";
                      }}
                    />
                  </div>
                  {selected.attachments?.length ? (
                    selected.attachments.map((item) => (
                      <div className="asset-attachment" key={item.id}>
                        {item.dataUrl ? (
                          <a href={item.dataUrl} download={item.name}>
                            {item.name}
                          </a>
                        ) : (
                          <span>
                            {item.name} · {item.type || "文件"}
                          </span>
                        )}
                        <button
                          onClick={() =>
                            update({
                              attachments: selected.attachments?.filter(
                                (value) => value.id !== item.id,
                              ),
                            })
                          }
                        >
                          移除
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>尚无附件</p>
                  )}
                </section>
                <section className="variable-panel">
                  <div className="panel-title">
                    <b>版本记录</b>
                    <span>{selected.revisions?.length ?? 0} 条</span>
                  </div>
                  {selected.revisions?.length ? (
                    [...selected.revisions].reverse().map((revision) => (
                      <div
                        className="asset-attachment"
                        key={`${revision.version}-${revision.createdAt}`}
                      >
                        <span>
                          v{revision.version} · {revision.note} ·{" "}
                          {new Date(revision.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p>点击“保存版本”记录当前内容。</p>
                  )}
                  <div className="panel-title">
                    <b>运行记录</b>
                    <span>{selected.runs?.length ?? 0} 条</span>
                    <button
                      disabled={!selected.runs?.length}
                      onClick={() => update({ runs: [] })}
                    >
                      清除记录
                    </button>
                  </div>
                  <label className="sensitive-run">
                    <input
                      type="checkbox"
                      checked={sensitiveRun}
                      onChange={(event) =>
                        setSensitiveRun(event.target.checked)
                      }
                    />
                    本次结果含敏感信息：丢弃而不保存
                  </label>
                  <button
                    className="asset-run-save"
                    onClick={() => void saveExternalRun()}
                  >
                    保存外部生成结果
                  </button>
                  {selected.runs?.length ? (
                    selected.runs.map((run) => (
                      <details className="asset-run-entry" key={run.id}>
                        <summary>
                          {new Date(run.createdAt).toLocaleString()} ·{" "}
                          {run.model} · {run.durationMs} ms ·{" "}
                          {run.tokens ?? "Token 未知"}
                        </summary>
                        <b>输入变量</b>
                        <pre>{JSON.stringify(run.input, null, 2)}</pre>
                        <b>输出</b>
                        <pre>{run.output || "（空结果）"}</pre>
                        <button
                          className="asset-run-save"
                          onClick={() => deriveFromRun(run.id)}
                        >
                          从此结果派生资产
                        </button>
                        <label className="run-compare">
                          <input
                            type="checkbox"
                            checked={comparisonRunIds.includes(run.id)}
                            onChange={() =>
                              setComparisonRunIds((current) =>
                                current.includes(run.id)
                                  ? current.filter((id) => id !== run.id)
                                  : current.length === 2
                                    ? [current[1], run.id]
                                    : [...current, run.id],
                              )
                            }
                          />
                          加入双结果对比
                        </label>
                      </details>
                    ))
                  ) : (
                    <p>此版本尚无运行记录。</p>
                  )}
                  {comparisonRunIds.length === 2 && selected.runs && (
                    <div className="asset-run-compare">
                      {comparisonRunIds
                        .map((id) =>
                          selected.runs?.find((run) => run.id === id),
                        )
                        .filter((run): run is NonNullable<typeof run> =>
                          Boolean(run),
                        )
                        .map((run) => (
                          <article key={run.id}>
                            <b>
                              {run.model} · {run.tokens ?? "Token 未知"}
                            </b>
                            <pre>{run.output}</pre>
                          </article>
                        ))}
                    </div>
                  )}
                  {latestRevision && (
                    <details className="asset-diff">
                      <summary>
                        与最近保存版本 v{latestRevision.version} 对比（
                        {changedFields.length} 个字段有变化）
                      </summary>
                      {changedFields.length ? (
                        changedFields.map((field) => (
                          <div key={field}>
                            <b>{field}</b>
                            <pre>
                              保存版本：
                              {JSON.stringify(
                                latestRevision.snapshot[field],
                                null,
                                2,
                              )?.slice(0, 900) ?? ""}
                              {"\n当前版本："}
                              {JSON.stringify(selected[field], null, 2)?.slice(
                                0,
                                900,
                              ) ?? ""}
                            </pre>
                          </div>
                        ))
                      ) : (
                        <p>当前内容与最近版本一致。</p>
                      )}
                    </details>
                  )}
                </section>
                <section className="prompt-preview">
                  <div className="panel-title">
                    <b>最终预览</b>
                    <button onClick={() => void copyRendered()}>
                      复制最终提示词
                    </button>
                  </div>
                  {rendered?.systemPrompt && (
                    <>
                      <span>System</span>
                      <pre>{rendered.systemPrompt}</pre>
                    </>
                  )}
                  <span>Prompt</span>
                  <pre>{rendered?.userPrompt || "等待输入提示词…"}</pre>
                  {rendered?.negativePrompt && (
                    <>
                      <span>Negative</span>
                      <pre>{rendered.negativePrompt}</pre>
                    </>
                  )}
                </section>
              </>
            ) : (
              <div className="asset-empty editor-empty">
                选择或新建一个资产开始编辑
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
