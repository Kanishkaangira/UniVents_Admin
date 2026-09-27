export default function StartupMessage({ title, children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-ink">
      <section className="max-w-lg">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="mt-3 text-mute">{children}</div>
      </section>
    </main>
  );
}