"use client";

import { useEffect, useMemo, useState } from "react";

type Tool = { id: string; name: string; desc: string; icon: string; color: string; tag?: string };

const tools: Tool[] = [
  { id: "json", name: "JSON 格式化", desc: "格式化、压缩与语法校验", icon: "{ }", color: "cyan" },
  { id: "base64", name: "Base64 转换", desc: "文本的 Base64 编码解码", icon: "B64", color: "blue" },
  { id: "url", name: "URL 编解码", desc: "URL 和参数安全转换", icon: "%", color: "green" },
  { id: "timestamp", name: "时间戳转换", desc: "Unix 时间戳与日期互转", icon: "◷", color: "orange", tag: "热门" },
  { id: "hash", name: "Hash 计算", desc: "SHA-1 / SHA-256 / SHA-512", icon: "#", color: "purple" },
  { id: "uuid", name: "UUID 生成器", desc: "批量生成 UUID v4", icon: "ID", color: "pink" },
  { id: "text", name: "文本工具", desc: "统计、清理与大小写转换", icon: "Aa", color: "yellow" },
  { id: "jwt", name: "JWT 解析", desc: "本地解析 Header 与 Payload", icon: "JWT", color: "red" },
];

const categories = ["全部工具", "常用收藏", "编码转换", "格式校验", "文本处理", "加密安全", "Web 与网络", "前端工具", "后端工具", "文件媒体", "数据生成", "开发速查"];

function encodeBase64(value: string) { return btoa(unescape(encodeURIComponent(value))); }
function decodeBase64(value: string) { return decodeURIComponent(escape(atob(value.trim()))); }

