import { it } from "../locales/it";
import type { FoodLike, Profile } from "../services/nutrition";
import { KEY, profiles, blocked, escape, number, knownSnapshot, snapshotFor, validProfile, saveProfiles, download } from "../services/nutrition";
const units: Record<string, string> = {
  pezzi: it.onePiece,
  fette: it.oneSlice,
  scatolette: it.oneCan,
  cucchiai: it.oneTablespoon,
  porzioni: it.oneServing,
  tazze: it.oneCup
};
export function attachEditorNutrition(dialog: HTMLDialogElement, foods: FoodLike[]): void {
  dialog.querySelectorAll<HTMLElement>('[data-food]').forEach(row => {
    const food = foods.find(f => f.id === row.dataset.food);
    if (!food) return;
    const previous = knownSnapshot(food.nutrition);
    const exact = profiles.find(p => p.name.toLocaleLowerCase() === food.name.toLocaleLowerCase());
    const selected = previous ? '__keep' : exact?.id || '';
    const field = document.createElement('label');
    field.className = 'field nutrition-profile-field';
    field.innerHTML = `${it.nutritionProfile}<select data-nutrition-profile><option value="">${it.noNutritionData}</option>${previous ? `<option value="__keep">${it.keepSavedNutritionSnapshot}</option>` : ''}${profiles.map(p => `<option value="${escape(p.id)}">${escape(p.name)} · per 100 ${p.basis}</option>`).join('')}</select><small class="help">${previous ? it.keepSnapshotOnlyPreservesThe : it.matchTheActualProductAnd}</small>`;
    row.querySelector('.editor-grid')?.after(field);
    const select = field.querySelector<HTMLSelectElement>('select')!;
    select.value = selected;
    const info = document.createElement('p');
    info.className = 'help';
    field.after(info);
    const refresh = () => {
      const amount = row.querySelector<HTMLInputElement>('[data-key="amount"]')!.valueAsNumber;
      const unit = row.querySelector<HTMLSelectElement>('[data-key="unit"]')!.value;
      if (select.value === '__keep') {
        info.textContent = amount === food.amount && unit === food.unit ? it.theSavedValuesWillBe : it.quantityChangedSelectAProfile;
        return;
      }
      const p = profiles.find(p => p.id === select.value);
      if (!p) {
        info.textContent = it.thisFoodWillBeMarked;
        return;
      }
      const values = snapshotFor(p, amount, unit);
      info.textContent = values ? `${number(values.kcal)} kcal · P ${number(values.protein)} g · C ${number(values.carbs)} g · F ${number(values.fat)} g` : `${it.noConversionFrom} ${unit} a ${p.basis}${it.editThisProfileOrLog} ${p.basis}.`;
    };
    row.querySelectorAll('input,select').forEach(el => el.addEventListener('input', refresh));
    refresh();
  });
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button secondary full';
  button.textContent = it.manageNutritionProfiles;
  button.style.marginBottom = '12px';
  const form = dialog.querySelector('#meal-form');
  form?.before(button);
  button.addEventListener('click', () => openLibrary(() => {
    // Refresh options without replacing user-entered names or amounts.
    dialog.querySelectorAll<HTMLSelectElement>('[data-nutrition-profile]').forEach(select => {
      const value = select.value;
      const hasKeep = Array.from(select.options).some(o => o.value === '__keep');
      select.innerHTML = `<option value="">${it.noNutritionData}</option>${hasKeep ? `<option value="__keep">${it.keepSavedNutritionSnapshot}</option>` : ''}${profiles.map(p => `<option value="${escape(p.id)}">${escape(p.name)} · per 100 ${p.basis}</option>`).join('')}`;
      select.value = Array.from(select.options).some(o => o.value === value) ? value : '';
      select.dispatchEvent(new Event('input', {
        bubbles: true
      }));
    });
  }));
}
export function captureNutrition(dialog: HTMLDialogElement, foods: FoodLike[], originals: FoodLike[]): FoodLike[] | null {
  const updated: FoodLike[] = [];
  for (const food of foods) {
    const row = Array.from(dialog.querySelectorAll<HTMLElement>('[data-food]')).find(r => r.dataset.food === food.id);
    const selected = row?.querySelector<HTMLSelectElement>('[data-nutrition-profile]')?.value || '';
    const copy: FoodLike = {
      ...food
    };
    delete copy.nutrition;
    if (selected === '__keep') {
      const original = originals.find(f => f.id === food.id);
      if (!original || !knownSnapshot(original.nutrition) || original.amount !== food.amount || original.unit !== food.unit || original.name !== food.name) {
        alert(`${it.selectANutritionProfileTo} ${food.name} ${it.afterChangingItsQuantityOr}`);
        return null;
      }
      copy.nutrition = {
        ...original.nutrition
      };
    } else if (selected) {
      const profile = profiles.find(p => p.id === selected);
      const snapshot = profile ? snapshotFor(profile, food.amount, food.unit) : undefined;
      if (!snapshot) {
        alert(`${it.noValidUnitConversionIs} ${food.name}${it.useItsProfileSG}`);
        return null;
      }
      copy.nutrition = snapshot;
    }
    updated.push(copy);
  }
  return updated;
}
export function openLibrary(onClose?: () => void): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'nutrition-dialog';
  dialog.setAttribute('aria-label', it.nutritionLibrary);
  document.body.appendChild(dialog);
  const close = () => {
    dialog.close();
    dialog.remove();
    onClose?.();
  };
  const show = (id?: string) => {
    const profile = profiles.find(p => p.id === id);
    dialog.innerHTML = `<div class="section-heading"><h2>${it.nutritionLibrary}</h2><button type="button" class="button secondary" id="close-library">${it.close}</button></div><p class="help">${it.enterLabelValuesPerG}</p>${blocked ? `<p role="alert" class="help">${it.archiveUnreadableEditingIsDisabled}</p>` : ''}<div class="actions"><button type="button" class="button secondary" id="export-profiles">${it.exportProfiles}</button><label class="button secondary">${it.importProfiles}<input id="import-profiles" type="file" accept="application/json,.json" hidden></label></div><label class="field">${it.existingProfile}<select id="profile-picker"><option value="">${it.createANewProfile}</option>${profiles.map(p => `<option value="${escape(p.id)}" ${p.id === id ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select></label><form id="profile-form"><label class="field">${it.foodBrandRawOrCooked}<input name="name" required maxlength="160" value="${escape(profile?.name || '')}" placeholder="${it.eGPastaBrandDry}"></label><label class="field">${it.referenceBasis}<select name="basis"><option value="g" ${profile?.basis === 'g' ? 'selected' : ''}>Per 100 g</option><option value="ml" ${profile?.basis === 'ml' ? 'selected' : ''}>Per 100 ml</option></select></label><div class="nutrition-input-grid">${([['kcal', it.caloriesKcal], ['protein', it.proteinG], ['carbs', it.carbsG], ['fat', it.fatG]] as const).map(([key, label]) => `<label class="field">${label}<input name="${key}" type="number" step="any" min="0" inputmode="decimal" required value="${profile ? profile[key] : ''}"></label>`).join('')}</div><label class="field">${it.sourceNotes}<input name="source" required value="${escape(profile?.source || '')}" placeholder="${it.packageLabelOrDatabaseAnd}"></label><details><summary>${it.optionalPortionConversions}</summary><p class="help">${it.measuredAmountInTheReference}</p><div class="nutrition-input-grid">${Object.entries(units).map(([unit, label]) => `<label class="field">${label}<input name="portion-${unit}" type="number" min="0.01" step="any" inputmode="decimal" value="${profile?.portions[unit] ?? ''}"></label>`).join('')}</div></details><button type="submit" class="button primary full" style="margin-top:16px">${profile ? it.updateProfile : it.saveNewProfile}</button></form><p class="help">${it.existingMealSnapshotsAreNot}</p>`;
    dialog.querySelector('#close-library')?.addEventListener('click', close);
    dialog.querySelector<HTMLSelectElement>('#profile-picker')?.addEventListener('change', e => show((e.target as HTMLSelectElement).value));
    dialog.querySelector('#export-profiles')?.addEventListener('click', () => {
      try {
        download(blocked ? localStorage.getItem(KEY) || '[]' : JSON.stringify(profiles, null, 2), 'nutrition-profiles.json');
      } catch {
        alert(it.exportFailed);
      }
    });
    dialog.querySelector<HTMLInputElement>('#import-profiles')?.addEventListener('change', async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const data: unknown = JSON.parse(await file.text());
        if (!Array.isArray(data) || !data.every(validProfile) || new Set(data.map(p => p.id)).size !== data.length) throw new Error('Invalid');
        if (!confirm(it.replaceYourNutritionLibraryWith)) return;
        if (saveProfiles(data)) show();
      } catch {
        alert(it.invalidNutritionBackupNoData);
      }
    });
    dialog.querySelector<HTMLFormElement>('#profile-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const data = new FormData(form);
      const portions: Record<string, number> = {};
      for (const unit of Object.keys(units)) {
        const value = String(data.get(`portion-${unit}`) || '');
        if (value) portions[unit] = Number(value);
      }
      const next: Profile = {
        id: profile?.id || `profile-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: String(data.get('name') || '').trim(),
        basis: data.get('basis') === 'ml' ? 'ml' : 'g',
        source: String(data.get('source') || '').trim(),
        kcal: Number(data.get('kcal')),
        protein: Number(data.get('protein')),
        carbs: Number(data.get('carbs')),
        fat: Number(data.get('fat')),
        portions
      };
      if (!validProfile(next) || !next.source) {
        alert(it.checkAllRequiredFields);
        return;
      }
      if (saveProfiles([...profiles.filter(p => p.id !== next.id), next])) {
        alert(it.profileSavedCloseTheLibrary);
        show(next.id);
      }
    });
  };
  dialog.addEventListener('cancel', e => {
    e.preventDefault();
    close();
  });
  show();
  dialog.showModal();
}
