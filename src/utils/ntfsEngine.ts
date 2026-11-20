import {
  ActionSimulationResult,
  ApplyToScope,
  NtfsAce,
  NtfsPermissionKey,
  ShareEntry,
  SharePermissionLevel,
  SimulatedActionId,
  VirtualFolderNode,
  VirtualPrincipal,
} from '../types/ntfs';

export interface PermissionMetadata {
  key: NtfsPermissionKey;
  label: string;
  column: 'left' | 'right';
  isDual: boolean;
  folderMeaning: string;
  fileMeaning: string;
}

export const ALL_NTFS_PERMISSIONS: PermissionMetadata[] = [
  {
    key: 'fullControl',
    label: 'Control total',
    column: 'left',
    isDual: false,
    folderMeaning: 'Concede todos los permisos sobre la carpeta, incluido cambiar permisos y tomar posesión.',
    fileMeaning: 'Concede todos los permisos sobre el archivo, incluido cambiar permisos y tomar posesión.',
  },
  {
    key: 'traverse',
    label: 'Atravesar carpeta / ejecutar archivo',
    column: 'left',
    isDual: true,
    folderMeaning: 'Atravesar carpeta: permite cruzar una carpeta para llegar a subcarpetas o archivos aunque no se pueda listar su contenido.',
    fileMeaning: 'Ejecutar archivo: permite ejecutar archivos de programa (.exe, .bat, scripts).',
  },
  {
    key: 'listRead',
    label: 'Mostrar carpeta / leer datos',
    column: 'left',
    isDual: true,
    folderMeaning: 'Mostrar carpeta: permite ver los nombres de los archivos y subcarpetas contenidos en ella.',
    fileMeaning: 'Leer datos: permite abrir y leer el contenido de los archivos.',
  },
  {
    key: 'readAttributes',
    label: 'Leer atributos',
    column: 'left',
    isDual: false,
    folderMeaning: 'Permite ver atributos básicos de la carpeta (solo lectura, oculto, sistema).',
    fileMeaning: 'Permite ver atributos básicos del archivo.',
  },
  {
    key: 'readExtendedAttributes',
    label: 'Leer atributos extendidos',
    column: 'left',
    isDual: false,
    folderMeaning: 'Permite ver atributos extendidos definidos por programas en la carpeta.',
    fileMeaning: 'Permite ver atributos extendidos definidos por programas en el archivo.',
  },
  {
    key: 'createFilesWriteData',
    label: 'Crear archivos / escribir datos',
    column: 'left',
    isDual: true,
    folderMeaning: 'Crear archivos: al aplicarse a carpeta/subcarpetas, permite crear nuevos archivos dentro de ella.',
    fileMeaning: 'Escribir datos: al aplicarse a archivos, permite modificar o sobrescribir el contenido de archivos existentes.',
  },
  {
    key: 'createFoldersAppendData',
    label: 'Crear carpetas / anexar datos',
    column: 'left',
    isDual: true,
    folderMeaning: 'Crear carpetas: al aplicarse a carpeta/subcarpetas, permite crear nuevas subcarpetas.',
    fileMeaning: 'Anexar datos: al aplicarse a archivos, permite añadir datos al final de un archivo existente sin sobrescribirlo.',
  },
  {
    key: 'writeAttributes',
    label: 'Escribir atributos',
    column: 'right',
    isDual: false,
    folderMeaning: 'Permite cambiar los atributos básicos de la carpeta.',
    fileMeaning: 'Permite cambiar los atributos básicos del archivo.',
  },
  {
    key: 'writeExtendedAttributes',
    label: 'Escribir atributos extendidos',
    column: 'right',
    isDual: false,
    folderMeaning: 'Permite cambiar atributos extendidos de la carpeta.',
    fileMeaning: 'Permite cambiar atributos extendidos del archivo.',
  },
  {
    key: 'deleteSubfoldersAndFiles',
    label: 'Eliminar subcarpetas y archivos',
    column: 'right',
    isDual: false,
    folderMeaning: 'Permite eliminar subcarpetas y archivos dentro de esta carpeta, incluso si no tienen el permiso Eliminar directo.',
    fileMeaning: 'Permite eliminar elementos contenidos (solo tiene efecto efectivo en contenedores/carpetas).',
  },
  {
    key: 'delete',
    label: 'Eliminar',
    column: 'right',
    isDual: false,
    folderMeaning: 'Permite eliminar o renombrar la propia carpeta a la que se aplica este permiso.',
    fileMeaning: 'Permite eliminar o renombrar el archivo.',
  },
  {
    key: 'readPermissions',
    label: 'Permisos de lectura',
    column: 'right',
    isDual: false,
    folderMeaning: 'Permite leer la lista de permisos (ACL) asignados a la carpeta.',
    fileMeaning: 'Permite leer la lista de permisos (ACL) asignados al archivo.',
  },
  {
    key: 'changePermissions',
    label: 'Cambiar permisos',
    column: 'right',
    isDual: false,
    folderMeaning: 'Permite modificar la ACL (añadir/quitar permisos) de la carpeta.',
    fileMeaning: 'Permite modificar la ACL del archivo.',
  },
  {
    key: 'takeOwnership',
    label: 'Tomar posesión',
    column: 'right',
    isDual: false,
    folderMeaning: 'Permite reclamar la propiedad de la carpeta.',
    fileMeaning: 'Permite reclamar la propiedad del archivo.',
  },
];

