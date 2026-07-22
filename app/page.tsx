"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Converter } from "opencc-js";
import { pinyin } from "pinyin-pro";
import cronstrue from "cronstrue/i18n.js";
import CryptoJS from "crypto-js";
import { sha3_224, sha3_256, sha3_384, sha3_512 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";

type Category = "编码转换" | "格式校验" | "文本处理" | "加密安全" | "Web 与网络" | "前端工具" | "后端工具" | "数据生成";
type Tool = { id: string; name: string; desc: string; icon: string; color: string; category: Category; tag?: string };

const tools: Tool[] = [
  { id:"json",name:"JSON 格式化",desc:"格式化、压缩与语法校验",icon:"{ }",color:"cyan",category:"格式校验" },
  { id:"base64",name:"Base64 转换",desc:"文本的 Base64 编码解码",icon:"B64",color:"blue",category:"编码转换" },
  { id:"url",name:"URL 编解码",desc:"URL 和参数安全转换",icon:"%",color:"green",category:"编码转换" },
  { id:"unicode",name:"Unicode 转换",desc:"中文与 Unicode 互转",icon:"U+",color:"blue",category:"编码转换",tag:"新" },
  { id:"timestamp",name:"时间戳转换",desc:"Unix 秒/毫秒与日期互转",icon:"◷",color:"orange",category:"编码转换",tag:"热门" },
  { id:"datecalc",name:"日期计算",desc:"计算两个日期时间之间的间隔",icon:"D±",color:"orange",category:"编码转换",tag:"新" },
  { id:"dateconvert",name:"日期转换",desc:"批量转换时间戳、日期与日期时间",icon:"D↔",color:"blue",category:"编码转换",tag:"新" },
  { id:"radix",name:"进制转换",desc:"2、8、10、16 进制同时转换",icon:"01",color:"green",category:"编码转换",tag:"新" },
  { id:"chinese",name:"简繁体转换",desc:"简体中文与繁体中文互转",icon:"简",color:"red",category:"编码转换",tag:"新" },
  { id:"case",name:"大小写转换",desc:"英文字母大写与小写互转",icon:"Aa",color:"yellow",category:"编码转换",tag:"新" },
  { id:"ascii",name:"ASCII 转换",desc:"字符与十进制编码数字互转",icon:"65",color:"cyan",category:"编码转换",tag:"新" },
  { id:"escape",name:"字符串转义",desc:"添加或去除常用转义符",icon:"\\n",color:"purple",category:"编码转换",tag:"新" },
  { id:"rmb",name:"人民币大写",desc:"人民币数字金额转中文大写",icon:"¥",color:"orange",category:"编码转换",tag:"新" },
  { id:"pinyin",name:"汉字转拼音",desc:"汉字转换为带声调的拼音",icon:"拼",color:"blue",category:"编码转换",tag:"新" },
  { id:"hash",name:"Hash 计算",desc:"SHA-1 / SHA-256 / SHA-512",icon:"#",color:"purple",category:"加密安全" },
  { id:"md5-32-lower",name:"MD5加密32_小写",desc:"32 位小写 MD5 摘要",icon:"MD5",color:"cyan",category:"加密安全",tag:"新" },
  { id:"md5-32-upper",name:"MD5加密32_大写",desc:"32 位大写 MD5 摘要",icon:"MD5",color:"blue",category:"加密安全",tag:"新" },
  { id:"md5-16-lower",name:"MD5加密16_小写",desc:"16 位小写 MD5 摘要",icon:"M16",color:"green",category:"加密安全",tag:"新" },
  { id:"md5-16-upper",name:"MD5加密16_大写",desc:"16 位大写 MD5 摘要",icon:"M16",color:"orange",category:"加密安全",tag:"新" },
  { id:"sha1",name:"SHA1",desc:"SHA-1 消息摘要",icon:"S1",color:"purple",category:"加密安全",tag:"新" },
  { id:"sha2-256",name:"SHA2_256",desc:"SHA-2 256 位消息摘要",icon:"256",color:"cyan",category:"加密安全",tag:"新" },
  { id:"sha2-512",name:"SHA2_512",desc:"SHA-2 512 位消息摘要",icon:"512",color:"blue",category:"加密安全",tag:"新" },
  { id:"sha3-512",name:"SHA3_512",desc:"SHA-3 512 位消息摘要",icon:"3·5",color:"green",category:"加密安全",tag:"新" },
  { id:"sha3-384",name:"SHA3_384",desc:"SHA-3 384 位消息摘要",icon:"384",color:"orange",category:"加密安全",tag:"新" },
  { id:"sha3-256",name:"SHA3_256",desc:"SHA-3 256 位消息摘要",icon:"3·2",color:"pink",category:"加密安全",tag:"新" },
  { id:"sha3-224",name:"SHA3_224",desc:"SHA-3 224 位消息摘要",icon:"224",color:"red",category:"加密安全",tag:"新" },
  { id:"ripemd-160",name:"RIPEMD_160",desc:"RIPEMD-160 消息摘要",icon:"R160",color:"yellow",category:"加密安全",tag:"新" },
  { id:"aes-encrypt",name:"AES_Encrypt",desc:"使用口令进行 AES 加密",icon:"AES",color:"cyan",category:"加密安全",tag:"新" },
  { id:"aes-decrypt",name:"AES_Decrypt",desc:"使用口令进行 AES 解密",icon:"AES",color:"blue",category:"加密安全",tag:"新" },
  { id:"des-encrypt",name:"DES_Encrypt",desc:"使用口令进行 DES 加密",icon:"DES",color:"green",category:"加密安全",tag:"新" },
  { id:"des-decrypt",name:"DES_Decrypt",desc:"使用口令进行 DES 解密",icon:"DES",color:"orange",category:"加密安全",tag:"新" },
  { id:"tripledes-encrypt",name:"TripleDES_Encrypt",desc:"使用口令进行 Triple DES 加密",icon:"3DES",color:"pink",category:"加密安全",tag:"新" },
  { id:"tripledes-decrypt",name:"TripleDES_Decrypt",desc:"使用口令进行 Triple DES 解密",icon:"3DES",color:"red",category:"加密安全",tag:"新" },
  { id:"rabbit-encrypt",name:"Rabbit_Encrypt",desc:"使用口令进行 Rabbit 加密",icon:"RBT",color:"yellow",category:"加密安全",tag:"新" },
  { id:"rabbit-decrypt",name:"Rabbit_Decrypt",desc:"使用口令进行 Rabbit 解密",icon:"RBT",color:"cyan",category:"加密安全",tag:"新" },
  { id:"rc4-encrypt",name:"RC4_Encrypt",desc:"使用口令进行 RC4 加密",icon:"RC4",color:"blue",category:"加密安全",tag:"新" },
  { id:"rc4-decrypt",name:"RC4_Decrypt",desc:"使用口令进行 RC4 解密",icon:"RC4",color:"green",category:"加密安全",tag:"新" },
  { id:"crc32-64",name:"64位 CRC32",desc:"CRC32 的 64 位十六进制表示",icon:"CRC",color:"purple",category:"加密安全",tag:"新" },
  { id:"uuid",name:"UUID 生成器",desc:"批量生成 UUID v4",icon:"ID",color:"pink",category:"数据生成" },
  { id:"password",name:"密码生成器",desc:"安全随机密码批量生成",icon:"***",color:"red",category:"数据生成",tag:"新" },
  { id:"text",name:"文本工具",desc:"统计、清理与大小写转换",icon:"Aa",color:"yellow",category:"文本处理" },
  { id:"dedupe",name:"去重复行",desc:"删除重复内容，保留首次出现",icon:"≠",color:"cyan",category:"文本处理",tag:"新" },
  { id:"sortlines",name:"文本排序",desc:"按行自然升序或降序排列",icon:"↕",color:"green",category:"文本处理",tag:"新" },
  { id:"regex",name:"正则测试",desc:"实时检查匹配结果",icon:".*",color:"orange",category:"格式校验",tag:"新" },
  { id:"jwt",name:"JWT 解析",desc:"本地解析 Header 与 Payload",icon:"JWT",color:"red",category:"加密安全" },
  { id:"json2ts",name:"JSON 转 TypeScript",desc:"自动推断对象类型",icon:"TS",color:"blue",category:"格式校验",tag:"新" },
  { id:"query",name:"URL 参数解析",desc:"解析 Query 参数为 JSON",icon:"?=",color:"cyan",category:"Web 与网络",tag:"新" },
  { id:"color",name:"HEX / RGB 转换",desc:"HEX 与 RGB 颜色值快速互转",icon:"◐",color:"pink",category:"编码转换",tag:"新" },
  { id:"markdown",name:"Markdown 预览",desc:"快速转换为 HTML",icon:"MD",color:"purple",category:"格式校验",tag:"新" },
  { id:"diff",name:"文本 Diff",desc:"逐行对比两段文本差异",icon:"±",color:"cyan",category:"文本处理",tag:"新" },
  { id:"naming",name:"命名格式转换",desc:"驼峰、下划线、短横线互转",icon:"aA",color:"yellow",category:"文本处理",tag:"新" },
  { id:"entities",name:"HTML 实体",desc:"HTML 实体编码与解码",icon:"&;",color:"orange",category:"编码转换",tag:"新" },
  { id:"cron",name:"Crontab 工具",desc:"支持 Linux、Spring 与 Quartz",icon:"⏱",color:"pink",category:"后端工具",tag:"新" },
  { id:"curl",name:"Curl 转 Fetch",desc:"将 Curl 请求转为 Fetch 代码",icon:"$",color:"green",category:"Web 与网络",tag:"新" },
  { id:"cidr",name:"CIDR 子网计算",desc:"计算 IPv4 网络与主机范围",icon:"IP",color:"blue",category:"Web 与网络",tag:"新" },
  { id:"units",name:"CSS 单位转换",desc:"px 与 rem 快速互转",icon:"px",color:"purple",category:"前端工具",tag:"新" },
  { id:"contrast",name:"颜色对比度",desc:"WCAG 对比度与等级检查",icon:"Aa",color:"cyan",category:"前端工具",tag:"新" },
  { id:"sql",name:"SQL 格式化",desc:"常用 SQL 关键字换行缩进",icon:"SQL",color:"orange",category:"后端工具",tag:"新" },
  { id:"yaml",name:"JSON 转 YAML",desc:"将 JSON 对象转为 YAML",icon:"YML",color:"red",category:"格式校验",tag:"新" },
];

const categories = ["全部工具", "常用收藏", "最近使用", "编码转换", "格式校验", "文本处理", "加密安全", "Web 与网络", "前端工具", "后端工具", "数据生成"];
const icons = ["◈","★","◷","⇄","✓","T","⌯","∿","◇","⎔","✦"];

function encodeBase64(v:string){return btoa(unescape(encodeURIComponent(v)))}
function decodeBase64(v:string){return decodeURIComponent(escape(atob(v.trim())))}
function inferType(v:unknown):string { if(Array.isArray(v)) return `${v.length ? inferType(v[0]) : "unknown"}[]`; if(v===null)return "null"; if(typeof v==="object") return `{ ${Object.entries(v as Record<string,unknown>).map(([k,x])=>`${k}: ${inferType(x)}`).join("; ")} }`; return typeof v; }
function markdown(v:string){return v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/^### (.*)$/gm,"<h3>$1</h3>").replace(/^## (.*)$/gm,"<h2>$1</h2>").replace(/^# (.*)$/gm,"<h1>$1</h1>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>").replace(/^[-*] (.*)$/gm,"<li>$1</li>").replace(/\n/g,"<br>")}
function toYaml(v:unknown,depth=0):string{const pad="  ".repeat(depth);if(Array.isArray(v))return v.map(x=>typeof x==="object"?`${pad}-\n${toYaml(x,depth+1)}`:`${pad}- ${String(x)}`).join("\n");if(v&&typeof v==="object")return Object.entries(v as Record<string,unknown>).map(([k,x])=>x&&typeof x==="object"?`${pad}${k}:\n${toYaml(x,depth+1)}`:`${pad}${k}: ${typeof x==="string"?JSON.stringify(x):String(x)}`).join("\n");return `${pad}${String(v)}`}
function ipNumber(ip:string){const p=ip.split(".").map(Number);if(p.length!==4||p.some(x=>x<0||x>255||!Number.isInteger(x)))throw new Error("请输入有效 IPv4 地址");return p.reduce((n,x)=>(n*256+x)>>>0,0)>>>0}
function numberIp(n:number){return [24,16,8,0].map(s=>(n>>>s)&255).join(".")}
function luminance(hex:string){const h=hex.replace("#","");if(!/^[0-9a-f]{6}$/i.test(h))throw new Error("请输入两个 6 位 HEX 颜色");const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(x=>x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2]}
type CipherName="aes"|"des"|"tripledes"|"rabbit"|"rc4";
function cipherInput(value:string){let parsed:unknown;try{parsed=JSON.parse(value)}catch{throw new Error('请输入 JSON，例如 {"text":"内容","key":"口令"}')};if(!parsed||typeof parsed!=="object")throw new Error("输入必须是 JSON 对象");const {text,key}=parsed as Record<string,unknown>;if(typeof text!=="string"||typeof key!=="string"||!key)throw new Error("text 必须是字符串，key 必须是非空字符串");return {text,key}}
function cipherRun(name:CipherName,decrypt:boolean,value:string){const {text,key}=cipherInput(value);const algorithms={aes:CryptoJS.AES,des:CryptoJS.DES,tripledes:CryptoJS.TripleDES,rabbit:CryptoJS.Rabbit,rc4:CryptoJS.RC4};if(!decrypt)return algorithms[name].encrypt(text,key).toString();let result="";try{result=algorithms[name].decrypt(text,key).toString(CryptoJS.enc.Utf8)}catch{throw new Error("解密失败，请检查密文和口令")};if(!result&&text)throw new Error("解密结果为空，请检查密文和口令");return result}
function crc32(value:string){let crc=0xffffffff;for(const byte of new TextEncoder().encode(value)){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
const toTraditional=Converter({from:"cn",to:"tw"});
const toSimplified=Converter({from:"tw",to:"cn"});
function rmbUppercase(value:string){
  const normalized=value.trim().replace(/[￥¥,，\s]/g,"");
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized))throw new Error("请输入有效金额，最多保留两位小数");
  const amount=Number(normalized);if(amount>999999999999999.99)throw new Error("金额不能超过 999999999999999.99 元");
  if(amount===0)return "人民币零元整";
  const digits="零壹贰叁肆伍陆柒捌玖",units=["仟","佰","拾",""];let integer=Math.floor(amount),text="";
  const sections:{text:string;value:number}[]=[];do{const part=integer%10000;let section="",zero=false;for(let i=0,n=part;i<4;i++,n=Math.floor(n/10)){const d=n%10;if(d){section=digits[d]+units[3-i]+section;zero=false}else if(section&&!zero){section="零"+section;zero=true}}sections.unshift({text:section.replace(/零+$/,""),value:part});integer=Math.floor(integer/10000)}while(integer);
  const sectionUnits=["","万","亿","万亿"];sections.forEach((section,i)=>{if(section.text){if(text&&section.value<1000&&!text.endsWith("零"))text+="零";text+=section.text+sectionUnits[sections.length-1-i]}});
  const cents=Math.round((amount-Math.floor(amount))*100),jiao=Math.floor(cents/10),fen=cents%10;
  return `人民币${text}元${jiao?digits[jiao]+"角":fen?"零":""}${fen?digits[fen]+"分":"整"}`;
}
function describeCron(expression:string,mode:"linux"|"spring"|"quartz"){
  const fields=expression.trim().split(/\s+/),expected=mode==="linux"?"5":mode==="spring"?"6":"6 或 7";
  if((mode==="linux"&&fields.length!==5)||(mode==="spring"&&fields.length!==6)||(mode==="quartz"&&![6,7].includes(fields.length)))throw new Error(`${mode==="linux"?"Linux":mode==="spring"?"Spring":"Quartz"} 表达式需要 ${expected} 个字段`);
  const names=mode==="linux"?["分钟","小时","日","月","星期"]:["秒","分钟","小时","日","月","星期",...(mode==="quartz"&&fields.length===7?["年"]:[])];
  let meaning:string;try{meaning=cronstrue.toString(expression,{locale:"zh_CN",use24HourTimeFormat:true,throwExceptionOnParseError:true,verbose:true})}catch{throw new Error("表达式格式无效，请检查字段范围和特殊字符")}
  const title=mode==="linux"?"Linux Crontab":mode==="spring"?"Java Spring @Scheduled":"Java Quartz CronTrigger";
  return `${title}\n含义：${meaning}\n\n字段结构：\n${fields.map((field,i)=>`${names[i]}：${field}`).join("\n")}\n\n说明：实际执行时间取决于应用或服务器时区。`;
}
function secureRandomIndex(max:number){const limit=0x100000000-(0x100000000%max),value=new Uint32Array(1);do{crypto.getRandomValues(value)}while(value[0]>=limit);return value[0]%max}
function generatePassword(length:number,groups:string[]){
  const pool=groups.join(""),characters=groups.slice(0,length).map(group=>group[secureRandomIndex(group.length)]);
  while(characters.length<length)characters.push(pool[secureRandomIndex(pool.length)]);
  for(let i=characters.length-1;i>0;i--){const j=secureRandomIndex(i+1);[characters[i],characters[j]]=[characters[j],characters[i]]}
  return characters.join("");
}
function padDate(value:number,length=2){return String(value).padStart(length,"0")}
function formatLocalDate(date:Date){return `${date.getFullYear()}-${padDate(date.getMonth()+1)}-${padDate(date.getDate())}`}
function formatLocalDateTime(date:Date){return `${formatLocalDate(date)} ${padDate(date.getHours())}:${padDate(date.getMinutes())}:${padDate(date.getSeconds())}`}
function parseDateValue(raw:string){
  const value=raw.trim();if(!value)throw new Error("日期不能为空");
  let date:Date;
  if(/^\d{10}$/.test(value))date=new Date(Number(value)*1000);
  else if(/^\d{13}$/.test(value))date=new Date(Number(value));
  else {
    const compact=value.match(/^(\d{4})(\d{2})(\d{2})$/),standard=value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?)?$/);
    const parts=compact?[compact[1],compact[2],compact[3],"0","0","0","0"]:standard?[standard[1],standard[2],standard[3],standard[4]??"0",standard[5]??"0",standard[6]??"0",standard[7]??"0"]:null;
    if(parts){const [year,month,day,hour,minute,second,millisecond]=parts.map(Number);date=new Date(year,month-1,day,hour,minute,second,millisecond);if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day||date.getHours()!==hour||date.getMinutes()!==minute||date.getSeconds()!==second)throw new Error(`无效日期：${value}`)}
    else date=new Date(value);
  }
  if(Number.isNaN(date.getTime()))throw new Error(`无法识别日期：${value}`);return date;
}
function dateDetails(date:Date){return `日期：${formatLocalDate(date)}\n本地时间：${formatLocalDateTime(date)}\nISO 8601：${date.toISOString()}\n时间戳秒：${Math.floor(date.getTime()/1000)}\n时间戳毫秒：${date.getTime()}`}

