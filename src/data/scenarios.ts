import {
  EvaluationIssue,
  NtfsScenario,
  ScenarioEvaluation,
  VirtualFolderNode,
  VirtualPrincipal,
} from '../types/ntfs';
import {
  computeEffectivePermissions,
  computeLocalEffectivePermissions,
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
      ? 'Configuración NTFS válida: todos los requisitos de objeto y permisos especiales se cumplen.'
      : `Faltan ${errors.length} ${errors.length === 1 ? 'ajuste' : 'ajustes'} para cumplir exactamente el enunciado.`,
    issues,
  };
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
    focusTab: 'entry',
    enunciado:
      'En C:\\SOR\\Entrega_Examenes, configura los permisos para el grupo Alumnos de modo que puedan entregar su examen (arrastrando o pegando el archivo dentro de la carpeta), pero NO puedan abrir/listar la carpeta para ver quién ha entregado ni leer, modificar o eliminar exámenes previos.',
    contextNote:
      'La carpeta padre C:\\SOR está compartida en red con permiso Cambiar y Leer para Alumnos, y tiene la herencia deshabilitada en Entrega_Examenes.',
    hint:
      'Crear archivos es un permiso de carpeta («Solo esta carpeta»). Marca «Crear archivos / escribir datos» y «Permisos de lectura» (y opcionalmente Atravesar carpeta), pero NO marques «Mostrar carpeta / leer datos».',
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
          shared: true,
          shareName: 'SOR',
          hidden: false,
          entries: [
            { id: '1-sh-adm', principalId: 'admin', allow: ['read', 'change', 'full'], deny: [] },
            { id: '1-sh-alu', principalId: 'alumnos', allow: ['read', 'change'], deny: [] },
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
      const onFolder = computeEffectivePermissions('entrega_ex', 'alumnos', 'thisFolder', 'network', folders, principals).effective;
      const onFiles = computeEffectivePermissions('entrega_ex', 'alumnos', 'files', 'network', folders, principals).effective;
      const onSubfolders = computeEffectivePermissions('entrega_ex', 'alumnos', 'subfolders', 'network', folders, principals).effective;

      if (onFolder.has('createFilesWriteData')) {
        issues.push({
          severity: 'success',
          title: 'Creación de archivos habilitada en la carpeta',
          detail: 'Alumnos tiene «Crear archivos / escribir datos» sobre Esta carpeta, por lo que puede depositar su examen.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Falta permiso para crear el archivo de entrega',
          detail: onFiles.has('createFilesWriteData')
            ? 'Has aplicado «Crear archivos / escribir datos» a Archivos, pero crear archivos nuevos es un permiso de carpeta («Solo esta carpeta»).'
            : 'Alumnos necesita «Crear archivos / escribir datos» aplicado a «Solo esta carpeta».',
        });
      }

      if (!onFolder.has('listRead') && !onFiles.has('listRead')) {
        issues.push({
          severity: 'success',
          title: 'Entrega ciega protegida',
          detail: '«Mostrar carpeta / leer datos» está desmarcado: no pueden listar ni leer los exámenes de otros alumnos.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Los alumnos pueden ver o leer entregas ajenas',
          detail: 'Debes quitar «Mostrar carpeta / leer datos» para impedir que entren a listar el contenido o leer archivos entregados.',
        });
      }

      if (onFiles.has('createFilesWriteData') || onFiles.has('delete') || onFolder.has('deleteSubfoldersAndFiles') || onFolder.has('delete')) {
        issues.push({
          severity: 'error',
          title: 'Permiso excesivo de modificación o borrado',
          detail: 'El ámbito debe ser «Solo esta carpeta» (no «Esta carpeta y archivos» ni «Esta carpeta, subcarpetas y archivos») y sin permisos de eliminación.',
        });
      }

      if (onSubfolders.size > 0 || onFiles.size > 0) {
        if (!issues.some((i) => i.severity === 'error')) {
          issues.push({
            severity: 'warning',
            title: 'Ámbito más amplio de lo necesario',
            detail: 'Conviene limitar la entrada a «Solo esta carpeta» para no propagar permisos a archivos o subcarpetas.',
          });
        }
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
    testAccessMode: 'local',
    focusTab: 'entry',
    enunciado:
      'En C:\\SOR\\Enunciado_Examenes el profesor no debe guardar historial en subcarpetas, solo el examen actual. Configura los permisos de Profesor en UNA sola entrada para que pueda ver el contenido, crear, modificar y eliminar archivos, pero NO pueda crear subcarpetas ni eliminar la propia carpeta Enunciado_Examenes.',
    contextNote:
      'La herencia ya está deshabilitada y Alumnos tiene Lectura y ejecución en «Esta carpeta y archivos». Falta configurar al usuario Profesor.',
    hint:
      'Usa el ámbito «Esta carpeta y archivos». Marca lectura, «Crear archivos / escribir datos», escribir atributos y «Eliminar subcarpetas y archivos», pero deja sin marcar «Crear carpetas / anexar datos» y «Eliminar».',
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
        ],
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
      const onFolder = computeLocalEffectivePermissions('enunciado_ex', 'profesor', 'thisFolder', folders, principals);
      const onFiles = computeLocalEffectivePermissions('enunciado_ex', 'profesor', 'files', folders, principals);
      const onSubfolders = computeLocalEffectivePermissions('enunciado_ex', 'profesor', 'subfolders', folders, principals);

      if (onFolder.has('listRead') && onFolder.has('traverse') && onFiles.has('listRead')) {
        issues.push({
          severity: 'success',
          title: 'Lectura de carpeta y archivos correcta',
          detail: 'Profesor puede listar la carpeta y leer los archivos de enunciados.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Faltan permisos de lectura en carpeta y archivos',
          detail: 'Debe tener «Atravesar carpeta / ejecutar archivo» y «Mostrar carpeta / leer datos» en «Esta carpeta y archivos».',
        });
      }

      if (onFolder.has('createFilesWriteData') && onFiles.has('createFilesWriteData')) {
        issues.push({
          severity: 'success',
          title: 'Creación y modificación de archivos activa',
          detail: 'Con «Crear archivos / escribir datos» en «Esta carpeta y archivos», puede crear archivos nuevos y editar los existentes.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Falta permiso para crear y modificar archivos',
          detail: 'Aplica «Crear archivos / escribir datos» al ámbito «Esta carpeta y archivos».',
        });
      }

      if (!onFolder.has('createFoldersAppendData')) {
        issues.push({
          severity: 'success',
          title: 'Creación de subcarpetas bloqueada',
          detail: '«Crear carpetas / anexar datos» está desmarcado para evitar que cree subcarpetas de historial.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'El profesor aún puede crear subcarpetas',
          detail: 'Desmarca «Crear carpetas / anexar datos» para impedir subcarpetas.',
        });
      }

      if ((onFolder.has('deleteSubfoldersAndFiles') || onFiles.has('delete')) && !onFolder.has('delete')) {
        issues.push({
          severity: 'success',
          title: 'Puede borrar archivos pero no la carpeta raíz',
          detail: '«Eliminar subcarpetas y archivos» permite limpiar archivos antiguos mientras la carpeta Enunciado_Examenes queda protegida (sin «Eliminar»).',
        });
      } else if (onFolder.has('delete')) {
        issues.push({
          severity: 'error',
          title: 'Podría borrar la propia carpeta Enunciado_Examenes',
          detail: 'Quita el permiso «Eliminar» sobre la carpeta y usa en su lugar «Eliminar subcarpetas y archivos».',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'No puede eliminar archivos de enunciados antiguos',
          detail: 'Marca «Eliminar subcarpetas y archivos» para que pueda borrar archivos dentro de Enunciado_Examenes.',
        });
      }

      if (onSubfolders.size > 0) {
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
    title: 'Aislar la carpeta raíz sin propagar a subcarpetas',
    category: 'Herencia y aislamiento',
    difficulty: 'Básico',
    sourcePractice: 'Práctica Repositorio',
    machineName: 'REPOSITORIO',
    targetFolderId: 'proyectos',
    targetPrincipalId: 'proyectosenred',
    testAccessMode: 'local',
    focusTab: 'security',
    enunciado:
      'En C:\\Proyectos cuelgan las carpetas Proy1, Proy2 y Proy3. Debes: 1) Deshabilitar la herencia (convirtiendo permisos heredados y eliminando a Usuarios y Usuarios autentificados), y 2) Dar permiso de Lectura y ejecución a «Proyectosenred» SOLO en la carpeta Proyectos, para que puedan ver las carpetas de proyecto pero NO entrar en proyectos ajenos por herencia.',
    contextNote:
      'Este patrón evita que al entrar en C:\\Proyectos todos los usuarios hereden acceso de lectura hacia C:\\Proyectos\\Proy1, Proy2 y Proy3.',
    hint:
      'Ve a «Seguridad avanzada», pulsa «Deshabilitar herencia» -> Convertir, quita «Usuarios» y «Usuarios autentificados», y añade a «Proyectosenred» con Lectura y ejecución en «Solo esta carpeta».',
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
          detail: 'Elimina de la lista a «Usuarios» y «Usuarios autentificados» para impedir accesos no autorizados.',
        });
      }

      const onFolder = computeLocalEffectivePermissions('proyectos', 'proyectosenred', 'thisFolder', folders, principals);
      const onProy1 = computeLocalEffectivePermissions('proy1', 'proyectosenred', 'thisFolder', folders, principals);

      if (onFolder.has('listRead') && onFolder.has('traverse') && !onFolder.has('createFilesWriteData') && !onFolder.has('delete')) {
        issues.push({
          severity: 'success',
          title: 'Lectura correcta en C:\\Proyectos',
          detail: 'Proyectosenred puede entrar y ver la lista de carpetas de proyectos sin modificar la raíz.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Permisos incorrectos para Proyectosenred en C:\\Proyectos',
          detail: 'Concede «Lectura y ejecución» (Atravesar, Mostrar, Leer atributos/extendidos, Permisos de lectura) sin escritura.',
        });
      }

      if (!onProy1.has('listRead') && !onProy1.has('traverse')) {
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
    title: 'Supervisión de Ejecutivos sobre proyectos presentes y futuros',
    category: 'Herencia y aislamiento',
    difficulty: 'Básico',
    sourcePractice: 'Práctica Repositorio',
    machineName: 'REPOSITORIO',
    targetFolderId: 'proyectos',
    targetPrincipalId: 'ejecutivos',
    testAccessMode: 'local',
    focusTab: 'entry',
    enunciado:
      'En C:\\Proyectos, el grupo «Ejecutivos» debe poder leer y ejecutar absolutamente todo el contenido de C:\\Proyectos y de cualquier subcarpeta o archivo actual o futuro, pero sin poder crear, editar ni borrar nada. Configúralo en C:\\Proyectos.',
    contextNote:
      'Al aplicar la entrada en la carpeta padre con propagación completa, las nuevas carpetas Proy4, Proy5... heredarán automáticamente este permiso de solo lectura.',
    hint:
      'Añade a «Ejecutivos» con ámbito «Esta carpeta, subcarpetas y archivos» y permisos de Lectura y ejecución.',
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
      const f = computeLocalEffectivePermissions('proyectos', 'ejecutivos', 'thisFolder', folders, principals);
      const s = computeLocalEffectivePermissions('proyectos', 'ejecutivos', 'subfolders', folders, principals);
      const fi = computeLocalEffectivePermissions('proyectos', 'ejecutivos', 'files', folders, principals);
      const p1f = computeLocalEffectivePermissions('proy1', 'ejecutivos', 'files', folders, principals);

      const hasRx = (set: Set<string>) =>
        set.has('traverse') && set.has('listRead') && set.has('readAttributes') && set.has('readPermissions');
      const hasWrite = (set: Set<string>) =>
        set.has('createFilesWriteData') || set.has('createFoldersAppendData') || set.has('delete') || set.has('deleteSubfoldersAndFiles');

      if (hasRx(f) && hasRx(s) && hasRx(fi) && hasRx(p1f)) {
        issues.push({
          severity: 'success',
          title: 'Lectura y ejecución heredada en toda la jerarquía',
          detail: 'Ejecutivos puede acceder y leer en C:\\Proyectos, subcarpetas y archivos actuales y futuros.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Falta propagación completa de lectura',
          detail: 'Selecciona «Esta carpeta, subcarpetas y archivos» con permisos de Lectura y ejecución.',
        });
      }

      if (!hasWrite(f) && !hasWrite(s) && !hasWrite(fi)) {
        issues.push({
          severity: 'success',
          title: 'Sin permisos de escritura o borrado',
          detail: 'Los ejecutivos mantienen acceso estrictamente de solo lectura.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Permisos de escritura concedidos por error',
          detail: 'Asegúrate de desmarcar permisos de creación, escritura o eliminación para Ejecutivos.',
        });
      }

      return buildEvaluation(issues, 100);
    },
  },

  // 5. Modificar archivos sin poder crear nuevos ni borrarlos (Par1 en Proy1)
  {
    id: 'sc-modificar-sin-crear',
    number: 5,
    title: 'Modificar archivos existentes sin crear nuevos ni borrar',
    category: 'Permisos dobles',
    difficulty: 'Avanzado',
    sourcePractice: 'Práctica Repositorio (Permisos dobles)',
    machineName: 'REPOSITORIO',
    targetFolderId: 'proy1',
    targetPrincipalId: 'par1',
    testAccessMode: 'local',
    focusTab: 'entry',
    enunciado:
      'En C:\\Proyectos\\Proy1, los participantes «Par1» deben poder entrar en Proy1 y sus subcarpetas y leer todo, y además poder MODIFICAR el contenido de los archivos ya existentes. Sin embargo, NO deben poder crear archivos nuevos, NO deben poder crear subcarpetas, y NO deben poder borrar ni archivos ni carpetas.',
    contextNote:
      'Este es el caso clásico de permisos dobles en NTFS: «Crear archivos / escribir datos» significa «Crear archivos» en carpetas, pero significa «Escribir/modificar datos» cuando se aplica a «Solo archivos».',
    hint:
      'Necesitas DOS entradas para Par1 en Proy1: 1) «Esta carpeta y subcarpetas» solo con Lectura y ejecución; 2) «Solo archivos» con Lectura + «Crear archivos / escribir datos» (+ «Crear carpetas / anexar datos» y escribir atributos), sin «Eliminar».',
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
        ],
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
      const onFolder = computeLocalEffectivePermissions('proy1', 'par1', 'thisFolder', folders, principals);
      const onSubfolders = computeLocalEffectivePermissions('proy1', 'par1', 'subfolders', folders, principals);
      const onFiles = computeLocalEffectivePermissions('proy1', 'par1', 'files', folders, principals);

      if (onFolder.has('listRead') && onFolder.has('traverse') && onSubfolders.has('listRead') && onFiles.has('listRead')) {
        issues.push({
          severity: 'success',
          title: 'Lectura en carpeta, subcarpetas y archivos',
          detail: 'Par1 puede navegar por Proy1 y sus subcarpetas y abrir los archivos.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Faltan permisos de lectura en algún nivel',
          detail: 'Asegúrate de dar Lectura y ejecución tanto en «Esta carpeta y subcarpetas» como en «Solo archivos».',
        });
      }

      if (onFiles.has('createFilesWriteData')) {
        issues.push({
          severity: 'success',
          title: 'Modificación de archivos existentes habilitada',
          detail: 'En «Solo archivos», «Crear archivos / escribir datos» permite editar y guardar archivos existentes.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'No pueden modificar archivos existentes',
          detail: 'Crea una entrada para Par1 aplicada a «Solo archivos» con «Crear archivos / escribir datos» marcado.',
        });
      }

      if (!onFolder.has('createFilesWriteData') && !onSubfolders.has('createFilesWriteData') && !onFolder.has('createFoldersAppendData')) {
        issues.push({
          severity: 'success',
          title: 'Creación de archivos y subcarpetas bloqueada',
          detail: 'Al no marcar permisos de creación en «Esta carpeta y subcarpetas», no pueden crear elementos nuevos.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Pueden crear archivos o subcarpetas nuevos',
          detail: 'En la entrada de «Esta carpeta y subcarpetas», desmarca «Crear archivos / escribir datos» y «Crear carpetas / anexar datos».',
        });
      }

      if (!onFiles.has('delete') && !onFolder.has('delete') && !onFolder.has('deleteSubfoldersAndFiles')) {
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
    title: 'Administración total del contenido sin eliminar la carpeta padre',
    category: 'Protección de carpeta raíz',
    difficulty: 'Intermedio',
    sourcePractice: 'Práctica Repositorio / Aulas SOR',
    machineName: 'REPOSITORIO',
    targetFolderId: 'proy1',
    targetPrincipalId: 'dir1',
    testAccessMode: 'local',
    focusTab: 'entry',
    enunciado:
      'En C:\\Proyectos\\Proy1, los directores «Dir1» deben tener prácticamente Control Total sobre todo lo que contiene Proy1 (crear y borrar subcarpetas, crear/modificar/borrar archivos, cambiar permisos y tomar posesión), pero NO deben poder eliminar ni renombrar la propia carpeta Proy1.',
    contextNote:
      'Si marcas «Control total», Windows activa automáticamente «Eliminar» sobre la carpeta actual. Para evitar que borren Proy1 pero sí su contenido, hay que usar un permiso Especial.',
    hint:
      'Usa «Esta carpeta, subcarpetas y archivos» y marca todos los permisos avanzados EXCEPTO «Control total» y «Eliminar». («Eliminar subcarpetas y archivos» SÍ debe quedar marcado).',
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
        ],
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
      const onFolder = computeLocalEffectivePermissions('proy1', 'dir1', 'thisFolder', folders, principals);
      const onSub = computeLocalEffectivePermissions('proy1', 'dir1', 'subfolders', folders, principals);
      const onFiles = computeLocalEffectivePermissions('proy1', 'dir1', 'files', folders, principals);

      if (!onFolder.has('delete') && !onFolder.has('fullControl')) {
        issues.push({
          severity: 'success',
          title: 'Carpeta Proy1 protegida frente a borrado',
          detail: 'Dir1 no tiene el permiso «Eliminar» sobre Proy1, por lo que no puede eliminar ni renombrar la carpeta raíz del proyecto.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Dir1 puede eliminar la propia carpeta Proy1',
          detail: 'Desmarca «Control total» y «Eliminar» en «Esta carpeta, subcarpetas y archivos».',
        });
      }

      if (
        onFolder.has('deleteSubfoldersAndFiles') &&
        onFolder.has('createFilesWriteData') &&
        onFolder.has('createFoldersAppendData') &&
        onFolder.has('changePermissions') &&
        onFolder.has('takeOwnership') &&
        onSub.has('deleteSubfoldersAndFiles') &&
        onFiles.has('createFilesWriteData')
      ) {
        issues.push({
          severity: 'success',
          title: 'Administración completa del contenido verificada',
          detail: 'Puede crear/eliminar subcarpetas y archivos, cambiar permisos y tomar posesión en toda la jerarquía interna.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Faltan permisos de administración sobre el contenido',
          detail: 'Asegúrate de marcar los 12 permisos restantes (incluidos «Eliminar subcarpetas y archivos», «Cambiar permisos» y «Tomar posesión») en «Esta carpeta, subcarpetas y archivos».',
        });
      }

      return buildEvaluation(issues, 100);
    },
  },

  // 7. Entrega de prácticas + consulta de archivadas (Entrega_Practicas - Alumnos)
  {
    id: 'sc-entrega-practicas',
    number: 7,
    title: 'Entrega en raíz y consulta de prácticas archivadas',
    category: 'Entrega y consulta',
    difficulty: 'Avanzado',
    sourcePractice: 'Práctica Aulas SOR',
    machineName: 'EQUIPO_PROFESOR',
    targetFolderId: 'entrega_pr',
    targetPrincipalId: 'alumnos',
    testAccessMode: 'local',
    focusTab: 'entry',
    enunciado:
      'En C:\\SOR\\Entrega_Practicas, los «Alumnos» deben poder ver la carpeta, subir sus prácticas directamente en la raíz Entrega_Practicas, y además leer los archivos que el Profesor archive en subcarpetas (ej. Corregidas). Sin embargo, NO deben poder modificar ni borrar archivos ya entregados, ni crear subcarpetas.',
    contextNote:
      'Si dieras «Crear archivos / escribir datos» en «Esta carpeta, subcarpetas y archivos», también podrían sobrescribir los archivos entregados por otros alumnos o las correcciones del profesor.',
    hint:
      'Crea DOS entradas para Alumnos: 1) «Solo esta carpeta» con Lectura y ejecución + «Crear archivos / escribir datos»; 2) «Esta carpeta, subcarpetas y archivos» solo con Lectura y ejecución.',
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
        ],
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
      const onFolder = computeLocalEffectivePermissions('entrega_pr', 'alumnos', 'thisFolder', folders, principals);
      const onSub = computeLocalEffectivePermissions('entrega_pr', 'alumnos', 'subfolders', folders, principals);
      const onFiles = computeLocalEffectivePermissions('entrega_pr', 'alumnos', 'files', folders, principals);

      if (onFolder.has('createFilesWriteData') && onFolder.has('listRead') && onFolder.has('traverse')) {
        issues.push({
          severity: 'success',
          title: 'Entrega de prácticas en la raíz permitida',
          detail: 'Alumnos puede entrar, listar y crear archivos en C:\\SOR\\Entrega_Practicas.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'Faltan permisos para entregar archivos en la raíz',
          detail: 'Añade una entrada para Alumnos en «Solo esta carpeta» con Lectura y ejecución + «Crear archivos / escribir datos».',
        });
      }

      if (onSub.has('listRead') && onSub.has('traverse') && onFiles.has('listRead')) {
        issues.push({
          severity: 'success',
          title: 'Consulta de subcarpetas archivadas activa',
          detail: 'Alumnos puede explorar las subcarpetas de prácticas corregidas y leer los archivos.',
        });
      } else {
        issues.push({
          severity: 'error',
          title: 'No pueden consultar prácticas archivadas en subcarpetas',
          detail: 'Añade una entrada en «Esta carpeta, subcarpetas y archivos» con Lectura y ejecución.',
        });
      }

      if (!onFiles.has('createFilesWriteData') && !onSub.has('createFilesWriteData') && !onFolder.has('createFoldersAppendData') && !onFiles.has('delete') && !onFolder.has('delete')) {
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
    title: 'Intersección Red ∩ NTFS y recurso compartido oculto ($)',
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
      'La carpeta C:\\Datos\\Contabilidad debe compartirse en red de forma OCULTA como «Contabilidad$». Aunque el grupo «Auditores» tiene localmente en NTFS permiso de Modificar sobre «Esta carpeta, subcarpetas y archivos», al acceder por red solo deben poder LEER (sin editar ni eliminar nada). Configura la pestaña Compartir (Red) manteniendo su permiso local NTFS.',
    contextNote:
      'El permiso efectivo al acceder por red es siempre la INTERSECCIÓN (el mínimo) entre el permiso del recurso compartido y el permiso local NTFS.',
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
