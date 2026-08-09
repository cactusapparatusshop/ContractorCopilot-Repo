export type EstimateStatus = "Draft" | "Sent" | "Viewed" | "Accepted" | "Expired";

export const company = {
  name: "Northstar Fencing Co.",
  owner: "Marcus Lee",
  email: "marcus@northstarfencing.com",
  phone: "(512) 555-0194",
  address: "4012 South Lamar Blvd, Austin, TX 78704",
};

export const dashboardMetrics = [
  { label: "Pipeline value", value: "$48,240", delta: "+12.5% vs. last month", icon: "briefcase", tone: "orange" },
  { label: "Win rate", value: "68.4%", delta: "+5.2% vs. last month", icon: "target", tone: "blue" },
  { label: "Pending deposits", value: "$9,860", delta: "4 proposals awaiting payment", icon: "wallet", tone: "purple" },
  { label: "Revenue this month", value: "$28,670", delta: "+18.1% vs. last month", icon: "trending", tone: "teal" },
] as const;

export const recentEstimates = [
  { id: "EST-1048", customer: "Olivia Martinez", initials: "OM", job: "Cedar privacy fence", total: "$6,381.00", status: "Viewed" as EstimateStatus, sent: "Today, 9:42 AM" },
  { id: "EST-1047", customer: "Ethan Brooks", initials: "EB", job: "Deck repair & stain", total: "$3,240.00", status: "Accepted" as EstimateStatus, sent: "Yesterday" },
  { id: "EST-1046", customer: "Sofia Patel", initials: "SP", job: "Front yard fence", total: "$8,950.00", status: "Sent" as EstimateStatus, sent: "Jul 28" },
  { id: "EST-1045", customer: "Henry Wilson", initials: "HW", job: "Gate replacement", total: "$1,680.00", status: "Draft" as EstimateStatus, sent: "Jul 28" },
  { id: "EST-1044", customer: "Ava Thompson", initials: "AT", job: "Pool safety fence", total: "$4,715.00", status: "Expired" as EstimateStatus, sent: "Jul 20" },
];

export const activities = [
  { type: "view", title: "Olivia viewed EST-1048", body: "Cedar privacy fence · $6,381", time: "7 min ago" },
  { type: "deposit", title: "Deposit received from Ethan", body: "$972.00 paid for deck repair", time: "1 hr ago" },
  { type: "ai", title: "AI draft is ready to review", body: "Front yard fence · Sofia Patel", time: "2 hrs ago" },
  { type: "sent", title: "Proposal sent to Mia Carter", body: "Commercial privacy screen", time: "Yesterday" },
];

export const followUps = [
  { day: "31", month: "JUL", name: "Olivia Martinez", note: "Follow up on cedar fence quote" },
  { day: "01", month: "AUG", name: "Sofia Patel", note: "Check in after site visit" },
  { day: "02", month: "AUG", name: "Mia Carter", note: "Proposal expires in 3 days" },
];

export const customers = [
  { id: "cus_olivia", name: "Olivia Martinez", initials: "OM", email: "olivia.martinez@email.com", phone: "(512) 555-0127", address: "1809 Bluebonnet Lane, Austin, TX", jobs: 2, lifetime: "$9,841", status: "Active" },
  { id: "cus_ethan", name: "Ethan Brooks", initials: "EB", email: "ethan.brooks@email.com", phone: "(512) 555-0172", address: "2217 Barton Hills Dr, Austin, TX", jobs: 1, lifetime: "$3,240", status: "Active" },
  { id: "cus_sofia", name: "Sofia Patel", initials: "SP", email: "sofia.patel@email.com", phone: "(737) 555-0191", address: "405 Pease Road, Austin, TX", jobs: 3, lifetime: "$13,990", status: "Prospect" },
  { id: "cus_henry", name: "Henry Wilson", initials: "HW", email: "henry.wilson@email.com", phone: "(512) 555-0145", address: "1507 Woodmont Ave, Austin, TX", jobs: 1, lifetime: "$1,680", status: "Active" },
  { id: "cus_mia", name: "Mia Carter", initials: "MC", email: "mia.carter@email.com", phone: "(512) 555-0102", address: "7900 Southwest Pkwy, Austin, TX", jobs: 2, lifetime: "$7,090", status: "Lead" },
];

export const proposal = {
  number: "EST-1048",
  title: "Cedar privacy fence installation",
  customer: {
    name: "Olivia Martinez",
    email: "olivia.martinez@email.com",
    address: "1809 Bluebonnet Lane\nAustin, TX 78704",
  },
  jobAddress: "1809 Bluebonnet Lane, Austin, TX 78704",
  createdAt: "July 31, 2026",
  validUntil: "August 14, 2026",
  depositPercent: 30,
  deposit: 1914.3,
  subtotal: 5795.73,
  tax: 585.27,
  total: 6381,
  scope: "Remove and dispose of the existing chain-link fence, then install 120 linear feet of 6′ western red cedar privacy fencing with one 4′ walk gate. Work includes concrete-set posts, exterior-rated fasteners, site cleanup, and a final walkthrough.",
  lines: [
    { item: "Remove existing chain-link fence", quantity: "120 LF", amount: 720 },
    { item: "6′ cedar privacy fence", quantity: "120 LF", amount: 3900 },
    { item: "4′ cedar walk gate", quantity: "1 EA", amount: 680 },
    { item: "Post concrete, hardware & cleanup", quantity: "1 LOT", amount: 495.73 },
  ],
};

export const aiDraft = {
  confidence: 93,
  scope: "Install a six-foot western red cedar privacy fence along the rear property line. Include removal of existing chain link, one walk gate, concrete-set posts, and jobsite cleanup.",
  assumptions: ["Ground is mostly level", "Access is available through side gate", "No permit is required"],
  lineItems: [
    { description: "Fence removal & disposal", category: "Labor", quantity: 120, unit: "LF", amount: 720 },
    { description: "6′ cedar privacy fence", category: "Materials + labor", quantity: 120, unit: "LF", amount: 3900 },
    { description: "4′ cedar walk gate", category: "Materials + labor", quantity: 1, unit: "EA", amount: 680 },
    { description: "Concrete, hardware & cleanup", category: "Materials", quantity: 1, unit: "LOT", amount: 495.73 },
  ],
};

export const navItems = [
  { label: "Overview", href: "/dashboard", icon: "layout" },
  { label: "Jobs", href: "/jobs", icon: "hardhat" },
  { label: "Proposals", href: "/estimates/est_1048", icon: "file" },
  { label: "Customers", href: "/customers", icon: "users" },
  { label: "Payments", href: "/billing", icon: "credit" },
] as const;

export const adminCompanies = [
  { name: "Northstar Fencing Co.", owner: "Marcus Lee", plan: "Pro", status: "Active", mrr: "$49.99", jobs: 86, joined: "Apr 24, 2026" },
  { name: "Evergreen Outdoor Living", owner: "Kelsey Wood", plan: "Pro", status: "Active", mrr: "$49.99", jobs: 62, joined: "May 12, 2026" },
  { name: "Austin Gate & Deck", owner: "Rafael Gomez", plan: "Free", status: "Trial", mrr: "$0", jobs: 14, joined: "Jul 28, 2026" },
  { name: "Hill Country Ironworks", owner: "Nina Price", plan: "Pro", status: "Active", mrr: "$49.99", jobs: 41, joined: "Jun 02, 2026" },
];
