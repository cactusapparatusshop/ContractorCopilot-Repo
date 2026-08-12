export const proposalLayouts = [
  {
    id: "CLEAN",
    name: "Clean & professional",
    shortName: "Clean",
    description: "A calm, concise proposal that keeps the focus on the scope and investment.",
  },
  {
    id: "DETAILED",
    name: "Detailed & itemized",
    shortName: "Detailed",
    description: "Adds clear pricing context and a more explicit breakdown for comparison-minded clients.",
  },
  {
    id: "PREMIUM",
    name: "Premium & visual",
    shortName: "Premium",
    description: "Uses an elevated presentation and strong investment summary for higher-value projects.",
  },
  { id: "EXECUTIVE", name: "Executive brief", shortName: "Executive", description: "A confident boardroom-style summary for decisive, high-value work." },
  { id: "BLUEPRINT", name: "Blueprint", shortName: "Blueprint", description: "A structured technical presentation for detailed scopes and commercial projects." },
  { id: "SIGNATURE", name: "Signature", shortName: "Signature", description: "A refined editorial layout with generous space for an elevated client experience." },
] as const;

export type ProposalLayout = (typeof proposalLayouts)[number]["id"];

export function isProposalLayout(value: unknown): value is ProposalLayout {
  return typeof value === "string" && proposalLayouts.some((layout) => layout.id === value);
}
