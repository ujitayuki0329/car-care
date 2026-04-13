import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white shadow-sm">
              C
            </div>
            <span className="text-base font-bold text-slate-900">Car Care 整備</span>
          </div>
          <Link
            href="/admin/login"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            スタッフログイン
          </Link>
        </div>
      </header>

      <main>
        <section className="border-b border-slate-100 bg-[#f7f8fb] px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-6xl lg:flex lg:items-center lg:gap-16">
            <div className="max-w-xl flex-1">
              <p className="text-sm font-semibold text-slate-900">オンライン予約</p>
              <h1 className="mt-3 text-4xl font-bold leading-[1.15] tracking-tight text-slate-900 lg:text-5xl">
                整備の空き状況を
                <br />
                その場で確認。
              </h1>
              <p className="mt-6 text-base leading-relaxed text-slate-600">
                日付・時間を選び、お客様情報を入力して予約が完了します。店舗の受付枠と連動しています。
              </p>
              <Link
                href="/reserve"
                className="mt-8 inline-flex rounded-full bg-brand-700 px-8 py-4 text-sm font-semibold text-white shadow-md shadow-brand-900/20 transition hover:bg-brand-800"
              >
                予約を始める
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-5 py-8 text-center text-xs text-slate-500 lg:px-8">Car Care · 自動車整備予約</footer>
    </div>
  );
}
