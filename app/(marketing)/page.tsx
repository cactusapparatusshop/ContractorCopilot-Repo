import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Sparkles, WalletCards } from "lucide-react";

export default function MarketingPage() {
  return (
    <main className="marketing-shell">
      <nav className="marketing-nav">
        <Link className="brand" href="/">
          <span className="brand-mark">C</span>
          ContractorCopilot
        </Link>
        <div className="marketing-links">
          <a href="#how-it-works">How it works</a>
          <Link href="/pricing">Pricing</Link>
          <a href="#features">Features</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link className="button button-ghost" href="/sign-in">Sign in</Link>
          <Link className="button button-primary" href="/sign-up">Start free</Link>
        </div>
      </nav>

      <section className="hero">
        <div>
          <div className="eyebrow">Built for specialty contractors</div>
          <h1>From jobsite notes to signed work—before lunch.</h1>
          <p>Capture photos, measurements, and a voice note. ContractorCopilot turns the details into a polished estimate your customer can approve and pay online.</p>
          <div className="hero-actions">
            <Link href="/sign-up" className="button button-primary button-lg">Create your first proposal <ArrowRight size={17} /></Link>
            <Link href="/pricing" className="button button-outline button-lg">See how it works</Link>
          </div>
          <div className="free-tier-promise"><CheckCircle2 size={16} /><span><b>Start with 3 free proposals or invoices.</b> Then it&apos;s $49.99/month for Pro.</span></div>
          <div className="proof">
            <div className="avatar-stack"><span /><span /><span /></div>
            Trusted by growing fencing, deck, HVAC & landscaping crews
          </div>
        </div>

        <div className="hero-preview" aria-label="ContractorCopilot dashboard preview">
          <div className="hero-halo" />
          <div className="preview-window">
            <div className="preview-top"><i /><i /><i /></div>
            <div className="preview-content">
              <aside className="preview-rail"><b style={{ width: "70%", background: "#f46e28" }} /><b /><b style={{ width: "63%" }} /><b style={{ width: "77%" }} /><b style={{ width: "54%" }} /></aside>
              <div className="preview-main">
                <div className="preview-title-row"><div><h3>Good morning, Marcus</h3><p>Here&apos;s what&apos;s happening with your business.</p></div><span className="preview-new">+ New proposal</span></div>
                <div className="preview-metrics">
                  <div className="preview-metric"><small>Pipeline value</small><strong>$48,240</strong></div>
                  <div className="preview-metric"><small>Win rate</small><strong>68.4%</strong></div>
                  <div className="preview-metric"><small>Deposits</small><strong>$9,860</strong></div>
                </div>
                <div className="preview-chart">
                  <b>Revenue overview</b>
                  <div className="chart-lines"><svg viewBox="0 0 360 100" preserveAspectRatio="none"><defs><linearGradient id="orangeFade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f46e28" stopOpacity=".23"/><stop offset="1" stopColor="#f46e28" stopOpacity="0"/></linearGradient></defs><path d="M0 76 C24 67 37 72 60 58 S98 65 121 45 S159 52 181 35 S216 38 240 25 S280 37 301 18 S335 28 360 5 L360 100 L0 100Z" fill="url(#orangeFade)"/><path d="M0 76 C24 67 37 72 60 58 S98 65 121 45 S159 52 181 35 S216 38 240 25 S280 37 301 18 S335 28 360 5" fill="none" stroke="#f46e28" strokeWidth="3"/></svg></div>
                </div>
              </div>
            </div>
          </div>
          <div className="floating-card"><span className="mini-label">EST-1047 · Deck repair</span><strong>$972.00</strong><span className="paid"><i /> Deposit paid today</span><small className="preview-usage">3 free documents included</small></div>
        </div>
      </section>

      <section className="marketing-logos">
        Join contractors who spend more time building—and less time building estimates.
        <div className="logo-row"><span>Northstar Fencing</span><span>EVERGREEN</span><span>Westlake Decks</span><span>ATX Outdoor</span><span>Iron &amp; Gate Co.</span></div>
      </section>

      <section id="features" className="feature-band">
        <div className="eyebrow" style={{ color: "#ffc193" }}>One calm workspace</div>
        <h2>Everything after the walkthrough, in one place.</h2>
        <div className="feature-grid">
          <article className="feature-card"><div className="icon-box"><Sparkles size={18} /></div><h3>AI that understands the job</h3><p>Turn photos, measurements, and spoken notes into a reviewable scope, material list, and itemized estimate.</p></article>
          <article className="feature-card"><div className="icon-box"><FileText size={18} /></div><h3>Quotes that look like your company</h3><p>Send branded proposals with clear line items, warranties, signature capture, and a secure customer portal.</p></article>
          <article className="feature-card"><div className="icon-box"><WalletCards size={18} /></div><h3>Deposits without the chase</h3><p>Let customers approve and pay their deposit online. Your pipeline updates automatically when money lands.</p></article>
        </div>
      </section>

      <footer className="marketing-footer"><span>© 2026 ContractorCopilot, Inc.</span><span style={{ display: "flex", gap: 16 }}><Link href="/pricing">Pricing</Link><Link href="/sign-in">Sign in</Link><span><CheckCircle2 size={12} style={{ verticalAlign: "-2px", color: "#17776d" }} /> Secure payments</span></span></footer>
    </main>
  );
}
