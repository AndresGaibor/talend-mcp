export function generateTalendId(): string {
  return `_${Math.random().toString(36).slice(2, 24).padEnd(22, "0")}`;
}