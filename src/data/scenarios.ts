import {
  EvaluationIssue,
  NtfsScenario,
  ScenarioEvaluation,
  VirtualFolderNode,
  VirtualPrincipal,
} from '../types/ntfs';
import {
  computeEffectivePermissions,
  findApplicableShareFolder,
} from '../utils/ntfsEngine';

const RX_PERMS = [
  'traverse',
  'listRead',
  'readAttributes',
  'readExtendedAttributes',
  'readPermissions',
] as const;

const FULL_PERMS = [
  'fullControl',
  'traverse',
  'listRead',
  'readAttributes',
  'readExtendedAttributes',
  'createFilesWriteData',
  'createFoldersAppendData',
  'writeAttributes',
  'writeExtendedAttributes',
  'deleteSubfoldersAndFiles',
  'delete',
  'readPermissions',
  'changePermissions',
  'takeOwnership',
] as const;

export const SANDBOX_PRINCIPALS: VirtualPrincipal[] = [
  { id: 'admin', name: 'Administradores', displayName: 'EQUIPO\\Administradores', kind: 'system' },
  { id: 'system', name: 'SYSTEM', displayName: 'SYSTEM', kind: 'system' },
  { id: 'users', name: 'Usuarios', displayName: 'EQUIPO\\Usuarios', kind: 'system' },
  { id: 'auth_users', name: 'Usuarios autentificados', displayName: 'Usuarios autentificados', kind: 'system' },
  { id: 'profesor', name: 'Profesor', displayName: 'EQUIPO\\Profesor', kind: 'user', memberOf: ['users', 'auth_users'] },
  { id: 'alumnos', name: 'Alumnos', displayName: 'EQUIPO\\Alumnos', kind: 'group', memberOf: ['users', 'auth_users'] },
  { id: 'alu_01', name: 'alu_01', displayName: 'EQUIPO\\alu_01', kind: 'user', memberOf: ['alumnos', 'users', 'auth_users'], description: 'Miembro de Alumnos' },
  { id: 'dir1', name: 'Dir1', displayName: 'EQUIPO\\Dir1', kind: 'group' },
  { id: 'par1', name: 'Par1', displayName: 'EQUIPO\\Par1', kind: 'group' },
  { id: 'ejecutivos', name: 'Ejecutivos', displayName: 'EQUIPO\\Ejecutivos', kind: 'group' },
];

