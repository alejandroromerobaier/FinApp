export const APP_VERSION = '2.6.0';

export interface ProjectColorOption {
  id: string;
  name: string;
  gradient: string;
  previewClass: string;
}

export const PROJECT_COLOR_OPTIONS: ProjectColorOption[] = [
  {
    id: 'navy',
    name: 'Azul FinApp',
    gradient: 'bg-gradient-to-br from-[#000666] via-blue-900 to-indigo-950 shadow-blue-950/40',
    previewClass: 'bg-[#000666]'
  },
  {
    id: 'slate',
    name: 'Grafito',
    gradient: 'bg-gradient-to-br from-slate-800 via-slate-900 to-black shadow-slate-900/40',
    previewClass: 'bg-slate-800'
  },
  {
    id: 'emerald',
    name: 'Esmeralda',
    gradient: 'bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-950 shadow-emerald-950/40',
    previewClass: 'bg-emerald-600'
  },
  {
    id: 'violet',
    name: 'Amatista',
    gradient: 'bg-gradient-to-br from-purple-800 via-violet-950 to-slate-950 shadow-purple-950/40',
    previewClass: 'bg-violet-600'
  },
  {
    id: 'rose',
    name: 'Rubí',
    gradient: 'bg-gradient-to-br from-rose-800 via-pink-950 to-slate-950 shadow-rose-950/40',
    previewClass: 'bg-rose-600'
  },
  {
    id: 'amber',
    name: 'Ámbar',
    gradient: 'bg-gradient-to-br from-amber-700 via-yellow-950 to-slate-950 shadow-amber-950/40',
    previewClass: 'bg-amber-600'
  },
  {
    id: 'cyan',
    name: 'Océano',
    gradient: 'bg-gradient-to-br from-cyan-800 via-blue-950 to-slate-950 shadow-cyan-950/40',
    previewClass: 'bg-cyan-600'
  },
  {
    id: 'sunset',
    name: 'Atardecer',
    gradient: 'bg-gradient-to-br from-orange-700 via-rose-950 to-slate-950 shadow-orange-950/40',
    previewClass: 'bg-orange-600'
  }
];

export function getProjectGradient(colorId?: string, isPersonal: boolean = false): string {
  if (colorId) {
    const found = PROJECT_COLOR_OPTIONS.find(c => c.id === colorId);
    if (found) return found.gradient;
  }
  return isPersonal 
    ? 'bg-gradient-to-br from-[#000666] via-blue-900 to-indigo-950 shadow-blue-950/40' 
    : 'bg-gradient-to-br from-slate-800 via-slate-900 to-black shadow-slate-900/40';
}
