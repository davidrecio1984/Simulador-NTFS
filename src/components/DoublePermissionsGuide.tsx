import React, { useState } from 'react';
import { Check, Folder, FileText, Network, ArrowRight, X } from 'lucide-react';
import { ALL_NTFS_PERMISSIONS, SCOPE_OPTIONS } from '../utils/ntfsEngine';

type ShareOpt = 'read' | 'change' | 'full' | 'deny';
type NtfsOpt = 'read' | 'modify' | 'full' | 'create_only';

export const DoublePermissionsGuide: React.FC = () => {
  const [objectFocus, setObjectFocus] = useState<'folder' | 'file'>('folder');
  const [sharePerm, setSharePerm] = useState<ShareOpt>('change');
  const [ntfsPerm, setNtfsPerm] = useState<NtfsOpt>('read');

  const dualPermissions = ALL_NTFS_PERMISSIONS.filter((p) => p.isDual);

  const computeIntersectionSummary = (): {
    result: string;
    detail: string;
    canRead: boolean;
    canCreate: boolean;
    canModify: boolean;
    canDelete: boolean;
    canChangeAcl: boolean;
  } => {
    if (sharePerm === 'deny') {
      return {
        result: 'Acceso denegado (0 permisos)',
        detail: 'Un «Denegar» en los permisos de red anula cualquier permiso local NTFS al conectar desde otro equipo.',
        canRead: false,
        canCreate: false,
        canModify: false,
        canDelete: false,
        canChangeAcl: false,
      };
    }

    const rankShare: Record<Exclude<ShareOpt, 'deny'>, number> = {
      read: 1,
      change: 2,
      full: 3,
    };
    const rankNtfs: Record<NtfsOpt, number> = {
      read: 1,
      create_only: 1.5,
      modify: 2,
      full: 3,
    };

    const sRank = rankShare[sharePerm];
    const nRank = rankNtfs[ntfsPerm];
    const minRank = Math.min(sRank, nRank);

    if (ntfsPerm === 'create_only' && sRank >= 2) {
      return {
        result: 'Lectura + Crear archivos (sin modificar/borrar)',
        detail: 'La red permite Cambiar (incluye crear/escribir/borrar), pero el permiso local NTFS filtra solo hasta crear archivos.',
        canRead: true,
        canCreate: true,
        canModify: false,
        canDelete: false,
        canChangeAcl: false,
      };
    }

    if (minRank <= 1) {
      return {
        result: 'Solo Lectura efectiva',
        detail:
          sRank < nRank
            ? 'El permiso de red (Leer) recorta al permiso local NTFS más amplio.'
            : 'El permiso local NTFS (Lectura) recorta al permiso de red más amplio.',
        canRead: true,
        canCreate: false,
        canModify: false,
        canDelete: false,
        canChangeAcl: false,
      };
    }

    if (minRank === 2) {
      return {
        result: 'Modificar / Cambiar efectivo',
        detail: 'Puede leer, crear, modificar y eliminar archivos/carpetas, pero no cambiar permisos NTFS ni tomar posesión.',
        canRead: true,
        canCreate: true,
        canModify: true,
        canDelete: true,
        canChangeAcl: false,
      };
    }

    return {
      result: 'Control total efectivo',
      detail: 'Tanto la red como el sistema de archivos NTFS permiten Control total, incluida la administración de ACL y posesión.',
      canRead: true,
      canCreate: true,
      canModify: true,
      canDelete: true,
      canChangeAcl: true,
    };
  };

  const inter = computeIntersectionSummary();

  return (
    <div className="mx-auto max-w-[1200px] space-y-10 px-6 py-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Guía práctica de permisos dobles, ámbitos e intersección
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Referencia rápida para entender cómo interpreta Windows cada permiso especial según el tipo de objeto elegido en «Se aplica a:» y cómo se combinan los permisos compartidos en red con los permisos locales NTFS.
        </p>
      </div>

      {/* Section 1: Dual Permissions */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              1. Los cuatro permisos dobles de NTFS
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              El primer nombre se aplica cuando «Se aplica a:» incluye carpetas; el segundo cuando se aplica a archivos.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setObjectFocus('folder')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                objectFocus === 'folder'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Folder className="h-3.5 w-3.5 text-amber-600" />
              Vista: Carpeta / Subcarpeta
            </button>
            <button
              type="button"
              onClick={() => setObjectFocus('file')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                objectFocus === 'file'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-[#0067C0]" />
              Vista: Solo archivos
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {dualPermissions.map((perm) => {
            const [folderPart, filePart] = perm.label.split(' / ');
            return (
              <div
                key={perm.key}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-900">
                    <span className={objectFocus === 'folder' ? 'text-[#0067C0] underline underline-offset-4' : 'text-slate-400'}>
                      {folderPart}
                    </span>
                    <span className="text-slate-400"> / </span>
                    <span className={objectFocus === 'file' ? 'text-[#0067C0] underline underline-offset-4' : 'text-slate-400'}>
                      {filePart}
                    </span>
                  </span>
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-slate-700">
                  {objectFocus === 'folder' ? perm.folderMeaning : perm.fileMeaning}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50/60 p-4 text-xs leading-relaxed text-slate-700">
          <strong className="font-semibold text-slate-900">Regla clave en clase:</strong> si quieres que un usuario pueda{' '}
          <span className="font-medium text-slate-900">modificar archivos existentes pero NO crear nuevos</span>, marca{' '}
          <span className="font-mono text-[11px] font-medium text-[#0067C0]">Crear archivos / escribir datos</span> con ámbito{' '}
          <span className="font-medium text-slate-900">Solo archivos</span>. A la inversa, para un buzón de entrega donde cree un archivo nuevo sin modificar los ya subidos, aplícalo a{' '}
          <span className="font-medium text-slate-900">Solo esta carpeta</span>.
        </div>
      </section>

      {/* Section 2: 7 Scopes table */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">
          2. Combinaciones de «Se aplica a:» en Windows
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Determina exactamente qué objetos reciben la entrada de permiso (ACE) y qué se hereda hacia abajo.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 pr-4 font-semibold">Opción en «Se aplica a:»</th>
                <th className="px-4 py-2.5 text-center font-semibold">Esta carpeta</th>
                <th className="px-4 py-2.5 text-center font-semibold">Subcarpetas</th>
                <th className="px-4 py-2.5 text-center font-semibold">Archivos</th>
                <th className="py-2.5 pl-4 font-semibold">Uso típico en prácticas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SCOPE_OPTIONS.map((sc) => {
                const usageMap: Record<string, string> = {
                  this_folder_only: 'Buzón de entrega ciega o acceso a carpeta raíz sin heredar a subcarpetas.',
                  this_folder_subfolders_files: 'Herencia completa (Administradores, Profesor, Ejecutivos).',
                  this_folder_subfolders: 'Navegar por estructura de carpetas sin aplicar el permiso a archivos.',
                  this_folder_files: 'Carpetas sin historial de subcarpetas (ej. Enunciado_Examenes).',
                  subfolders_files_only: 'Reglas que solo deben afectar al contenido interno, no a la raíz.',
                  subfolders_only: 'Control exclusivo sobre subcarpetas hijas.',
                  files_only: 'Permitir modificar archivos existentes sin dejar crear archivos nuevos.',
                };
                return (
                  <tr key={sc.value} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-4 font-medium text-slate-900">{sc.label}</td>
                    <td className="px-4 py-2.5 text-center">
                      {sc.affectsThisFolder ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Aplica" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {sc.affectsSubfolders ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Aplica" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {sc.affectsFiles ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Aplica" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-4 text-slate-600">{usageMap[sc.value]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: Interactive Network vs NTFS Intersection Calculator */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-[#0067C0]" />
          <h2 className="text-base font-semibold text-slate-900">
            3. Calculadora de intersección: Red (Compartir) ∩ Local (NTFS)
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Cuando un usuario accede por ruta UNC (\\SERVIDOR\Recurso), el permiso resultante es siempre el mínimo (la intersección) entre ambos.
        </p>

        <div className="mt-5 grid gap-6 lg:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-700">Permiso en Red (Compartir)</p>
            <div className="space-y-1.5">
              {(
                [
                  { id: 'read', label: 'Leer' },
                  { id: 'change', label: 'Cambiar (+ Leer)' },
                  { id: 'full', label: 'Control total' },
                  { id: 'deny', label: 'Denegar todo' },
                ] as { id: ShareOpt; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSharePerm(opt.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    sharePerm === opt.id
                      ? 'border-[#0067C0] bg-sky-50 text-[#0067C0]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{opt.label}</span>
                  {sharePerm === opt.id && <ArrowRight className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-slate-700">Permiso local NTFS</p>
            <div className="space-y-1.5">
              {(
                [
                  { id: 'read', label: 'Lectura y ejecución' },
                  { id: 'create_only', label: 'Lectura + Crear archivos (Solo carpeta)' },
                  { id: 'modify', label: 'Modificar' },
                  { id: 'full', label: 'Control total' },
                ] as { id: NtfsOpt; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setNtfsPerm(opt.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    ntfsPerm === opt.id
                      ? 'border-[#0067C0] bg-sky-50 text-[#0067C0]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{opt.label}</span>
                  {ntfsPerm === opt.id && <ArrowRight className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">Permiso efectivo por red</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{inter.result}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">{inter.detail}</p>

            <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-3 text-xs">
              {[
                { label: 'Leer contenido', ok: inter.canRead },
                { label: 'Crear archivos', ok: inter.canCreate },
                { label: 'Modificar archivos', ok: inter.canModify },
                { label: 'Eliminar objetos', ok: inter.canDelete },
                { label: 'Cambiar permisos NTFS', ok: inter.canChangeAcl },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-slate-700">{row.label}</span>
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      row.ok ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {row.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {row.ok ? 'Permitido' : 'Denegado'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
