import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { DoublePermissionsGuide } from './components/DoublePermissionsGuide';
import { ExamPanel } from './components/ExamPanel';
import { ConsoleTab, NtfsConsole } from './components/NtfsConsole';
import { ScenarioSidebar } from './components/ScenarioSidebar';
import { AppView, TopBar } from './components/TopBar';
import {
  SANDBOX_INITIAL_FOLDERS,
  SANDBOX_PRINCIPALS,
} from './data/scenarios';
import { ALL_SCENARIOS, drawRandomExam } from './data/scenarioBank';
import {
  NtfsAce,
  NtfsScenario,
  ScenarioEvaluation,
  VirtualFolderNode,
  VirtualPrincipal,
} from './types/ntfs';
import { getAllAcesForFolder } from './utils/ntfsEngine';

const STORAGE_KEY_COMPLETED = 'ntfs_sim_completed_scenarios_v1';

function cloneFolders(folders: VirtualFolderNode[]): VirtualFolderNode[] {
  return JSON.parse(JSON.stringify(folders)) as VirtualFolderNode[];
}

interface ExamState {
  questions: NtfsScenario[];
  activeIndex: number;
  workspaces: VirtualFolderNode[][];
  selectedFolders: string[];
  tabs: ConsoleTab[];
  simPrincipals: string[];
  simModes: ('local' | 'network')[];
  editedFlags: boolean[];
  evaluations: (ScenarioEvaluation | null)[];
  isGraded: boolean;
  showReport: boolean;
}

