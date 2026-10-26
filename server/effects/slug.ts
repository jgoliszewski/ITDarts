// File names for the sound library in the repo. Pure, so the effects page can show the name before the upload.

/** “Crowd roar!” → “crowd-roar”: a readable file name that stays put when the sound is renamed later. */
export function slug(name: string): string {
  const s = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return s || 'sound';
}