export const ALL_PERMISSION_KEYS: NtfsPermissionKey[] = ALL_NTFS_PERMISSIONS.map((p) => p.key);

export const SCOPE_LABELS: Record<ApplyToScope, string> = {
  this_folder_only: 'Solo esta carpeta',
  this_folder_subfolders_files: 'Esta carpeta, subcarpetas y archivos',
  this_folder_subfolders: 'Esta carpeta y subcarpetas',
  this_folder_files: 'Esta carpeta y archivos',
  subfolders_files_only: 'Solo subcarpetas y archivos',
  subfolders_only: 'Solo subcarpetas',
  files_only: 'Solo archivos',
};

export const SCOPE_OPTIONS: { value: ApplyToScope; label: string; affectsThisFolder: boolean; affectsSubfolders: boolean; affectsFiles: boolean }[] = [
  {
    value: 'this_folder_only',
    label: 'Solo esta carpeta',
    affectsThisFolder: true,
    affectsSubfolders: false,
    affectsFiles: false,
  },
  {
    value: 'this_folder_subfolders_files',
    label: 'Esta carpeta, subcarpetas y archivos',
    affectsThisFolder: true,
    affectsSubfolders: true,
    affectsFiles: true,
  },
  {
    value: 'this_folder_subfolders',
    label: 'Esta carpeta y subcarpetas',
    affectsThisFolder: true,
    affectsSubfolders: true,
    affectsFiles: false,
  },
  {
    value: 'this_folder_files',
    label: 'Esta carpeta y archivos',
    affectsThisFolder: true,
    affectsSubfolders: false,
    affectsFiles: true,
  },
  {
    value: 'subfolders_files_only',
    label: 'Solo subcarpetas y archivos',
    affectsThisFolder: false,
    affectsSubfolders: true,
    affectsFiles: true,
  },
  {
    value: 'subfolders_only',
    label: 'Solo subcarpetas',
    affectsThisFolder: false,
    affectsSubfolders: true,
    affectsFiles: false,
  },
  {
    value: 'files_only',
    label: 'Solo archivos',
    affectsThisFolder: false,
    affectsSubfolders: false,
    affectsFiles: true,
  },
];

export const BASIC_PERMISSION_GROUPS: {
  id: string;
  label: string;
  permissions: NtfsPermissionKey[];
}[] = [
  {
    id: 'full',
    label: 'Control total',
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    id: 'modify',
    label: 'Modificar',
    permissions: [
      'traverse',
      'listRead',
      'readAttributes',
      'readExtendedAttributes',
      'createFilesWriteData',
      'createFoldersAppendData',
      'writeAttributes',
      'writeExtendedAttributes',
      'delete',
      'readPermissions',
    ],
  },
  {
    id: 'readExecute',
    label: 'Lectura y ejecución',
    permissions: ['traverse', 'listRead', 'readAttributes', 'readExtendedAttributes', 'readPermissions'],
  },
  {
    id: 'listFolder',
    label: 'Mostrar el contenido de la carpeta',
    permissions: ['traverse', 'listRead', 'readAttributes', 'readExtendedAttributes', 'readPermissions'],
  },
  {
    id: 'read',
    label: 'Lectura',
    permissions: ['listRead', 'readAttributes', 'readExtendedAttributes', 'readPermissions'],
  },
  {
    id: 'write',
    label: 'Escritura',
    permissions: [
      'createFilesWriteData',
      'createFoldersAppendData',
      'writeAttributes',
      'writeExtendedAttributes',
    ],
  },
];

export function scopeAppliesToTarget(
  scope: ApplyToScope,
  target: 'thisFolder' | 'subfolders' | 'files'
): boolean {
  const info = SCOPE_OPTIONS.find((s) => s.value === scope);
  if (!info) return false;
  if (target === 'thisFolder') return info.affectsThisFolder;
  if (target === 'subfolders') return info.affectsSubfolders;
  return info.affectsFiles;
}

