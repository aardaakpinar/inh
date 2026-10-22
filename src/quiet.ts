// node:sqlite hala "experimental" isaretli; her acilista cikan uyariyi sustur.
// Bu modul, node:sqlite iceren modullerden ONCE import edilmelidir.
const original = process.emitWarning.bind(process) as (...args: unknown[]) => void;

process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const first = args[0];
  const type = typeof first === "string" ? first : (first as { type?: string } | undefined)?.type;
  const text = typeof warning === "string" ? warning : warning.message;
  if (type === "ExperimentalWarning" && /sqlite/i.test(text)) return;
  original(warning, ...args);
}) as typeof process.emitWarning;

export {};
