import {
  createBackup,
  downloadJson,
  exportOriginalArchives,
  getStorageWarning,
  importBackup,
} from "../services/storage";
import { todayKey } from "../utils/helpers";
import { openDialog } from "./form-dialog";
import { showToast } from "./toast";

/**
 * Dialog to export all data to a file and to import a backup. `onImported`
 * runs after a successful import, so the app can reload its state.
 */
export function openDataDialog(onImported: () => void): void {
  const { dialog, close } = openDialog({
    title: "Backup dei dati",
    body: `
      <p class="help">Diario, prodotti personali, lista della spesa e dispensa sono salvati solo in questo browser. Esporta ogni tanto un backup: se cancelli i dati di navigazione, è l’unico modo per recuperarli.</p>
      <div class="actions">
        <button type="button" class="button primary" data-export>Esporta backup</button>
        <button type="button" class="button secondary" data-import>Importa backup…</button>
      </div>
      <input type="file" accept="application/json,.json" hidden data-file aria-label="File di backup">
      <p class="help">L’importazione sostituisce gli archivi contenuti nel file.</p>`,
  });

  const file = dialog.querySelector<HTMLInputElement>("[data-file]")!;

  dialog.querySelector("[data-export]")!.addEventListener("click", () => {
    // Unreadable archives cannot be re-serialized: export them exactly as stored.
    if (getStorageWarning()) return exportOriginalArchives();
    downloadJson(createBackup(), `diario-alimentare-backup-${todayKey()}.json`);
    showToast("Backup esportato nei download.");
  });

  dialog.querySelector("[data-import]")!.addEventListener("click", () => file.click());

  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    file.value = "";
    if (!selected) return;
    if (!importBackup(await selected.text())) return;
    close();
    onImported();
    showToast("Backup importato.");
  });
}