export function getEffectivePrincipalIds(
  principalId: string,
  principals: VirtualPrincipal[]
): string[] {
  const visited = new Set<string>();
  const queue = [principalId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const p = principals.find((item) => item.id === current);
    if (p?.memberOf) {
      for (const groupId of p.memberOf) {
        if (!visited.has(groupId)) queue.push(groupId);
      }
    }
  }
  return Array.from(visited);
}

export function summarizeAceAccess(permissions: NtfsPermissionKey[]): string {
  const set = new Set(permissions);
  if (set.has('fullControl') || permissions.length === ALL_PERMISSION_KEYS.length) {
    return 'Control total';
  }
  const modifySet = BASIC_PERMISSION_GROUPS.find((g) => g.id === 'modify')!.permissions;
  if (
    modifySet.every((k) => set.has(k)) &&
    permissions.length === modifySet.length
  ) {
    return 'Modificar';
  }
  const rxSet = BASIC_PERMISSION_GROUPS.find((g) => g.id === 'readExecute')!.permissions;
  if (rxSet.every((k) => set.has(k)) && permissions.length === rxSet.length) {
    return 'Lectura y ejecución';
  }
  const readSet = BASIC_PERMISSION_GROUPS.find((g) => g.id === 'read')!.permissions;
  if (readSet.every((k) => set.has(k)) && permissions.length === readSet.length) {
    return 'Lectura';
  }
  if (
    set.has('createFilesWriteData') &&
    set.has('traverse') &&
    set.has('listRead') &&
    !set.has('createFoldersAppendData') &&
    !set.has('delete')
  ) {
    return 'Lectura, escritura y ejecución';
  }
  return 'Especial';
}

export function getAllAcesForFolder(
  folderId: string,
  folders: VirtualFolderNode[]
): NtfsAce[] {
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return [];

  const ownAces = folder.aces.filter((a) => !a.inheritedFrom);
  if (!folder.inheritanceEnabled || !folder.parentId) {
    return folder.aces;
  }

  const parent = folders.find((f) => f.id === folder.parentId);
  if (!parent) return folder.aces;

  const parentAces = getAllAcesForFolder(parent.id, folders);
  const inheritedFromParent: NtfsAce[] = [];

  for (const pace of parentAces) {
    if (pace.onlyThisContainerChildren && pace.inheritedFrom && pace.inheritedFrom !== parent.path) {
      continue;
    }
    if (pace.scope === 'this_folder_only') {
      continue;
    }
    let childScope: ApplyToScope = pace.scope;
    if (pace.scope === 'subfolders_files_only') {
      childScope = 'this_folder_subfolders_files';
    } else if (pace.scope === 'subfolders_only') {
      childScope = 'this_folder_subfolders';
    }
    inheritedFromParent.push({
      ...pace,
      id: `inh-${parent.id}-${pace.id}`,
      scope: childScope,
      inheritedFrom: pace.inheritedFrom ?? parent.path,
    });
  }

  const explicitNonInherited = ownAces;
  return [...explicitNonInherited, ...inheritedFromParent];
}

export function computeLocalEffectivePermissions(
  folderId: string,
  principalId: string,
  target: 'thisFolder' | 'subfolders' | 'files',
  folders: VirtualFolderNode[],
  principals: VirtualPrincipal[]
): Set<NtfsPermissionKey> {
  const activeIds = new Set(getEffectivePrincipalIds(principalId, principals));
  const aces = getAllAcesForFolder(folderId, folders).filter((ace) =>
    activeIds.has(ace.principalId)
  );

  const allowed = new Set<NtfsPermissionKey>();
  const denied = new Set<NtfsPermissionKey>();

  for (const ace of aces) {
    if (!scopeAppliesToTarget(ace.scope, target)) continue;
    const expanded = ace.permissions.includes('fullControl')
      ? ALL_PERMISSION_KEYS
      : ace.permissions;

    if (ace.type === 'allow') {
      for (const perm of expanded) allowed.add(perm);
    } else {
      for (const perm of expanded) denied.add(perm);
    }
  }

  for (const perm of denied) {
    allowed.delete(perm);
  }
  return allowed;
}

export function findApplicableShareFolder(
  folderId: string,
  folders: VirtualFolderNode[]
): VirtualFolderNode | null {
  let current = folders.find((f) => f.id === folderId) ?? null;
  while (current) {
    if (current.share?.shared) {
      return current;
    }
    const parentId = current.parentId;
    if (!parentId) break;
    current = folders.find((f) => f.id === parentId) ?? null;
  }
  return null;
}

