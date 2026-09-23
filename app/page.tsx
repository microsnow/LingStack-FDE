"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { nextRecentTools, sensitiveToolIds } from "../lib/tool-policy";
import { FdeNavigation, type FdeModule } from "./fde-navigation";
import { categories, tools } from "../lib/tool-catalog";
import type { ToolCapability } from "../lib/tool-catalog";
import { toolSamples as samples } from "../lib/tool-samples";
import { runTool as executeTool } from "../lib/tool-runner";
import { formatToolError } from "../lib/tool-errors";
import type { OpenFilePayload } from "./desktop";

const capabilityPresentation: Record<ToolCapability, { label: string; detail: string }> = {
  local: { label: "● 本地安全处理", detail: "输入与结果只在本机处理。" },
  network: { label: "● 需要联网", detail: "执行时可能向外部服务发送输入；发送前必须说明数据去向。" },
  ai: { label: "● AI 能力", detail: "执行时可能向所选模型发送输入；发送前必须说明模型和数据范围。" },
};

const icons = ["◈", "★", "◷", "⇄", "✓", "T", "⌯", "∿", "◇", "⎔", "✦"];

export default function Home({
  onNavigate,
  initialFile,
}: { onNavigate?: (module: FdeModule) => void; initialFile?: (OpenFilePayload & { requestId: number }) | null } = {}) {
  const [active, setActive] = useState("json"),
    [category, setCategory] = useState("全部工具"),
    [query, setQuery] = useState(""),
    [input, setInput] = useState(samples.json),
    [output, setOutput] = useState(""),
    [error, setError] = useState(""),
    [theme, setTheme] = useState("dark"),
    [copied, setCopied] = useState(false),
    [favorites, setFavorites] = useState<string[]>([]),
    [recent, setRecent] = useState<string[]>([]),
    [ready, setReady] = useState(false);
  const [passwordLength, setPasswordLength] = useState(16),
    [passwordCount, setPasswordCount] = useState(5),
    [passwordGroups, setPasswordGroups] = useState({
      numbers: true,
      lower: true,
      upper: true,
      symbols: true,
    });
  const [tabs, setTabs] = useState<string[]>(["json"]),
    [autoRun, setAutoRun] = useState(false),
    [mobileNav, setMobileNav] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null),
    fileRef = useRef<HTMLInputElement>(null);
  const current = tools.find((t) => t.id === active) ?? tools[0];
  const currentCapability = capabilityPresentation[current.capability];
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const f = localStorage.getItem("devkit-favorites"),
          r = localStorage.getItem("devkit-recent"),
          th = localStorage.getItem("devkit-theme");
        if (f) setFavorites(JSON.parse(f));
        if (r) setRecent(JSON.parse(r));
        if (th) setTheme(th);
      } finally {
        setReady(true);
      }
    });
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (ready) localStorage.setItem("devkit-theme", theme);
  }, [theme, ready]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runTool();
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });
  const visible = useMemo(
    () =>
      tools
        .filter((t) => {
          const matches = (t.name + t.desc + t.category)
            .toLowerCase()
            .includes(query.toLowerCase());
          if (!matches) return false;
          if (category === "常用收藏") return favorites.includes(t.id);
          if (category === "最近使用") return recent.includes(t.id);
          if (category !== "全部工具") return t.category === category;
          return true;
        })
        .sort((a, b) =>
          category === "最近使用"
            ? recent.indexOf(a.id) - recent.indexOf(b.id)
            : 0,
        ),
    [query, category, favorites, recent],
  );
  function selectTool(id: string) {
    setActive(id);
    setTabs((value) => (value.includes(id) ? value : [...value, id].slice(-6)));
    setInput(samples[id] ?? "");
    setOutput("");
    setError("");
    setMobileNav(false);
    if (!sensitiveToolIds.has(id)) {
      const next = nextRecentTools(recent, id);
      setRecent(next);
      localStorage.setItem("devkit-recent", JSON.stringify(next));
    }
  }
  useEffect(() => {
    if (!initialFile) return;
    queueMicrotask(() => {
      if (initialFile.error) {
        setError(initialFile.error);
        setOutput("");
        return;
      }
      const extension = initialFile.name?.split(".").at(-1)?.toLowerCase();
      const suggestedTool: Record<string, string> = {
        json: "json", md: "markdown", csv: "csvpreview", xml: "xmlformat", yaml: "yamlformat", yml: "yamlformat",
      };
      const toolId = extension ? suggestedTool[extension] : undefined;
      if (toolId && tools.some((tool) => tool.id === toolId)) {
        setActive(toolId);
        setTabs((current) => current.includes(toolId) ? current : [...current, toolId].slice(-6));
      }
      setInput(initialFile.text ?? "");
      setOutput("");
      setError("");
    });
  }, [initialFile]);
  function toggleFavorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((x) => x !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("devkit-favorites", JSON.stringify(next));
  }
  async function runTool(action = "primary") {
    try {
      setError("");
      const result = await executeTool(active, input, action, {
        passwordLength,
        passwordCount,
        passwordGroups,
      });
      setOutput(result);
    } catch (error) {
      setOutput("");
      setError(formatToolError(error));
    }
  }
  async function copyOutput() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }
  function swapValues() {
    if (!output) return;
    setInput(output);
    setOutput(input);
    setError("");
  }
  function downloadOutput() {
    if (!output) return;
    const extensions: Record<string, string> = {
      json2csv: "csv",
      csvpreview: "md",
      json2xml: "xml",
      xmlformat: "xml",
      yaml2json: "json",
      csv2json: "json",
      propertiesyaml: "yaml",
      markdown: "html",
    };
    const extension = extensions[active] ?? "txt",
      url = URL.createObjectURL(
        new Blob([output], { type: "text/plain;charset=utf-8" }),
      );
    const link = document.createElement("a");
    link.href = url;
    link.download = `devkit-${active}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function loadFile(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("文件不能超过 5 MB");
      return;
    }
    setInput(await file.text());
    setOutput("");
    setError("");
  }
  function closeTab(id: string) {
    const next = tabs.filter((tab) => tab !== id);
    setTabs(next.length ? next : ["json"]);
    if (id === active) selectTool(next.at(-1) ?? "json");
  }
  // runTool intentionally uses the latest render values; the timer is recreated when inputs change.
  useEffect(() => {
    if (!autoRun) return;
    const timer = setTimeout(() => void runTool(), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, active, autoRun]);
  useEffect(
    () =>
      window.fdeDesktop?.onClipboardInput((value) => {
        setInput(value);
        setOutput("");
        setError("");
      }),
    [],
  );
  async function loadClipboard() {
    const value = await window.fdeDesktop?.readClipboardText();
    if (value !== undefined) {
      setInput(value);
      setOutput("");
      setError("");
    }
  }
  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="mobile-menu"
          onClick={() => setMobileNav(!mobileNav)}
          aria-label="打开分类导航"
          aria-expanded={mobileNav}
        >
          ☰
        </button>
        <div className="brand">
          <span className="brand-mark">F_</span>
          <div>
            <strong>灵栈</strong>
            <small>FDE · DevKit 工具中心</small>
          </div>
        </div>
        {onNavigate && <FdeNavigation active="devkit" onChange={onNavigate} />}
        <label className="search">
          <span>⌕</span>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`搜索 ${tools.length} 个工具...`}
          />
          <kbd>Ctrl K</kbd>
        </label>
        <div className="top-actions">
          <span className="local">
            <i />
            {window.fdeDesktop ? "桌面本地处理" : "浏览器本地处理"}
          </span>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="切换主题"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <nav>
          {categories.map((c, i) => (
            <button
              onClick={() => {
                setCategory(c);
                setMobileNav(false);
              }}
              className={category === c ? "selected" : ""}
              key={c}
            >
              <span>{icons[i]}</span>
              {c}
              <em>
                {c === "常用收藏"
                  ? favorites.length
                  : c === "最近使用"
                    ? recent.length
                    : ""}
              </em>
            </button>
          ))}
        </nav>
        <div className="privacy">
          <span>◉</span>
          <div>
            <b>隐私优先</b>
            <p>本地工具不会上传输入；联网与 AI 工具会单独标识。</p>
          </div>
        </div>
        <div className="version">
          <span>DevKit v0.4.0</span>
          <span className="status-dot" />
          运行正常
        </div>
      </aside>
      <section className="content">
        <div className="welcome">
          <div>
            <p className="eyebrow">DEVKIT V0.4 · LOCAL FIRST</p>
            <h1>今天想解决什么问题？</h1>
            <p>选择工具，输入数据，立即得到结果。</p>
          </div>
          <div className="pulse">
            <i />
            <span>{tools.length}</span>
            <small>已上线工具</small>
          </div>
        </div>
        <div className="section-title">
          <h2>
            {query
              ? `搜索结果 · ${visible.length}`
              : `${category} · ${visible.length}`}
          </h2>
          <span>收藏与最近使用仅保存在本机</span>
        </div>
        {visible.length ? (
          <div className="tool-grid">
            {visible.map((t) => (
              <div
                key={t.id}
                className={`tool-card ${active === t.id ? "active" : ""}`}
                onClick={() => selectTool(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectTool(t.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <span className={`tool-icon ${t.color}`}>{t.icon}</span>
                <span>
                  <b>{t.name}</b>
                  <small>{t.desc}</small>
                </span>
                {(t.tag || t.capability !== "local") && (
                  <span className="tool-badges">
                    {t.tag && <em>{t.tag}</em>}
                    {t.capability !== "local" && (
                      <em className={`capability-tag ${t.capability}`}>
                        {capabilityPresentation[t.capability].label.replace("● ", "")}
                      </em>
                    )}
                  </span>
                )}
                <button
                  className={`favorite ${favorites.includes(t.id) ? "on" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(t.id);
                  }}
                  aria-label={`${favorites.includes(t.id) ? "取消收藏" : "收藏"}${t.name}`}
                >
                  ★
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <b>这里还是空的</b>
            <span>可以通过工具卡片右下角的星标加入收藏。</span>
          </div>
        )}
        <section className="workspace">
          <div className="tool-tabs" role="tablist">
            {tabs.map((id) => {
              const tool = tools.find((item) => item.id === id);
              return (
                <div className={id === active ? "active" : ""} key={id}>
                  <button
                    role="tab"
                    aria-selected={id === active}
                    onClick={() => selectTool(id)}
                  >
                    {tool?.name}
                  </button>
                  <button
                    onClick={() => closeTab(id)}
                    aria-label={`关闭${tool?.name}标签`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <div className="workspace-head">
            <div className={`tool-icon ${current.color}`}>{current.icon}</div>
            <div>
              <p>{current.category}</p>
              <h2>{current.name}</h2>
            </div>
            <label className="auto-run">
              <input
                type="checkbox"
                checked={autoRun}
                onChange={(e) => setAutoRun(e.target.checked)}
              />{" "}
              自动执行
            </label>
            <button
              className={`head-favorite ${favorites.includes(active) ? "on" : ""}`}
              onClick={() => toggleFavorite(active)}
            >
              ★ {favorites.includes(active) ? "已收藏" : "收藏"}
            </button>
            <span
              className={`secure ${current.capability}`}
              title={currentCapability.detail}
            >
              {currentCapability.label}
            </span>
          </div>
          {active === "password" ? (
            <div className="password-workspace">
              <div className="password-config">
                <label>
                  <span>密码长度</span>
                  <input
                    type="number"
                    min="4"
                    max="128"
                    value={passwordLength}
                    onChange={(e) =>
                      setPasswordLength(
                        Math.min(128, Math.max(4, Number(e.target.value) || 4)),
                      )
                    }
                  />
                </label>
                <label>
                  <span>生成数量</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={passwordCount}
                    onChange={(e) =>
                      setPasswordCount(
                        Math.min(50, Math.max(1, Number(e.target.value) || 1)),
                      )
                    }
                  />
                </label>
                <fieldset>
                  <legend>字符组成</legend>
                  {(
                    [
                      ["numbers", "数字 0–9"],
                      ["lower", "小写字母 a–z"],
                      ["upper", "大写字母 A–Z"],
                      ["symbols", "特殊符号"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={passwordGroups[key]}
                        onChange={(e) =>
                          setPasswordGroups({
                            ...passwordGroups,
                            [key]: e.target.checked,
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </fieldset>
                <p>
                  使用浏览器安全随机数生成；每个密码至少包含一个已选择类别的字符。
                </p>
              </div>
              <div className="editor password-output">
                <div className="editor-bar">
                  <b>生成结果</b>
                  <button onClick={copyOutput}>
                    {copied ? "已复制" : "复制全部"}
                  </button>
                </div>
                <textarea
                  value={error || output}
                  className={error ? "has-error" : ""}
                  readOnly
                  placeholder="点击下方按钮生成密码"
                />
              </div>
            </div>
          ) : (
            <div
              className="editors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void loadFile(e.dataTransfer.files[0]);
              }}
            >
              <div className="editor">
                <div className="editor-bar">
                  <b>输入</b>
                  <button onClick={() => fileRef.current?.click()}>文件</button>
                  {window.fdeDesktop && (
                    <button onClick={() => void loadClipboard()}>剪贴板</button>
                  )}
                  <button onClick={() => setInput(samples[active] ?? "")}>
                    示例
                  </button>
                  <button onClick={() => setInput("")}>清空</button>
                  <input
                    ref={fileRef}
                    type="file"
                    hidden
                    onChange={(e) => void loadFile(e.target.files?.[0])}
                  />
                </div>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  spellCheck={false}
                  aria-label={`${current.name}输入`}
                />
              </div>
              <button
                className="run"
                onClick={() => runTool()}
                aria-label="执行"
              >
                →
              </button>
              <div className="editor">
                <div className="editor-bar">
                  <b>输出</b>
                  <button onClick={copyOutput}>
                    {copied ? "已复制" : "复制"}
                  </button>
                </div>
                {active === "markdown" && output && !error ? (
                  <iframe
                    className="markdown-preview"
                    sandbox=""
                    srcDoc={output}
                    title="Markdown 实时预览"
                  />
                ) : (
                  <textarea
                    value={error || output}
                    className={error ? "has-error" : ""}
                    readOnly
                    placeholder="结果将显示在这里"
                    aria-live="polite"
                    aria-label={`${current.name}输出`}
                  />
                )}
              </div>
            </div>
          )}
          <div className="workspace-actions">
            <button className="primary" onClick={() => runTool()}>
              执行转换 <kbd>Ctrl ↵</kbd>
            </button>
            <button onClick={swapValues} disabled={!output}>
              交换输入输出
            </button>
            <button onClick={downloadOutput} disabled={!output}>
              下载结果
            </button>
            {active === "json" && (
              <button onClick={() => runTool("minify")}>压缩 JSON</button>
            )}
            {[
              "base64",
              "url",
              "unicode",
              "entities",
              "ascii",
              "escape",
            ].includes(active) && (
              <button onClick={() => runTool("decode")}>
                {active === "ascii"
                  ? "ASCII → 字符"
                  : active === "escape"
                    ? "去除转义符"
                    : "解码"}
              </button>
            )}
            {active === "chinese" && (
              <>
                <button onClick={() => runTool()}>简体 → 繁体</button>
                <button onClick={() => runTool("simplified")}>
                  繁体 → 简体
                </button>
              </>
            )}
            {active === "case" && (
              <>
                <button onClick={() => runTool()}>小写 → 大写</button>
                <button onClick={() => runTool("lower")}>大写 → 小写</button>
              </>
            )}
            {active === "color" && (
              <>
                <button onClick={() => runTool("rgb")}>HEX → RGB</button>
                <button onClick={() => runTool("hex")}>RGB → HEX</button>
              </>
            )}
            {active === "cron" && (
              <>
                <button onClick={() => runTool()}>Linux</button>
                <button onClick={() => runTool("spring")}>Java (Spring)</button>
                <button onClick={() => runTool("quartz")}>Java (Quartz)</button>
              </>
            )}
            {active === "units" && (
              <button onClick={() => runTool("decode")}>rem 转 px</button>
            )}
            {active === "sortlines" && (
              <button onClick={() => runTool("desc")}>降序排序</button>
            )}
            {active === "hash" && (
              <>
                <button onClick={() => runTool("sha1")}>SHA-1</button>
                <button onClick={() => runTool("sha512")}>SHA-512</button>
              </>
            )}
            {active === "webformat" && (
              <>
                <button onClick={() => runTool("html")}>格式化 HTML</button>
                <button onClick={() => runTool("css")}>格式化 CSS</button>
                <button onClick={() => runTool("javascript")}>
                  格式化 JavaScript
                </button>
              </>
            )}
            {active === "propertiesyaml" && (
              <button onClick={() => runTool("properties")}>
                YAML → Properties
              </button>
            )}
            {active === "text" && (
              <>
                <button onClick={() => runTool("upper")}>大写</button>
                <button onClick={() => runTool("lower")}>小写</button>
                <button onClick={() => runTool("unique")}>去重复行</button>
                <button onClick={() => runTool("remove-empty")}>
                  去除空行
                </button>
                <button onClick={() => runTool("trim-start")}>
                  去除行首空格/Tab
                </button>
                <button onClick={() => runTool("trim-end")}>
                  去除行尾空格/Tab
                </button>
                <button onClick={() => runTool("sort-asc")}>升序</button>
                <button onClick={() => runTool("sort-desc")}>降序</button>
              </>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
