import type {
  Company, StockItem, Customer, Invoice, InvoiceItem, Worker, AttendanceRecord,
} from './types';

// ─── Companies ────────────────────────────────────────────────────────────────
export const mockCompanies: Company[] = [
  {
    id: 'c1', name: 'Ittefaq Steel Mills', contactPerson: 'Ahmed Raza',
    phone: '0321-4455667', address: 'Kot Lakhpat, Lahore',
    email: 'info@ittefaqsteel.com', createdAt: '2024-01-15',
    totalPurchased: 85000, totalCost: 21250000,
  },
  {
    id: 'c2', name: 'Amreli Steels Ltd.', contactPerson: 'Bilal Khan',
    phone: '0300-2233445', address: 'Bin Qasim, Karachi',
    email: 'sales@amreli.com', createdAt: '2024-02-10',
    totalPurchased: 62000, totalCost: 16120000,
  },
  {
    id: 'c3', name: 'Pakistan Steel Re-Rolling', contactPerson: 'Tariq Mehmood',
    phone: '0333-5544332', address: 'Sheikhupura Industrial Estate',
    createdAt: '2024-03-05', totalPurchased: 48000, totalCost: 11520000,
  },
  {
    id: 'c4', name: 'GHP Steel', contactPerson: 'Usman Ghani',
    phone: '0311-7788990', address: 'SITE Area, Hyderabad',
    email: 'ghpsteel@gmail.com', createdAt: '2024-04-18',
    totalPurchased: 31000, totalCost: 8060000,
  },
  {
    id: 'c5', name: 'Frontier Steel', contactPerson: 'Imran Afridi',
    phone: '0345-9988776', address: 'Hayatabad, Peshawar',
    createdAt: '2024-05-22', totalPurchased: 19500, totalCost: 5070000,
  },
];

// ─── Stock Items ──────────────────────────────────────────────────────────────
export const mockStockItems: StockItem[] = [
  {
    id: 's1', category: 'Steel', steelType:'Rod', grade: 'Grade 60', weightKg: 12000,
    quantity: 600, unit: 'piece', pricePerKg: 260,
    companyId: 'c1', companyName: 'Ittefaq Steel Mills',
    batchNumber: 'ITF-2024-001', dateAdded: '2024-11-01',
    location: 'Bay A', status: 'In Stock',
  },
  {
    id: 's2', category: 'Steel', steelType:'Sheet', grade: 'MS Plain', weightKg: 8500,
    quantity: 170, unit: 'piece', pricePerKg: 275,
    companyId: 'c1', companyName: 'Ittefaq Steel Mills',
    batchNumber: 'ITF-2024-002', dateAdded: '2024-11-15',
    location: 'Bay B', status: 'In Stock',
  },
  {
    id: 's3', category: 'Steel', steelType:'Bar', grade: 'Mild Steel', weightKg: 6200,
    quantity: 400, unit: 'piece', pricePerKg: 255,
    companyId: 'c2', companyName: 'Amreli Steels Ltd.',
    batchNumber: 'AMR-2024-011', dateAdded: '2024-11-20',
    location: 'Bay C', status: 'In Stock',
  },
  {
    id: 's4', category: 'Steel', steelType:'Angle', grade: '75x75x6mm', weightKg: 1800,
    quantity: 120, unit: 'piece', pricePerKg: 268,
    companyId: 'c3', companyName: 'Pakistan Steel Re-Rolling',
    batchNumber: 'PSR-2024-007', dateAdded: '2024-12-01',
    location: 'Bay A', status: 'Low Stock',
    notes: 'Reorder required',
  },
  {
    id: 's5', category: 'Steel', steelType:'Pipe', grade: 'ERW', weightKg: 3400,
    quantity: 200, unit: 'piece', pricePerKg: 285,
    companyId: 'c2', companyName: 'Amreli Steels Ltd.',
    batchNumber: 'AMR-2024-012', dateAdded: '2024-12-05',
    location: 'Bay D', status: 'In Stock',
  },
  {
    id: 's6', category: 'Steel', steelType:'Channel', grade: 'C-75', weightKg: 950,
    quantity: 60, unit: 'piece', pricePerKg: 272,
    companyId: 'c4', companyName: 'GHP Steel',
    batchNumber: 'GHP-2024-003', dateAdded: '2024-12-08',
    location: 'Bay B', status: 'Low Stock',
  },
  {
    id: 's7', category: 'Steel', steelType:'Coil', grade: 'HR Coil', weightKg: 15000,
    quantity: 15, unit: 'piece', pricePerKg: 270,
    companyId: 'c1', companyName: 'Ittefaq Steel Mills',
    batchNumber: 'ITF-2024-003', dateAdded: '2024-12-10',
    location: 'Bay E', status: 'In Stock',
  },
  {
    id: 's8', category: 'Steel', steelType:'Beam', grade: 'I-Beam 150', weightKg: 0,
    quantity: 0, unit: 'piece', pricePerKg: 295,
    companyId: 'c5', companyName: 'Frontier Steel',
    batchNumber: 'FRS-2024-001', dateAdded: '2024-11-28',
    location: 'Bay F', status: 'Out of Stock',
  },
];

