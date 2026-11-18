import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  FolderCog,
  Info,
  Network,
  Plus,
  Shield,
  ShieldAlert,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  AceType,
  ApplyToScope,
  NtfsAce,
  NtfsPermissionKey,
  ShareEntry,
  SharePermissionLevel,
  VirtualFolderNode,
  VirtualPrincipal,
} from '../types/ntfs';
import {
  ALL_NTFS_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  BASIC_PERMISSION_GROUPS,
  SCOPE_LABELS,
  SCOPE_OPTIONS,
  computeEffectivePermissions,
  getAllAcesForFolder,
  summarizeAceAccess,
} from '../utils/ntfsEngine';

export type ConsoleTab = 'security' | 'entry' | 'share' | 'effective';

interface NtfsConsoleProps {
  mode: 'scenarios' | 'sandbox';
  machineName: string;
  folder: VirtualFolderNode;
  allFolders: VirtualFolderNode[];
  principals: VirtualPrincipal[];
  activeTab: ConsoleTab;
  onChangeTab: (tab: ConsoleTab) => void;
  defaultPrincipalId: string;
  onUpdateFolder: (updated: VirtualFolderNode) => void;
  onDisableInheritance: (folderId: string, strategy: 'convert' | 'remove') => void;
  onEnableInheritance: (folderId: string) => void;
  onAddCustomPrincipal?: (name: string, kind: 'user' | 'group') => string;
}

