"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Category = "编码转换" | "格式校验" | "文本处理" | "加密安全" | "Web 与网络" | "前端工具" | "数据生成";
type Tool = { id: string; name: string; desc: string; icon: string; color: string; category: Category; tag?: string };

const tools: Tool[] = [
  { id:"json",name:"JSON 格式化",desc:"格式化、压缩与语法校验",icon:"{ }",color:"cyan",category:"格式校验" },
  { id:"base64",name:"Base64 转换",desc:"文本的 Base64 编码解码",icon:"B64",color:"blue",category:"编码转换" },
  { id:"url",name:"URL 编解码",desc:"URL 和参数安全转换",icon:"%",color:"green",category:"编码转换" },
  { id:"unicode",name:"Unicode 转换",desc:"中文与 Unicode 互转",icon:"U+",color:"blue",category:"编码转换",tag:"新" },
  { id:"timestamp",name:"时间戳转换",desc:"Unix 秒/毫秒与日期互转",icon:"◷",color:"orange",category:"编码转换",tag:"热门" },
  { id:"radix",name:"进制转换",desc:"2、8、10、16 进制同时转换",icon:"01",color:"green",category:"编码转换",tag:"新" },
  { id:"hash",name:"Hash 计算",desc:"SHA-1 / SHA-256 / SHA-512",icon:"#",color:"purple",category:"加密安全" },
  { id:"uuid",name:"UUID 生成器",desc:"批量生成 UUID v4",icon:"ID",color:"pink",category:"数据生成" },
  { id:"password",name:"密码生成器",desc:"安全随机密码批量生成",icon:"***",color:"red",category:"数据生成",tag:"新" },
  { id:"text",name:"文本工具",desc:"统计、清理与大小写转换",icon:"Aa",color:"yellow",category:"文本处理" },
  { id:"regex",name:"正则测试",desc:"实时检查匹配结果",icon:".*",color:"orange",category:"格式校验",tag:"新" },
  { id:"jwt",name:"JWT 解析",desc:"本地解析 Header 与 Payload",icon:"JWT",color:"red",category:"加密安全" },
  { id:"json2ts",name:"JSON 转 TypeScript",desc:"自动推断对象类型",icon:"TS",color:"blue",category:"格式校验",tag:"新" },
  { id:"query",name:"URL 参数解析",desc:"解析 Query 参数为 JSON",icon:"?=",color:"cyan",category:"Web 与网络",tag:"新" },
  { id:"color",name:"颜色转换",desc:"HEX 与 RGB 快速互转",icon:"◐",color:"pink",category:"前端工具",tag:"新" },
  { id:"markdown",name:"Markdown 预览",desc:"快速转换为 HTML",icon:"MD",color:"purple",category:"格式校验",tag:"新" },
];

const categories = ["全部工具", "常用收藏", "最近使用", "编码转换", "格式校验", "文本处理", "加密安全", "Web 与网络", "前端工具", "数据生成"];
const icons = ["◈","★","◷","⇄","✓","T","⌯","∿","◇","✦"];

