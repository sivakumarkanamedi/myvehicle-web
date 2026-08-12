import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/signup" className="text-sm font-bold text-blue-400 hover:text-blue-300">
          ← Back to Sign Up
        </Link>

        <section className="mt-5 rounded-3xl border border-white/10 bg-slate-900/70 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-400">
            My Vehicle
          </p>
          <h1 className="mt-2 text-3xl font-black">Terms of Use</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            These MVP terms explain the basic rules for using My Vehicle. They should be
            reviewed and finalized by qualified legal counsel before a commercial public launch.
          </p>

          <div className="mt-8 space-y-7 text-sm leading-7 text-slate-300">
            <section>
              <h2 className="text-lg font-black text-white">1. Using My Vehicle</h2>
              <p className="mt-2">
                Use the service lawfully and provide accurate account, vehicle and document
                information. You are responsible for protecting access to your account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">2. Vehicle information</h2>
              <p className="mt-2">
                My Vehicle helps organize vehicle information, reminders, documents and connected
                services. Information shown by the app should be verified when an official,
                legal, financial or safety decision depends on it.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">3. Mira AI</h2>
              <p className="mt-2">
                Mira AI can assist with vehicle-related tasks and information, but AI output may
                be incomplete or inaccurate. Important information should be confirmed through
                the appropriate official or professional source.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">4. Emergency features</h2>
              <p className="mt-2">
                SOS and location features are assistance tools and do not replace official
                emergency services. A notification or dispatch must not be assumed successful
                unless the app explicitly confirms the connected service completed it.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">5. Third-party services</h2>
              <p className="mt-2">
                Maps, workshops, insurers, payment providers, marketplaces and other partner
                services may have their own terms, availability and responsibilities.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black text-white">6. Changes</h2>
              <p className="mt-2">
                Features and these terms may change as the product develops. Material changes
                should be communicated before production use where required.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
