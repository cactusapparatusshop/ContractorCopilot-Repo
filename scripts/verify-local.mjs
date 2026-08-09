/**
 * Lightweight smoke check for a running local ContractorCopilot instance.
 * Run with: node scripts/verify-local.mjs [base-url]
 */
const base = process.argv[2] ?? "http://127.0.0.1:3000";
const results = [];

async function request(path, options = {}) {
  const response = await fetch(base + path, { redirect: "manual", ...options });
  const contentType = response.headers.get("content-type") ?? "";
  const buffer = new Uint8Array(await response.arrayBuffer());
  const text = contentType.includes("application/pdf") ? "" : new TextDecoder().decode(buffer);
  return { response, contentType, buffer, text };
}

function record(check, status, pass, detail) {
  results.push({ check, status, pass, detail });
}

for (const path of ["/", "/sign-in", "/sign-up", "/dashboard", "/jobs/new", "/estimates", "/p/demo-proposal"]) {
  try {
    const { response, buffer } = await request(path);
    record(path, response.status, response.ok && buffer.byteLength > 1_000, `HTML ${buffer.byteLength} bytes`);
  } catch (error) {
    record(path, 0, false, error.message);
  }
}

const originHeaders = { "content-type": "application/json", origin: base };

try {
  const { response, text } = await request("/api/auth/sign-in", {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({ email: "demo@contractorcopilot.app", password: "preview-password" }),
  });
  const data = JSON.parse(text);
  record("Demo sign-in", response.status, response.ok && data.mode === "demo" && Boolean(response.headers.get("set-cookie")), data.mode ?? "No auth mode");
} catch (error) {
  record("Demo sign-in", 0, false, error.message);
}

try {
  const { response, text } = await request("/api/jobs", {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({ customerName: "Olivia Martinez", customerEmail: "olivia.martinez@email.com", jobType: "Cedar privacy fence", address: "1809 Bluebonnet Lane", notes: "120 linear feet with one gate." }),
  });
  const data = JSON.parse(text);
  record("Job creation", response.status, response.ok && Boolean(data.id) && data.demo === true, data.id ?? "No job id");
} catch (error) {
  record("Job creation", 0, false, error.message);
}

try {
  const { response, text } = await request("/api/ai/estimate", {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({
      title: "Cedar privacy fence",
      jobDescription: "Install 120 feet of cedar fence and one gate. Remove chain link.",
      measurements: "Fence length: 120 LF\nWalk gates: 1 EA",
    }),
  });
  const data = JSON.parse(text);
  record("AI estimate", response.status, response.ok && data.pricing?.lineItems?.length > 0 && data.draft?.scopeOfWork?.length > 10, `${data.pricing?.lineItems?.length ?? 0} priced lines`);
} catch (error) {
  record("AI estimate", 0, false, error.message);
}

try {
  const { response, text } = await request("/api/estimates/generate", {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({
      jobType: "Cedar privacy fence",
      notes: "Install 120 feet of cedar fence and one gate.",
      measurements: [{ label: "Fence length", quantity: "120", unit: "LF" }],
    }),
  });
  const data = JSON.parse(text);
  record("Wizard compatibility API", response.status, response.ok && data.lineItems?.length > 0, `${data.lineItems?.length ?? 0} UI lines`);
} catch (error) {
  record("Wizard compatibility API", 0, false, error.message);
}

try {
  const { response, text } = await request("/api/portal/demo-proposal");
  const data = JSON.parse(text);
  record("Public proposal API", response.status, response.ok && data.demo && data.totals?.totalCents > 0, `proposal total ${data.totals?.totalCents ?? 0} cents`);
} catch (error) {
  record("Public proposal API", 0, false, error.message);
}

try {
  const { response, text } = await request("/api/portal/demo-proposal/accept", {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({ signerName: "Olivia Martinez", signerEmail: "olivia.martinez@email.com", acceptedTerms: true }),
  });
  const data = JSON.parse(text);
  record("Proposal acceptance", response.status, response.ok && data.status === "ACCEPTED", data.status ?? "No status");
} catch (error) {
  record("Proposal acceptance", 0, false, error.message);
}

try {
  const { response, text } = await request("/api/portal/demo-proposal/deposit", {
    method: "POST",
    headers: originHeaders,
    body: "{}",
  });
  const data = JSON.parse(text);
  record("Deposit checkout", response.status, response.ok && Boolean(data.url) && data.demo === true, data.url ?? "No checkout URL");
} catch (error) {
  record("Deposit checkout", 0, false, error.message);
}

try {
  const { response, text } = await request("/api/billing/checkout", {
    method: "POST",
    headers: originHeaders,
    body: JSON.stringify({ plan: "scale" }),
  });
  const data = JSON.parse(text);
  record("Subscription checkout", response.status, response.ok && Boolean(data.url) && data.demo === true, data.url ?? "No checkout URL");
} catch (error) {
  record("Subscription checkout", 0, false, error.message);
}

try {
  const { response, text } = await request("/api/billing/portal", {
    method: "POST",
    headers: originHeaders,
    body: "{}",
  });
  const data = JSON.parse(text);
  record("Billing portal", response.status, response.ok && Boolean(data.url) && data.demo === true, data.url ?? "No portal URL");
} catch (error) {
  record("Billing portal", 0, false, error.message);
}

try {
  const { response, contentType, buffer } = await request("/api/proposals/est_1048/pdf");
  record("Proposal PDF", response.status, response.ok && contentType.includes("application/pdf") && buffer.byteLength > 1_000, `${contentType}; ${buffer.byteLength} bytes`);
} catch (error) {
  record("Proposal PDF", 0, false, error.message);
}

try {
  const { response, contentType, buffer } = await request("/api/portal/demo-proposal/pdf");
  record("Customer portal PDF", response.status, response.ok && contentType.includes("application/pdf") && buffer.byteLength > 1_000, `${contentType}; ${buffer.byteLength} bytes`);
} catch (error) {
  record("Customer portal PDF", 0, false, error.message);
}

try {
  const { response, text } = await request("/api/cron/expire-proposals");
  const data = JSON.parse(text);
  record("Proposal expiry cron", response.status, response.ok && data.demo === true, "demo acknowledgement");
} catch (error) {
  record("Proposal expiry cron", 0, false, error.message);
}

try {
  const { response, text } = await request("/api/stripe/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "test" }),
  });
  const data = JSON.parse(text);
  record("Stripe webhook preview", response.status, response.ok && data.received && data.demo, "demo acknowledgement");
} catch (error) {
  record("Stripe webhook preview", 0, false, error.message);
}

try {
  const { response, text } = await request("/api/ai/estimate", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://malicious.example" },
    body: JSON.stringify({ title: "Bad origin", jobDescription: "This must be rejected." }),
  });
  record("Cross-origin guard", response.status, response.status === 403 && text.includes("CROSS_SITE_REQUEST"), "malicious origin rejected");
} catch (error) {
  record("Cross-origin guard", 0, false, error.message);
}

console.table(results);
if (results.some((result) => !result.pass)) process.exit(1);
