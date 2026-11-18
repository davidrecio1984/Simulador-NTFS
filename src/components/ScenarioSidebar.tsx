import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  HelpCircle,
  Lock,
  Monitor,
  Network,
  ShieldCheck,
  Shuffle,
  XCircle,
} from 'lucide-react';
import {
  NtfsScenario,
  ScenarioCategory,
  VirtualFolderNode,
  VirtualPrincipal,
} from '../types/ntfs';
import { findApplicableShareFolder, simulateUserActions } from '../utils/ntfsEngine';

interface ScenarioSidebarProps {
  mode: 'exam' | 'scenarios' | 'sandbox';
  scenarios: NtfsScenario[];
  activeScenarioIndex: number;
  completedIds: string[];
  onSelectScenario: (index: number) => void;
  examGraded?: boolean;
  folders: VirtualFolderNode[];
  selectedFolderId: string;
  onSelectFolder: (folderId: string) => void;
  principals: VirtualPrincipal[];
  simPrincipalId: string;
  onChangeSimPrincipal: (id: string) => void;
  simAccessMode: 'local' | 'network';
  onChangeSimAccessMode: (mode: 'local' | 'network') => void;
  onAddSandboxFolder?: (parentId: string, name: string) => void;
}

const CATEGORIES: ScenarioCategory[] = [
  'Buzón de entrega ciega',
  'Permisos dobles',
  'Herencia y aislamiento',
  'Carpetas sin historial',
  'Protección de carpeta raíz',
  'Entrega y consulta',
  'Intersección Red y NTFS',
  'Ejecución y Denegar',
];

