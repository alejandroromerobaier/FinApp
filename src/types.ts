export interface Transaction {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  addedBy: string;
  type: 'personal' | 'shared';
}

export interface Contributor {
  id: string;
  name: string;
  avatar: string;
  expensesCount: number;
  totalSpent: number;
  percentage: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  transactionCount: number;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  icon: string;
  currency: string;
  ownerId: string;
  memberIds: string[];
  pendingEmails?: string[];
  createdAt: any;
  updatedAt?: any;
}