// ─── Customers ────────────────────────────────────────────────────────────────
export const mockCustomers: Customer[] = [
  {
    id: 'cu1', name: 'Muhammad Usman', phone: '0300-1234567',
    address: 'Model Town, Lahore', city: 'Lahore',
    email: 'usman.construction@gmail.com', createdAt: '2024-06-01',
    totalPurchases: 8, totalSpent: 2340000, pendingBalance: 0,
  },
  {
    id: 'cu2', name: 'Ali Builders & Co.', phone: '0321-9876543',
    address: 'DHA Phase 5, Karachi', city: 'Karachi',
    email: 'alibuilders@outlook.com', createdAt: '2024-07-15',
    totalPurchases: 14, totalSpent: 5620000, pendingBalance: 185000,
  },
  {
    id: 'cu3', name: 'Rana Fabricators', phone: '0333-5678901',
    address: 'GT Road, Rawalpindi', city: 'Rawalpindi',
    createdAt: '2024-08-03', totalPurchases: 6, totalSpent: 1180000, pendingBalance: 75000,
  },
  {
    id: 'cu4', name: 'Shah Steel Works', phone: '0345-2345678',
    address: 'Ring Road, Peshawar', city: 'Peshawar',
    createdAt: '2024-09-10', totalPurchases: 3, totalSpent: 880000, pendingBalance: 0,
  },
  {
    id: 'cu5', name: 'Malik Engineering', phone: '0311-8765432',
    address: 'Korangi Industrial Area, Karachi', city: 'Karachi',
    email: 'malik.eng@yahoo.com', createdAt: '2024-10-22',
    totalPurchases: 5, totalSpent: 1650000, pendingBalance: 320000,
  },
  {
    id: 'cu6', name: 'National Infra Projects', phone: '0312-3344556',
    address: 'Blue Area, Islamabad', city: 'Islamabad',
    email: 'nip.contracts@gmail.com', createdAt: '2024-11-01',
    totalPurchases: 2, totalSpent: 4200000, pendingBalance: 0,
  },
];

