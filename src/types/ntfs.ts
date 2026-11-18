export type NtfsPermissionKey =
  | 'fullControl'
  | 'traverse'
  | 'listRead'
  | 'readAttributes'
  | 'readExtendedAttributes'
  | 'createFilesWriteData'
  | 'createFoldersAppendData'
  | 'writeAttributes'
  | 'writeExtendedAttributes'
  | 'deleteSubfoldersAndFiles'
  | 'delete'
  | 'readPermissions'
  | 'changePermissions'
  | 'takeOwnership';

export type ApplyToScope =
  | 'this_folder_only'
  | 'this_folder_subfolders_files'
  | 'this_folder_subfolders'
  | 'this_folder_files'
  | 'subfolders_files_only'
  | 'subfolders_only'
  | 'files_only';

export type AceType = 'allow' | 'deny';

export type SharePermissionLevel = 'read' | 'change' | 'full';

export interface ShareEntry {
  id: string;
  principalId: string;
  allow: SharePermissionLevel[];
  deny: SharePermissionLevel[];
}

export interface NtfsAce {
  id: string;
  principalId: string;
  type: AceType;
  scope: ApplyToScope;
  permissions: NtfsPermissionKey[];
  inheritedFrom: string | null;
  onlyThisContainerChildren?: boolean;
}

export interface VirtualPrincipal {
  id: string;
  name: string;
  displayName: string;
  kind: 'user' | 'group' | 'system';
  memberOf?: string[];
  description?: string;
}

export interface FolderShareConfig {
  shared: boolean;
  shareName: string;
  hidden: boolean;
  entries: ShareEntry[];
}

export interface VirtualFolderNode {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  owner: string;
  inheritanceEnabled: boolean;
  aces: NtfsAce[];
  share?: FolderShareConfig;
  sampleFiles: string[];
  sampleSubfolders: string[];
}

export type SimulatedActionId =
  | 'enter_folder'
  | 'list_contents'
  | 'create_file'
  | 'modify_existing_file'
  | 'create_subfolder'
  | 'delete_existing_file'
  | 'delete_subfolder'
  | 'delete_this_folder'
  | 'read_in_subfolder'
  | 'create_in_subfolder'
  | 'change_permissions'
  | 'take_ownership';

export interface ActionSimulationResult {
  actionId: SimulatedActionId;
  label: string;
  allowed: boolean;
  localAllowed: boolean;
  shareAllowed: boolean;
  reason: string;
  relevantRule: string;
}

export interface EvaluationIssue {
  severity: 'error' | 'warning' | 'success';
  title: string;
  detail: string;
}

export interface ScenarioEvaluation {
  passed: boolean;
  score: number;
  maxScore: number;
  summary: string;
  issues: EvaluationIssue[];
}

export type ScenarioCategory =
  | 'Buzón de entrega ciega'
  | 'Permisos dobles'
  | 'Herencia y aislamiento'
  | 'Carpetas sin historial'
  | 'Protección de carpeta raíz'
  | 'Entrega y consulta'
  | 'Intersección Red y NTFS'
  | 'Ejecución y Denegar';

export interface NtfsScenario {
  id: string;
  number: number;
  title: string;
  category: ScenarioCategory;
  difficulty: 'Básico' | 'Intermedio' | 'Avanzado';
  sourcePractice: string;
  machineName: string;
  targetFolderId: string;
  targetPrincipalId: string;
  testAccessMode: 'local' | 'network';
  enunciado: string;
  contextNote: string;
  hint: string;
  focusTab: 'security' | 'entry' | 'share' | 'effective';
  requireNetworkCheck?: boolean;
  initialFolders: VirtualFolderNode[];
  principals: VirtualPrincipal[];
  checkSolution: (
    folders: VirtualFolderNode[],
    principals: VirtualPrincipal[]
  ) => ScenarioEvaluation;
}