export const NtfsConsole: React.FC<NtfsConsoleProps> = ({
  mode,
  machineName,
  folder,
  allFolders,
  principals,
  activeTab,
  onChangeTab,
  defaultPrincipalId,
  onUpdateFolder,
  onDisableInheritance,
  onEnableInheritance,
  onAddCustomPrincipal,
}) => {
  const [selectedAceId, setSelectedAceId] = useState<string | null>(null);
  const [showInheritanceDialog, setShowInheritanceDialog] = useState(false);
  const [aclNotice, setAclNotice] = useState<string | null>(null);

  // Entry Editor State
  const [editingAceId, setEditingAceId] = useState<string | null>(null);
  const [entryPrincipalId, setEntryPrincipalId] = useState<string>(defaultPrincipalId);
  const [entryType, setEntryType] = useState<AceType>('allow');
  const [entryScope, setEntryScope] = useState<ApplyToScope>('this_folder_subfolders_files');
  const [entryPerms, setEntryPerms] = useState<NtfsPermissionKey[]>([]);
  const [entryOnlyChildren, setEntryOnlyChildren] = useState(false);
  const [showBasicMode, setShowBasicMode] = useState(false);
  const [focusedPermKey, setFocusedPermKey] = useState<NtfsPermissionKey>('createFilesWriteData');

  // Sandbox custom principal creation
  const [newPrincipalName, setNewPrincipalName] = useState('');
  const [newPrincipalKind, setNewPrincipalKind] = useState<'user' | 'group'>('group');
  const [showAddPrincipalForm, setShowAddPrincipalForm] = useState(false);

  // Share tab state
  const [selectedSharePrincipalId, setSelectedSharePrincipalId] = useState<string>(
    folder.share?.entries[0]?.principalId ?? defaultPrincipalId
  );
  const [shareAddPrincipalId, setShareAddPrincipalId] = useState<string>(defaultPrincipalId);

  // Effective tab state
  const [effPrincipalId, setEffPrincipalId] = useState<string>(defaultPrincipalId);
  const [effMode, setEffMode] = useState<'local' | 'network'>('network');
  const [effTarget, setEffTarget] = useState<'thisFolder' | 'subfolders' | 'files'>('thisFolder');

  useEffect(() => {
    setSelectedAceId(null);
    setShowInheritanceDialog(false);
    setAclNotice(null);
    setEntryPrincipalId(defaultPrincipalId);
    setEffPrincipalId(defaultPrincipalId);
    setShareAddPrincipalId(defaultPrincipalId);
    if (folder.share?.entries.length) {
      setSelectedSharePrincipalId(folder.share.entries[0].principalId);
    }
  }, [folder.id, defaultPrincipalId]);

  const effectiveAces = getAllAcesForFolder(folder.id, allFolders);
  const selectedAce = effectiveAces.find((a) => a.id === selectedAceId) ?? null;

  const getPrincipalName = (id: string) =>
    principals.find((p) => p.id === id)?.displayName ??
    principals.find((p) => p.id === id)?.name ??
    id;

  const getPrincipalKind = (id: string) =>
    principals.find((p) => p.id === id)?.kind ?? 'user';

  const openNewEntryEditor = () => {
    setEditingAceId(null);
    setEntryPrincipalId(defaultPrincipalId);
    setEntryType('allow');
    setEntryScope('this_folder_only');
    setEntryPerms([]);
    setEntryOnlyChildren(false);
    setShowBasicMode(false);
    setAclNotice(null);
    onChangeTab('entry');
  };

  const openEditEntryEditor = (ace: NtfsAce) => {
    if (ace.inheritedFrom) {
      setAclNotice(
        `La entrada de «${getPrincipalName(ace.principalId)}» se hereda desde ${ace.inheritedFrom}. Deshabilita la herencia (convirtiendo permisos) para editarla.`
      );
      return;
    }
    setEditingAceId(ace.id);
    setEntryPrincipalId(ace.principalId);
    setEntryType(ace.type);
    setEntryScope(ace.scope);
    setEntryPerms([...ace.permissions]);
    setEntryOnlyChildren(Boolean(ace.onlyThisContainerChildren));
    setShowBasicMode(false);
    setAclNotice(null);
    onChangeTab('entry');
  };

  const handleRemoveAce = () => {
    if (!selectedAce) return;
    if (selectedAce.inheritedFrom) {
      setAclNotice(
        `No puedes quitar «${getPrincipalName(selectedAce.principalId)}» porque se hereda de ${selectedAce.inheritedFrom}. Pulsa «Deshabilitar herencia» primero.`
      );
      return;
    }
    const nextAces = folder.aces.filter((a) => a.id !== selectedAce.id);
    onUpdateFolder({ ...folder, aces: nextAces });
    setSelectedAceId(null);
    setAclNotice(`Entrada de «${getPrincipalName(selectedAce.principalId)}» eliminada.`);
  };

  const toggleAdvancedPermission = (key: NtfsPermissionKey) => {
    setFocusedPermKey(key);
    if (key === 'fullControl') {
      if (entryPerms.includes('fullControl')) {
        setEntryPerms([]);
      } else {
        setEntryPerms([...ALL_PERMISSION_KEYS]);
      }
      return;
    }

    const next = new Set(entryPerms);
    if (next.has(key)) {
      next.delete(key);
      next.delete('fullControl');
    } else {
      next.add(key);
      const allOthersPresent = ALL_PERMISSION_KEYS.filter((k) => k !== 'fullControl').every((k) =>
        next.has(k)
      );
      if (allOthersPresent) next.add('fullControl');
    }
    setEntryPerms(Array.from(next));
  };

  const toggleBasicGroup = (perms: NtfsPermissionKey[]) => {
    const current = new Set(entryPerms);
    const allChecked = perms.every((p) => current.has(p));
    if (allChecked) {
      for (const p of perms) current.delete(p);
      current.delete('fullControl');
    } else {
      for (const p of perms) current.add(p);
      const allOthersPresent = ALL_PERMISSION_KEYS.filter((k) => k !== 'fullControl').every((k) =>
        current.has(k)
      );
      if (allOthersPresent) current.add('fullControl');
    }
    setEntryPerms(Array.from(current));
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (entryPerms.length === 0) {
      setAclNotice('Selecciona al menos un permiso antes de aceptar la entrada.');
      return;
    }

    const newAce: NtfsAce = {
      id: editingAceId ?? `ace-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      principalId: entryPrincipalId,
      type: entryType,
      scope: entryScope,
      permissions: [...entryPerms],
      inheritedFrom: null,
      onlyThisContainerChildren: entryOnlyChildren,
    };

    const nextAces = editingAceId
      ? folder.aces.map((a) => (a.id === editingAceId ? newAce : a))
      : [...folder.aces, newAce];

    onUpdateFolder({ ...folder, aces: nextAces });
    setSelectedAceId(newAce.id);
    setEditingAceId(null);
    setAclNotice(
      `Entrada guardada: ${getPrincipalName(entryPrincipalId)} (${SCOPE_LABELS[entryScope]}).`
    );
    onChangeTab('security');
  };

  // Share handlers
  const ensureShareConfig = () =>
    folder.share ?? {
      shared: false,
      shareName: folder.name,
      hidden: false,
      entries: [
        {
          id: `sh-${Date.now()}`,
          principalId: 'admin',
          allow: ['read', 'change', 'full'],
          deny: [],
        },
      ],
    };

  const handleToggleShareEnabled = (checked: boolean) => {
    const current = ensureShareConfig();
    onUpdateFolder({
      ...folder,
      share: {
        ...current,
        shared: checked,
        hidden: current.shareName.trim().endsWith('$'),
      },
    });
  };

  const handleShareNameChange = (value: string) => {
    const current = ensureShareConfig();
    onUpdateFolder({
      ...folder,
      share: {
        ...current,
        shareName: value,
        hidden: value.trim().endsWith('$'),
      },
    });
  };

  const handleAddShareEntry = () => {
    const current = ensureShareConfig();
    if (current.entries.some((e) => e.principalId === shareAddPrincipalId)) {
      setSelectedSharePrincipalId(shareAddPrincipalId);
      return;
    }
    const newEntry: ShareEntry = {
      id: `sh-${Date.now()}`,
      principalId: shareAddPrincipalId,
      allow: ['read'],
      deny: [],
    };
    onUpdateFolder({
      ...folder,
      share: {
        ...current,
        entries: [...current.entries, newEntry],
      },
    });
    setSelectedSharePrincipalId(shareAddPrincipalId);
  };

  const handleRemoveShareEntry = (principalId: string) => {
    const current = ensureShareConfig();
    const nextEntries = current.entries.filter((e) => e.principalId !== principalId);
    onUpdateFolder({
      ...folder,
      share: {
        ...current,
        entries: nextEntries,
      },
    });
    if (selectedSharePrincipalId === principalId) {
      setSelectedSharePrincipalId(nextEntries[0]?.principalId ?? '');
    }
  };

  const handleToggleShareLevel = (
    principalId: string,
    column: 'allow' | 'deny',
    level: SharePermissionLevel
  ) => {
    const current = ensureShareConfig();
    const nextEntries = current.entries.map((entry) => {
      if (entry.principalId !== principalId) return entry;
      const allow = new Set(entry.allow);
      const deny = new Set(entry.deny);

      if (column === 'allow') {
        if (allow.has(level)) {
          allow.delete(level);
          if (level === 'read') {
            allow.delete('change');
            allow.delete('full');
          }
          if (level === 'change') {
            allow.delete('full');
          }
        } else {
          deny.delete(level);
          allow.add(level);
          if (level === 'full') {
            allow.add('change');
            allow.add('read');
            deny.delete('change');
            deny.delete('read');
          } else if (level === 'change') {
            allow.add('read');
            deny.delete('read');
          }
        }
      } else {
        if (deny.has(level)) {
          deny.delete(level);
        } else {
          allow.delete(level);
          deny.add(level);
        }
      }

      return {
        ...entry,
        allow: Array.from(allow),
        deny: Array.from(deny),
      };
    });

    onUpdateFolder({
      ...folder,
      share: {
        ...current,
        entries: nextEntries,
      },
    });
  };

  const handleCreateCustomPrincipal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddCustomPrincipal || !newPrincipalName.trim()) return;
    const newId = onAddCustomPrincipal(newPrincipalName.trim(), newPrincipalKind);
    setEntryPrincipalId(newId);
    setNewPrincipalName('');
    setShowAddPrincipalForm(false);
  };

  const scopeMeta = SCOPE_OPTIONS.find((s) => s.value === entryScope)!;
  const focusedPermMeta =
    ALL_NTFS_PERMISSIONS.find((p) => p.key === focusedPermKey) ?? ALL_NTFS_PERMISSIONS[5];
  const leftPermissions = ALL_NTFS_PERMISSIONS.filter((p) => p.column === 'left');
  const rightPermissions = ALL_NTFS_PERMISSIONS.filter((p) => p.column === 'right');

  const shareConfig = folder.share;
  const activeShareEntry = shareConfig?.entries.find(
    (e) => e.principalId === selectedSharePrincipalId
  );

  const effectiveCalc = computeEffectivePermissions(
    folder.id,
    effPrincipalId,
    effTarget,
    effMode,
    allFolders,
    principals
  );

  const tabs: { id: ConsoleTab; label: string }[] = [
    { id: 'security', label: 'Seguridad avanzada' },
    { id: 'entry', label: editingAceId ? 'Editar entrada de permiso' : 'Entrada de permiso' },
    { id: 'share', label: 'Compartir (Red)' },
    { id: 'effective', label: 'Acceso efectivo' },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      {/* Console Window Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <FolderCog className="h-5 w-5 text-[#0067C0]" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Configuración de seguridad avanzada para {folder.name}
            </h2>
            <p className="font-mono text-xs text-slate-500">
              {folder.path} · Propietario: {folder.owner}
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Herencia:{' '}
          <span className="font-semibold text-slate-800">
            {folder.inheritanceEnabled ? 'Habilitada' : 'Deshabilitada (explícita)'}
          </span>
        </div>
      </div>

      {/* Console Sub-Tabs */}
      <div
        role="tablist"
        aria-label="Secciones de propiedades NTFS"
        className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-6 pt-2"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChangeTab(tab.id)}
              className={`rounded-t-lg border-x border-t px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'border-slate-200 bg-white text-[#0067C0] font-semibold -mb-px pb-2.5'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Console Body */}
      <div className="p-6">
        {aclNotice && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50/70 px-3.5 py-2.5 text-xs text-slate-700">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-[#0067C0]" />
              {aclNotice}
            </span>
            <button
              type="button"
              onClick={() => setAclNotice(null)}
              aria-label="Cerrar aviso"
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* TAB 1: SEGURIDAD AVANZADA (ACL TABLE) */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-600">
                Haz doble clic en una entrada o selecciona una y pulsa «Editar» para ajustar el objeto y los permisos especiales.
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Tipo</th>
                    <th className="px-3 py-2.5 font-semibold">Entidad de seguridad</th>
                    <th className="px-3 py-2.5 font-semibold">Acceso</th>
                    <th className="px-3 py-2.5 font-semibold">Heredada de</th>
                    <th className="px-3 py-2.5 font-semibold">Se aplica a</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {effectiveAces.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        La lista de control de acceso (ACL) está vacía. Ningún usuario tiene acceso hasta que añadas una entrada.
                      </td>
                    </tr>
                  ) : (
                    effectiveAces.map((ace) => {
                      const isSelected = ace.id === selectedAceId;
                      const kind = getPrincipalKind(ace.principalId);
                      return (
                        <tr
                          key={ace.id}
                          onClick={() => setSelectedAceId(ace.id)}
                          onDoubleClick={() => openEditEntryEditor(ace)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                ace.type === 'allow' ? 'text-slate-800' : 'text-rose-700'
                              }`}
                            >
                              {ace.type === 'allow' ? (
                                <Shield className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                              )}
                              {ace.type === 'allow' ? 'Permitir' : 'Denegar'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-900">
                            <span className="inline-flex items-center gap-1.5">
                              {kind === 'user' ? (
                                <User className="h-3.5 w-3.5 text-slate-400" />
                              ) : (
                                <Users className="h-3.5 w-3.5 text-[#0067C0]" />
                              )}
                              {getPrincipalName(ace.principalId)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {summarizeAceAccess(ace.permissions)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">
                            {ace.inheritedFrom ?? 'Ninguno'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {SCOPE_LABELS[ace.scope]}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Windows-style action bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openNewEntryEditor}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0067C0] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#005A9E]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
                <button
                  type="button"
                  disabled={!selectedAce}
                  onClick={() => selectedAce && openEditEntryEditor(selectedAce)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={!selectedAce}
                  onClick={handleRemoveAce}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Quitar
                </button>
              </div>

              {folder.parentId && (
                <div>
                  {folder.inheritanceEnabled ? (
                    <button
                      type="button"
                      onClick={() => setShowInheritanceDialog((v) => !v)}
                      className="rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                    >
                      Deshabilitar herencia
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onEnableInheritance(folder.id);
                        setAclNotice('Herencia habilitada nuevamente desde la carpeta padre.');
                      }}
                      className="rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                    >
                      Habilitar herencia
                    </button>
                  )}
                </div>
              )}
            </div>

            {showInheritanceDialog && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="space-y-2.5 text-xs">
                    <p className="font-semibold text-slate-900">
                      Bloquear herencia — ¿Qué desea hacer con los permisos heredados actuales?
                    </p>
                    <p className="text-slate-600">
                      Está a punto de bloquear la herencia en este objeto, lo que significa que los permisos heredados de un objeto primario ya no se aplicarán a {folder.name}.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onDisableInheritance(folder.id, 'convert');
                          setShowInheritanceDialog(false);
                          setAclNotice(
                            'Herencia deshabilitada. Los permisos heredados se convirtieron en explícitos para que puedas editarlos o quitarlos.'
                          );
                        }}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-xs font-semibold text-[#0067C0] hover:bg-slate-50"
                      >
                        Convertir los permisos heredados en permisos explícitos en este objeto
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDisableInheritance(folder.id, 'remove');
                          setShowInheritanceDialog(false);
                          setAclNotice(
                            'Herencia deshabilitada y todos los permisos heredados eliminados.'
                          );
                        }}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Quitar todos los permisos heredados de este objeto
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ENTRADA DE PERMISO (OBJETO + PERMISOS ESPECIALES) */}
        {activeTab === 'entry' && (
          <form onSubmit={handleSaveEntry} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="entry-principal" className="block text-xs font-semibold text-slate-700">
                    Entidad de seguridad
                  </label>
                  {mode === 'sandbox' && onAddCustomPrincipal && (
                    <button
                      type="button"
                      onClick={() => setShowAddPrincipalForm((v) => !v)}
                      className="text-[11px] font-medium text-[#0067C0] hover:underline"
                    >
                      + Nuevo usuario/grupo
                    </button>
                  )}
                </div>
                <select
                  id="entry-principal"
                  value={entryPrincipalId}
                  onChange={(e) => setEntryPrincipalId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#0067C0] focus:outline-none"
                >
                  {principals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="entry-type" className="block text-xs font-semibold text-slate-700">
                  Tipo
                </label>
                <select
                  id="entry-type"
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as AceType)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#0067C0] focus:outline-none"
                >
                  <option value="allow">Permitir</option>
                  <option value="deny">Denegar</option>
                </select>
              </div>

              <div>
                <label htmlFor="entry-scope" className="block text-xs font-semibold text-slate-700">
                  Se aplica a: (Tipo de objeto)
                </label>
                <select
                  id="entry-scope"
                  value={entryScope}
                  onChange={(e) => setEntryScope(e.target.value as ApplyToScope)}
                  className="mt-1.5 w-full rounded-lg border border-[#0067C0] bg-sky-50/40 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none"
                >
                  {SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {showAddPrincipalForm && mode === 'sandbox' && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  type="text"
                  value={newPrincipalName}
                  onChange={(e) => setNewPrincipalName(e.target.value)}
                  placeholder="Nombre (ej. Ventas, Contable1)"
                  className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-[#0067C0] focus:outline-none"
                />
                <select
                  value={newPrincipalKind}
                  onChange={(e) => setNewPrincipalKind(e.target.value as 'user' | 'group')}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="group">Grupo</option>
                  <option value="user">Usuario</option>
                </select>
                <button
                  type="button"
                  onClick={handleCreateCustomPrincipal}
                  className="rounded-md bg-[#0067C0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#005A9E]"
                >
                  Crear entidad
                </button>
              </div>
            )}

            {/* Instant Object Scope Indicator */}
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
              <span className="font-semibold text-slate-700">Objetos afectados por este ámbito:</span>
              <span className={`inline-flex items-center gap-1 ${scopeMeta.affectsThisFolder ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
                {scopeMeta.affectsThisFolder ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                Esta carpeta ({folder.name})
              </span>
              <span className={`inline-flex items-center gap-1 ${scopeMeta.affectsSubfolders ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
                {scopeMeta.affectsSubfolders ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                Subcarpetas
              </span>
              <span className={`inline-flex items-center gap-1 ${scopeMeta.affectsFiles ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
                {scopeMeta.affectsFiles ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                Archivos
              </span>
            </div>

            {/* Header for Permissions section + Basic/Advanced Toggle */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-semibold text-slate-900">
                {showBasicMode ? 'Permisos básicos:' : 'Permisos avanzados (especiales):'}
              </span>
              <button
                type="button"
                onClick={() => setShowBasicMode((v) => !v)}
                className="text-xs font-medium text-[#0067C0] hover:underline"
              >
                {showBasicMode ? 'Mostrar permisos avanzados' : 'Mostrar permisos básicos'}
              </button>
            </div>

            {/* Basic or Advanced 14-checkbox Matrix */}
            {showBasicMode ? (
              <div className="space-y-2.5 py-1">
                {BASIC_PERMISSION_GROUPS.map((grp) => {
                  const isChecked = grp.permissions.every((p) => entryPerms.includes(p));
                  return (
                    <label
                      key={grp.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-xs text-slate-800 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleBasicGroup(grp.permissions)}
                        className="h-4 w-4 rounded border-slate-300 text-[#0067C0] focus:ring-[#0067C0]"
                      />
                      <span className="font-medium">{grp.label}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  {leftPermissions.map((perm) => {
                    const checked = entryPerms.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        onMouseEnter={() => setFocusedPermKey(perm.key)}
                        className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                          focusedPermKey === perm.key
                            ? 'bg-sky-50/70 text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAdvancedPermission(perm.key)}
                            className="h-4 w-4 rounded border-slate-300 text-[#0067C0] focus:ring-[#0067C0]"
                          />
                          <span className={checked ? 'font-medium text-slate-900' : ''}>
                            {perm.label}
                          </span>
                        </span>
                        {perm.isDual && (
                          <span className="font-mono text-[10px] text-[#0067C0]">
                            doble
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  {rightPermissions.map((perm) => {
                    const checked = entryPerms.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        onMouseEnter={() => setFocusedPermKey(perm.key)}
                        className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                          focusedPermKey === perm.key
                            ? 'bg-sky-50/70 text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAdvancedPermission(perm.key)}
                            className="h-4 w-4 rounded border-slate-300 text-[#0067C0] focus:ring-[#0067C0]"
                          />
                          <span className={checked ? 'font-medium text-slate-900' : ''}>
                            {perm.label}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dynamic Context Helper for Focused Permission + Current Scope */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 text-xs">
              <p className="font-semibold text-slate-900">
                Interpretación de «{focusedPermMeta.label}» con ámbito «{scopeMeta.label}»:
              </p>
              <div className="mt-1.5 space-y-1 text-slate-600">
                {(scopeMeta.affectsThisFolder || scopeMeta.affectsSubfolders) && (
                  <p>
                    <strong className="font-medium text-slate-800">En carpetas:</strong>{' '}
                    {focusedPermMeta.folderMeaning}
                  </p>
                )}
                {scopeMeta.affectsFiles && (
                  <p>
                    <strong className="font-medium text-slate-800">En archivos:</strong>{' '}
                    {focusedPermMeta.fileMeaning}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={entryOnlyChildren}
                  onChange={(e) => setEntryOnlyChildren(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#0067C0]"
                />
                <span>Aplicar estos permisos solo a objetos y/o contenedores dentro de este contenedor</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEntryPerms([])}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Borrar todo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAceId(null);
                    onChangeTab('security');
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#0067C0] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#005A9E]"
                >
                  {editingAceId ? 'Guardar cambios' : 'Aceptar entrada'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 3: COMPARTIR (PERMISOS DE RED / SMB) */}
        {activeTab === 'share' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-slate-900">
                <input
                  type="checkbox"
                  checked={Boolean(shareConfig?.shared)}
                  onChange={(e) => handleToggleShareEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#0067C0]"
                />
                <span>Compartir esta carpeta (Uso compartido avanzado)</span>
              </label>

              {shareConfig?.shared && (
                <span className="font-mono text-xs text-slate-600">
                  Ruta UNC: \\{machineName}\{shareConfig.shareName}
                </span>
              )}
            </div>

            {!shareConfig?.shared ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-xs text-slate-600">
                Esta carpeta no está compartida directamente en red. Activa «Compartir esta carpeta» si deseas definir permisos de recurso compartido o un nombre oculto con <span className="font-mono font-semibold text-slate-900">$</span>.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="share-name" className="block text-xs font-semibold text-slate-700">
                      Nombre del recurso compartido
                    </label>
                    <input
                      id="share-name"
                      type="text"
                      value={shareConfig.shareName}
                      onChange={(e) => handleShareNameChange(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-[#0067C0] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end pb-1.5 text-xs text-slate-600">
                    {shareConfig.shareName.trim().endsWith('$') ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#0067C0]">
                        <Network className="h-4 w-4" />
                        Recurso oculto ($): no aparece al explorar Red, accesible vía ruta UNC.
                      </span>
                    ) : (
                      <span>
                        Añade <span className="font-mono font-semibold">$</span> al final si deseas ocultar la carpeta en Red.
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        Nombres de grupos o usuarios:
                      </span>
                    </div>

                    <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {shareConfig.entries.map((entry) => {
                        const isSel = entry.principalId === selectedSharePrincipalId;
                        return (
                          <div
                            key={entry.principalId}
                            onClick={() => setSelectedSharePrincipalId(entry.principalId)}
                            className={`flex cursor-pointer items-center justify-between px-3 py-2 text-xs ${
                              isSel ? 'bg-sky-50 font-semibold text-[#0067C0]' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span>{getPrincipalName(entry.principalId)}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveShareEntry(entry.principalId);
                              }}
                              aria-label="Quitar usuario de recurso compartido"
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-2.5 flex gap-2">
                      <select
                        aria-label="Agregar usuario o grupo al recurso compartido"
                        value={shareAddPrincipalId}
                        onChange={(e) => setShareAddPrincipalId(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        {principals.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.displayName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddShareEntry}
                        className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                      >
                        Agregar
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      Permisos de {activeShareEntry ? getPrincipalName(activeShareEntry.principalId) : 'selección'}
                    </p>
                    {activeShareEntry ? (
                      <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-3 py-2 font-semibold">Permiso en red</th>
                              <th className="px-3 py-2 text-center font-semibold">Permitir</th>
                              <th className="px-3 py-2 text-center font-semibold">Denegar</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(
                              [
                                { level: 'full', label: 'Control total' },
                                { level: 'change', label: 'Cambiar' },
                                { level: 'read', label: 'Leer' },
                              ] as { level: SharePermissionLevel; label: string }[]
                            ).map((row) => (
                              <tr key={row.level}>
                                <td className="px-3 py-2.5 font-medium text-slate-800">{row.label}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    aria-label={`Permitir ${row.label}`}
                                    checked={activeShareEntry.allow.includes(row.level)}
                                    onChange={() =>
                                      handleToggleShareLevel(
                                        activeShareEntry.principalId,
                                        'allow',
                                        row.level
                                      )
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-[#0067C0]"
                                  />
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    aria-label={`Denegar ${row.label}`}
                                    checked={activeShareEntry.deny.includes(row.level)}
                                    onChange={() =>
                                      handleToggleShareLevel(
                                        activeShareEntry.principalId,
                                        'deny',
                                        row.level
                                      )
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-rose-600"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">
                        Selecciona o agrega un usuario/grupo para configurar sus permisos en red.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ACCESO EFECTIVO (INTERSECCIÓN RED ∩ NTFS) */}
        {activeTab === 'effective' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="eff-user" className="block text-xs font-semibold text-slate-700">
                  Usuario / Grupo
                </label>
                <select
                  id="eff-user"
                  value={effPrincipalId}
                  onChange={(e) => setEffPrincipalId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                >
                  {principals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="eff-mode" className="block text-xs font-semibold text-slate-700">
                  Tipo de acceso
                </label>
                <select
                  id="eff-mode"
                  value={effMode}
                  onChange={(e) => setEffMode(e.target.value as 'local' | 'network')}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                >
                  <option value="local">Local (en este equipo)</option>
                  <option value="network">En red (intersección Red ∩ NTFS)</option>
                </select>
              </div>

              <div>
                <label htmlFor="eff-target" className="block text-xs font-semibold text-slate-700">
                  Objeto evaluado
                </label>
                <select
                  id="eff-target"
                  value={effTarget}
                  onChange={(e) =>
                    setEffTarget(e.target.value as 'thisFolder' | 'subfolders' | 'files')
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                >
                  <option value="thisFolder">Esta carpeta ({folder.name})</option>
                  <option value="subfolders">Subcarpetas internas</option>
                  <option value="files">Archivos dentro</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Permiso especial NTFS</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Local (NTFS)</th>
                    {effMode === 'network' && (
                      <th className="px-3 py-2.5 text-center font-semibold">Red (Compartir)</th>
                    )}
                    <th className="px-3 py-2.5 text-center font-semibold">Acceso efectivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ALL_NTFS_PERMISSIONS.map((perm) => {
                    const hasLocal = effectiveCalc.local.has(perm.key);
                    const hasShare = effectiveCalc.share?.has(perm.key) ?? false;
                    const hasEff = effectiveCalc.effective.has(perm.key);

                    return (
                      <tr key={perm.key} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-medium text-slate-800">{perm.label}</td>
                        <td className="px-3 py-2 text-center">
                          {hasLocal ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <Check className="h-3.5 w-3.5" /> Sí
                            </span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </td>
                        {effMode === 'network' && (
                          <td className="px-3 py-2 text-center">
                            {hasShare ? (
                              <span className="inline-flex items-center gap-1 text-sky-700 font-medium">
                                <Check className="h-3.5 w-3.5" /> Sí
                              </span>
                            ) : (
                              <span className="text-slate-400">No</span>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2 text-center">
                          {hasEff ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <Check className="h-3.5 w-3.5" /> Concedido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700">
                              <X className="h-3.5 w-3.5" /> Denegado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
