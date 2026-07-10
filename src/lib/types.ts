// ─── Company / Supplier ────────────────────────────────────────────────────
export interface Company {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  email?: string;
  createdAt: string;
  totalPurchased: number; // kg
  totalCost: number;      // PKR
}

// ─── Inventory / Stock ──────────────────────────────────────────────────────
export type SteelType = 'Rod' | 'Sheet' | 'Bar' | 'Angle' | 'Channel' | 'Pipe' | 'Coil' | 'Beam';
export type CementType = 'OPC' | 'SRC' | 'White Cement' | 'Block Cement' | 'Other';
export type ProductType = SteelType | CementType;
export type ProductCategory = 'Steel' | 'Cement';
export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export interface StockItem {
  id: string;
  category: ProductCategory;     // 'Steel' or 'Cement'
  steelType: ProductType;        // steel type, or cement type/brand
  grade?: string;
  weightKg: number;              // Steel: kg in stock · Cement: number of packs in stock
  quantity: number;
  unit: 'kg' | 'ton' | 'piece' | 'pack';
  pricePerKg: number;            // Steel: price per kg · Cement: price per pack
  companyId: string;
  companyName: string;
  batchNumber: string;
  dateAdded: string;
  location?: string;
  notes?: string;
  status: StockStatus;
}

// ─── Scrap ──────────────────────────────────────────────────────────────────
export interface ScrapItem {
  id: string;
  stockItemId: string;       // batch this scrap came from
  category: ProductCategory;
  steelType: ProductType;
  grade?: string;
  weightKg: number;          // Steel: kg scrapped · Cement: packs scrapped
  unit: string;
  pricePerKg: number;        // original purchase price (for value reference)
  companyName: string;
  batchNumber: string;
  date: string;              // YYYY-MM-DD
  notes?: string;
}

// ─── Customer ───────────────────────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  phone: string;     // primary key for search
  address: string;
  email?: string;
  city?: string;
  createdAt: string;
  totalPurchases: number;
  totalSpent: number;
  pendingBalance: number;
}

// ─── Extra / Misc Charge ────────────────────────────────────────────────────
export interface ExtraCharge {
  id: string;
  description: string;
  amount: number;
}

// ─── Invoice ────────────────────────────────────────────────────────────────
export interface InvoiceItem {
  id: string;
  stockItemId?: string;  // links to the inventory batch
  category: ProductCategory;  // 'Steel' or 'Cement'
  steelType: ProductType;
  description?: string;
  weightKg: number;      // Steel: kg sold · Cement: packs sold
  quantity: number;
  unit: string;
  pricePerKg: number;    // Steel: price per kg · Cement: price per pack
  costPerKg?: number;    // buy rate snapshot from the batch (for profit)
  totalPrice: number;
}

export type InvoiceStatus = 'Paid' | 'Pending' | 'Partial' | 'Cancelled';

export type InvoiceType = 'Steel' | 'Cement' | 'Both';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountType: 'percent' | 'flat';
  total: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
  extraCharges?: ExtraCharge[];
  notes?: string;
  vehicleNumber?: string;   // transport vehicle shown on the printed bill
  createdAt: string;
  dueDate?: string;
  // Worker B (sales agent / broker)
  workerBId?: string;
  workerBName?: string;
  workerBCharge?: number;
}

// ─── Worker B (Sales Agent / Broker) ────────────────────────────────────────
export interface WorkerB {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  totalEarnings: number;  // sum of all workerBCharge across their invoices
  totalPaid: number;      // how much has actually been paid out to this agent
  totalDeals: number;     // count of invoices they handled
}

// ─── Worker ─────────────────────────────────────────────────────────────────
export type WorkerRole = 'Loader' | 'Supervisor' | 'Driver' | 'Welder' | 'Guard' | 'Accountant' | 'Other';
export type SalaryType = 'Daily' | 'Weekly' | 'Monthly';

export interface Worker {
  id: string;
  name: string;
  phone: string;
  role: WorkerRole;
  salaryType: SalaryType;
  salaryRate: number;   // PKR per day/week/month
  joiningDate: string;
  address?: string;
  cnic?: string;
  isActive: boolean;
}

export interface AttendanceRecord {
  id: string;
  workerId: string;
  date: string;         // YYYY-MM-DD
  present: boolean;
  overtime?: number;    // hours
  notes?: string;
}

// ─── Dashboard Stats ────────────────────────────────────────────────────────
export interface DashboardStats {
  totalStockKg: number;
  totalStockValue: number;
  totalCompanies: number;
  totalCustomers: number;
  totalInvoices: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  totalProfit: number;
  pendingPayments: number;
  activeWorkers: number;
  lowStockItems: number;
}

// ─── App Context ─────────────────────────────────────────────────────────────
export interface AppState {
  companies: Company[];
  stockItems: StockItem[];
  scrapItems: ScrapItem[];
  customers: Customer[];
  invoices: Invoice[];
  workers: Worker[];
  workerBs: WorkerB[];
  attendance: AttendanceRecord[];
  darkMode: boolean;
  sidebarOpen: boolean;
}
