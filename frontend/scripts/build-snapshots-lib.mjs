/**
 * Snapshots gravados no build (FR-011): a última cópia de `settings.json`, `ministries.json` e `home.json`, embutida no
 * pacote como terceira e última fonte do leitor de snapshots (arquivo `/data` → API → build), com o aviso "Algumas
 * informações podem estar desatualizadas.". O deploy baixa os arquivos do ambiente publicado antes de compilar.
 *
 * A origem é `BUILD_SNAPSHOTS_FROM`: uma URL base (`https://homolog.pibls.com/data`) ou uma pasta com os três arquivos.
 * Sem ela, o build não leva snapshot nenhum e, se tudo falhar em tempo de execução, a página mostra o erro com
 * "Tentar novamente". Um arquivo que não vem ou vem fora do formato não derruba o build: fica de fora, com aviso.
 */

export const SNAPSHOT_NAMES = ["settings", "ministries", "home"];

/** `{ data, generated_at }` com `data` presente (contracts/snapshots.md). */
export function isSnapshotFile(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "data" in value &&
    value.data != null
  );
}

/** Caminho/URL de um snapshot a partir da origem. */
export function sourceOf(base, name) {
  return /^https?:\/\//i.test(base) ? `${base.replace(/\/+$/, "")}/${name}.json` : null;
}

/**
 * @param {string} base URL base ou pasta
 * @param {{ fetchText: (url: string) => Promise<string>, readText: (name: string) => string | null }} io
 * @returns {Promise<{ files: Record<string, string>, skipped: string[] }>} conteúdo a gravar e o que ficou de fora
 */
export async function collectSnapshots(base, io) {
  const files = {};
  const skipped = [];

  for (const name of SNAPSHOT_NAMES) {
    try {
      const url = sourceOf(base, name);
      const text = url ? await io.fetchText(url) : io.readText(name);
      if (text === null) throw new Error("arquivo não encontrado");

      const parsed = JSON.parse(text);
      if (!isSnapshotFile(parsed)) throw new Error("fora do formato { data, generated_at }");
      // Só os campos do contrato, regravados: nada além do que o site público já serve
      files[name] =
        `${JSON.stringify({ data: parsed.data, generated_at: parsed.generated_at ?? null })}\n`;
    } catch (error) {
      skipped.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { files, skipped };
}
