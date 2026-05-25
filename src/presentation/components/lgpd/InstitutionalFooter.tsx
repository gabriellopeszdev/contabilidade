import Link from 'next/link';

export function InstitutionalFooter() {
  return (
    <footer className="border-t border-gray-100 dark:border-gray-800 bg-white/60 dark:bg-gray-900/80 backdrop-blur-sm px-4 py-3 shrink-0">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-gray-400 dark:text-gray-500">
        <span>© {new Date().getFullYear()} Gestão Contábil. Todos os direitos reservados.</span>
        <div className="flex items-center gap-3">
          <Link href="/privacidade" target="_blank" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            Política de Privacidade
          </Link>
          <span className="text-gray-200 dark:text-gray-700">|</span>
          <Link href="/termos" target="_blank" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            Termos de Uso
          </Link>
        </div>
      </div>
    </footer>
  );
}