export const ScenarioSidebar: React.FC<ScenarioSidebarProps> = ({
  mode,
  scenarios,
  activeScenarioIndex,
  completedIds,
  onSelectScenario,
  examGraded = false,
  folders,
  selectedFolderId,
  onSelectFolder,
  principals,
  simPrincipalId,
  onChangeSimPrincipal,
  simAccessMode,
  onChangeSimAccessMode,
  onAddSandboxFolder,
}) => {
  const [showHint, setShowHint] = useState(false);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  // Bank filtering
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');

  const filteredBank = useMemo(() => {
    return scenarios
      .map((sc, originalIndex) => ({ sc, originalIndex }))
      .filter(({ sc }) => {
        if (filterCategory !== 'all' && sc.category !== filterCategory) return false;
        if (filterDifficulty !== 'all' && sc.difficulty !== filterDifficulty) return false;
        return true;
      });
  }, [scenarios, filterCategory, filterDifficulty]);

  const scenario = scenarios[activeScenarioIndex];
  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? folders[0];
  const shareFolder = selectedFolder
    ? findApplicableShareFolder(selectedFolder.id, folders)
    : null;

  const actions = selectedFolder
    ? simulateUserActions(
        selectedFolder.id,
        simPrincipalId,
        simAccessMode,
        folders,
        principals
      )
    : [];

  const handlePickRandomFromBank = () => {
    const pool = filteredBank.length > 0 ? filteredBank : scenarios.map((sc, i) => ({ sc, originalIndex: i }));
    const randomItem = pool[Math.floor(Math.random() * pool.length)];
    setShowHint(false);
    onSelectScenario(randomItem.originalIndex);
  };

  const renderFolderTree = (parentId: string | null, depth = 0) => {
    const children = folders.filter((f) => f.parentId === parentId);
    return children.map((folder) => {
      const isSelected = folder.id === selectedFolderId;
      const isTarget = mode !== 'sandbox' && scenario?.targetFolderId === folder.id;
      const inheritedShare = !folder.share?.shared
        ? findApplicableShareFolder(folder.id, folders)
        : null;
      return (
        <div key={folder.id}>
          <button
            type="button"
            onClick={() => onSelectFolder(folder.id)}
            style={{ paddingLeft: `${depth * 16 + 10}px` }}
            className={`flex w-full items-center justify-between gap-2 rounded-md py-1.5 pr-2.5 text-left text-xs transition-colors ${
              isSelected
                ? 'bg-sky-50 font-semibold text-[#0067C0]'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              {isSelected ? (
                <FolderOpen className="h-4 w-4 shrink-0 text-[#0067C0]" />
              ) : (
                <Folder className="h-4 w-4 shrink-0 text-amber-500" />
              )}
              <span className="truncate font-mono text-[12px]">{folder.name}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">
              {folder.share?.shared ? (
                <span title={`Compartida directamente: ${folder.share.shareName}`}>
                  <Network
                    className="h-3.5 w-3.5 text-sky-600"
                    aria-label="Carpeta compartida en red"
                  />
                </span>
              ) : inheritedShare?.share ? (
                <span title={`Accesible en red vía ${inheritedShare.name} (${inheritedShare.share.shareName})`}>
                  <Network
                    className="h-3.5 w-3.5 text-sky-300"
                    aria-label="Accesible en red por carpeta padre compartida"
                  />
                </span>
              ) : null}
              {!folder.inheritanceEnabled && (
                <span title="Herencia NTFS deshabilitada">
                  <Lock
                    className="h-3 w-3 text-slate-400"
                    aria-label="Herencia deshabilitada"
                  />
                </span>
              )}
              {isTarget && (
                <span className="font-sans text-[11px] font-medium text-[#0067C0]">
                  Objetivo
                </span>
              )}
            </span>
          </button>
          {renderFolderTree(folder.id, depth + 1)}
        </div>
      );
    });
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddSandboxFolder || !newFolderName.trim() || !selectedFolder) return;
    onAddSandboxFolder(selectedFolder.id, newFolderName.trim());
    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  const canShowHint = mode === 'scenarios' || (mode === 'exam' && examGraded);

  return (
    <aside className="space-y-5">
      {mode !== 'sandbox' && scenario && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          {/* Header & Stepper */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
              {mode === 'exam' ? (
                <>
                  <span className="font-semibold text-slate-900">
                    Pregunta {activeScenarioIndex + 1} de {scenarios.length}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Reto #{scenario.number}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-slate-900">
                    Reto {scenario.number} de {scenarios.length}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{completedIds.length}/{scenarios.length} resueltos</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={mode === 'exam' ? 'Pregunta anterior' : 'Escenario anterior'}
                disabled={activeScenarioIndex === 0}
                onClick={() => {
                  setShowHint(false);
                  onSelectScenario(activeScenarioIndex - 1);
                }}
                className="rounded-md border border-slate-200 p-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={mode === 'exam' ? 'Siguiente pregunta' : 'Siguiente escenario'}
                disabled={activeScenarioIndex === scenarios.length - 1}
                onClick={() => {
                  setShowHint(false);
                  onSelectScenario(activeScenarioIndex + 1);
                }}
                className="rounded-md border border-slate-200 p-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Bank Filters & Selector (only in Bank mode) */}
          {mode === 'scenarios' && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Filtrar por categoría"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#0067C0] focus:outline-none"
                >
                  <option value="all">Todas las categorías</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrar por dificultad"
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#0067C0] focus:outline-none"
                >
                  <option value="all">Toda dificultad</option>
                  <option value="Básico">Básico</option>
                  <option value="Intermedio">Intermedio</option>
                  <option value="Avanzado">Avanzado</option>
                </select>
              </div>

              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <select
                    id="scenario-select"
                    aria-label="Seleccionar reto del banco"
                    value={
                      filteredBank.some((item) => item.originalIndex === activeScenarioIndex)
                        ? activeScenarioIndex
                        : ''
                    }
                    onChange={(e) => {
                      if (e.target.value === '') return;
                      setShowHint(false);
                      onSelectScenario(Number(e.target.value));
                    }}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-[#0067C0] focus:outline-none"
                  >
                    {!filteredBank.some((item) => item.originalIndex === activeScenarioIndex) && (
                      <option value="">
                        {filteredBank.length} retos filtrados (elige uno)
                      </option>
                    )}
                    {filteredBank.map(({ sc, originalIndex }) => {
                      const done = completedIds.includes(sc.id);
                      return (
                        <option key={sc.id} value={originalIndex}>
                          {done ? '✓ ' : ''}
                          {sc.number}. {sc.title}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-2.5 right-2.5 h-3.5 w-3.5 text-slate-500" />
                </div>

                <button
                  type="button"
                  onClick={handlePickRandomFromBank}
                  title="Cargar un reto aleatorio del filtro actual"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Shuffle className="h-3.5 w-3.5 text-[#0067C0]" />
                  Aleatorio
                </button>
              </div>
              <p className="text-[11px] text-slate-500 tabular-nums">
                Mostrando {filteredBank.length} de {scenarios.length} escenarios disponibles
              </p>
            </div>
          )}

          {/* Scenario Metadata & Enunciado */}
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{scenario.category}</span>
              <span aria-hidden="true">·</span>
              <span>{scenario.difficulty}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[11px]">{scenario.machineName}</span>
            </div>
            <h2 className="mt-1.5 text-base font-semibold leading-snug text-slate-900">
              {scenario.title}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-700">
              {scenario.enunciado}
            </p>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
              {scenario.contextNote}
            </p>

            {canShowHint && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowHint((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0067C0] hover:underline"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  {showHint ? 'Ocultar pista' : 'Ver pista'}
                </button>
                {mode === 'scenarios' && completedIds.includes(scenario.id) && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Completado
                  </span>
                )}
              </div>
            )}

            {canShowHint && showHint && (
              <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/70 p-3 text-xs leading-relaxed text-slate-700">
                {scenario.hint}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Virtual Directory Explorer */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Árbol de carpetas del equipo
            </h3>
            <p className="text-xs text-slate-500">
              Selecciona una carpeta para editar sus permisos
            </p>
          </div>
          {mode === 'sandbox' && onAddSandboxFolder && (
            <button
              type="button"
              onClick={() => setShowNewFolderInput((v) => !v)}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              + Subcarpeta
            </button>
          )}
        </div>

        {showNewFolderInput && mode === 'sandbox' && (
          <form onSubmit={handleCreateFolder} className="mt-3 flex gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={`Nueva en ${selectedFolder?.name}...`}
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-[#0067C0] focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md bg-[#0067C0] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#005A9E]"
            >
              Crear
            </button>
          </form>
        )}

        <div className="mt-3 space-y-0.5">{renderFolderTree(null, 0)}</div>

        {selectedFolder &&
          (selectedFolder.sampleFiles.length > 0 ||
            selectedFolder.sampleSubfolders.length > 0) && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-semibold text-slate-500">
                Contenido simulado en {selectedFolder.path}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
                {selectedFolder.sampleSubfolders.map((sub) => (
                  <span key={sub} className="inline-flex items-center gap-1 font-mono text-[11px]">
                    <Folder className="h-3.5 w-3.5 text-amber-500" />
                    {sub}
                  </span>
                ))}
                {selectedFolder.sampleFiles.map((file) => (
                  <span key={file} className="inline-flex items-center gap-1 font-mono text-[11px]">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    {file}
                  </span>
                ))}
              </div>
            </div>
          )}
      </section>

      {/* Interactive Action Test Console */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0067C0]" />
            <h3 className="text-sm font-semibold text-slate-900">
              Consola de prueba de acciones
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Comprueba qué operaciones puede hacer un usuario en{' '}
            <span className="font-mono text-slate-700">{selectedFolder?.path}</span>
          </p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="sim-principal" className="block text-[11px] font-medium text-slate-600">
              Simular como usuario / grupo
            </label>
            <select
              id="sim-principal"
              value={simPrincipalId}
              onChange={(e) => onChangeSimPrincipal(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-[#0067C0] focus:outline-none"
            >
              {principals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.description ? `(${p.description})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-[11px] font-medium text-slate-600">
              Vía de acceso
            </span>
            <div className="mt-1 flex rounded-md bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => onChangeSimAccessMode('local')}
                className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  simAccessMode === 'local'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Monitor className="h-3 w-3" />
                Local
              </button>
              <button
                type="button"
                onClick={() => onChangeSimAccessMode('network')}
                className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  simAccessMode === 'network'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Network className="h-3 w-3" />
                En red
              </button>
            </div>
          </div>
        </div>

        {simAccessMode === 'network' && (
          <div className="mt-2.5 rounded-md bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600">
            {shareFolder?.share ? (
              <span>
                Ruta UNC: \\{mode !== 'sandbox' && scenario ? scenario.machineName : 'EQUIPO'}\
                {shareFolder.share.shareName}
                {shareFolder.share.shareName.endsWith('$') ? ' (oculta)' : ''}
              </span>
            ) : (
              <span className="text-amber-700">
                Carpeta no compartida en red (sin acceso por red)
              </span>
            )}
          </div>
        )}

        <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          {actions.map((act) => {
            const isExpanded = expandedActionId === act.actionId;
            return (
              <div key={act.actionId} className="py-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedActionId(isExpanded ? null : act.actionId)
                  }
                  className="flex w-full items-center justify-between gap-2 rounded py-1 text-left text-xs hover:bg-slate-50"
                >
                  <span className="text-slate-700">{act.label}</span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 font-medium ${
                      act.allowed ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {act.allowed ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Permitido
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5" />
                        Denegado
                      </>
                    )}
                  </span>
                </button>
                {isExpanded && (
                  <div className="mt-1 mb-1 rounded-md bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-600">
                    <p>{act.reason}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-500">
                      Regla evaluada: {act.relevantRule}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
};
