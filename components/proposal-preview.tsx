"use client";

import { useState } from "react";

import { ProposalDocument, type ProposalDocumentData } from "@/components/proposal-document";
import { ProposalLayoutSelector } from "@/components/proposal-layout-selector";
import type { ProposalLayout } from "@/lib/proposal-layouts";

export function ProposalPreview({ proposalId, document, initialLayout, initialCustomerCompanyName, initialCustomerLogoDataUrl, initialShowCustomerLogo }: { proposalId: string; document: ProposalDocumentData; initialLayout: ProposalLayout; initialCustomerCompanyName?: string | null; initialCustomerLogoDataUrl?: string | null; initialShowCustomerLogo?: boolean }) {
  const [layout, setLayout] = useState(initialLayout);
  const [brand, setBrand] = useState({ customerCompanyName: initialCustomerCompanyName, customerLogoDataUrl: initialCustomerLogoDataUrl, showCustomerLogo: initialShowCustomerLogo ?? false });
  return <div className="proposal-preview-stack"><ProposalLayoutSelector proposalId={proposalId} initialLayout={initialLayout} initialCustomerCompanyName={initialCustomerCompanyName} initialCustomerLogoDataUrl={initialCustomerLogoDataUrl} initialShowCustomerLogo={initialShowCustomerLogo} onLayoutChange={setLayout} onCustomerBrandChange={(next) => setBrand((current) => ({ ...current, ...next }))} /><ProposalDocument data={{ ...document, ...brand }} layout={layout} /></div>;
}
