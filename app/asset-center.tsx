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
  syncAssetVariables,
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
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [desktopStorageReady, setDesktopStorageReady] = useState(
    !window.fdeDesktop,
  );
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify(assets));
    if (desktopStorageReady) {
      void window.fdeDesktop?.saveSmartAssets(assets).catch((error) =>
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
    () => assets.filter((asset) => asset.kind === kind && !asset.archived),
    [assets, kind],
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
  const visible = useMemo(
    () =>
      kindAssets.filter((asset) => {
        if (filter === "收藏" && !asset.favorite) return false;
        if (filter !== "全部" && filter !== "收藏" && asset.category !== filter)
          return false;
        const term = query.trim().toLocaleLowerCase();
        return (
          !term ||
          [asset.name, asset.description, asset.category, ...asset.tags]
            .join(" ")
            .toLocaleLowerCase()
            .includes(term)
        );
      }),
    [filter, kindAssets, query],
  );
  const selected = assets.find(
    (asset) => asset.id === selectedId && asset.kind === kind,
  );
  const rendered = selected ? renderAsset(selected) : null;

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

  async function importAssets(file?: File) {
    if (!file) return;
    try {
      const incoming = parseAssetBundle(await file.text());
      setAssets((current) => mergeAssets(current, incoming));
      setMessage(`已导入 ${incoming.length} 项资产`);
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
          <button onClick={exportAssets} title="导出资产">
            ⇩
          </button>
          <button onClick={() => importRef.current?.click()} title="导入资产">
            ⇧
          </button>
          <input
            ref={importRef}
            hidden
            type="file"
            accept="application/json,.json"
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
                {filter} · {visible.length}
              </b>
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
                  <i>{asset.favorite ? "★" : ""}</i>
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
                  </div>
                  <button
                    className={selected.favorite ? "favorite-active" : ""}
                    onClick={() => update({ favorite: !selected.favorite })}
                  >
                    ★
                  </button>
                  <button onClick={duplicateAsset}>创建副本</button>
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
                  </div>
                  {selected.variables.length ? (
                    <div className="variable-grid">
                      {selected.variables.map((variable) => (
                        <label key={variable.name}>
                          <span>{variable.name}</span>
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
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p>
                      在提示词中输入 <code>{"{{变量名}}"}</code> 即可创建变量。
                    </p>
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
