import { inputError, parseJson } from "./tool-errors";

export type CipherName = "aes" | "des" | "tripledes" | "rabbit" | "rc4";

function cipherInput(value: string) {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== "object")
    inputError("加解密输入不是 JSON 对象。", {
      suggestion: '使用 {"text":"内容","key":"口令"} 格式。',
    });
  const { text, key } = parsed as Record<string, unknown>;
  if (typeof text !== "string" || typeof key !== "string" || !key)
    inputError("text 或 key 字段无效。", {
      suggestion: "text 必须是字符串，key 必须是非空字符串。",
    });
  return { text, key };
}

export async function cipherRun(name: CipherName, decrypt: boolean, value: string) {
  const { default: CryptoJS } = await import("crypto-js");
  const { text, key } = cipherInput(value);
  const algorithms = {
    aes: CryptoJS.AES,
    des: CryptoJS.DES,
    tripledes: CryptoJS.TripleDES,
    rabbit: CryptoJS.Rabbit,
    rc4: CryptoJS.RC4,
  };
  if (!decrypt) return algorithms[name].encrypt(text, key).toString();
  let result = "";
  try {
    result = algorithms[name].decrypt(text, key).toString(CryptoJS.enc.Utf8);
  } catch {
    inputError("解密失败。", { suggestion: "检查密文、算法和口令是否完全匹配。" });
  }
  if (!result && text)
    inputError("解密结果为空。", { suggestion: "检查密文、算法和口令是否完全匹配。" });
  return result;
}