export const SANDBOX_INITIAL_FOLDERS: VirtualFolderNode[] = [
  {
    id: 'c_root',
    name: 'C:\\',
    path: 'C:\\',
    parentId: null,
    owner: 'SYSTEM',
    inheritanceEnabled: false,
    aces: [
      { id: 'sb-root-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
      { id: 'sb-root-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
      { id: 'sb-root-usr', principalId: 'users', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...RX_PERMS], inheritedFrom: null },
    ],
    sampleFiles: [],
    sampleSubfolders: ['SOR', 'Proyectos'],
  },
  {
    id: 'sor',
    name: 'SOR',
    path: 'C:\\SOR',
    parentId: 'c_root',
    owner: 'EQUIPO\\Administradores',
    inheritanceEnabled: false,
    aces: [
      { id: 'sb-sor-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
      { id: 'sb-sor-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
      { id: 'sb-sor-alu', principalId: 'alumnos', type: 'allow', scope: 'this_folder_only', permissions: [...RX_PERMS], inheritedFrom: null },
      { id: 'sb-sor-prof', principalId: 'profesor', type: 'allow', scope: 'this_folder_only', permissions: [...RX_PERMS], inheritedFrom: null },
    ],
    share: {
      shared: true,
      shareName: 'SOR',
      hidden: false,
      entries: [
        { id: 'sh-adm', principalId: 'admin', allow: ['read', 'change', 'full'], deny: [] },
        { id: 'sh-alu', principalId: 'alumnos', allow: ['read', 'change'], deny: [] },
        { id: 'sh-prof', principalId: 'profesor', allow: ['read', 'change'], deny: [] },
      ],
    },
    sampleFiles: ['normativa.pdf'],
    sampleSubfolders: ['Entrega_Examenes', 'Entrega_Practicas'],
  },
  {
    id: 'entrega_ex',
    name: 'Entrega_Examenes',
    path: 'C:\\SOR\\Entrega_Examenes',
    parentId: 'sor',
    owner: 'EQUIPO\\Administradores',
    inheritanceEnabled: true,
    aces: [],
    sampleFiles: ['examen_alu02.pdf'],
    sampleSubfolders: [],
  },
  {
    id: 'entrega_pr',
    name: 'Entrega_Practicas',
    path: 'C:\\SOR\\Entrega_Practicas',
    parentId: 'sor',
    owner: 'EQUIPO\\Administradores',
    inheritanceEnabled: true,
    aces: [],
    sampleFiles: ['practica1_alu01.docx'],
    sampleSubfolders: ['Corregidas'],
  },
];

function buildEvaluation(issues: EvaluationIssue[], maxScore: number): ScenarioEvaluation {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const passed = errors.length === 0;
  const successes = issues.filter((i) => i.severity === 'success').length;
  const score = passed
    ? Math.max(maxScore - warnings.length * 10, 80)
    : Math.max(Math.round((successes / Math.max(issues.length, 1)) * 60), 10);

  return {
    passed,
    score,
    maxScore,
    summary: passed
      ? 'Configuración de Red + NTFS válida: el acceso desde otro equipo cumple todos los requisitos.'
      : `Faltan ${errors.length} ${errors.length === 1 ? 'ajuste' : 'ajustes'} entre permisos de Red y NTFS para cumplir el enunciado.`,
    issues,
  };
}

export function verifyNetworkShareAvailable(
  folderId: string,
  principalId: string,
  folders: VirtualFolderNode[],
  principals: VirtualPrincipal[],
  issues: EvaluationIssue[],
  principalLabel: string
): boolean {
  const shareFolder = findApplicableShareFolder(folderId, folders);
  if (!shareFolder || !shareFolder.share) {
    issues.push({
      severity: 'error',
      title: 'Carpeta no compartida en red',
      detail: `Los usuarios se conectan desde otro equipo: comparte esta carpeta o su carpeta padre en «Compartir (Red)» y concede permiso de red a ${principalLabel}.`,
    });
    return false;
  }

  const net = computeEffectivePermissions(
    folderId,
    principalId,
    'thisFolder',
    'network',
    folders,
    principals
  );
  if (!net.share || net.share.size === 0) {
    issues.push({
      severity: 'error',
      title: `Sin permisos en red para ${principalLabel}`,
      detail: `La carpeta está compartida como \\\\${shareFolder.share.shareName}, pero ${principalLabel} no tiene permiso en la pestaña «Compartir (Red)».`,
    });
    return false;
  }

  return true;
}

export const NTFS_SCENARIOS: NtfsScenario[] = [
  // 1. Buzón de entrega ciega (Entrega_Examenes - Alumnos)
  {
    id: 'sc-entrega-examenes',
    number: 1,
    title: 'Buzón de entrega ciega (Entrega de exámenes)',
    category: 'Buzón de entrega ciega',
    difficulty: 'Básico',
    sourcePractice: 'Práctica Aulas SOR',
    machineName: 'EQUIPO_PROFESOR',
    targetFolderId: 'entrega_ex',
    targetPrincipalId: 'alumnos',
    testAccessMode: 'network',
    focusTab: 'share',
    enunciado:
      'Los «Alumnos» tienen que entregar su examen en la carpeta compartida C:\\SOR\\Entrega_Examenes desde sus ordenadores de clase. Queremos que puedan dejar ahí su archivo, pero sin poder curiosear los exámenes que ya hayan subido sus compañeros ni tocar o borrar nada de lo que haya dentro.',
    contextNote:
      'Se conectan desde otros equipos de la red. Ten en cuenta tanto el acceso por red como los permisos de la carpeta.',
    hint:
      '1) En C:\\SOR (o en Entrega_Examenes) activa «Compartir (Red)» y da a Alumnos «Cambiar» + «Leer». 2) En NTFS de Entrega_Examenes añade a Alumnos con ámbito «Solo esta carpeta» y «Crear archivos / escribir datos» + «Permisos de lectura», SIN «Mostrar carpeta / leer datos».',
    principals: [
      { id: 'admin', name: 'Administradores', displayName: 'EQUIPO_PROFESOR\\Administradores', kind: 'system' },
      { id: 'system', name: 'SYSTEM', displayName: 'SYSTEM', kind: 'system' },
      { id: 'profesor', name: 'Profesor', displayName: 'EQUIPO_PROFESOR\\Profesor', kind: 'user' },
      { id: 'alumnos', name: 'Alumnos', displayName: 'EQUIPO_PROFESOR\\Alumnos', kind: 'group' },
      { id: 'alu_01', name: 'alu_01', displayName: 'EQUIPO_PROFESOR\\alu_01', kind: 'user', memberOf: ['alumnos'], description: 'Estudiante de prueba (miembro de Alumnos)' },
    ],
    initialFolders: [
      {
        id: 'sor',
        name: 'SOR',
        path: 'C:\\SOR',
        parentId: null,
        owner: 'EQUIPO_PROFESOR\\Administradores',
        inheritanceEnabled: false,
        aces: [
          { id: '1-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '1-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '1-alu', principalId: 'alumnos', type: 'allow', scope: 'this_folder_only', permissions: [...RX_PERMS], inheritedFrom: null },
        ],
        share: {
          shared: false,
          shareName: 'SOR',
          hidden: false,
          entries: [
            { id: '1-sh-adm', principalId: 'admin', allow: ['read', 'change', 'full'], deny: [] },
          ],
        },
        sampleFiles: [],
        sampleSubfolders: ['Entrega_Examenes'],
      },
      {
        id: 'entrega_ex',
        name: 'Entrega_Examenes',
        path: 'C:\\SOR\\Entrega_Examenes',
        parentId: 'sor',
        owner: 'EQUIPO_PROFESOR\\Administradores',
        inheritanceEnabled: false,
        aces: [
          { id: '1-ex-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '1-ex-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
        ],
        sampleFiles: ['examen_alu02.pdf', 'examen_alu05.pdf'],
        sampleSubfolders: [],
      },
    ],
    checkSolution: (folders, principals) => {
      const issues: EvaluationIssue[] = [];
      const hasShare = verifyNetworkShareAvailable('entrega_ex', 'alumnos', folders, principals, issues, 'Alumnos');

      const netFolder = computeEffectivePermissions('entrega_ex', 'alumnos', 'thisFolder', 'network', folders, principals);
      const netFiles = computeEffectivePermissions('entrega_ex', 'alumnos', 'files', 'network', folders, principals);
      const netSub = computeEffectivePermissions('entrega_ex', 'alumnos', 'subfolders', 'network', folders, principals);

      if (netFolder.effective.has('createFilesWriteData')) {
        issues.push({
          severity: 'success',
          title: 'Entrega por red habilitada',
          detail: 'Alumnos tiene permiso en red («Cambiar») y NTFS («Crear archivos / escribir datos» en Solo esta carpeta), por lo que puede entregar su examen desde otro equipo.',
        });
      } else if (hasShare) {
        issues.push({
          severity: 'error',
          title: 'No pueden crear el archivo de entrega desde red',
          detail: netFolder.local.has('createFilesWriteData')
            ? 'En NTFS local está bien, pero en «Compartir (Red)» falta marcar «Cambiar» para Alumnos (intersección Red ∩ NTFS).'
            : netFiles.local.has('createFilesWriteData')
              ? 'Has aplicado «Crear archivos / escribir datos» a Archivos, pero crear archivos nuevos es un permiso de carpeta («Solo esta carpeta»).'
              : 'Alumnos necesita «Crear archivos / escribir datos» aplicado a «Solo esta carpeta» en NTFS y «Cambiar» en Red.',
        });
      }

      if (!netFolder.effective.has('listRead') && !netFiles.effective.has('listRead') && !netFolder.local.has('listRead')) {
        issues.push({
          severity: 'success',
          title: 'Entrega ciega protegida',
          detail: '«Mostrar carpeta / leer datos» está desmarcado: no pueden listar ni leer los exámenes de otros alumnos.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Los alumnos pueden ver o leer entregas ajenas',
          detail: 'Debes quitar «Mostrar carpeta / leer datos» en NTFS para impedir que entren a listar o leer archivos entregados.',
        });
      }

      if (netFiles.local.has('createFilesWriteData') || netFiles.local.has('delete') || netFolder.local.has('deleteSubfoldersAndFiles') || netFolder.local.has('delete')) {
        issues.push({
          severity: 'error',
          title: 'Permiso excesivo de modificación o borrado',
          detail: 'El ámbito debe ser «Solo esta carpeta» y sin permisos de eliminación.',
        });
      }

      if ((netSub.local.size > 0 || netFiles.local.size > 0) && !issues.some((i) => i.severity === 'error')) {
        issues.push({
          severity: 'warning',
          title: 'Ámbito más amplio de lo necesario',
          detail: 'Conviene limitar la entrada a «Solo esta carpeta».',
        });
      }

      return buildEvaluation(issues, 100);
    },
  },

  // 2. Carpeta de Enunciados sin historial (Enunciado_Examenes - Profesor)
  {
    id: 'sc-enunciado-profesor',
    number: 2,
    title: 'Carpeta de enunciados sin historial (Profesor)',
    category: 'Carpetas sin historial',
    difficulty: 'Básico',
    sourcePractice: 'Práctica Aulas SOR',
    machineName: 'EQUIPO_PROFESOR',
    targetFolderId: 'enunciado_ex',
    targetPrincipalId: 'profesor',
    testAccessMode: 'network',
    focusTab: 'share',
    enunciado:
      'El «Profesor» se va a conectar desde su equipo a C:\\SOR\\Enunciado_Examenes para ir colgando y actualizando el examen vigente. Necesita poder ver lo que hay, subir archivos nuevos, editarlos o borrarlos si hace falta, pero no queremos que empiece a crear subcarpetas de historial ni que borre por error la carpeta Enunciado_Examenes.',
    contextNote:
      'Hazlo dejando una única regla nueva para Profesor en la carpeta, sin tocar la que ya tienen los Alumnos.',
    hint:
      '1) En Compartir (Red) de C:\\SOR (o Enunciado_Examenes) añade a Profesor con «Cambiar» y «Leer». 2) En NTFS de Enunciado_Examenes usa «Esta carpeta y archivos» con lectura, «Crear archivos / escribir datos», escribir atributos y «Eliminar subcarpetas y archivos», sin «Crear carpetas» ni «Eliminar».',
    principals: [
      { id: 'admin', name: 'Administradores', displayName: 'EQUIPO_PROFESOR\\Administradores', kind: 'system' },
      { id: 'system', name: 'SYSTEM', displayName: 'SYSTEM', kind: 'system' },
      { id: 'profesor', name: 'Profesor', displayName: 'EQUIPO_PROFESOR\\Profesor', kind: 'user' },
      { id: 'alumnos', name: 'Alumnos', displayName: 'EQUIPO_PROFESOR\\Alumnos', kind: 'group' },
    ],
    initialFolders: [
      {
        id: 'sor',
        name: 'SOR',
        path: 'C:\\SOR',
        parentId: null,
        owner: 'EQUIPO_PROFESOR\\Administradores',
        inheritanceEnabled: false,
        aces: [
          { id: '2-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '2-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '2-prof', principalId: 'profesor', type: 'allow', scope: 'this_folder_only', permissions: [...RX_PERMS], inheritedFrom: null },
        ],
        share: {
          shared: false,
          shareName: 'SOR',
          hidden: false,
          entries: [
            { id: '2-sh-adm', principalId: 'admin', allow: ['read', 'change', 'full'], deny: [] },
          ],
        },
        sampleFiles: [],
        sampleSubfolders: ['Enunciado_Examenes'],
      },
      {
        id: 'enunciado_ex',
        name: 'Enunciado_Examenes',
        path: 'C:\\SOR\\Enunciado_Examenes',
        parentId: 'sor',
        owner: 'EQUIPO_PROFESOR\\Administradores',
        inheritanceEnabled: false,
        aces: [
          { id: '2-ex-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '2-ex-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '2-ex-alu', principalId: 'alumnos', type: 'allow', scope: 'this_folder_files', permissions: [...RX_PERMS], inheritedFrom: null },
        ],
        sampleFiles: ['Examen_SOR_UD3.pdf'],
        sampleSubfolders: [],
      },
    ],
    checkSolution: (folders, principals) => {
      const issues: EvaluationIssue[] = [];
      const hasShare = verifyNetworkShareAvailable('enunciado_ex', 'profesor', folders, principals, issues, 'Profesor');

      const onFolder = computeEffectivePermissions('enunciado_ex', 'profesor', 'thisFolder', 'network', folders, principals);
      const onFiles = computeEffectivePermissions('enunciado_ex', 'profesor', 'files', 'network', folders, principals);
      const onSubfolders = computeEffectivePermissions('enunciado_ex', 'profesor', 'subfolders', 'network', folders, principals);

      if (onFolder.effective.has('listRead') && onFolder.effective.has('traverse') && onFiles.effective.has('listRead')) {
        issues.push({
          severity: 'success',
          title: 'Lectura de carpeta y archivos por red correcta',
          detail: 'Profesor puede listar la carpeta y leer los archivos de enunciados desde otro equipo.',
        });
      } else if (hasShare) {
        issues.push({
          severity: 'error',
          title: 'Faltan permisos de lectura en carpeta y archivos',
          detail: 'Debe tener «Atravesar carpeta / ejecutar archivo» y «Mostrar carpeta / leer datos» en «Esta carpeta y archivos» y permiso de red «Leer».',
        });
      }

      if (onFolder.effective.has('createFilesWriteData') && onFiles.effective.has('createFilesWriteData')) {
        issues.push({
          severity: 'success',
          title: 'Creación y modificación de archivos por red activa',
          detail: 'Puede crear archivos nuevos y editar los existentes remotamente.',
        });
      } else if (hasShare) {
        issues.push({
          severity: 'error',
          title: 'No puede crear o modificar archivos por red',
          detail: onFolder.local.has('createFilesWriteData') && onFiles.local.has('createFilesWriteData')
            ? 'Los permisos locales NTFS están bien, pero en «Compartir (Red)» falta marcar «Cambiar» para Profesor.'
            : 'Aplica «Crear archivos / escribir datos» al ámbito «Esta carpeta y archivos» y «Cambiar» en Red.',
        });
      }

      if (!onFolder.local.has('createFoldersAppendData')) {
        issues.push({
          severity: 'success',
          title: 'Creación de subcarpetas bloqueada',
          detail: '«Crear carpetas / anexar datos» está desmarcado para evitar subcarpetas de historial.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'El profesor aún puede crear subcarpetas',
          detail: 'Desmarca «Crear carpetas / anexar datos» en NTFS.',
        });
      }

      if ((onFolder.effective.has('deleteSubfoldersAndFiles') || onFiles.effective.has('delete')) && !onFolder.local.has('delete')) {
        issues.push({
          severity: 'success',
          title: 'Puede borrar archivos pero no la carpeta raíz',
          detail: '«Eliminar subcarpetas y archivos» permite limpiar archivos mientras Enunciado_Examenes queda protegida.',
        });
      } else if (onFolder.local.has('delete')) {
        issues.push({
          severity: 'error',
          title: 'Podría borrar la propia carpeta Enunciado_Examenes',
          detail: 'Quita «Eliminar» sobre la carpeta y usa en su lugar «Eliminar subcarpetas y archivos».',
        });
      } else if (hasShare) {
        issues.push({
          severity: 'error',
          title: 'No puede eliminar archivos antiguos por red',
          detail: 'Marca «Eliminar subcarpetas y archivos» en NTFS y «Cambiar» en Compartir (Red).',
        });
      }

      if (onSubfolders.local.size > 0) {
        issues.push({
          severity: 'error',
          title: 'El ámbito incluye subcarpetas',
          detail: 'El enunciado pide no propagar a subcarpetas: selecciona «Esta carpeta y archivos».',
        });
      }

      return buildEvaluation(issues, 100);
    },
  },

  // 3. Lectura solo en carpeta raíz compartida (C:\Proyectos - Proyectosenred)
  {
    id: 'sc-raiz-proyectos',
    number: 3,
    title: 'Acceso a la raíz compartida sin entrar en subcarpetas',
    category: 'Herencia y aislamiento',
    difficulty: 'Básico',
    sourcePractice: 'Práctica Repositorio',
    machineName: 'REPOSITORIO',
    targetFolderId: 'proyectos',
    targetPrincipalId: 'proyectosenred',
    testAccessMode: 'network',
    focusTab: 'share',
    enunciado:
      'El grupo «Proyectosenred» va a entrar desde otros equipos a C:\\Proyectos, donde están las carpetas Proy1, Proy2 y Proy3. Al conectarse, solo deberían poder ver qué carpetas de proyecto hay dentro de Proyectos, pero sin poder meterse en Proy1 ni heredar accesos genéricos del sistema.',
    contextNote:
      'Revisa tanto los permisos de red como los grupos generales que vienen heredados desde C:\\.',
    hint:
      '1) En Compartir (Red) de C:\\Proyectos activa «Compartir esta carpeta» y añade a Proyectosenred (con Leer). 2) En Seguridad avanzada deshabilita herencia (Convertir), quita Usuarios y Usuarios autentificados y añade a Proyectosenred con Lectura y ejecución en «Solo esta carpeta».',
    principals: [
      { id: 'admin', name: 'Administradores', displayName: 'REPOSITORIO\\Administradores', kind: 'system' },
      { id: 'system', name: 'SYSTEM', displayName: 'SYSTEM', kind: 'system' },
      { id: 'users', name: 'Usuarios', displayName: 'REPOSITORIO\\Usuarios', kind: 'system' },
      { id: 'auth_users', name: 'Usuarios autentificados', displayName: 'Usuarios autentificados', kind: 'system' },
      { id: 'proyectosenred', name: 'Proyectosenred', displayName: 'REPOSITORIO\\Proyectosenred', kind: 'group' },
      { id: 'usu4', name: 'usu4', displayName: 'REPOSITORIO\\usu4', kind: 'user', memberOf: ['proyectosenred', 'users', 'auth_users'] },
    ],
    initialFolders: [
      {
        id: 'c_root',
        name: 'C:\\',
        path: 'C:\\',
        parentId: null,
        owner: 'SYSTEM',
        inheritanceEnabled: false,
        aces: [
          { id: '3-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '3-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '3-usr', principalId: 'users', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...RX_PERMS], inheritedFrom: null },
          { id: '3-auth', principalId: 'auth_users', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...RX_PERMS, 'createFilesWriteData', 'createFoldersAppendData', 'writeAttributes', 'writeExtendedAttributes', 'delete'], inheritedFrom: null },
        ],
        sampleFiles: [],
        sampleSubfolders: ['Proyectos'],
      },
      {
        id: 'proyectos',
        name: 'Proyectos',
        path: 'C:\\Proyectos',
        parentId: 'c_root',
        owner: 'REPOSITORIO\\Administradores',
        inheritanceEnabled: true,
        aces: [],
        share: {
          shared: false,
          shareName: 'Proyectos',
          hidden: false,
          entries: [
            { id: '3-sh-adm', principalId: 'admin', allow: ['read', 'change', 'full'], deny: [] },
          ],
        },
        sampleFiles: [],
        sampleSubfolders: ['Proy1', 'Proy2', 'Proy3'],
      },
      {
        id: 'proy1',
        name: 'Proy1',
        path: 'C:\\Proyectos\\Proy1',
        parentId: 'proyectos',
        owner: 'REPOSITORIO\\Administradores',
        inheritanceEnabled: true,
        aces: [],
        sampleFiles: ['presupuesto.xlsx'],
        sampleSubfolders: [],
      },
    ],
    checkSolution: (folders, principals) => {
      const issues: EvaluationIssue[] = [];
      const hasShare = verifyNetworkShareAvailable('proyectos', 'proyectosenred', folders, principals, issues, 'Proyectosenred');

      const proj = folders.find((f) => f.id === 'proyectos')!;
      if (!proj.inheritanceEnabled) {
        issues.push({
          severity: 'success',
          title: 'Herencia deshabilitada en C:\\Proyectos',
          detail: 'La carpeta ya no recibe entradas automáticas desde C:\\.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'La herencia sigue habilitada',
          detail: 'Pulsa «Deshabilitar herencia» en Seguridad avanzada para romper la propagación desde C:\\.',
        });
      }

      const hasUsers = proj.aces.some((a) => a.principalId === 'users' || a.principalId === 'auth_users');
      if (!hasUsers) {
        issues.push({
          severity: 'success',
          title: 'Grupos genéricos del sistema eliminados',
          detail: 'Ni «Usuarios» ni «Usuarios autentificados» figuran en la ACL de C:\\Proyectos.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Quedan permisos para Usuarios o Usuarios autentificados',
          detail: 'Elimina de la lista a «Usuarios» y «Usuarios autentificados».',
        });
      }

      const onFolder = computeEffectivePermissions('proyectos', 'proyectosenred', 'thisFolder', 'network', folders, principals);
      const onProy1 = computeEffectivePermissions('proy1', 'proyectosenred', 'thisFolder', 'network', folders, principals);

      if (
        onFolder.effective.has('listRead') &&
        onFolder.effective.has('traverse') &&
        !onFolder.effective.has('createFilesWriteData') &&
        !onFolder.effective.has('delete') &&
        !onFolder.local.has('createFilesWriteData') &&
        !onFolder.local.has('delete')
      ) {
        issues.push({
          severity: 'success',
          title: 'Lectura por red correcta en C:\\Proyectos',
          detail: 'Proyectosenred puede entrar por red y ver la lista de carpetas de proyectos sin modificar la raíz.',
        });
      } else if (hasShare) {
        issues.push({
          severity: 'error',
          title: 'Permisos incorrectos para Proyectosenred en C:\\Proyectos',
          detail: 'Concede «Lectura y ejecución» en NTFS sin permisos de escritura o borrado.',
        });
      }

      if (!onProy1.effective.has('listRead') && !onProy1.effective.has('traverse') && !onProy1.local.has('listRead')) {
        issues.push({
          severity: 'success',
          title: 'Subcarpetas de proyecto aisladas',
          detail: 'Al usar «Solo esta carpeta», Proy1/Proy2/Proy3 no heredan lectura de Proyectosenred.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'El permiso se está heredando a Proy1',
          detail: 'El ámbito de Proyectosenred en C:\\Proyectos debe ser «Solo esta carpeta».',
        });
      }

      return buildEvaluation(issues, 100);
    },
  },

  // 4. Supervisión global de Ejecutivos
  {
    id: 'sc-ejecutivos',
    number: 4,
    title: 'Supervisión remota de Ejecutivos sobre proyectos presentes y futuros',
    category: 'Herencia y aislamiento',
    difficulty: 'Básico',
    sourcePractice: 'Práctica Repositorio',
    machineName: 'REPOSITORIO',
    targetFolderId: 'proyectos',
    targetPrincipalId: 'ejecutivos',
    testAccessMode: 'network',
    focusTab: 'share',
    enunciado:
      'Los miembros de «Ejecutivos» quieren echar un vistazo desde sus portátiles a todo lo que se guarda en C:\\Proyectos y en cualquier carpeta de proyecto que haya ahora o se cree más adelante. Solo es para consultar y abrir archivos, así que no deben poder cambiar, añadir ni borrar absolutamente nada.',
    contextNote:
      'Ten en cuenta que se conectarán desde fuera de ese equipo, así que revisa la configuración de red y la herencia hacia las subcarpetas.',
    hint:
      '1) En Compartir (Red) de C:\\Proyectos habilita compartir y añade a Ejecutivos con «Leer». 2) En NTFS añade a Ejecutivos con «Esta carpeta, subcarpetas y archivos» y Lectura y ejecución.',
    principals: [
      { id: 'admin', name: 'Administradores', displayName: 'REPOSITORIO\\Administradores', kind: 'system' },
      { id: 'system', name: 'SYSTEM', displayName: 'SYSTEM', kind: 'system' },
      { id: 'proyectosenred', name: 'Proyectosenred', displayName: 'REPOSITORIO\\Proyectosenred', kind: 'group' },
      { id: 'ejecutivos', name: 'Ejecutivos', displayName: 'REPOSITORIO\\Ejecutivos', kind: 'group' },
      { id: 'ejec1', name: 'ejec1', displayName: 'REPOSITORIO\\ejec1', kind: 'user', memberOf: ['ejecutivos', 'proyectosenred'] },
    ],
    initialFolders: [
      {
        id: 'proyectos',
        name: 'Proyectos',
        path: 'C:\\Proyectos',
        parentId: null,
        owner: 'REPOSITORIO\\Administradores',
        inheritanceEnabled: false,
        aces: [
          { id: '4-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '4-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '4-pr', principalId: 'proyectosenred', type: 'allow', scope: 'this_folder_only', permissions: [...RX_PERMS], inheritedFrom: null },
        ],
        share: {
          shared: false,
          shareName: 'Proyectos',
          hidden: false,
          entries: [
            { id: '4-sh-adm', principalId: 'admin', allow: ['read', 'change', 'full'], deny: [] },
          ],
        },
        sampleFiles: [],
        sampleSubfolders: ['Proy1', 'Proy2'],
      },
      {
        id: 'proy1',
        name: 'Proy1',
        path: 'C:\\Proyectos\\Proy1',
        parentId: 'proyectos',
        owner: 'REPOSITORIO\\Administradores',
        inheritanceEnabled: true,
        aces: [],
        sampleFiles: ['memoria.pdf'],
        sampleSubfolders: ['Anexos'],
      },
    ],
    checkSolution: (folders, principals) => {
      const issues: EvaluationIssue[] = [];
      const hasShare = verifyNetworkShareAvailable('proyectos', 'ejecutivos', folders, principals, issues, 'Ejecutivos');

      const localF = computeEffectivePermissions('proyectos', 'ejecutivos', 'thisFolder', 'network', folders, principals).local;
      const localS = computeEffectivePermissions('proyectos', 'ejecutivos', 'subfolders', 'network', folders, principals).local;
      const localFi = computeEffectivePermissions('proyectos', 'ejecutivos', 'files', 'network', folders, principals).local;
      const f = computeEffectivePermissions('proyectos', 'ejecutivos', 'thisFolder', 'network', folders, principals).effective;
      const s = computeEffectivePermissions('proyectos', 'ejecutivos', 'subfolders', 'network', folders, principals).effective;
      const fi = computeEffectivePermissions('proyectos', 'ejecutivos', 'files', 'network', folders, principals).effective;
      const p1f = computeEffectivePermissions('proy1', 'ejecutivos', 'files', 'network', folders, principals).effective;

      const hasRx = (set: Set<string>) =>
        set.has('traverse') && set.has('listRead') && set.has('readAttributes') && set.has('readPermissions');
      const hasWrite = (set: Set<string>) =>
        set.has('createFilesWriteData') || set.has('createFoldersAppendData') || set.has('delete') || set.has('deleteSubfoldersAndFiles');

      if (hasRx(f) && hasRx(s) && hasRx(fi) && hasRx(p1f)) {
        issues.push({
          severity: 'success',
          title: 'Lectura y ejecución por red heredada en toda la jerarquía',
          detail: 'Ejecutivos puede acceder por red y leer en C:\\Proyectos, subcarpetas y archivos actuales y futuros.',
        });
      } else if (hasShare) {
        issues.push({
          severity: 'error',
          title: 'Falta propagación completa de lectura',
          detail: 'Selecciona «Esta carpeta, subcarpetas y archivos» con permisos de Lectura y ejecución en NTFS.',
        });
      }

      if (!hasWrite(f) && !hasWrite(s) && !hasWrite(fi) && !hasWrite(localF) && !hasWrite(localS) && !hasWrite(localFi)) {
        issues.push({
          severity: 'success',
          title: 'Sin permisos de escritura o borrado',
          detail: 'Los ejecutivos mantienen acceso estrictamente de solo lectura.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Permisos de escritura concedidos por error',
          detail: 'Desmarca permisos de creación, escritura o eliminación en NTFS para Ejecutivos.',
        });
      }

      return buildEvaluation(issues, 100);
    },
  },

  // 5. Modificar archivos sin poder crear nuevos ni borrarlos (Par1 en Proy1)
  {
    id: 'sc-modificar-sin-crear',
    number: 5,
    title: 'Editar archivos ya creados sin añadir nuevos ni borrar',
    category: 'Permisos dobles',
    difficulty: 'Avanzado',
    sourcePractice: 'Práctica Repositorio (Permisos dobles)',
    machineName: 'REPOSITORIO',
    targetFolderId: 'proy1',
    targetPrincipalId: 'par1',
    testAccessMode: 'network',
    focusTab: 'share',
    enunciado:
      'Los compañeros de «Par1» trabajan desde otros ordenadores en C:\\Proyectos\\Proy1. Necesitan navegar por la carpeta y sus subcarpetas, abrir los documentos y editar los archivos que ya existen para actualizarlos. Eso sí: no pueden crear archivos nuevos, ni crear carpetas nuevas, ni borrar nada de lo que hay.',
    contextNote:
      'Acceden en red desde otros equipos. Piensa bien en cómo cambian los permisos según se apliquen a carpetas o a archivos.',
    hint:
      '1) Comparte C:\\Proyectos (o Proy1) dando a Par1 permiso de red «Cambiar» + «Leer». 2) En NTFS de Proy1 crea 2 entradas para Par1: «Esta carpeta y subcarpetas» (Lectura y ejecución) y «Solo archivos» (Lectura + «Crear archivos / escribir datos» + «Crear carpetas / anexar datos» + escribir atributos, SIN «Eliminar»).',
    principals: [
      { id: 'admin', name: 'Administradores', displayName: 'REPOSITORIO\\Administradores', kind: 'system' },
      { id: 'system', name: 'SYSTEM', displayName: 'SYSTEM', kind: 'system' },
      { id: 'ejecutivos', name: 'Ejecutivos', displayName: 'REPOSITORIO\\Ejecutivos', kind: 'group' },
      { id: 'par1', name: 'Par1', displayName: 'REPOSITORIO\\Par1', kind: 'group' },
      { id: 'usu4', name: 'usu4', displayName: 'REPOSITORIO\\usu4', kind: 'user', memberOf: ['par1'] },
    ],
    initialFolders: [
      {
        id: 'proyectos',
        name: 'Proyectos',
        path: 'C:\\Proyectos',
        parentId: null,
        owner: 'REPOSITORIO\\Administradores',
        inheritanceEnabled: false,
        aces: [
          { id: '5-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '5-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '5-ej', principalId: 'ejecutivos', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...RX_PERMS], inheritedFrom: null },
          { id: '5-par', principalId: 'par1', type: 'allow', scope: 'this_folder_only', permissions: [...RX_PERMS], inheritedFrom: null },
        ],
        share: {
          shared: false,
          shareName: 'Proyectos',
          hidden: false,
          entries: [
            { id: '5-sh-adm', principalId: 'admin', allow: ['read', 'change', 'full'], deny: [] },
          ],
        },
        sampleFiles: [],
        sampleSubfolders: ['Proy1'],
      },
      {
        id: 'proy1',
        name: 'Proy1',
        path: 'C:\\Proyectos\\Proy1',
        parentId: 'proyectos',
        owner: 'REPOSITORIO\\Administradores',
        inheritanceEnabled: true,
        aces: [],
        sampleFiles: ['plan_proyecto.docx', 'datos.xlsx'],
        sampleSubfolders: ['Actas'],
      },
    ],
    checkSolution: (folders, principals) => {
      const issues: EvaluationIssue[] = [];
      const hasShare = verifyNetworkShareAvailable('proy1', 'par1', folders, principals, issues, 'Par1');

      const onFolder = computeEffectivePermissions('proy1', 'par1', 'thisFolder', 'network', folders, principals);
      const onSubfolders = computeEffectivePermissions('proy1', 'par1', 'subfolders', 'network', folders, principals);
      const onFiles = computeEffectivePermissions('proy1', 'par1', 'files', 'network', folders, principals);

      if (onFolder.effective.has('listRead') && onFolder.effective.has('traverse') && onSubfolders.effective.has('listRead') && onFiles.effective.has('listRead')) {
        issues.push({
          severity: 'success',
          title: 'Lectura por red en carpeta, subcarpetas y archivos',
          detail: 'Par1 puede navegar por Proy1 y sus subcarpetas y abrir los archivos.',
        });
      } else if (hasShare) {
        issues.push({
          severity: 'error',
          title: 'Faltan permisos de lectura en algún nivel',
          detail: 'Asegúrate de dar Lectura y ejecución tanto en «Esta carpeta y subcarpetas» como en «Solo archivos».',
        });
      }

      if (onFiles.effective.has('createFilesWriteData')) {
        issues.push({
          severity: 'success',
          title: 'Modificación de archivos existentes por red habilitada',
          detail: 'En Red («Cambiar») y en NTFS («Solo archivos» + «Crear archivos / escribir datos»), pueden guardar cambios en archivos existentes.',
        });
      } else if (hasShare) {
        issues.push({
          severity: 'error',
          title: 'No pueden modificar archivos existentes desde otro equipo',
          detail: onFiles.local.has('createFilesWriteData')
            ? 'En NTFS local está bien, pero en «Compartir (Red)» falta marcar «Cambiar» para Par1 (intersección Red ∩ NTFS).'
            : 'Crea una entrada NTFS para Par1 aplicada a «Solo archivos» con «Crear archivos / escribir datos» y marca «Cambiar» en Red.',
        });
      }

      if (!onFolder.local.has('createFilesWriteData') && !onSubfolders.local.has('createFilesWriteData') && !onFolder.local.has('createFoldersAppendData')) {
        issues.push({
          severity: 'success',
          title: 'Creación de archivos y subcarpetas bloqueada',
          detail: 'No pueden crear elementos nuevos.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Pueden crear archivos o subcarpetas nuevos',
          detail: 'En la entrada de «Esta carpeta y subcarpetas», desmarca «Crear archivos / escribir datos» y «Crear carpetas / anexar datos».',
        });
      }

      if (!onFiles.local.has('delete') && !onFolder.local.has('delete') && !onFolder.local.has('deleteSubfoldersAndFiles')) {
        issues.push({
          severity: 'success',
          title: 'Eliminación bloqueada',
          detail: 'Par1 no puede borrar ni archivos ni carpetas.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Tienen permisos de eliminación',
          detail: 'Desmarca «Eliminar» y «Eliminar subcarpetas y archivos» en ambas entradas.',
        });
      }

      return buildEvaluation(issues, 100);
    },
  },

  // 6. Director con control total del contenido pero sin borrar la carpeta raíz (Dir1 en Proy1)
  {
    id: 'sc-director-sin-borrar-raiz',
    number: 6,
    title: 'Control total interno sin poder borrar la carpeta',
    category: 'Protección de carpeta raíz',
    difficulty: 'Intermedio',
    sourcePractice: 'Práctica Repositorio / Aulas SOR',
    machineName: 'REPOSITORIO',
    targetFolderId: 'proy1',
    targetPrincipalId: 'dir1',
    testAccessMode: 'network',
    focusTab: 'share',
    enunciado:
      'El grupo «Dir1» lleva la coordinación de C:\\Proyectos\\Proy1 desde otro ordenador de la oficina. Tienen que poder hacer de todo dentro del proyecto —crear y borrar archivos o subcarpetas, cambiar permisos y hasta hacerse propietarios de elementos internos—, pero hay una línea roja: no pueden eliminar ni cambiar el nombre de la propia carpeta Proy1.',
    contextNote:
      'Como trabajan a distancia por red, comprueba qué límite impone la forma de compartir la carpeta frente a los permisos de seguridad.',
    hint:
      '1) En Compartir (Red) de C:\\Proyectos (o Proy1) asigna a Dir1 «Control total». 2) En NTFS de Proy1 usa «Esta carpeta, subcarpetas y archivos» marcando los 12 permisos especiales EXCEPTO «Control total» y «Eliminar».',
    principals: [
      { id: 'admin', name: 'Administradores', displayName: 'REPOSITORIO\\Administradores', kind: 'system' },
      { id: 'system', name: 'SYSTEM', displayName: 'SYSTEM', kind: 'system' },
      { id: 'dir1', name: 'Dir1', displayName: 'REPOSITORIO\\Dir1', kind: 'group' },
      { id: 'usu1', name: 'usu1', displayName: 'REPOSITORIO\\usu1', kind: 'user', memberOf: ['dir1'] },
    ],
    initialFolders: [
      {
        id: 'proyectos',
        name: 'Proyectos',
        path: 'C:\\Proyectos',
        parentId: null,
        owner: 'REPOSITORIO\\Administradores',
        inheritanceEnabled: false,
        aces: [
          { id: '6-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '6-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '6-dir', principalId: 'dir1', type: 'allow', scope: 'this_folder_only', permissions: [...RX_PERMS], inheritedFrom: null },
        ],
        share: {
          shared: false,
          shareName: 'Proyectos',
          hidden: false,
          entries: [
            { id: '6-sh-adm', principalId: 'admin', allow: ['read', 'change', 'full'], deny: [] },
          ],
        },
        sampleFiles: [],
        sampleSubfolders: ['Proy1'],
      },
      {
        id: 'proy1',
        name: 'Proy1',
        path: 'C:\\Proyectos\\Proy1',
        parentId: 'proyectos',
        owner: 'REPOSITORIO\\Administradores',
        inheritanceEnabled: true,
        aces: [],
        sampleFiles: ['presupuesto.xlsx'],
        sampleSubfolders: ['Entregables'],
      },
    ],
    checkSolution: (folders, principals) => {
      const issues: EvaluationIssue[] = [];
      const hasShare = verifyNetworkShareAvailable('proy1', 'dir1', folders, principals, issues, 'Dir1');

      const onFolder = computeEffectivePermissions('proy1', 'dir1', 'thisFolder', 'network', folders, principals);
      const onSub = computeEffectivePermissions('proy1', 'dir1', 'subfolders', 'network', folders, principals);
      const onFiles = computeEffectivePermissions('proy1', 'dir1', 'files', 'network', folders, principals);

      if (!onFolder.local.has('delete') && !onFolder.local.has('fullControl')) {
        issues.push({
          severity: 'success',
          title: 'Carpeta Proy1 protegida frente a borrado',
          detail: 'Dir1 no tiene «Eliminar» sobre Proy1, por lo que no puede eliminar ni renombrar la carpeta raíz del proyecto.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Dir1 puede eliminar la propia carpeta Proy1',
          detail: 'Desmarca «Control total» y «Eliminar» en NTFS sobre «Esta carpeta, subcarpetas y archivos».',
        });
      }

      if (
        onFolder.effective.has('deleteSubfoldersAndFiles') &&
        onFolder.effective.has('createFilesWriteData') &&
        onFolder.effective.has('createFoldersAppendData') &&
        onFolder.effective.has('changePermissions') &&
        onFolder.effective.has('takeOwnership') &&
        onSub.effective.has('deleteSubfoldersAndFiles') &&
        onFiles.effective.has('createFilesWriteData')
      ) {
        issues.push({
          severity: 'success',
          title: 'Administración remota completa del contenido verificada',
          detail: 'Con «Control total» en Red y permiso especial NTFS, puede gestionar contenido, cambiar permisos y tomar posesión por red.',
        });
      } else if (hasShare) {
        const localOk =
          onFolder.local.has('changePermissions') &&
          onFolder.local.has('takeOwnership') &&
          onFolder.local.has('deleteSubfoldersAndFiles');
        issues.push({
          severity: 'error',
          title: 'Faltan permisos efectivos de administración por red',
          detail: localOk
            ? 'En NTFS local has marcado los permisos correctos, pero en «Compartir (Red)» solo tiene «Cambiar/Leer»: asigna «Control total» en Red para permitir Cambiar permisos y Tomar posesión remotamente.'
            : 'Marca los 12 permisos especiales (incluidos «Eliminar subcarpetas y archivos», «Cambiar permisos» y «Tomar posesión») en «Esta carpeta, subcarpetas y archivos» y «Control total» en Red.',
        });
      }

      return buildEvaluation(issues, 100);
    },
  },

  // 7. Entrega de prácticas + consulta de archivadas (Entrega_Practicas - Alumnos)
  {
    id: 'sc-entrega-practicas',
    number: 7,
    title: 'Subir prácticas y consultar las corregidas',
    category: 'Entrega y consulta',
    difficulty: 'Avanzado',
    sourcePractice: 'Práctica Aulas SOR',
    machineName: 'EQUIPO_PROFESOR',
    targetFolderId: 'entrega_pr',
    targetPrincipalId: 'alumnos',
    testAccessMode: 'network',
    focusTab: 'share',
    enunciado:
      'Los «Alumnos» se conectan desde sus puestos a C:\\SOR\\Entrega_Practicas. Ahí mismo tienen que poder entrar y subir sus prácticas nuevas en la carpeta principal, y también consultar lo que el profesor vaya dejando ya corregido dentro de subcarpetas como Corregidas. Pero ojo: no pueden modificar entregas anteriores, ni borrar archivos, ni crear subcarpetas.',
    contextNote:
      'Acceden desde otros equipos del aula; combina el acceso en red con reglas distintas según dónde afecten.',
    hint:
      '1) Comparte C:\\SOR (o Entrega_Practicas) dando a Alumnos «Cambiar» y «Leer». 2) En NTFS crea dos entradas: «Solo esta carpeta» (Lectura y ejecución + «Crear archivos / escribir datos») y «Esta carpeta, subcarpetas y archivos» (solo Lectura y ejecución).',
    principals: [
      { id: 'admin', name: 'Administradores', displayName: 'EQUIPO_PROFESOR\\Administradores', kind: 'system' },
      { id: 'system', name: 'SYSTEM', displayName: 'SYSTEM', kind: 'system' },
      { id: 'profesor', name: 'Profesor', displayName: 'EQUIPO_PROFESOR\\Profesor', kind: 'user' },
      { id: 'alumnos', name: 'Alumnos', displayName: 'EQUIPO_PROFESOR\\Alumnos', kind: 'group' },
      { id: 'alu_01', name: 'alu_01', displayName: 'EQUIPO_PROFESOR\\alu_01', kind: 'user', memberOf: ['alumnos'] },
    ],
    initialFolders: [
      {
        id: 'sor',
        name: 'SOR',
        path: 'C:\\SOR',
        parentId: null,
        owner: 'EQUIPO_PROFESOR\\Administradores',
        inheritanceEnabled: false,
        aces: [
          { id: '7-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '7-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '7-alu', principalId: 'alumnos', type: 'allow', scope: 'this_folder_only', permissions: [...RX_PERMS], inheritedFrom: null },
        ],
        share: {
          shared: false,
          shareName: 'SOR',
          hidden: false,
          entries: [
            { id: '7-sh-adm', principalId: 'admin', allow: ['read', 'change', 'full'], deny: [] },
          ],
        },
        sampleFiles: [],
        sampleSubfolders: ['Entrega_Practicas'],
      },
      {
        id: 'entrega_pr',
        name: 'Entrega_Practicas',
        path: 'C:\\SOR\\Entrega_Practicas',
        parentId: 'sor',
        owner: 'EQUIPO_PROFESOR\\Administradores',
        inheritanceEnabled: false,
        aces: [
          { id: '7-pr-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '7-pr-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          {
            id: '7-pr-prof',
            principalId: 'profesor',
            type: 'allow',
            scope: 'this_folder_subfolders_files',
            permissions: FULL_PERMS.filter((p) => p !== 'fullControl' && p !== 'delete' && p !== 'changePermissions' && p !== 'takeOwnership'),
            inheritedFrom: null,
          },
        ],
        sampleFiles: ['P1_alu02.pdf'],
        sampleSubfolders: ['Corregidas'],
      },
    ],
    checkSolution: (folders, principals) => {
      const issues: EvaluationIssue[] = [];
      const hasShare = verifyNetworkShareAvailable('entrega_pr', 'alumnos', folders, principals, issues, 'Alumnos');

      const onFolder = computeEffectivePermissions('entrega_pr', 'alumnos', 'thisFolder', 'network', folders, principals);
      const onSub = computeEffectivePermissions('entrega_pr', 'alumnos', 'subfolders', 'network', folders, principals);
      const onFiles = computeEffectivePermissions('entrega_pr', 'alumnos', 'files', 'network', folders, principals);

      if (onFolder.effective.has('createFilesWriteData') && onFolder.effective.has('listRead') && onFolder.effective.has('traverse')) {
        issues.push({
          severity: 'success',
          title: 'Entrega de prácticas en la raíz permitida por red',
          detail: 'Alumnos puede entrar, listar y crear archivos en C:\\SOR\\Entrega_Practicas.',
        });
      } else if (hasShare) {
        issues.push({
          severity: 'error',
          title: 'Faltan permisos para entregar archivos en la raíz por red',
          detail: onFolder.local.has('createFilesWriteData')
            ? 'En NTFS local es correcto, pero en «Compartir (Red)» falta marcar «Cambiar» para Alumnos.'
            : 'Añade una entrada NTFS para Alumnos en «Solo esta carpeta» con Lectura y ejecución + «Crear archivos / escribir datos» y «Cambiar» en Red.',
        });
      }

      if (onSub.effective.has('listRead') && onSub.effective.has('traverse') && onFiles.effective.has('listRead')) {
        issues.push({
          severity: 'success',
          title: 'Consulta de subcarpetas archivadas activa',
          detail: 'Alumnos puede explorar las subcarpetas de prácticas corregidas y leer los archivos.',
        });
      } else if (hasShare) {
        issues.push({
          severity: 'error',
          title: 'No pueden consultar prácticas archivadas en subcarpetas',
          detail: 'Añade una entrada en «Esta carpeta, subcarpetas y archivos» con Lectura y ejecución.',
        });
      }

      if (!onFiles.local.has('createFilesWriteData') && !onSub.local.has('createFilesWriteData') && !onFolder.local.has('createFoldersAppendData') && !onFiles.local.has('delete') && !onFolder.local.has('delete')) {
        issues.push({
          severity: 'success',
          title: 'Integridad de entregas y carpetas protegida',
          detail: 'No pueden modificar archivos existentes, crear subcarpetas ni eliminar entregas.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Permisos de escritura o borrado excesivos',
          detail: 'Limita «Crear archivos / escribir datos» a «Solo esta carpeta», y no concedas «Crear carpetas» ni «Eliminar».',
        });
      }

      return buildEvaluation(issues, 100);
    },
  },

  // 8. Intersección Red + NTFS + Recurso oculto ($)
  {
    id: 'sc-interseccion-red-ntfs',
    number: 8,
    title: 'Carpeta oculta en red con límite para Auditores',
    category: 'Intersección Red y NTFS',
    difficulty: 'Intermedio',
    sourcePractice: 'Permisos locales y en red',
    machineName: 'SERVIDOR',
    targetFolderId: 'contabilidad',
    targetPrincipalId: 'auditores',
    testAccessMode: 'network',
    focusTab: 'share',
    requireNetworkCheck: true,
    enunciado:
      'Queremos publicar en red la carpeta C:\\Datos\\Contabilidad de forma oculta (para que no salga al explorar la red) usando el nombre «Contabilidad$». Aunque el grupo «Auditores» puede editar y borrar archivos si se sienta en el propio servidor, cuando entren desde otro equipo por red solo deben poder mirar el contenido sin cambiar ni borrar nada.',
    contextNote:
      'No toques los permisos locales que ya tiene Auditores en el servidor; resuélvelo únicamente desde la configuración de red.',
    hint:
      'En la pestaña «Compartir (Red)», activa compartir carpeta con nombre «Contabilidad$» (el símbolo $ la oculta) y concede a Auditores únicamente permiso de red «Leer».',
    principals: [
      { id: 'admin', name: 'Administradores', displayName: 'SERVIDOR\\Administradores', kind: 'system' },
      { id: 'system', name: 'SYSTEM', displayName: 'SYSTEM', kind: 'system' },
      { id: 'auditores', name: 'Auditores', displayName: 'SERVIDOR\\Auditores', kind: 'group' },
      { id: 'aud1', name: 'aud1', displayName: 'SERVIDOR\\aud1', kind: 'user', memberOf: ['auditores'] },
    ],
    initialFolders: [
      {
        id: 'contabilidad',
        name: 'Contabilidad',
        path: 'C:\\Datos\\Contabilidad',
        parentId: null,
        owner: 'SERVIDOR\\Administradores',
        inheritanceEnabled: false,
        aces: [
          { id: '8-adm', principalId: 'admin', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          { id: '8-sys', principalId: 'system', type: 'allow', scope: 'this_folder_subfolders_files', permissions: [...FULL_PERMS], inheritedFrom: null },
          {
            id: '8-aud',
            principalId: 'auditores',
            type: 'allow',
            scope: 'this_folder_subfolders_files',
            permissions: ['traverse', 'listRead', 'readAttributes', 'readExtendedAttributes', 'createFilesWriteData', 'createFoldersAppendData', 'writeAttributes', 'writeExtendedAttributes', 'delete', 'readPermissions'],
            inheritedFrom: null,
          },
        ],
        share: {
          shared: false,
          shareName: 'Contabilidad',
          hidden: false,
          entries: [
            { id: '8-sh-adm', principalId: 'admin', allow: ['read', 'change', 'full'], deny: [] },
          ],
        },
        sampleFiles: ['balance_2026.xlsx', 'libro_diario.csv'],
        sampleSubfolders: ['Trimestre_1'],
      },
    ],
    checkSolution: (folders, principals) => {
      const issues: EvaluationIssue[] = [];
      const cont = folders.find((f) => f.id === 'contabilidad')!;

      if (cont.share?.shared && cont.share.shareName.trim().toLowerCase() === 'contabilidad$') {
        issues.push({
          severity: 'success',
          title: 'Recurso compartido oculto correctamente',
          detail: 'Compartido como \\\\SERVIDOR\\Contabilidad$ (el signo $ oculta la carpeta en el explorador de red).',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Recurso compartido o nombre incorrecto',
          detail: 'Activa «Compartir esta carpeta» en la pestaña Compartir (Red) con el nombre exacto «Contabilidad$».',
        });
      }

      const netFiles = computeEffectivePermissions('contabilidad', 'auditores', 'files', 'network', folders, principals);
      const localFiles = netFiles.local;
      const effFiles = netFiles.effective;

      if (localFiles.has('createFilesWriteData') && localFiles.has('delete')) {
        issues.push({
          severity: 'success',
          title: 'Permiso local NTFS Modificar conservado',
          detail: 'En local el grupo Auditores mantiene sus permisos de modificación.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Se modificó el permiso local NTFS',
          detail: 'Conserva el permiso local Modificar de Auditores en NTFS y restringe el acceso usando únicamente el permiso de Red.',
        });
      }

      if (effFiles.has('listRead') && !effFiles.has('createFilesWriteData') && !effFiles.has('delete')) {
        issues.push({
          severity: 'success',
          title: 'Intersección Red ∩ NTFS aplicada',
          detail: 'Al acceder por red, el mínimo entre Red (Leer) y NTFS (Modificar) resulta en solo lectura efectiva.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'El permiso efectivo en red no es de solo lectura',
          detail: 'En los permisos del recurso compartido para Auditores, marca únicamente «Leer» (sin «Cambiar» ni «Control total»).',
        });
      }

      return buildEvaluation(issues, 100);
    },
  },
];