function createFreshExam(): ExamState {
  const questions = drawRandomExam(ALL_SCENARIOS, 5);
  return {
    questions,
    activeIndex: 0,
    workspaces: questions.map((q) => cloneFolders(q.initialFolders)),
    selectedFolders: questions.map((q) => q.targetFolderId),
    tabs: questions.map((q) => q.focusTab),
    simPrincipals: questions.map((q) => q.targetPrincipalId),
    simModes: questions.map((q) => q.testAccessMode),
    editedFlags: questions.map(() => false),
    evaluations: questions.map(() => null),
    isGraded: false,
    showReport: false,
  };
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('exam');
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_COMPLETED);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  // Exam State (5 random questions)
  const [exam, setExam] = useState<ExamState>(() => createFreshExam());

  // Bank (320 scenarios) working state
  const [activeScenarioIndex, setActiveScenarioIndex] = useState(0);
  const activeBankScenario = ALL_SCENARIOS[activeScenarioIndex];
  const [scenarioFolders, setScenarioFolders] = useState<VirtualFolderNode[]>(() =>
    cloneFolders(activeBankScenario.initialFolders)
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    activeBankScenario.targetFolderId
  );
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>(activeBankScenario.focusTab);
  const [simPrincipalId, setSimPrincipalId] = useState<string>(
    activeBankScenario.targetPrincipalId
  );
  const [simAccessMode, setSimAccessMode] = useState<'local' | 'network'>(
    activeBankScenario.testAccessMode
  );
  const [evaluation, setEvaluation] = useState<ScenarioEvaluation | null>(null);

  // Sandbox working state
  const [sandboxFolders, setSandboxFolders] = useState<VirtualFolderNode[]>(() =>
    cloneFolders(SANDBOX_INITIAL_FOLDERS)
  );
  const [sandboxPrincipals, setSandboxPrincipals] = useState<VirtualPrincipal[]>(() => [
    ...SANDBOX_PRINCIPALS,
  ]);
  const [sandboxSelectedFolderId, setSandboxSelectedFolderId] = useState<string>('entrega_ex');
  const [sandboxTab, setSandboxTab] = useState<ConsoleTab>('security');
  const [sandboxSimPrincipalId, setSandboxSimPrincipalId] = useState<string>('alu_01');
  const [sandboxSimAccessMode, setSandboxSimAccessMode] = useState<'local' | 'network'>('network');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify(completedIds));
    } catch {
      // Ignore storage quota errors
    }
  }, [completedIds]);

  const loadBankScenario = (index: number) => {
    const sc = ALL_SCENARIOS[index];
    setActiveScenarioIndex(index);
    setScenarioFolders(cloneFolders(sc.initialFolders));
    setSelectedFolderId(sc.targetFolderId);
    setConsoleTab(sc.focusTab);
    setSimPrincipalId(sc.targetPrincipalId);
    setSimAccessMode(sc.testAccessMode);
    setEvaluation(null);
  };

  const resetCurrentBankScenario = () => {
    setScenarioFolders(cloneFolders(activeBankScenario.initialFolders));
    setSelectedFolderId(activeBankScenario.targetFolderId);
    setConsoleTab(activeBankScenario.focusTab);
    setEvaluation(null);
  };

  const resetSandbox = () => {
    setSandboxFolders(cloneFolders(SANDBOX_INITIAL_FOLDERS));
    setSandboxPrincipals([...SANDBOX_PRINCIPALS]);
    setSandboxSelectedFolderId('entrega_ex');
    setSandboxTab('security');
  };

  const handleCheckBankSolution = () => {
    const result = activeBankScenario.checkSolution(
      scenarioFolders,
      activeBankScenario.principals
    );
    setEvaluation(result);
    if (result.passed && !completedIds.includes(activeBankScenario.id)) {
      setCompletedIds((prev) => [...prev, activeBankScenario.id]);
    }
  };

  const handleGradeExam = () => {
    const nextEvaluations = exam.questions.map((q, idx) =>
      q.checkSolution(exam.workspaces[idx], q.principals)
    );
    const newlyPassed = exam.questions
      .filter((_, idx) => nextEvaluations[idx].passed)
      .map((q) => q.id);

    if (newlyPassed.length > 0) {
      setCompletedIds((prev) => Array.from(new Set([...prev, ...newlyPassed])));
    }

    setExam((prev) => ({
      ...prev,
      evaluations: nextEvaluations,
      isGraded: true,
      showReport: true,
    }));
  };

  const handleStartNewExam = () => {
    setExam(createFreshExam());
  };

  const handlePrimaryAction = () => {
    if (activeView === 'exam') {
      if (exam.isGraded) {
        handleStartNewExam();
      } else {
        handleGradeExam();
      }
    } else if (activeView === 'scenarios') {
      handleCheckBankSolution();
    } else if (activeView === 'sandbox') {
      resetSandbox();
    } else {
      setActiveView('exam');
    }
  };

  const primaryActionLabel =
    activeView === 'exam'
      ? exam.isGraded
        ? 'Nuevo examen (5)'
        : 'Calificar examen'
      : activeView === 'scenarios'
        ? 'Comprobar solución'
        : activeView === 'sandbox'
          ? 'Restablecer laboratorio'
          : 'Ir al examen';

  const isExam = activeView === 'exam';
  const isSandbox = activeView === 'sandbox';

  const currentScenario = isExam
    ? exam.questions[exam.activeIndex]
    : activeBankScenario;

  const currentFolders = isExam
    ? exam.workspaces[exam.activeIndex]
    : isSandbox
      ? sandboxFolders
      : scenarioFolders;

  const currentSelectedFolderId = isExam
    ? exam.selectedFolders[exam.activeIndex]
    : isSandbox
      ? sandboxSelectedFolderId
      : selectedFolderId;

  const currentTab = isExam
    ? exam.tabs[exam.activeIndex]
    : isSandbox
      ? sandboxTab
      : consoleTab;

  const currentSimPrincipalId = isExam
    ? exam.simPrincipals[exam.activeIndex]
    : isSandbox
      ? sandboxSimPrincipalId
      : simPrincipalId;

  const currentSimAccessMode = isExam
    ? exam.simModes[exam.activeIndex]
    : isSandbox
      ? sandboxSimAccessMode
      : simAccessMode;

  const currentPrincipals = isSandbox
    ? sandboxPrincipals
    : currentScenario.principals;

  const currentEvaluation = isExam
    ? exam.isGraded
      ? exam.evaluations[exam.activeIndex]
      : null
    : evaluation;

  const selectedFolder =
    currentFolders.find((f) => f.id === currentSelectedFolderId) ?? currentFolders[0];

  const updateCurrentFolders = (
    updater: (prev: VirtualFolderNode[]) => VirtualFolderNode[]
  ) => {
    if (isExam) {
      setExam((prev) => {
        const idx = prev.activeIndex;
        const nextWorkspaces = prev.workspaces.map((w, i) =>
          i === idx ? updater(w) : w
        );
        const nextFlags = prev.editedFlags.map((flag, i) =>
          i === idx ? true : flag
        );
        return {
          ...prev,
          workspaces: nextWorkspaces,
          editedFlags: nextFlags,
        };
      });
    } else if (isSandbox) {
      setSandboxFolders(updater);
    } else {
      setScenarioFolders(updater);
      setEvaluation(null);
    }
  };

  const handleSelectFolder = (folderId: string) => {
    if (isExam) {
      setExam((prev) => ({
        ...prev,
        selectedFolders: prev.selectedFolders.map((f, i) =>
          i === prev.activeIndex ? folderId : f
        ),
      }));
    } else if (isSandbox) {
      setSandboxSelectedFolderId(folderId);
    } else {
      setSelectedFolderId(folderId);
    }
  };

  const handleChangeTab = (tab: ConsoleTab) => {
    if (isExam) {
      setExam((prev) => ({
        ...prev,
        tabs: prev.tabs.map((t, i) => (i === prev.activeIndex ? tab : t)),
      }));
    } else if (isSandbox) {
      setSandboxTab(tab);
    } else {
      setConsoleTab(tab);
    }
  };

  const handleChangeSimPrincipal = (id: string) => {
    if (isExam) {
      setExam((prev) => ({
        ...prev,
        simPrincipals: prev.simPrincipals.map((p, i) =>
          i === prev.activeIndex ? id : p
        ),
      }));
    } else if (isSandbox) {
      setSandboxSimPrincipalId(id);
    } else {
      setSimPrincipalId(id);
    }
  };

  const handleChangeSimAccessMode = (mode: 'local' | 'network') => {
    if (isExam) {
      setExam((prev) => ({
        ...prev,
        simModes: prev.simModes.map((m, i) =>
          i === prev.activeIndex ? mode : m
        ),
      }));
    } else if (isSandbox) {
      setSandboxSimAccessMode(mode);
    } else {
      setSimAccessMode(mode);
    }
  };

  const handleUpdateFolder = (updated: VirtualFolderNode) => {
    updateCurrentFolders((prev) =>
      prev.map((f) => (f.id === updated.id ? updated : f))
    );
  };

  const handleDisableInheritance = (
    folderId: string,
    strategy: 'convert' | 'remove'
  ) => {
    updateCurrentFolders((prev) => {
      const allAces = getAllAcesForFolder(folderId, prev);
      return prev.map((f) => {
        if (f.id !== folderId) return f;
        if (strategy === 'remove') {
          return {
            ...f,
            inheritanceEnabled: false,
            aces: f.aces.filter((a) => !a.inheritedFrom),
          };
        }
        const converted: NtfsAce[] = allAces.map((a, idx) => ({
          ...a,
          id: a.inheritedFrom ? `conv-${folderId}-${idx}-${Date.now()}` : a.id,
          inheritedFrom: null,
        }));
        return {
          ...f,
          inheritanceEnabled: false,
          aces: converted,
        };
      });
    });
  };

  const handleEnableInheritance = (folderId: string) => {
    updateCurrentFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, inheritanceEnabled: true } : f))
    );
  };

  const handleAddSandboxFolder = (parentId: string, name: string) => {
    const parent = sandboxFolders.find((f) => f.id === parentId);
    if (!parent) return;
    const cleanName = name.replace(/[\\/:*?"<>|]/g, '');
    if (!cleanName) return;
    const newPath = parent.path.endsWith('\\')
      ? `${parent.path}${cleanName}`
      : `${parent.path}\\${cleanName}`;
    const newId = `sb-dir-${Date.now()}`;
    const newNode: VirtualFolderNode = {
      id: newId,
      name: cleanName,
      path: newPath,
      parentId: parent.id,
      owner: 'EQUIPO\\Administradores',
      inheritanceEnabled: true,
      aces: [],
      sampleFiles: ['documento.txt'],
      sampleSubfolders: [],
    };
    setSandboxFolders((prev) =>
      prev
        .map((f) =>
          f.id === parentId
            ? { ...f, sampleSubfolders: [...f.sampleSubfolders, cleanName] }
            : f
        )
        .concat(newNode)
    );
    setSandboxSelectedFolderId(newId);
  };

  const handleAddCustomPrincipal = (name: string, kind: 'user' | 'group'): string => {
    const id = `custom-${Date.now()}`;
    const newPrincipal: VirtualPrincipal = {
      id,
      name,
      displayName: `EQUIPO\\${name}`,
      kind,
      memberOf: kind === 'user' ? ['users', 'auth_users'] : undefined,
    };
    setSandboxPrincipals((prev) => [...prev, newPrincipal]);
    return id;
  };

  const handleResetExamQuestion = () => {
    setExam((prev) => {
      const idx = prev.activeIndex;
      const q = prev.questions[idx];
      return {
        ...prev,
        workspaces: prev.workspaces.map((w, i) =>
          i === idx ? cloneFolders(q.initialFolders) : w
        ),
        selectedFolders: prev.selectedFolders.map((f, i) =>
          i === idx ? q.targetFolderId : f
        ),
        tabs: prev.tabs.map((t, i) => (i === idx ? q.focusTab : t)),
        editedFlags: prev.editedFlags.map((fl, i) => (i === idx ? false : fl)),
      };
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        activeView={activeView}
        onChangeView={setActiveView}
        onPrimaryAction={handlePrimaryAction}
        primaryActionLabel={primaryActionLabel}
      />

      {activeView === 'guide' ? (
        <DoublePermissionsGuide />
      ) : (
        <main className="mx-auto max-w-[1440px] space-y-5 px-6 py-6">
          {isExam && (
            <ExamPanel
              questions={exam.questions}
              activeQuestionIndex={exam.activeIndex}
              editedFlags={exam.editedFlags}
              evaluations={exam.evaluations}
              isGraded={exam.isGraded}
              showReport={exam.showReport}
              onSelectQuestion={(idx) =>
                setExam((prev) => ({ ...prev, activeIndex: idx }))
              }
              onToggleReport={() =>
                setExam((prev) => ({ ...prev, showReport: !prev.showReport }))
              }
              onStartNewExam={handleStartNewExam}
              onGradeExam={handleGradeExam}
            />
          )}

          <div className="grid items-start gap-6 lg:grid-cols-12">
            {/* Left Zone: Enunciado, Tree, Action Console */}
            <div className="lg:col-span-5 xl:col-span-4">
              <ScenarioSidebar
                mode={isExam ? 'exam' : isSandbox ? 'sandbox' : 'scenarios'}
                scenarios={isExam ? exam.questions : ALL_SCENARIOS}
                activeScenarioIndex={isExam ? exam.activeIndex : activeScenarioIndex}
                completedIds={completedIds}
                onSelectScenario={
                  isExam
                    ? (idx) => setExam((prev) => ({ ...prev, activeIndex: idx }))
                    : loadBankScenario
                }
                examGraded={exam.isGraded}
                folders={currentFolders}
                selectedFolderId={currentSelectedFolderId}
                onSelectFolder={handleSelectFolder}
                principals={currentPrincipals}
                simPrincipalId={currentSimPrincipalId}
                onChangeSimPrincipal={handleChangeSimPrincipal}
                simAccessMode={currentSimAccessMode}
                onChangeSimAccessMode={handleChangeSimAccessMode}
                onAddSandboxFolder={isSandbox ? handleAddSandboxFolder : undefined}
              />
            </div>

            {/* Right Zone: Interactive NTFS & Share Properties Console */}
            <div className="space-y-5 lg:col-span-7 xl:col-span-8">
              {/* Toolbar above console */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
                <div className="text-xs text-slate-600">
                  {isSandbox ? (
                    <span>
                      Modo <strong className="font-semibold text-slate-900">Laboratorio libre</strong>: configura herencia, ámbitos y permisos especiales en cualquier carpeta.
                    </span>
                  ) : (
                    <span>
                      Carpeta objetivo:{' '}
                      <span className="font-mono font-semibold text-slate-900">
                        {
                          currentScenario.initialFolders.find(
                            (f) => f.id === currentScenario.targetFolderId
                          )?.path
                        }
                      </span>
                    </span>
                  )}
                </div>

                {!isSandbox && !(isExam && exam.isGraded) && (
                  <button
                    type="button"
                    onClick={isExam ? handleResetExamQuestion : resetCurrentBankScenario}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {isExam ? 'Reiniciar pregunta' : 'Reiniciar reto'}
                  </button>
                )}
              </div>

              {/* Evaluation Result Banner */}
              {!isSandbox && currentEvaluation && (
                <section
                  aria-live="polite"
                  className={`rounded-xl border p-5 ${
                    currentEvaluation.passed
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : 'border-rose-200 bg-rose-50/70'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {currentEvaluation.passed ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                      ) : (
                        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
                      )}
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {currentEvaluation.passed
                            ? 'Solución correcta'
                            : 'Revisa la configuración NTFS'}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-700">
                          {currentEvaluation.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isExam &&
                        currentEvaluation.passed &&
                        activeScenarioIndex < ALL_SCENARIOS.length - 1 && (
                          <button
                            type="button"
                            onClick={() => loadBankScenario(activeScenarioIndex + 1)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 whitespace-nowrap"
                          >
                            Siguiente reto
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      {!isExam && (
                        <button
                          type="button"
                          onClick={() => setEvaluation(null)}
                          aria-label="Cerrar evaluación"
                          className="rounded-md p-1 text-slate-500 hover:bg-white/60 hover:text-slate-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-slate-200/70 pt-3">
                    {currentEvaluation.issues.map((issue, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs">
                        {issue.severity === 'success' && (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                        )}
                        {issue.severity === 'warning' && (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        )}
                        {issue.severity === 'error' && (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
                        )}
                        <div>
                          <span className="font-semibold text-slate-900">{issue.title}: </span>
                          <span className="text-slate-700">{issue.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Interactive NTFS Properties Console */}
              {selectedFolder && (
                <NtfsConsole
                  mode={isSandbox ? 'sandbox' : 'scenarios'}
                  machineName={isSandbox ? 'EQUIPO' : currentScenario.machineName}
                  folder={selectedFolder}
                  allFolders={currentFolders}
                  principals={currentPrincipals}
                  activeTab={currentTab}
                  onChangeTab={handleChangeTab}
                  defaultPrincipalId={
                    isSandbox ? 'alu_01' : currentScenario.targetPrincipalId
                  }
                  onUpdateFolder={handleUpdateFolder}
                  onDisableInheritance={handleDisableInheritance}
                  onEnableInheritance={handleEnableInheritance}
                  onAddCustomPrincipal={
                    isSandbox ? handleAddCustomPrincipal : undefined
                  }
                />
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
