export async function convertChinese(value: string, toSimplified: boolean) {
  if (toSimplified) {
    const { Converter } = await import("opencc-js/t2cn");
    return Converter({ from: "tw", to: "cn" })(value);
  }

  const { Converter } = await import("opencc-js/cn2t");
  return Converter({ from: "cn", to: "tw" })(value);
}