// ─── Invoices ────────────────────────────────────────────────────────────────
export const mockInvoices: Invoice[] = [
  {
    id: 'inv1', invoiceNumber: 'SV-2024-0001',
    invoiceType: 'Steel', customerId: 'cu1', customerName: 'Muhammad Usman', customerPhone: '0300-1234567',
    items: [
      { id: 'ii1', category: 'Steel', steelType:'Rod', description: 'Grade 60 Rebar 16mm', weightKg: 500, quantity: 25, unit: 'piece', pricePerKg: 265, totalPrice: 132500 },
      { id: 'ii2', category: 'Steel', steelType:'Angle', description: '75x75x6mm', weightKg: 240, quantity: 16, unit: 'piece', pricePerKg: 270, totalPrice: 64800 },
    ],
    subtotal: 197300, discount: 5000, discountType: 'flat', total: 192300,
    amountPaid: 192300, balance: 0, status: 'Paid',
    createdAt: '2024-11-05', dueDate: '2024-11-20',
  },
  {
    id: 'inv2', invoiceNumber: 'SV-2024-0002',
    invoiceType: 'Steel', customerId: 'cu2', customerName: 'Ali Builders & Co.', customerPhone: '0321-9876543',
    items: [
      { id: 'ii3', category: 'Steel', steelType:'Sheet', description: 'MS Plain 4x8 3mm', weightKg: 1200, quantity: 24, unit: 'piece', pricePerKg: 275, totalPrice: 330000 },
      { id: 'ii4', category: 'Steel', steelType:'Rod', description: 'Grade 60 Rebar 20mm', weightKg: 800, quantity: 32, unit: 'piece', pricePerKg: 262, totalPrice: 209600 },
    ],
    subtotal: 539600, discount: 10, discountType: 'percent', total: 485640,
    amountPaid: 300000, balance: 185640, status: 'Partial',
    createdAt: '2024-11-12', dueDate: '2024-12-12',
    notes: 'Balance due by month end',
  },
  {
    id: 'inv3', invoiceNumber: 'SV-2024-0003',
    invoiceType: 'Steel', customerId: 'cu3', customerName: 'Rana Fabricators', customerPhone: '0333-5678901',
    items: [
      { id: 'ii5', category: 'Steel', steelType:'Channel', description: 'C-75 Light', weightKg: 380, quantity: 24, unit: 'piece', pricePerKg: 272, totalPrice: 103360 },
    ],
    subtotal: 103360, discount: 0, discountType: 'flat', total: 103360,
    amountPaid: 28360, balance: 75000, status: 'Partial',
    createdAt: '2024-11-18', dueDate: '2024-12-05',
  },
  {
    id: 'inv4', invoiceNumber: 'SV-2024-0004',
    invoiceType: 'Steel', customerId: 'cu6', customerName: 'National Infra Projects', customerPhone: '0312-3344556',
    items: [
      { id: 'ii6', category: 'Steel', steelType:'Coil', description: 'HR Coil 2mm', weightKg: 5000, quantity: 5, unit: 'piece', pricePerKg: 270, totalPrice: 1350000 },
      { id: 'ii7', category: 'Steel', steelType:'Rod', description: 'Grade 60 Rebar 25mm', weightKg: 3000, quantity: 100, unit: 'piece', pricePerKg: 262, totalPrice: 786000 },
      { id: 'ii8', category: 'Steel', steelType:'Sheet', description: 'MS Plain 4x8 5mm', weightKg: 2000, quantity: 25, unit: 'piece', pricePerKg: 280, totalPrice: 560000 },
    ],
    subtotal: 2696000, discount: 5, discountType: 'percent', total: 2561200,
    amountPaid: 2561200, balance: 0, status: 'Paid',
    createdAt: '2024-11-25',
  },
  {
    id: 'inv5', invoiceNumber: 'SV-2024-0005',
    invoiceType: 'Steel', customerId: 'cu4', customerName: 'Shah Steel Works', customerPhone: '0345-2345678',
    items: [
      { id: 'ii9', category: 'Steel', steelType:'Bar', description: 'Mild Steel Flat Bar 50x6', weightKg: 600, quantity: 40, unit: 'piece', pricePerKg: 258, totalPrice: 154800 },
      { id: 'ii10', category: 'Steel', steelType:'Pipe', description: 'ERW Pipe 2"', weightKg: 400, quantity: 20, unit: 'piece', pricePerKg: 285, totalPrice: 114000 },
    ],
    subtotal: 268800, discount: 3000, discountType: 'flat', total: 265800,
    amountPaid: 265800, balance: 0, status: 'Paid',
    createdAt: '2024-12-02',
  },
  {
    id: 'inv6', invoiceNumber: 'SV-2024-0006',
    invoiceType: 'Steel', customerId: 'cu5', customerName: 'Malik Engineering', customerPhone: '0311-8765432',
    items: [
      { id: 'ii11', category: 'Steel', steelType:'Beam', description: 'I-Beam 150x75', weightKg: 1200, quantity: 10, unit: 'piece', pricePerKg: 295, totalPrice: 354000 },
      { id: 'ii12', category: 'Steel', steelType:'Angle', description: '50x50x5mm', weightKg: 180, quantity: 24, unit: 'piece', pricePerKg: 268, totalPrice: 48240 },
    ],
    subtotal: 402240, discount: 0, discountType: 'flat', total: 402240,
    amountPaid: 82240, balance: 320000, status: 'Pending',
    createdAt: '2024-12-08', dueDate: '2024-12-22',
  },
];