export function computeShareAllowedNtfsMask(
  entries: ShareEntry[],
  principalId: string,
  principals: VirtualPrincipal[]
): Set<NtfsPermissionKey> {
  const activeIds = new Set(getEffectivePrincipalIds(principalId, principals));
  const matching = entries.filter((e) => activeIds.has(e.principalId));

  const allowedLevels = new Set<SharePermissionLevel>();
  const deniedLevels = new Set<SharePermissionLevel>();

  for (const entry of matching) {
    for (const lvl of entry.allow) allowedLevels.add(lvl);
    for (const lvl of entry.deny) deniedLevels.add(lvl);
  }

  if (deniedLevels.has('full') || deniedLevels.has('read')) {
    return new Set();
  }

  const result = new Set<NtfsPermissionKey>();
  const effectiveFull =
    allowedLevels.has('full') &&
    !deniedLevels.has('full') &&
    !deniedLevels.has('change') &&
    !deniedLevels.has('read');
  const effectiveChange =
    (allowedLevels.has('change') || effectiveFull) &&
    !deniedLevels.has('change') &&
    !deniedLevels.has('read');
  const effectiveRead =
    (allowedLevels.has('read') || effectiveChange || effectiveFull) &&
    !deniedLevels.has('read');

  if (effectiveFull) {
    for (const k of ALL_PERMISSION_KEYS) result.add(k);
    return result;
  }

  if (effectiveRead) {
    result.add('traverse');
    result.add('listRead');
    result.add('readAttributes');
    result.add('readExtendedAttributes');
    result.add('readPermissions');
  }

  if (effectiveChange) {
    result.add('createFilesWriteData');
    result.add('createFoldersAppendData');
    result.add('writeAttributes');
    result.add('writeExtendedAttributes');
    result.add('delete');
    result.add('deleteSubfoldersAndFiles');
  }

  return result;
}

export function computeEffectivePermissions(
  folderId: string,
  principalId: string,
  target: 'thisFolder' | 'subfolders' | 'files',
  accessMode: 'local' | 'network',
  folders: VirtualFolderNode[],
  principals: VirtualPrincipal[]
): {
  local: Set<NtfsPermissionKey>;
  share: Set<NtfsPermissionKey> | null;
  effective: Set<NtfsPermissionKey>;
  shareFolder: VirtualFolderNode | null;
} {
  const local = computeLocalEffectivePermissions(
    folderId,
    principalId,
    target,
    folders,
    principals
  );

  if (accessMode === 'local') {
    return { local, share: null, effective: local, shareFolder: null };
  }

  const shareFolder = findApplicableShareFolder(folderId, folders);
  if (!shareFolder || !shareFolder.share) {
    return { local, share: new Set(), effective: new Set(), shareFolder: null };
  }

  const share = computeShareAllowedNtfsMask(
    shareFolder.share.entries,
    principalId,
    principals
  );

  const effective = new Set<NtfsPermissionKey>();
  for (const perm of local) {
    if (share.has(perm)) effective.add(perm);
  }

  return { local, share, effective, shareFolder };
}

