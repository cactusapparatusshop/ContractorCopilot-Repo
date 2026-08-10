"use client";

import { useState } from "react";

import { ProposalDocument, type ProposalDocumentData } from "@/components/proposal-document";
import { ProposalLayoutSelector } from "@/components/proposal-layout-selector";
import type { ProposalLayout } from "@/lib/proposal-layouts";

export function ProposalPreview({ proposalId, document, initialLayout }: { proposalId: string; document: ProposalDocumentData; initialLayout: ProposalLayout }) {
  const [layout, setLayout] = useState(initialLayout);
  return <div className="proposal-preview-stack"><ProposalLayoutSelector proposalId={proposalId} initialLayout={initialLayout} onLayoutChange={setLayout} /><ProposalDocument data={document} layout={layout} /></div>;
}