// ─── Workers ──────────────────────────────────────────────────────────────────
export const mockWorkers: Worker[] = [
  {
    id: 'w1', name: 'Ghulam Mustafa', phone: '0300-1111222', role: 'Supervisor',
    salaryType: 'Monthly', salaryRate: 45000, joiningDate: '2023-01-10',
    address: 'Shahdara, Lahore', cnic: '35201-1234567-1', isActive: true,
  },
  {
    id: 'w2', name: 'Kashif Ali', phone: '0321-2223334', role: 'Loader',
    salaryType: 'Daily', salaryRate: 1200, joiningDate: '2023-03-15',
    address: 'Badami Bagh, Lahore', cnic: '35202-7654321-3', isActive: true,
  },
  {
    id: 'w3', name: 'Zafar Iqbal', phone: '0333-3334445', role: 'Driver',
    salaryType: 'Monthly', salaryRate: 35000, joiningDate: '2023-05-20',
    address: 'Walled City, Lahore', isActive: true,
  },
  {
    id: 'w4', name: 'Nasir Mahmood', phone: '0345-4445556', role: 'Loader',
    salaryType: 'Daily', salaryRate: 1200, joiningDate: '2023-08-01',
    address: 'Gulberg, Lahore', isActive: true,
  },
  {
    id: 'w5', name: 'Arshad Karim', phone: '0311-5556667', role: 'Welder',
    salaryType: 'Daily', salaryRate: 1800, joiningDate: '2024-01-12',
    address: 'Township, Lahore', cnic: '35203-9876543-7', isActive: true,
  },
  {
    id: 'w6', name: 'Sajid Hussain', phone: '0312-6667778', role: 'Guard',
    salaryType: 'Monthly', salaryRate: 28000, joiningDate: '2024-02-28',
    address: 'Ravi Road, Lahore', isActive: true,
  },
  {
    id: 'w7', name: 'Faisal Nawaz', phone: '0315-7778889', role: 'Accountant',
    salaryType: 'Monthly', salaryRate: 55000, joiningDate: '2023-11-01',
    address: 'Johar Town, Lahore', isActive: true,
  },
  {
    id: 'w8', name: 'Saeed Khan', phone: '0319-8889990', role: 'Loader',
    salaryType: 'Daily', salaryRate: 1200, joiningDate: '2024-03-10',
    address: 'Ichhra, Lahore', isActive: false,
  },
];

// ─── Attendance (last 7 days for mock) ───────────────────────────────────────
const today = new Date();
const days = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(today);
  d.setDate(today.getDate() - (6 - i));
  return d.toISOString().split('T')[0];
});

export const mockAttendance: AttendanceRecord[] = mockWorkers
  .filter(w => w.isActive)
  .flatMap(worker =>
    days.map((date, idx) => ({
      id: `att-${worker.id}-${idx}`,
      workerId: worker.id,
      date,
      present: Math.random() > 0.15, // ~85% attendance
      overtime: Math.random() > 0.7 ? Math.round(Math.random() * 3) : 0,
    }))
  );

// ─── Monthly Sales (for charts) ───────────────────────────────────────────────
export const monthlySalesData = [
  { month: 'Jul', revenue: 1840000, invoices: 8 },
  { month: 'Aug', revenue: 2150000, invoices: 11 },
  { month: 'Sep', revenue: 1920000, invoices: 9 },
  { month: 'Oct', revenue: 2780000, invoices: 14 },
  { month: 'Nov', revenue: 3340000, invoices: 16 },
  { month: 'Dec', revenue: 2860000, invoices: 12 },
];

export const stockByTypeData = [
  { type: 'Rod',     kg: 12000 },
  { type: 'Sheet',   kg: 8500  },
  { type: 'Bar',     kg: 6200  },
  { type: 'Coil',    kg: 15000 },
  { type: 'Pipe',    kg: 3400  },
  { type: 'Angle',   kg: 1800  },
  { type: 'Channel', kg: 950   },
  { type: 'Beam',    kg: 0     },
];
