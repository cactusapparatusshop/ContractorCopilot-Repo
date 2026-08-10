import { Bug, Lightbulb } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { FeedbackForm } from "@/components/feedback-form";

export default function FeedbackPage() {
  return <>
    <PageHeader title="Feedback" subtitle="Help shape ContractorCopilot by reporting issues and sharing feature ideas." />
    <section className="feedback-page-grid">
      <article className="card form-card"><h2>Tell us what you need</h2><p>Every submission reaches the product team for review. Include enough context for us to understand the job you were trying to do.</p><FeedbackForm /></article>
      <aside className="feedback-guidance"><article className="card side-card"><span className="icon-box orange"><Bug /></span><h2>For a bug report</h2><p>Tell us what you expected, what actually happened, and what you clicked just before it occurred.</p></article><article className="card side-card"><span className="icon-box blue"><Lightbulb /></span><h2>For a feature request</h2><p>Describe the outcome you want—not just a button. That helps us design the right workflow.</p></article></aside>
    </section>
  </>;
}
