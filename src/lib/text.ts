/** Remove quebras de linha e caracteres de controle de textos vindos do cliente ou do modelo. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

export const MAX_PREF_LENGTH = 40;
