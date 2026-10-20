// 조건부 클래스 합치기 — falsy 값은 버린다
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}