export function simulateUserActions(
  folderId: string,
  principalId: string,
  accessMode: 'local' | 'network',
  folders: VirtualFolderNode[],
  principals: VirtualPrincipal[]
): ActionSimulationResult[] {
  const onThisFolder = computeEffectivePermissions(
    folderId,
    principalId,
    'thisFolder',
    accessMode,
    folders,
    principals
  );
  const onSubfolders = computeEffectivePermissions(
    folderId,
    principalId,
    'subfolders',
    accessMode,
    folders,
    principals
  );
  const onFiles = computeEffectivePermissions(
    folderId,
    principalId,
    'files',
    accessMode,
    folders,
    principals
  );

  const shareName = onThisFolder.shareFolder?.share?.shareName;

  const evalAction = (
    actionId: SimulatedActionId,
    label: string,
    requiredPerm: NtfsPermissionKey,
    targetSet: {
      local: Set<NtfsPermissionKey>;
      share: Set<NtfsPermissionKey> | null;
      effective: Set<NtfsPermissionKey>;
    },
    successReason: string,
    missingLocalReason: string,
    relevantRule: string
  ): ActionSimulationResult => {
    const localAllowed = targetSet.local.has(requiredPerm);
    const shareAllowed =
      accessMode === 'local'
        ? true
        : targetSet.share !== null && targetSet.share.has(requiredPerm);
    const allowed = targetSet.effective.has(requiredPerm);

    let reason = successReason;
    if (!allowed) {
      if (accessMode === 'network' && !onThisFolder.shareFolder) {
        reason = 'La carpeta ni sus ancestros están compartidos en red.';
      } else if (accessMode === 'network' && localAllowed && !shareAllowed) {
        reason = `Bloqueado por el permiso de red del recurso «${shareName}»: en NTFS local sí está permitido, pero el permiso de Compartir (Red) lo recorta (intersección Red ∩ NTFS).`;
      } else if (!localAllowed) {
        reason = missingLocalReason;
      }
    }

    return {
      actionId,
      label,
      allowed,
      localAllowed,
      shareAllowed,
      reason,
      relevantRule,
    };
  };

  return [
    evalAction(
      'enter_folder',
      'Entrar / atravesar la carpeta',
      'traverse',
      onThisFolder,
      'Puede acceder a la ruta de esta carpeta.',
      'Falta «Atravesar carpeta / ejecutar archivo» en Esta carpeta.',
      'Atravesar carpeta (Esta carpeta)'
    ),
    evalAction(
      'list_contents',
      'Ver lista de archivos y subcarpetas',
      'listRead',
      onThisFolder,
      'Puede listar los elementos dentro de esta carpeta.',
      'Falta «Mostrar carpeta / leer datos» en Esta carpeta (útil para buzones de entrega ciega).',
      'Mostrar carpeta / leer datos (Esta carpeta)'
    ),
    evalAction(
      'create_file',
      'Crear archivo nuevo en esta carpeta',
      'createFilesWriteData',
      onThisFolder,
      'Puede crear archivos nuevos en esta carpeta (permiso de carpeta).',
      'Falta «Crear archivos / escribir datos» aplicado a Esta carpeta (recuerda: crear archivos es permiso de carpeta, no de Solo archivos).',
      'Crear archivos / escribir datos (Esta carpeta)'
    ),
    evalAction(
      'modify_existing_file',
      'Modificar archivo existente',
      'createFilesWriteData',
      onFiles,
      'Puede sobrescribir y guardar cambios en archivos existentes.',
      'Falta «Crear archivos / escribir datos» aplicado a Archivos.',
      'Crear archivos / escribir datos (Solo archivos)'
    ),
    evalAction(
      'create_subfolder',
      'Crear una subcarpeta nueva',
      'createFoldersAppendData',
      onThisFolder,
      'Puede crear nuevas subcarpetas dentro de esta carpeta.',
      'Falta «Crear carpetas / anexar datos» en Esta carpeta.',
      'Crear carpetas / anexar datos (Esta carpeta)'
    ),
    evalAction(
      'read_in_subfolder',
      'Leer archivos dentro de subcarpetas',
      'listRead',
      onSubfolders.effective.has('listRead') && onFiles.effective.has('listRead')
        ? onFiles
        : onSubfolders.effective.has('listRead')
          ? onFiles
          : onSubfolders,
      'Puede explorar subcarpetas y leer sus archivos.',
      'Falta «Mostrar carpeta / leer datos» propagado a Subcarpetas y archivos.',
      'Mostrar carpeta / leer datos (Subcarpetas y archivos)'
    ),
    evalAction(
      'delete_existing_file',
      'Eliminar un archivo existente',
      !onFiles.effective.has('delete') && onThisFolder.effective.has('deleteSubfoldersAndFiles')
        ? 'deleteSubfoldersAndFiles'
        : 'delete',
      onFiles.effective.has('delete')
        ? onFiles
        : onThisFolder.effective.has('deleteSubfoldersAndFiles')
          ? onThisFolder
          : onFiles,
      'Puede eliminar archivos contenidos en esta carpeta.',
      'No tiene «Eliminar» sobre Archivos ni «Eliminar subcarpetas y archivos» sobre la carpeta.',
      'Eliminar (Archivos) o Eliminar subcarpetas y archivos (Carpeta)'
    ),
    evalAction(
      'delete_this_folder',
      'Eliminar o renombrar esta propia carpeta',
      'delete',
      onThisFolder,
      'Puede eliminar o renombrar la propia carpeta actual.',
      'Protegida: falta «Eliminar» sobre Esta carpeta (se conserva intacta la carpeta raíz).',
      'Eliminar (Esta carpeta)'
    ),
    evalAction(
      'change_permissions',
      'Cambiar permisos NTFS',
      'changePermissions',
      onThisFolder,
      'Puede modificar la configuración de seguridad de la carpeta.',
      'Falta «Cambiar permisos» en Esta carpeta.',
      'Cambiar permisos (Esta carpeta)'
    ),
  ];
}