const samples:Record<string,string>={json:'{"project":"DevKit","ready":true,"tools":["JSON","Base64","UUID"]}',base64:"开发者工具箱",url:"https://example.com/search?q=开发者工具",unicode:"你好，DevKit",timestamp:String(Math.floor(Date.now()/1000)),datecalc:"2026-07-15\n2026-07-22 00:12:31",dateconvert:"20260715\n2026-07-15\n2026-07-15 00:00:00\n2026-07-22T00:12:31.000Z\n2026-07-22T00:12:31",radix:"255",chinese:"开发者工具箱，让编码转换更简单。",case:"Hello DevKit 你好",ascii:"DevKit 你好",escape:'第一行\n第二行："DevKit"',rmb:"123456.78",pinyin:"开发者工具箱",hash:"Hello DevKit",uuid:"5",password:"16",text:"Hello DevKit\n这是一段测试文本。",regex:"/dev(kit)?/gi\nDevKit makes dev work easier.",jwt:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiRGV2S2l0IiwiaWF0IjoxNTE2MjM5MDIyfQ.signature",json2ts:'{"name":"DevKit","version":2,"ready":true}',query:"https://example.com/search?q=devkit&page=2",color:"#41e0c2",markdown:"# DevKit\n\n**私密、高效**的 `开发者工具箱`\n\n- 本地处理\n- 即开即用",diff:"原来的第一行\n相同内容\n--- 对比 ---\n修改后的第一行\n相同内容",naming:"hello developer toolbox",entities:"<button title=\"DevKit\">开始</button>",cron:"*/15 9-18 * * 1-5",curl:"curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{\"name\":\"DevKit\"}'",cidr:"192.168.1.10/24",units:"24",contrast:"#41e0c2\n#091011",sql:"select id,name from users where active=1 order by created_at desc",yaml:'{"name":"DevKit","version":3,"features":["local","fast"]}'};

Object.assign(samples,{dedupe:"苹果\n香蕉\n苹果\n橙子\n香蕉",sortlines:"项目10\n项目2\n苹果\n香蕉\n项目1"});
Object.assign(samples,{
  "md5-32-lower":"Hello DevKit","md5-32-upper":"Hello DevKit","md5-16-lower":"Hello DevKit","md5-16-upper":"Hello DevKit",
  sha1:"Hello DevKit","sha2-256":"Hello DevKit","sha2-512":"Hello DevKit","sha3-512":"Hello DevKit","sha3-384":"Hello DevKit","sha3-256":"Hello DevKit","sha3-224":"Hello DevKit","ripemd-160":"Hello DevKit","crc32-64":"Hello DevKit",
  "aes-encrypt":'{"text":"Hello DevKit","key":"change-this-passphrase"}',"des-encrypt":'{"text":"Hello DevKit","key":"change-this-passphrase"}',"tripledes-encrypt":'{"text":"Hello DevKit","key":"change-this-passphrase"}',"rabbit-encrypt":'{"text":"Hello DevKit","key":"change-this-passphrase"}',"rc4-encrypt":'{"text":"Hello DevKit","key":"change-this-passphrase"}',
  "aes-decrypt":'{"text":"粘贴 AES_Encrypt 输出的密文","key":"change-this-passphrase"}',"des-decrypt":'{"text":"粘贴 DES_Encrypt 输出的密文","key":"change-this-passphrase"}',"tripledes-decrypt":'{"text":"粘贴 TripleDES_Encrypt 输出的密文","key":"change-this-passphrase"}',"rabbit-decrypt":'{"text":"粘贴 Rabbit_Encrypt 输出的密文","key":"change-this-passphrase"}',"rc4-decrypt":'{"text":"粘贴 RC4_Encrypt 输出的密文","key":"change-this-passphrase"}'
});

export default function Home(){
  const [active,setActive]=useState("json"),[category,setCategory]=useState("全部工具"),[query,setQuery]=useState(""),[input,setInput]=useState(samples.json),[output,setOutput]=useState(""),[error,setError]=useState(""),[theme,setTheme]=useState("dark"),[copied,setCopied]=useState(false),[favorites,setFavorites]=useState<string[]>([]),[recent,setRecent]=useState<string[]>([]),[ready,setReady]=useState(false);
  const [passwordLength,setPasswordLength]=useState(16),[passwordCount,setPasswordCount]=useState(5),[passwordGroups,setPasswordGroups]=useState({numbers:true,lower:true,upper:true,symbols:true});
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
      else if(active==="datecalc"){
        const values=input.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(values.length!==2)throw new Error("请输入两个日期时间，每行一个");
        const start=parseDateValue(values[0]),end=parseDateValue(values[1]),difference=end.getTime()-start.getTime(),absolute=Math.abs(difference),direction=difference===0?"两个时间相同":difference>0?"第二个时间晚于第一个时间":"第二个时间早于第一个时间";
        result=`开始：${formatLocalDateTime(start)}\n结束：${formatLocalDateTime(end)}\n方向：${direction}\n\n相差毫秒数：${absolute}\n相差秒数：${absolute/1000}\n相差小时数：${absolute/3600000}\n相差天数：${absolute/86400000}`;
      }
      else if(active==="dateconvert"){
        const values=input.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!values.length)throw new Error("请至少输入一个日期或时间戳");
        result=values.map((value,index)=>`# ${index+1} · ${value}\n${dateDetails(parseDateValue(value))}`).join("\n\n");
      }
      else if(active==="radix"){const n=input.trim().startsWith("0x")?parseInt(input,16):Number(input);if(!Number.isInteger(n))throw new Error("请输入有效整数");result=`二进制：${n.toString(2)}\n八进制：${n.toString(8)}\n十进制：${n}\n十六进制：${n.toString(16).toUpperCase()}`}
      else if(active==="chinese")result=action==="simplified"?toSimplified(input):toTraditional(input);
      else if(active==="case")result=action==="lower"?input.toLocaleLowerCase():input.toLocaleUpperCase();
      else if(active==="ascii"){
        if(action==="decode"){const values=input.trim().split(/[\s,，]+/).filter(Boolean);if(!values.length||values.some(x=>!/^\d+$/.test(x)||Number(x)>0x10ffff))throw new Error("请输入以空格或逗号分隔的十进制编码数字");result=values.map(x=>String.fromCodePoint(Number(x))).join("")}
        else result=[...input].map(char=>char.codePointAt(0)).join(" ");
      }
      else if(active==="escape")result=action==="decode"?JSON.parse(`"${input}"`):JSON.stringify(input).slice(1,-1);
      else if(active==="rmb")result=rmbUppercase(input);
      else if(active==="pinyin")result=pinyin(input,{toneType:"symbol",type:"string",nonZh:"consecutive"});
      else if(active==="hash"){const algorithm=action==="sha1"?"SHA-1":action==="sha512"?"SHA-512":"SHA-256";const digest=await crypto.subtle.digest(algorithm,new TextEncoder().encode(input));result=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")}
      else if(active.startsWith("md5-")){const full=CryptoJS.MD5(input).toString();result=active.includes("16-")?full.slice(8,24):full;if(active.endsWith("upper"))result=result.toUpperCase()}
      else if(active==="sha1")result=CryptoJS.SHA1(input).toString();
      else if(active==="sha2-256")result=CryptoJS.SHA256(input).toString();
      else if(active==="sha2-512")result=CryptoJS.SHA512(input).toString();
      else if(active.startsWith("sha3-")){const algorithms={"sha3-224":sha3_224,"sha3-256":sha3_256,"sha3-384":sha3_384,"sha3-512":sha3_512};result=bytesToHex(algorithms[active as keyof typeof algorithms](new TextEncoder().encode(input)))}
      else if(active==="ripemd-160")result=CryptoJS.RIPEMD160(input).toString();
      else if(active==="crc32-64")result=crc32(input).toString(16).padStart(16,"0");
      else if(/^(aes|des|tripledes|rabbit|rc4)-(encrypt|decrypt)$/.test(active)){const [name,mode]=active.split("-") as [CipherName,"encrypt"|"decrypt"];result=cipherRun(name,mode==="decrypt",input)}
      else if(active==="uuid")result=Array.from({length:Math.min(Math.max(Number(input)||1,1),100)},()=>crypto.randomUUID()).join("\n");
      else if(active==="password"){
        const definitions={numbers:"0123456789",lower:"abcdefghijklmnopqrstuvwxyz",upper:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",symbols:"!@#$%^&*()_+-=[]{};:,.?/|~"},groups=Object.entries(passwordGroups).filter(([,enabled])=>enabled).map(([name])=>definitions[name as keyof typeof definitions]);
        if(!groups.length)throw new Error("请至少选择一种字符类型");if(passwordLength<groups.length)throw new Error(`密码长度不能少于已选择的 ${groups.length} 种字符类型`);
        result=Array.from({length:passwordCount},()=>generatePassword(passwordLength,groups)).join("\n");
      }
      else if(active==="text"){
        const lines=input.split(/\r?\n/),compare=(a:string,b:string)=>a.localeCompare(b,"zh-CN",{numeric:true,sensitivity:"base"});
        if(action==="upper")result=input.toUpperCase();
        else if(action==="lower")result=input.toLowerCase();
        else if(action==="unique")result=[...new Set(lines)].join("\n");
        else if(action==="sort-asc")result=[...lines].sort(compare).join("\n");
        else if(action==="sort-desc")result=[...lines].sort((a,b)=>compare(b,a)).join("\n");
        else if(action==="remove-empty")result=lines.filter(line=>line.trim().length>0).join("\n");
        else if(action==="trim-start")result=lines.map(line=>line.replace(/^[ \t]+/,"")).join("\n");
        else if(action==="trim-end")result=lines.map(line=>line.replace(/[ \t]+$/,"")).join("\n");
        else result=`字符数：${input.length}\n单词数：${input.trim()?input.trim().split(/\s+/).length:0}\n行数：${lines.length}`;
      }
      else if(active==="dedupe")result=[...new Set(input.split(/\r?\n/))].join("\n");
      else if(active==="sortlines"){const lines=input.split(/\r?\n/),compare=(a:string,b:string)=>a.localeCompare(b,"zh-CN",{numeric:true,sensitivity:"base"});result=[...lines].sort(action==="desc"?(a,b)=>compare(b,a):compare).join("\n")}
      else if(active==="regex"){const [pattern,...lines]=input.split("\n"),m=pattern.match(/^\/(.*)\/([a-z]*)$/);if(!m)throw new Error("第一行请使用 /pattern/flags 格式");const re=new RegExp(m[1],m[2].includes("g")?m[2]:m[2]+"g");const matches=[...lines.join("\n").matchAll(re)];result=matches.length?matches.map((x,i)=>`${i+1}. "${x[0]}" · 位置 ${x.index}`).join("\n"):"没有匹配结果"}
      else if(active==="jwt"){const[h,p]=input.split(".");const parse=(s:string)=>JSON.parse(decodeBase64(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")));result=JSON.stringify({header:parse(h),payload:parse(p),notice:"仅解析，未验证签名"},null,2)}
      else if(active==="json2ts"){const v=JSON.parse(input);result=`interface Root ${inferType(v)}`}
      else if(active==="query"){const u=new URL(input.includes("://")?input:`https://local.dev/?${input.replace(/^\?/,"")}`);result=JSON.stringify(Object.fromEntries(u.searchParams),null,2)}
      else if(active==="color"){if(action==="rgb"||input.trim().startsWith("#")){const h=input.trim().replace(/^#/,"");if(!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(h))throw new Error("请输入 3 位或 6 位 HEX 颜色");const full=h.length===3?[...h].map(x=>x+x).join(""):h;result=`rgb(${parseInt(full.slice(0,2),16)}, ${parseInt(full.slice(2,4),16)}, ${parseInt(full.slice(4,6),16)})`}else{const m=input.match(/-?\d+(?:\.\d+)?/g);if(!m||m.length!==3||m.some(x=>Number(x)<0||Number(x)>255))throw new Error("请输入三个 0–255 之间的 RGB 数值");result="#"+m.map(x=>Math.round(Number(x)).toString(16).padStart(2,"0")).join("").toUpperCase()}}
      else if(active==="markdown")result=markdown(input);
      else if(active==="diff"){const [a="",b=""]=input.split(/^--- 对比 ---$/m),aa=a.trim().split("\n"),bb=b.trim().split("\n"),size=Math.max(aa.length,bb.length);result=Array.from({length:size},(_,i)=>aa[i]===bb[i]?`  ${aa[i]??""}`:`- ${aa[i]??""}\n+ ${bb[i]??""}`).join("\n")}
      else if(active==="naming"){const words=input.trim().replace(/([a-z0-9])([A-Z])/g,"$1 $2").split(/[\s_-]+/).filter(Boolean).map(x=>x.toLowerCase());result=`camelCase：${words[0]+words.slice(1).map(x=>x[0].toUpperCase()+x.slice(1)).join("")}\nPascalCase：${words.map(x=>x[0].toUpperCase()+x.slice(1)).join("")}\nsnake_case：${words.join("_")}\nkebab-case：${words.join("-")}\nCONSTANT_CASE：${words.join("_").toUpperCase()}`}
      else if(active==="entities")result=action==="decode"?new DOMParser().parseFromString(input,"text/html").documentElement.textContent??"":input.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
      else if(active==="cron")result=describeCron(input,action==="spring"?"spring":action==="quartz"?"quartz":"linux");
      else if(active==="curl"){const url=input.match(/https?:\/\/[^\s'\"]+/)?.[0];if(!url)throw new Error("未找到请求 URL");const method=input.match(/(?:-X|--request)\s+([A-Z]+)/i)?.[1]??(input.match(/(?:-d|--data)/)?"POST":"GET");const headers=Object.fromEntries([...input.matchAll(/(?:-H|--header)\s+['\"]([^:]+):\s*([^'\"]+)['\"]/g)].map(x=>[x[1],x[2]]));const body=input.match(/(?:-d|--data(?:-raw)?)\s+'([^']*)'/)?.[1];result=`fetch(${JSON.stringify(url)}, ${JSON.stringify({method:method.toUpperCase(),...(Object.keys(headers).length?{headers}:{}),...(body?{body}: {})},null,2)})\n  .then(response => response.json())\n  .then(console.log);`}
      else if(active==="cidr"){const [ip,prefixText]=input.trim().split("/"),prefix=Number(prefixText);if(!Number.isInteger(prefix)||prefix<0||prefix>32)throw new Error("前缀长度必须在 0–32 之间");const n=ipNumber(ip),mask=prefix===0?0:(0xffffffff<<(32-prefix))>>>0,network=(n&mask)>>>0,broadcast=(network|(~mask>>>0))>>>0,hosts=prefix>=31?Math.pow(2,32-prefix):Math.pow(2,32-prefix)-2;result=`网络地址：${numberIp(network)}\n子网掩码：${numberIp(mask)}\n广播地址：${numberIp(broadcast)}\n可用范围：${numberIp(prefix>=31?network:network+1)} — ${numberIp(prefix>=31?broadcast:broadcast-1)}\n主机数：${hosts}`}
      else if(active==="units"){const n=Number(input);if(!Number.isFinite(n))throw new Error("请输入数值");result=action==="decode"?`${n}rem = ${n*16}px（基准 16px）`:`${n}px = ${n/16}rem（基准 16px）`}
      else if(active==="contrast"){const [a,b]=input.trim().split(/\s+/),l1=luminance(a),l2=luminance(b),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);result=`对比度：${ratio.toFixed(2)}:1\n普通文本 AA：${ratio>=4.5?"通过":"不通过"}\n大文本 AA：${ratio>=3?"通过":"不通过"}\nAAA：${ratio>=7?"通过":"不通过"}`}
      else if(active==="sql")result=input.replace(/\s+/g," ").replace(/\b(SELECT|FROM|WHERE|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|VALUES|SET)\b/gi,"\n$1").replace(/\b(AND|OR)\b/gi,"\n  $1").trim();
      else if(active==="yaml")result=toYaml(JSON.parse(input));setOutput(result);
    }catch(e){setOutput("");setError(e instanceof Error?e.message:"处理失败，请检查输入。")}}
  async function copyOutput(){await navigator.clipboard.writeText(output);setCopied(true);setTimeout(()=>setCopied(false),1400)}
  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">D_</span><div><strong>DevKit</strong><small>开发者工具箱</small></div></div><label className="search"><span>⌕</span><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder={`搜索 ${tools.length} 个工具...`}/><kbd>Ctrl K</kbd></label><div className="top-actions"><span className="local"><i/>本地处理</span><button onClick={()=>setTheme(theme==="dark"?"light":"dark")} aria-label="切换主题">{theme==="dark"?"☀":"☾"}</button></div></header>
    <aside className="sidebar"><nav>{categories.map((c,i)=><button onClick={()=>setCategory(c)} className={category===c?"selected":""} key={c}><span>{icons[i]}</span>{c}<em>{c==="常用收藏"?favorites.length:c==="最近使用"?recent.length:""}</em></button>)}</nav><div className="privacy"><span>◉</span><div><b>隐私优先</b><p>输入内容仅在本机浏览器中处理。</p></div></div><div className="version"><span>DevKit v0.3.1</span><span className="status-dot"/>运行正常</div></aside>
    <section className="content"><div className="welcome"><div><p className="eyebrow">DEVKIT V0.3 · LOCAL FIRST</p><h1>今天想解决什么问题？</h1><p>选择工具，输入数据，立即得到结果。</p></div><div className="pulse"><i/><span>{tools.length}</span><small>已上线工具</small></div></div>
      <div className="section-title"><h2>{query?`搜索结果 · ${visible.length}`:`${category} · ${visible.length}`}</h2><span>收藏与最近使用仅保存在本机</span></div>
      {visible.length?<div className="tool-grid">{visible.map(t=><div key={t.id} className={`tool-card ${active===t.id?"active":""}`} onClick={()=>selectTool(t.id)} role="button" tabIndex={0}><span className={`tool-icon ${t.color}`}>{t.icon}</span><span><b>{t.name}</b><small>{t.desc}</small></span>{t.tag&&<em>{t.tag}</em>}<button className={`favorite ${favorites.includes(t.id)?"on":""}`} onClick={e=>{e.stopPropagation();toggleFavorite(t.id)}} aria-label="收藏工具">★</button></div>)}</div>:<div className="empty"><b>这里还是空的</b><span>可以通过工具卡片右下角的星标加入收藏。</span></div>}
      <section className="workspace"><div className="workspace-head"><div className={`tool-icon ${current.color}`}>{current.icon}</div><div><p>{current.category}</p><h2>{current.name}</h2></div><button className={`head-favorite ${favorites.includes(active)?"on":""}`} onClick={()=>toggleFavorite(active)}>★ {favorites.includes(active)?"已收藏":"收藏"}</button><span className="secure">● 本地安全处理</span></div>
        {active==="password"?<div className="password-workspace"><div className="password-config"><label><span>密码长度</span><input type="number" min="4" max="128" value={passwordLength} onChange={e=>setPasswordLength(Math.min(128,Math.max(4,Number(e.target.value)||4)))}/></label><label><span>生成数量</span><input type="number" min="1" max="50" value={passwordCount} onChange={e=>setPasswordCount(Math.min(50,Math.max(1,Number(e.target.value)||1)))}/></label><fieldset><legend>字符组成</legend>{([['numbers','数字 0–9'],['lower','小写字母 a–z'],['upper','大写字母 A–Z'],['symbols','特殊符号']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={passwordGroups[key]} onChange={e=>setPasswordGroups({...passwordGroups,[key]:e.target.checked})}/><span>{label}</span></label>)}</fieldset><p>使用浏览器安全随机数生成；每个密码至少包含一个已选择类别的字符。</p></div><div className="editor password-output"><div className="editor-bar"><b>生成结果</b><button onClick={copyOutput}>{copied?"已复制":"复制全部"}</button></div><textarea value={error||output} className={error?"has-error":""} readOnly placeholder="点击下方按钮生成密码"/></div></div>:<div className="editors"><div className="editor"><div className="editor-bar"><b>输入</b><button onClick={()=>setInput("")}>清空</button></div><textarea value={input} onChange={e=>setInput(e.target.value)} spellCheck={false}/></div><button className="run" onClick={()=>runTool()} aria-label="执行">→</button><div className="editor"><div className="editor-bar"><b>输出</b><button onClick={copyOutput}>{copied?"已复制":"复制"}</button></div><textarea value={error||output} className={error?"has-error":""} readOnly placeholder="结果将显示在这里"/></div></div>}
        <div className="workspace-actions"><button className="primary" onClick={()=>runTool()}>执行转换 <kbd>Ctrl ↵</kbd></button>{active==="json"&&<button onClick={()=>runTool("minify")}>压缩 JSON</button>}{["base64","url","unicode","entities","ascii","escape"].includes(active)&&<button onClick={()=>runTool("decode")}>{active==="ascii"?"ASCII → 字符":active==="escape"?"去除转义符":"解码"}</button>}{active==="chinese"&&<><button onClick={()=>runTool()}>简体 → 繁体</button><button onClick={()=>runTool("simplified")}>繁体 → 简体</button></>}{active==="case"&&<><button onClick={()=>runTool()}>小写 → 大写</button><button onClick={()=>runTool("lower")}>大写 → 小写</button></>}{active==="color"&&<><button onClick={()=>runTool("rgb")}>HEX → RGB</button><button onClick={()=>runTool("hex")}>RGB → HEX</button></>}{active==="cron"&&<><button onClick={()=>runTool()}>Linux</button><button onClick={()=>runTool("spring")}>Java (Spring)</button><button onClick={()=>runTool("quartz")}>Java (Quartz)</button></>}{active==="units"&&<button onClick={()=>runTool("decode")}>rem 转 px</button>}{active==="sortlines"&&<button onClick={()=>runTool("desc")}>降序排序</button>}{active==="hash"&&<><button onClick={()=>runTool("sha1")}>SHA-1</button><button onClick={()=>runTool("sha512")}>SHA-512</button></>}{active==="text"&&<><button onClick={()=>runTool("upper")}>大写</button><button onClick={()=>runTool("lower")}>小写</button><button onClick={()=>runTool("unique")}>去重复行</button><button onClick={()=>runTool("remove-empty")}>去除空行</button><button onClick={()=>runTool("trim-start")}>去除行首空格/Tab</button><button onClick={()=>runTool("trim-end")}>去除行尾空格/Tab</button><button onClick={()=>runTool("sort-asc")}>升序</button><button onClick={()=>runTool("sort-desc")}>降序</button></>}</div>
      </section>
    </section>
  </main>;
}
