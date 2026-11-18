import React from 'react';
import {
  Award,
  CheckCircle2,
  Eye,
  RotateCcw,
  Shuffle,
  XCircle,
} from 'lucide-react';
import { NtfsScenario, ScenarioEvaluation } from '../types/ntfs';

interface ExamPanelProps {
  questions: NtfsScenario[];
  activeQuestionIndex: number;
  editedFlags: boolean[];
  evaluations: (ScenarioEvaluation | null)[];
  isGraded: boolean;
  showReport: boolean;
  onSelectQuestion: (index: number) => void;
  onToggleReport: () => void;
  onStartNewExam: () => void;
  onGradeExam: () => void;
}

function getQualitativeGrade(scoreOutOf10: number): {
  label: string;
  passed: boolean;
} {
  if (scoreOutOf10 >= 9) return { label: 'Sobresaliente', passed: true };
  if (scoreOutOf10 >= 7) return { label: 'Notable', passed: true };
  if (scoreOutOf10 >= 6) return { label: 'Bien', passed: true };
  if (scoreOutOf10 >= 5) return { label: 'Suficiente', passed: true };
  return { label: 'Insuficiente', passed: false };
}

export const ExamPanel: React.FC<ExamPanelProps> = ({
  questions,
  activeQuestionIndex,
  editedFlags,
  evaluations,
  isGraded,
  showReport,
  onSelectQuestion,
  onToggleReport,
  onStartNewExam,
  onGradeExam,
}) => {
  const total = questions.length;
  const editedCount = editedFlags.filter(Boolean).length;
  const passedCount = evaluations.filter((e) => e?.passed).length;
  const pointsPerQuestion = 10 / total;
  const gradeOutOf10 = passedCount * pointsPerQuestion;
  const pct = Math.round((passedCount / total) * 100);
  const qual = getQualitativeGrade(gradeOutOf10);

  return (
    <div className="space-y-4">
      {/* Horizontal 5-question exam navigation bar */}
      <section className="rounded-xl border border-slate-200 bg-white px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular-nums">
            <span className="font-semibold text-slate-900">
              Examen aleatorio ({total} escenarios)
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {isGraded
                ? `Calificación: ${gradeOutOf10.toFixed(1).replace('.', ',')} / 10 (${qual.label})`
                : `Configuradas: ${editedCount}/${total}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {questions.map((q, idx) => {
              const isCurrent = idx === activeQuestionIndex;
              const ev = evaluations[idx];
              const isEdited = editedFlags[idx];

              let btnClass =
                'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
              if (isGraded && ev) {
                btnClass = ev.passed
                  ? isCurrent
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : isCurrent
                    ? 'border-rose-700 bg-rose-700 text-white'
                    : 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100';
              } else if (isCurrent) {
                btnClass = 'border-[#0067C0] bg-[#0067C0] text-white';
              } else if (isEdited) {
                btnClass = 'border-sky-300 bg-sky-50 text-[#0067C0]';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onSelectQuestion(idx)}
                  aria-label={`Pregunta ${idx + 1}${isEdited ? ' (configurada)' : ''}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition-colors ${btnClass}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {isGraded ? (
              <button
                type="button"
                onClick={onToggleReport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Eye className="h-3.5 w-3.5" />
                {showReport ? 'Ocultar acta' : 'Ver acta de notas'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onGradeExam}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#0067C0] bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#0067C0] hover:bg-sky-100 whitespace-nowrap"
              >
                Finalizar y calificar
              </button>
            )}
            <button
              type="button"
              onClick={onStartNewExam}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Nuevo examen
            </button>
          </div>
        </div>
      </section>

      {/* Final Graded Exam Summary Report */}
      {isGraded && showReport && (
        <section
          aria-live="polite"
          className="rounded-xl border border-slate-200 bg-white p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-200 pb-5">
            <div className="flex items-start gap-3.5">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  qual.passed
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                <Award className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Calificación final del examen ({total} escenarios aleatorios)
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-3">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {gradeOutOf10.toFixed(2).replace('.', ',')} / 10
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      qual.passed ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {qual.label} · {pct}% de aciertos ({passedCount}/{total})
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onStartNewExam}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0067C0] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#005A9E] whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Generar otro examen (5 nuevas)
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-3 font-semibold">#</th>
                  <th className="px-3 py-2.5 font-semibold">Escenario</th>
                  <th className="px-3 py-2.5 font-semibold">Concepto</th>
                  <th className="px-3 py-2.5 font-semibold">Resultado</th>
                  <th className="py-2.5 pl-3 text-right font-semibold">Revisión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {questions.map((q, idx) => {
                  const ev = evaluations[idx];
                  const passed = Boolean(ev?.passed);
                  return (
                    <tr
                      key={q.id}
                      className={
                        idx === activeQuestionIndex ? 'bg-sky-50/50' : 'hover:bg-slate-50/70'
                      }
                    >
                      <td className="py-2.5 pr-3 font-semibold text-slate-700 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {q.title}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{q.category}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {passed ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Correcto ({pointsPerQuestion.toFixed(1).replace('.', ',')} pts)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                            <XCircle className="h-3.5 w-3.5" />
                            Incorrecto (0,0 pts)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectQuestion(idx)}
                          className="font-medium text-[#0067C0] hover:underline whitespace-nowrap"
                        >
                          Revisar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