export default function Home() {
  const [active, setActive] = useState("json");
  const [query, setQuery] = useState("");
  const [input, setInput] = useState('{"project":"DevKit","ready":true,"tools":["JSON","Base64","UUID"]}');
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState("dark");
  const [copied, setCopied] = useState(false);

  const current = tools.find(t => t.id === active) ?? tools[0];
  const visible = useMemo(() => tools.filter(t => (t.name + t.desc).toLowerCase().includes(query.toLowerCase())), [query]);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { runTool(); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectTool(id: string) {
    setActive(id); setError(""); setOutput("");
    const samples: Record<string, string> = {
      json: '{"project":"DevKit","ready":true,"tools":["JSON","Base64","UUID"]}', base64: "开发者工具箱",
      url: "https://example.com/search?q=开发者工具", timestamp: String(Math.floor(Date.now()/1000)), hash: "Hello DevKit",
      uuid: "5", text: "Hello DevKit\n这是一段测试文本。", jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiRGV2S2l0IiwiaWF0IjoxNTE2MjM5MDIyfQ.signature"
    };
    setInput(samples[id] ?? "");
  }

  async function runTool(action = "primary") {
    try {
      setError(""); let result = "";
      if (active === "json") result = action === "minify" ? JSON.stringify(JSON.parse(input)) : JSON.stringify(JSON.parse(input), null, 2);
      else if (active === "base64") result = action === "decode" ? decodeBase64(input) : encodeBase64(input);
      else if (active === "url") result = action === "decode" ? decodeURIComponent(input) : encodeURIComponent(input);
      else if (active === "timestamp") {
        const n = Number(input); result = Number.isFinite(n) ? new Date(input.length <= 10 ? n * 1000 : n).toLocaleString("zh-CN", { hour12: false }) : String(Math.floor(new Date(input).getTime()/1000));
      } else if (active === "hash") {
        const data = new TextEncoder().encode(input); const digest = await crypto.subtle.digest("SHA-256", data); result = [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
      } else if (active === "uuid") result = Array.from({length: Math.min(Math.max(Number(input)||1,1),100)}, () => crypto.randomUUID()).join("\n");
      else if (active === "text") {
        if (action === "upper") result = input.toUpperCase(); else if (action === "lower") result = input.toLowerCase(); else result = `字符数：${input.length}\n单词数：${input.trim() ? input.trim().split(/\s+/).length : 0}\n行数：${input.split(/\r?\n/).length}`;
      } else if (active === "jwt") {
        const [h,p] = input.split("."); const parse=(s:string)=>JSON.parse(decodeBase64(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"="))); result = JSON.stringify({ header: parse(h), payload: parse(p) }, null, 2);
      }
      setOutput(result);
    } catch (e) { setOutput(""); setError(e instanceof Error ? e.message : "处理失败，请检查输入。"); }
  }

  async function copyOutput() { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(()=>setCopied(false), 1400); }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">D_</span><div><strong>DevKit</strong><small>开发者工具箱</small></div></div>
      <label className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索工具、命令或功能..."/><kbd>Ctrl K</kbd></label>
      <div className="top-actions"><span className="local"><i/>本地处理</span><button onClick={()=>setTheme(theme === "dark" ? "light" : "dark")} aria-label="切换主题">{theme === "dark" ? "☀" : "☾"}</button><button aria-label="设置">⚙</button></div>
    </header>
    <aside className="sidebar">
      <nav>{categories.map((c,i)=><button className={i===0 ? "selected" : ""} key={c}><span>{["◈","★","⇄","✓","T","⌯","∿","◇","⎔","▣","✦","☷"][i]}</span>{c}{i>5 && <em>即将上线</em>}</button>)}</nav>
      <div className="privacy"><span>◉</span><div><b>隐私优先</b><p>数据仅在您的浏览器中处理，不会上传。</p></div></div>
      <div className="version"><span>DevKit v0.1.0</span><span className="status-dot"/>运行正常</div>
    </aside>
    <section className="content">
      <div className="welcome"><div><p className="eyebrow">GOOD {new Date().getHours() < 12 ? "MORNING" : "AFTERNOON"}</p><h1>今天想解决什么问题？</h1><p>挑选一个工具，所有计算都在本地完成。</p></div><div className="pulse"><i/><span>8</span><small>已上线工具</small></div></div>
      <div className="section-title"><h2>{query ? `搜索结果 · ${visible.length}` : "常用工具"}</h2><span>按使用频率排序</span></div>
      <div className="tool-grid">{visible.map(t=><button key={t.id} className={`tool-card ${active===t.id ? "active" : ""}`} onClick={()=>selectTool(t.id)}><span className={`tool-icon ${t.color}`}>{t.icon}</span><span><b>{t.name}</b><small>{t.desc}</small></span>{t.tag && <em>{t.tag}</em>}<i className="arrow">↗</i></button>)}</div>
      <section className="workspace">
        <div className="workspace-head"><div className={`tool-icon ${current.color}`}>{current.icon}</div><div><p>当前工具</p><h2>{current.name}</h2></div><span className="secure">● 本地安全处理</span></div>
        <div className="editors">
          <div className="editor"><div className="editor-bar"><b>输入</b><button onClick={()=>setInput("")}>清空</button></div><textarea value={input} onChange={e=>setInput(e.target.value)} spellCheck={false}/></div>
          <button className="run" onClick={()=>runTool()} aria-label="执行">→</button>
          <div className="editor"><div className="editor-bar"><b>输出</b><button onClick={copyOutput}>{copied ? "已复制" : "复制"}</button></div><textarea value={error || output} className={error ? "has-error" : ""} readOnly placeholder="结果将显示在这里"/></div>
        </div>
        <div className="workspace-actions">
          <button className="primary" onClick={()=>runTool()}>执行转换 <kbd>Ctrl ↵</kbd></button>
          {active === "json" && <button onClick={()=>runTool("minify")}>压缩 JSON</button>}
          {(active === "base64" || active === "url") && <button onClick={()=>runTool("decode")}>解码</button>}
          {active === "text" && <><button onClick={()=>runTool("upper")}>大写</button><button onClick={()=>runTool("lower")}>小写</button></>}
        </div>
      </section>
    </section>
  </main>;
}
