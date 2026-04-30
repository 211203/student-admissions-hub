export default function MeritListLoading() {
  return (
    <section className="space-y-6 rounded-2xl border border-gray-800 bg-gray-900 p-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-52 rounded bg-gray-800" />
        <div className="h-4 w-72 rounded bg-gray-800" />
      </div>

      <div className="h-11 w-full max-w-md rounded-xl bg-gray-800" />

      <div className="overflow-hidden rounded-xl border border-gray-800">
        <div className="h-12 bg-gray-800" />
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-10 rounded bg-gray-800/80" />
          ))}
        </div>
      </div>
    </section>
  )
}
