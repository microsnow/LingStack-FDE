export type CipherName = "aes" | "des" | "tripledes" | "rabbit" | "rc4";

function cipherInput(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('请输入 JSON，例如 {"text":"内容","key":"口令"}');
  }
  if (!parsed || typeof parsed !== "object") throw new Error("输入必须是 JSON 对象");
  const { text, key } = parsed as Record<string, unknown>;
  if (typeof text !== "string" || typeof key !== "string" || !key)
    throw new Error("text 必须是字符串，key 必须是非空字符串");
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
    throw new Error("解密失败，请检查密文和口令");
  }
  if (!result && text) throw new Error("解密结果为空，请检查密文和口令");
  return result;
}