function encodeBase64(v:string){return btoa(unescape(encodeURIComponent(v)))}
function decodeBase64(v:string){return decodeURIComponent(escape(atob(v.trim())))}
function inferType(v:unknown):string { if(Array.isArray(v)) return `${v.length ? inferType(v[0]) : "unknown"}[]`; if(v===null)return "null"; if(typeof v==="object") return `{ ${Object.entries(v as Record<string,unknown>).map(([k,x])=>`${k}: ${inferType(x)}`).join("; ")} }`; return typeof v; }
function markdown(v:string){return v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/^### (.*)$/gm,"<h3>$1</h3>").replace(/^## (.*)$/gm,"<h2>$1</h2>").replace(/^# (.*)$/gm,"<h1>$1</h1>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>").replace(/^[-*] (.*)$/gm,"<li>$1</li>").replace(/\n/g,"<br>")}

const samples:Record<string,string>={json:'{"project":"DevKit","ready":true,"tools":["JSON","Base64","UUID"]}',base64:"开发者工具箱",url:"https://example.com/search?q=开发者工具",unicode:"你好，DevKit",timestamp:String(Math.floor(Date.now()/1000)),radix:"255",hash:"Hello DevKit",uuid:"5",password:"16",text:"Hello DevKit\n这是一段测试文本。",regex:"/dev(kit)?/gi\nDevKit makes dev work easier.",jwt:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiRGV2S2l0IiwiaWF0IjoxNTE2MjM5MDIyfQ.signature",json2ts:'{"name":"DevKit","version":2,"ready":true}',query:"https://example.com/search?q=devkit&page=2",color:"#41e0c2",markdown:"# DevKit\n\n**私密、高效**的 `开发者工具箱`\n\n- 本地处理\n- 即开即用"};

export default function Home(){
  const [active,setActive]=useState("json"),[category,setCategory]=useState("全部工具"),[query,setQuery]=useState(""),[input,setInput]=useState(samples.json),[output,setOutput]=useState(""),[error,setError]=useState(""),[theme,setTheme]=useState("dark"),[copied,setCopied]=useState(false),[favorites,setFavorites]=useState<string[]>([]),[recent,setRecent]=useState<string[]>([]),[ready,setReady]=useState(false);
  const searchRef=useRef<HTMLInputElement>(null); const current=tools.find(t=>t.id===active)??tools[0];
  useEffect(()=>{const f=localStorage.getItem("devkit-favorites"),r=localStorage.getItem("devkit-recent"),th=localStorage.getItem("devkit-theme");if(f)setFavorites(JSON.parse(f));if(r)setRecent(JSON.parse(r));if(th)setTheme(th);setReady(true)},[]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;if(ready)localStorage.setItem("devkit-theme",theme)},[theme,ready]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();searchRef.current?.focus()}if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();runTool()}};addEventListener("keydown",key);return()=>removeEventListener("keydown",key)});
  const visible=useMemo(()=>tools.filter(t=>{const matches=(t.name+t.desc+t.category).toLowerCase().includes(query.toLowerCase());if(!matches)return false;if(category==="常用收藏")return favorites.includes(t.id);if(category==="最近使用")return recent.includes(t.id);if(category!=="全部工具")return t.category===category;return true}).sort((a,b)=>category==="最近使用"?recent.indexOf(a.id)-recent.indexOf(b.id):0),[query,category,favorites,recent]);
  function selectTool(id:string){setActive(id);setInput(samples[id]??"");setOutput("");setError("");const next=[id,...recent.filter(x=>x!==id)].slice(0,8);setRecent(next);localStorage.setItem("devkit-recent",JSON.stringify(next));}
  function toggleFavorite(id:string){const next=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];setFavorites(next);localStorage.setItem("devkit-favorites",JSON.stringify(next))}
  async function runTool(action="primary"){
    try{setError("");let result="";
      if(active==="json")result=action==="minify"?JSON.stringify(JSON.parse(input)):JSON.stringify(JSON.parse(input),null,2);
      else if(active==="base64")result=action==="decode"?decodeBase64(input):encodeBase64(input);
      else if(active==="url")result=action==="decode"?decodeURIComponent(input):encodeURIComponent(input);
      else if(active==="unicode")result=action==="decode"?input.replace(/\\u([0-9a-fA-F]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16))):[...input].map(c=>`\\u${c.charCodeAt(0).toString(16).padStart(4,"0")}`).join("");
      else if(active==="timestamp"){const n=Number(input);const d=Number.isFinite(n)?new Date(input.trim().length<=10?n*1000:n):new Date(input);result=Number.isFinite(n)?`本地时间：${d.toLocaleString("zh-CN",{hour12:false})}\nISO 8601：${d.toISOString()}\n秒级时间戳：${Math.floor(d.getTime()/1000)}\n毫秒时间戳：${d.getTime()}`:String(Math.floor(d.getTime()/1000))}
      else if(active==="radix"){const n=input.trim().startsWith("0x")?parseInt(input,16):Number(input);if(!Number.isInteger(n))throw new Error("请输入有效整数");result=`二进制：${n.toString(2)}\n八进制：${n.toString(8)}\n十进制：${n}\n十六进制：${n.toString(16).toUpperCase()}`}
      else if(active==="hash"){const algorithm=action==="sha1"?"SHA-1":action==="sha512"?"SHA-512":"SHA-256";const digest=await crypto.subtle.digest(algorithm,new TextEncoder().encode(input));result=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")}
      else if(active==="uuid")result=Array.from({length:Math.min(Math.max(Number(input)||1,1),100)},()=>crypto.randomUUID()).join("\n");
      else if(active==="password"){const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";const len=Math.min(Math.max(Number(input)||16,8),128);const bytes=crypto.getRandomValues(new Uint32Array(len));result=Array.from(bytes,b=>chars[b%chars.length]).join("")}
      else if(active==="text")result=action==="upper"?input.toUpperCase():action==="lower"?input.toLowerCase():action==="clean"?[...new Set(input.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))].join("\n"):`字符数：${input.length}\n单词数：${input.trim()?input.trim().split(/\s+/).length:0}\n行数：${input.split(/\r?\n/).length}`;
      else if(active==="regex"){const [pattern,...lines]=input.split("\n"),m=pattern.match(/^\/(.*)\/([a-z]*)$/);if(!m)throw new Error("第一行请使用 /pattern/flags 格式");const re=new RegExp(m[1],m[2].includes("g")?m[2]:m[2]+"g");const matches=[...lines.join("\n").matchAll(re)];result=matches.length?matches.map((x,i)=>`${i+1}. "${x[0]}" · 位置 ${x.index}`).join("\n"):"没有匹配结果"}
      else if(active==="jwt"){const[h,p]=input.split(".");const parse=(s:string)=>JSON.parse(decodeBase64(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")));result=JSON.stringify({header:parse(h),payload:parse(p),notice:"仅解析，未验证签名"},null,2)}
      else if(active==="json2ts"){const v=JSON.parse(input);result=`interface Root ${inferType(v)}`}
      else if(active==="query"){const u=new URL(input.includes("://")?input:`https://local.dev/?${input.replace(/^\?/,"")}`);result=JSON.stringify(Object.fromEntries(u.searchParams),null,2)}
      else if(active==="color"){if(input.trim().startsWith("#")){const h=input.trim().slice(1);if(!/^[0-9a-f]{6}$/i.test(h))throw new Error("请输入 6 位 HEX 颜色");result=`RGB：rgb(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)})`}else{const m=input.match(/\d+/g);if(!m||m.length<3)throw new Error("请输入 HEX 或 RGB");result="#"+m.slice(0,3).map(x=>Math.min(255,+x).toString(16).padStart(2,"0")).join("")}}
      else if(active==="markdown")result=markdown(input);setOutput(result);
    }catch(e){setOutput("");setError(e instanceof Error?e.message:"处理失败，请检查输入。")}}
  async function copyOutput(){await navigator.clipboard.writeText(output);setCopied(true);setTimeout(()=>setCopied(false),1400)}
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">D_</span><div><strong>DevKit</strong><small>开发者工具箱</small></div></div><label className="search"><span>⌕</span><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索 16 个工具..."/><kbd>Ctrl K</kbd></label><div className="top-actions"><span className="local"><i/>本地处理</span><button onClick={()=>setTheme(theme==="dark"?"light":"dark")} aria-label="切换主题">{theme==="dark"?"☀":"☾"}</button></div></header>
    <aside className="sidebar"><nav>{categories.map((c,i)=><button onClick={()=>setCategory(c)} className={category===c?"selected":""} key={c}><span>{icons[i]}</span>{c}<em>{c==="常用收藏"?favorites.length:c==="最近使用"?recent.length:""}</em></button>)}</nav><div className="privacy"><span>◉</span><div><b>隐私优先</b><p>输入内容仅在本机浏览器中处理。</p></div></div><div className="version"><span>DevKit v0.2.0</span><span className="status-dot"/>运行正常</div></aside>
    <section className="content"><div className="welcome"><div><p className="eyebrow">DEVKIT V0.2 · LOCAL FIRST</p><h1>今天想解决什么问题？</h1><p>选择工具，输入数据，立即得到结果。</p></div><div className="pulse"><i/><span>{tools.length}</span><small>已上线工具</small></div></div>
      <div className="section-title"><h2>{query?`搜索结果 · ${visible.length}`:`${category} · ${visible.length}`}</h2><span>收藏与最近使用仅保存在本机</span></div>
      {visible.length?<div className="tool-grid">{visible.map(t=><div key={t.id} className={`tool-card ${active===t.id?"active":""}`} onClick={()=>selectTool(t.id)} role="button" tabIndex={0}><span className={`tool-icon ${t.color}`}>{t.icon}</span><span><b>{t.name}</b><small>{t.desc}</small></span>{t.tag&&<em>{t.tag}</em>}<button className={`favorite ${favorites.includes(t.id)?"on":""}`} onClick={e=>{e.stopPropagation();toggleFavorite(t.id)}} aria-label="收藏工具">★</button></div>)}</div>:<div className="empty"><b>这里还是空的</b><span>可以通过工具卡片右下角的星标加入收藏。</span></div>}
      <section className="workspace"><div className="workspace-head"><div className={`tool-icon ${current.color}`}>{current.icon}</div><div><p>{current.category}</p><h2>{current.name}</h2></div><button className={`head-favorite ${favorites.includes(active)?"on":""}`} onClick={()=>toggleFavorite(active)}>★ {favorites.includes(active)?"已收藏":"收藏"}</button><span className="secure">● 本地安全处理</span></div>
        <div className="editors"><div className="editor"><div className="editor-bar"><b>输入</b><button onClick={()=>setInput("")}>清空</button></div><textarea value={input} onChange={e=>setInput(e.target.value)} spellCheck={false}/></div><button className="run" onClick={()=>runTool()} aria-label="执行">→</button><div className="editor"><div className="editor-bar"><b>输出</b><button onClick={copyOutput}>{copied?"已复制":"复制"}</button></div><textarea value={error||output} className={error?"has-error":""} readOnly placeholder="结果将显示在这里"/></div></div>
        <div className="workspace-actions"><button className="primary" onClick={()=>runTool()}>执行转换 <kbd>Ctrl ↵</kbd></button>{active==="json"&&<button onClick={()=>runTool("minify")}>压缩 JSON</button>}{["base64","url","unicode"].includes(active)&&<button onClick={()=>runTool("decode")}>解码</button>}{active==="hash"&&<><button onClick={()=>runTool("sha1")}>SHA-1</button><button onClick={()=>runTool("sha512")}>SHA-512</button></>}{active==="text"&&<><button onClick={()=>runTool("upper")}>大写</button><button onClick={()=>runTool("lower")}>小写</button><button onClick={()=>runTool("clean")}>去重清理</button></>}</div>
      </section>
    </section>
  </main>;
}
