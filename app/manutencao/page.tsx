export default function ManutencaoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 max-w-md px-6">
        <div className="text-8xl">🔧</div>
        <h1 className="text-3xl font-bold text-gray-900">Em Manutenção</h1>
        <p className="text-gray-500 text-lg">
          Estamos atualizando o sistema para melhorar sua experiência. Voltaremos em breve!
        </p>
        <p className="text-gray-400 text-sm">Se você é administrador, faça login normalmente.</p>
      </div>
    </div>
  );
}
