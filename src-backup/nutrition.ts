/* Nutrition library and meal snapshots. No external dependencies. */
export type NutritionSnapshot = {
  profileId: string;
  profileName: string;
  source: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};
type Nutrients = { kcal: number; protein: number; carbs: number; fat: number };
type Profile = Nutrients & {
  id: string;
  name: string;
  basis: 'g' | 'ml';
  source: string;
  portions: Record<string, number>;
};
type FoodLike = {
  id: string;
  name: string;
  amount: number;
  unit: string;
  nutrition?: NutritionSnapshot;
};
type EntryLike = { mealId: string; foods: FoodLike[] };
const KEY = 'diario-alimentare:nutrition:v1';
const units: Record<string, string> = {
  pezzi: 'One piece', fette: 'One slice', scatolette: 'One can',
  cucchiai: 'One tablespoon', porzioni: 'One serving', tazze: 'One cup',
};
let profiles: Profile[] = [];
let blocked = false;
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
function record(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function nutrients(v: unknown): v is Nutrients {
  return record(v) && ['kcal','protein','carbs','fat'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k]) && (v[k] as number) >= 0);
}
function validProfile(v: unknown): v is Profile {
  if (!nutrients(v) || !record(v)) return false;
  return typeof v.id === 'string' && typeof v.name === 'string' && v.name.trim().length > 0 &&
    typeof v.source === 'string' && (v.basis === 'g' || v.basis === 'ml') &&
    record(v.portions) && Object.values(v.portions).every(n => typeof n === 'number' && Number.isFinite(n) && n > 0);
}
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(validProfile)) throw new Error('Invalid archive');
    profiles = parsed;
  }
} catch { blocked = true; }
function saveProfiles(next: Profile[]): boolean {
  if (blocked) { alert('The nutrition archive could not be read. Export it before making changes.'); return false; }
  try { localStorage.setItem(KEY, JSON.stringify(next)); profiles = next; return true; }
  catch { alert('Nutrition profiles could not be saved.'); return false; }
}
function download(value: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([value], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
function knownSnapshot(value: unknown): value is NutritionSnapshot {
  return nutrients(value) && record(value) && typeof value.profileId === 'string' && typeof value.profileName === 'string' && typeof value.source === 'string';
}
export function calculateNutrition(entries: EntryLike[]): { total: Nutrients; missing: number; known: number } {
  const total: Nutrients = {kcal:0,protein:0,carbs:0,fat:0};
  let missing = 0; let known = 0;
  for (const food of entries.flatMap(e => e.foods)) {
    if (!knownSnapshot(food.nutrition)) { missing++; continue; }
    known++;
    for (const key of ['kcal','protein','carbs','fat'] as const) total[key] += food.nutrition[key];
  }
  return {total,missing,known};
}
function macroHtml(result: ReturnType<typeof calculateNutrition>): string {
  return `<div class="macro-grid">${([['kcal','Calories','kcal'],['protein','Protein','g'],['carbs','Carbs','g'],['fat','Fat','g']] as const).map(([key,label,unit])=>`<div class="macro"><span>${label}</span><strong>${result.known ? number(result.total[key]) : '—'}</strong><small>${unit}</small></div>`).join('')}</div>`;
}
export function attachNutrition(entries: EntryLike[]): void {
  const macroGrid = document.querySelector<HTMLElement>('main > .card .macro-grid');
  const summary = macroGrid?.closest<HTMLElement>('.card');
  if (summary) {
    const result = calculateNutrition(entries);
    summary.innerHTML = `<div class="section-heading"><h2>${result.missing ? 'Known consumed macros' : 'Consumed macros'}</h2><span class="badge ${result.missing?'subtle':''}">${result.missing?'Incomplete':'Logged foods'}</span></div>${macroHtml(result)}<p class="help">${result.missing ? `${result.missing} logged food(s) have no nutrition snapshot. Reopen their meal, select a profile and confirm. Missing values are not treated as zero.` : result.known ? 'Calculated only from logged foods. Planned meals are excluded.' : 'No foods with nutrition data have been logged yet.'}</p><button type="button" class="button secondary full" id="nutrition-library">Manage nutrition profiles</button>`;
    summary.querySelector('#nutrition-library')?.addEventListener('click',()=>openLibrary());
  }
  document.querySelectorAll<HTMLElement>('.card.meal').forEach(card=>{
    const id = card.querySelector<HTMLButtonElement>('[data-edit]')?.dataset.edit;
    const entry = entries.find(e=>e.mealId===id);
    if (!entry) return;
    const result = calculateNutrition([entry]);
    const p = document.createElement('p'); p.className='help';
    p.textContent = result.known ? `${result.missing?'Known subtotal':'Meal total'}: ${number(result.total.kcal)} kcal · P ${number(result.total.protein)} g · C ${number(result.total.carbs)} g · F ${number(result.total.fat)} g${result.missing ? ` · ${result.missing} food(s) missing data` : ''}` : 'Nutrition data is missing for this meal.';
    card.querySelector('.actions')?.before(p);
  });
}
function snapshotFor(profile: Profile, amount: number, unit: string): NutritionSnapshot | undefined {
  const baseAmount = unit === profile.basis ? amount : profile.portions[unit] ? amount * profile.portions[unit]! : NaN;
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return undefined;
  const factor = baseAmount / 100;
  return {profileId:profile.id,profileName:profile.name,source:profile.source,
    kcal:profile.kcal*factor,protein:profile.protein*factor,carbs:profile.carbs*factor,fat:profile.fat*factor};
}
/* Called immediately after the meal editor is drawn. */
export function attachEditorNutrition(dialog: HTMLDialogElement, foods: FoodLike[]): void {
  dialog.querySelectorAll<HTMLElement>('[data-food]').forEach(row=>{
    const food = foods.find(f=>f.id===row.dataset.food);
    if (!food) return;
    const previous = knownSnapshot(food.nutrition);
    const exact = profiles.find(p=>p.name.toLocaleLowerCase()===food.name.toLocaleLowerCase());
    const selected = previous ? '__keep' : exact?.id || '';
    const field = document.createElement('label'); field.className='field nutrition-profile-field';
    field.innerHTML=`Nutrition profile<select data-nutrition-profile><option value="">No nutrition data</option>${previous?'<option value="__keep">Keep saved nutrition snapshot</option>':''}${profiles.map(p=>`<option value="${escape(p.id)}">${escape(p.name)} · per 100 ${p.basis}</option>`).join('')}</select><small class="help">${previous ? 'Keep snapshot only preserves the original quantity and unit. Select a profile to recalculate a changed portion.' : 'Match the actual product and its raw/cooked state.'}</small>`;
    row.querySelector('.editor-grid')?.after(field);
    const select = field.querySelector<HTMLSelectElement>('select')!; select.value=selected;
    const info = document.createElement('p'); info.className='help'; field.after(info);
    const refresh=()=>{
      const amount = row.querySelector<HTMLInputElement>('[data-key="amount"]')!.valueAsNumber;
      const unit = row.querySelector<HTMLSelectElement>('[data-key="unit"]')!.value;
      if (select.value==='__keep') {
        info.textContent=amount===food.amount && unit===food.unit ? 'The saved values will be preserved.' : 'Quantity changed: select a profile to recalculate. Confirming with “Keep” will be blocked.';
        return;
      }
      const p = profiles.find(p=>p.id===select.value);
      if (!p) {info.textContent='This food will be marked as missing nutrition data.';return;}
      const values=snapshotFor(p,amount,unit);
      info.textContent=values ? `${number(values.kcal)} kcal · P ${number(values.protein)} g · C ${number(values.carbs)} g · F ${number(values.fat)} g` : `No conversion from ${unit} to ${p.basis}. Edit this profile or log the measured amount in ${p.basis}.`;
    };
    row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',refresh)); refresh();
  });
  const button = document.createElement('button'); button.type='button'; button.className='button secondary full';
  button.textContent='Manage nutrition profiles'; button.style.marginBottom='12px';
  const form=dialog.querySelector('#meal-form'); form?.before(button);
  button.addEventListener('click',()=>openLibrary(()=>{
    // Refresh options without replacing user-entered names or amounts.
    dialog.querySelectorAll<HTMLSelectElement>('[data-nutrition-profile]').forEach(select=>{
      const value=select.value; const hasKeep=Array.from(select.options).some(o=>o.value==='__keep');
      select.innerHTML=`<option value="">No nutrition data</option>${hasKeep?'<option value="__keep">Keep saved nutrition snapshot</option>':''}${profiles.map(p=>`<option value="${escape(p.id)}">${escape(p.name)} · per 100 ${p.basis}</option>`).join('')}`;
      select.value=Array.from(select.options).some(o=>o.value===value)?value:'';
      select.dispatchEvent(new Event('input',{bubbles:true}));
    });
  }));
}
/* Returns a new food array; the previous entries are never mutated. */
export function captureNutrition(dialog: HTMLDialogElement, foods: FoodLike[], originals: FoodLike[]): FoodLike[] | null {
  const updated: FoodLike[] = [];
  for (const food of foods) {
    const row=Array.from(dialog.querySelectorAll<HTMLElement>('[data-food]')).find(r=>r.dataset.food===food.id);
    const selected=row?.querySelector<HTMLSelectElement>('[data-nutrition-profile]')?.value || '';
    const copy: FoodLike={...food}; delete copy.nutrition;
    if (selected==='__keep') {
      const original=originals.find(f=>f.id===food.id);
      if (!original || !knownSnapshot(original.nutrition) || original.amount!==food.amount || original.unit!==food.unit) {
        alert(`Select a nutrition profile to recalculate ${food.name} after changing its quantity or unit.`); return null;
      }
      copy.nutrition={...original.nutrition};
    } else if (selected) {
      const profile=profiles.find(p=>p.id===selected);
      const snapshot=profile?snapshotFor(profile,food.amount,food.unit):undefined;
      if (!snapshot) {alert(`No valid unit conversion is available for ${food.name}. Use its profile's g/ml basis or add a portion weight.`);return null;}
      copy.nutrition=snapshot;
    }
    updated.push(copy);
  }
  return updated;
}
function openLibrary(onClose?:()=>void): void {
  const dialog=document.createElement('dialog');dialog.className='nutrition-dialog';dialog.setAttribute('aria-label','Nutrition library');document.body.appendChild(dialog);
  const close=()=>{dialog.close();dialog.remove();onClose?.();};
  const show=(id?:string)=>{
    const profile=profiles.find(p=>p.id===id);
    dialog.innerHTML=`<div class="section-heading"><h2>Nutrition library</h2><button type="button" class="button secondary" id="close-library">Close</button></div><p class="help">Enter label values per 100 g or 100 ml. Zero is allowed only when the source says zero. No nutritional values are prefilled.</p>${blocked?'<p role="alert" class="help">Archive unreadable. Editing is disabled.</p>':''}<div class="actions"><button type="button" class="button secondary" id="export-profiles">Export profiles</button><label class="button secondary">Import profiles<input id="import-profiles" type="file" accept="application/json,.json" hidden></label></div><label class="field">Existing profile<select id="profile-picker"><option value="">Create a new profile</option>${profiles.map(p=>`<option value="${escape(p.id)}" ${p.id===id?'selected':''}>${escape(p.name)}</option>`).join('')}</select></label><form id="profile-form"><label class="field">Food / brand / raw or cooked<input name="name" required maxlength="160" value="${escape(profile?.name||'')}" placeholder="e.g. Pasta · brand · dry"></label><label class="field">Reference basis<select name="basis"><option value="g" ${profile?.basis==='g'?'selected':''}>Per 100 g</option><option value="ml" ${profile?.basis==='ml'?'selected':''}>Per 100 ml</option></select></label><div class="nutrition-input-grid">${([['kcal','Calories (kcal)'],['protein','Protein (g)'],['carbs','Carbs (g)'],['fat','Fat (g)']] as const).map(([key,label])=>`<label class="field">${label}<input name="${key}" type="number" step="any" min="0" inputmode="decimal" required value="${profile?profile[key]:''}"></label>`).join('')}</div><label class="field">Source / notes<input name="source" required value="${escape(profile?.source||'')}" placeholder="Package label, or database and entry"></label><details><summary>Optional portion conversions</summary><p class="help">Measured amount in the reference unit (g or ml) for ONE piece, slice, can, etc. Leave unknown values blank.</p><div class="nutrition-input-grid">${Object.entries(units).map(([unit,label])=>`<label class="field">${label}<input name="portion-${unit}" type="number" min="0.01" step="any" inputmode="decimal" value="${profile?.portions[unit]??''}"></label>`).join('')}</div></details><button type="submit" class="button primary full" style="margin-top:16px">${profile?'Update profile':'Save new profile'}</button></form><p class="help">Existing meal snapshots are not changed when you update a profile.</p>`;
    dialog.querySelector('#close-library')?.addEventListener('click',close);
    dialog.querySelector<HTMLSelectElement>('#profile-picker')?.addEventListener('change',e=>show((e.target as HTMLSelectElement).value));
    dialog.querySelector('#export-profiles')?.addEventListener('click',()=>{try{download(blocked?localStorage.getItem(KEY)||'[]':JSON.stringify(profiles,null,2),'nutrition-profiles.json');}catch{alert('Export failed.');}});
    dialog.querySelector<HTMLInputElement>('#import-profiles')?.addEventListener('change',async e=>{
      const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;
      try{
        const data:unknown=JSON.parse(await file.text());
        if(!Array.isArray(data)||!data.every(validProfile)||new Set(data.map(p=>p.id)).size!==data.length)throw new Error('Invalid');
        if(!confirm('Replace your nutrition library with this file? Export your current library first. Logged snapshots will not be changed.'))return;
        if(saveProfiles(data))show();
      }catch{alert('Invalid nutrition backup. No data was changed.');}
    });
    dialog.querySelector<HTMLFormElement>('#profile-form')?.addEventListener('submit',e=>{
      e.preventDefault();const form=e.target as HTMLFormElement;const data=new FormData(form);
      const portions:Record<string,number>={};
      for(const unit of Object.keys(units)){const value=String(data.get(`portion-${unit}`)||'');if(value)portions[unit]=Number(value);}
      const next:Profile={id:profile?.id||`profile-${Date.now()}-${Math.random().toString(36).slice(2)}`,name:String(data.get('name')||'').trim(),basis:data.get('basis')==='ml'?'ml':'g',source:String(data.get('source')||'').trim(),kcal:Number(data.get('kcal')),protein:Number(data.get('protein')),carbs:Number(data.get('carbs')),fat:Number(data.get('fat')),portions};
      if(!validProfile(next)||!next.source){alert('Check all required fields.');return;}
      if(saveProfiles([...profiles.filter(p=>p.id!==next.id),next])){alert('Profile saved. Close the library and select it in your meal.');show(next.id);}
    });
  };
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});show();dialog.showModal();
}
