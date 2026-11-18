import React from 'react';

export type AppView = 'exam' | 'scenarios' | 'sandbox' | 'guide';

interface TopBarProps {
  activeView: AppView;
  onChangeView: (view: AppView) => void;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onChangeView,
  onPrimaryAction,
  primaryActionLabel,
}) => {
  const navItems: { id: AppView; label: string }[] = [
    { id: 'exam', label: 'Modo examen' },
    { id: 'scenarios', label: 'Banco de retos' },
    { id: 'sandbox', label: 'Laboratorio libre' },
    { id: 'guide', label: 'Guía de permisos' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-3.5">
        <button
          type="button"
          onClick={() => onChangeView('exam')}
          className="text-left text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0067C0]"
        >
          Simulador NTFS
        </button>

        <nav
          aria-label="Navegación principal"
          className="flex items-center gap-6 overflow-x-auto text-sm font-medium"
        >
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeView(item.id)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0067C0] ${
                  isActive
                    ? 'text-[#0067C0] font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-3.5 h-0.5 bg-[#0067C0]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="rounded-lg bg-[#0067C0] px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-[#005A9E] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0067C0]"
          >
            {primaryActionLabel}
          </button>
        </div>
      </div>
    </header>
  );
};
