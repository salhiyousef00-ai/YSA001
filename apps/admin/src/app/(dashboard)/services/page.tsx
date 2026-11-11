import type { Service } from '@wasla/shared';
import { requireAdmin } from '@/lib/supabase';
import { upsertService } from '../actions';

function ServiceForm({ s }: { s?: Service }) {
  return (
    <form action={upsertService} className="card stack">
      {s ? <input type="hidden" name="id" value={s.id} /> : null}
      <div className="row">
        <label>Slug<input name="slug" defaultValue={s?.slug} required pattern="[a-z0-9-]+" /></label>
        <label>Icône<input name="icon" defaultValue={s?.icon ?? 'briefcase'} /></label>
        <label>Ordre<input name="sort_order" type="number" defaultValue={s?.sort_order ?? 0} style={{ width: 90 }} /></label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" name="is_active" defaultChecked={s?.is_active ?? true} /> Actif</label>
      </div>
      <div className="row">
        <label>Nom (FR)<input name="name_fr" defaultValue={s?.name_fr} required /></label>
        <label>Nom (AR)<input name="name_ar" defaultValue={s?.name_ar} required dir="rtl" /></label>
        <label>Nom (EN)<input name="name_en" defaultValue={s?.name_en} required /></label>
      </div>
      <label>Description (FR)<textarea name="description_fr" defaultValue={s?.description_fr} /></label>
      <label>Description (AR)<textarea name="description_ar" defaultValue={s?.description_ar} dir="rtl" /></label>
      <label>Description (EN)<textarea name="description_en" defaultValue={s?.description_en} /></label>
      <div><button className="btn">{s ? 'Enregistrer' : 'Ajouter le service'}</button></div>
    </form>
  );
}

export default async function Services({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from('services').select('*').order('sort_order');
  return (
    <div className="stack">
      <h1>Catalogue de services</h1>
      {error ? <p className="alert">{decodeURIComponent(error)}</p> : null}
      {((data ?? []) as Service[]).map((s) => <ServiceForm key={s.id} s={s} />)}
      <h2>Nouveau service</h2>
      <ServiceForm />
    </div>
  );
}
