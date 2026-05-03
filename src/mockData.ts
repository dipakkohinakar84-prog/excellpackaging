
import { User, Department, Customer, Item, WorkOrder } from './types';

export const MOCK_USERS: User[] = [
  { id: 1, username: 'Sakshi Bomble', email: 'sbomble@abc.com', mobile: '8766074260', passkey: 'pass123', department: 'Office', level: '1-Manager' },
  { id: 2, username: 'Atul Khandge', email: 'admin@a', mobile: '9881110047', passkey: 'pass123', department: 'Office', level: '1-Manager' },
  { id: 3, username: 'Pravin Ghumatkar', email: 'admin@a', mobile: '8149210774', passkey: 'pass123', department: 'Quality_Control', level: '4-Quality' },
  { id: 4, username: 'Sandip Rale', email: 'admin@a', mobile: '9921533583', passkey: 'pass123', department: 'Trading_Consumables', level: '3-HOD' },
];

export const MOCK_DEPARTMENTS: Department[] = [
  { id: 1, name: 'Wood_Work', incharge: 'Sandeep Rale', supervisor: 'Sandeep Rale', info: 'Wood_Work Unit' },
  { id: 2, name: 'Corrugation', incharge: 'Sandeep Rale', supervisor: 'Sandeep Rale', info: '' },
  { id: 3, name: 'Foam_Plastic_bags', incharge: '', supervisor: '', info: '' },
  { id: 4, name: 'Trading_Consumables', incharge: '', supervisor: '', info: '' },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 1, name: 'Govind Precision Tech India Pvt Ltd', proprietor: 'Govind', address: 'Bhosari MIDC', city: 'Bhosari', contact: '9876543210', email: 'govind@gmail.com', gst: '27AAAAA0000A1Z5', type: 'Manufacturing', reference: 'Direct', remarks: '' },
  { id: 2, name: 'Caprihans India Ltd', proprietor: 'Director', address: 'Pune-Nasik Highway', city: 'Pune', contact: '9888888888', email: 'caprihans@gmail.com', gst: '27BBBBB1111B1Z6', type: 'Manufacturing', reference: 'Trade', remarks: '' },
];

export const MOCK_ITEMS: Item[] = [
  { 
    id: 1, 
    name: 'Pallet 2x2 MB PPLT0014', 
    customer_name: 'Caprihans India Ltd', 
    drawing_no: 'PPLT1043', 
    remarks: 'Heavy duty pallet for export', 
    departments: ['Wood_Work'],
    children: [
      { id: 'c1', name: 'Wooden Plank', departments: ['Wood_Work'], size: '1200x100x20mm', qtyPerMaster: 10 },
      { id: 'c2', name: 'Support Block', departments: ['Wood_Work'], size: '100x100x100mm', qtyPerMaster: 9 },
      { id: 'c3', name: 'Bottom Runner', departments: ['Wood_Work'], size: '1200x100x20mm', qtyPerMaster: 3 }
    ]
  },
  { 
    id: 2, 
    name: 'TOP 2x2 MB PPLT0013', 
    customer_name: 'Caprihans India Ltd', 
    drawing_no: 'PPLT0013', 
    remarks: 'Corrugated top cover', 
    departments: ['Corrugation'],
    children: [
      { id: 'c4', name: 'Main Sheet', departments: ['Corrugation'], size: '1250x1250mm', qtyPerMaster: 1 },
      { id: 'c5', name: 'Side Flap', departments: ['Corrugation'], size: '200x1250mm', qtyPerMaster: 4 }
    ]
  },
];

export const MOCK_WORK_ORDERS: WorkOrder[] = [
  { id: 511, itemId: 1, customer: 'Caprihans India Ltd', job_details: 'PLY TOP 875x875 (2x2) - PPLT1043', drawing: 'PPLT1043', qty: 5, etd: '2025-10-16', ready_date: '2025-10-31', status: 'Ready for despatch', assigned_departments: ['Wood_Work', 'Quality_Control'] },
  { id: 782, customer: 'Excell Vadodara', job_details: 'PSC R', drawing: 'PSC R', qty: 10, etd: '2025-12-13', ready_date: '2025-12-19', status: 'Ready for despatch', assigned_departments: ['Corrugation'] },
  { id: 1113, customer: 'Diam Display India Pvt Ltd', job_details: 'WOOD_C1_GONDOLA_WOODEN_CRATE', drawing: 'N/A', qty: 10, etd: '2026-02-11', ready_date: '2026-02-11', status: 'Not Started', assigned_departments: ['Wood_Work'] },
];