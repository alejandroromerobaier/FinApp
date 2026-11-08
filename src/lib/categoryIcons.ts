import React from 'react';
import {
  Tag,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  Utensils,
  Coffee,
  Pizza,
  Car,
  Fuel,
  Bus,
  Bike,
  Plane,
  Hotel,
  Home,
  Armchair,
  Wrench,
  Zap,
  Wifi,
  Smartphone,
  Receipt,
  Landmark,
  Briefcase,
  DollarSign,
  Play,
  Tv,
  Film,
  Music,
  Heart,
  Pill,
  Stethoscope,
  Dumbbell,
  Sparkles,
  Scissors,
  Book,
  GraduationCap,
  PawPrint,
  Baby,
  Gift,
  ShieldCheck,
  Key,
  MoreHorizontal
} from 'lucide-react';

export const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Tag,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  Utensils,
  Coffee,
  Pizza,
  Car,
  Fuel,
  Bus,
  Bike,
  Plane,
  Hotel,
  Home,
  Armchair,
  Wrench,
  Zap,
  Wifi,
  Smartphone,
  Receipt,
  Landmark,
  Briefcase,
  DollarSign,
  Play,
  Tv,
  Film,
  Music,
  Heart,
  Pill,
  Stethoscope,
  Dumbbell,
  Sparkles,
  Scissors,
  Book,
  GraduationCap,
  PawPrint,
  Baby,
  Gift,
  ShieldCheck,
  Key,
  MoreHorizontal
};

export interface IconCategoryGroup {
  name: string;
  icons: { id: string; label: string }[];
}

export const CATEGORY_ICON_GROUPS: IconCategoryGroup[] = [
  {
    name: 'Esenciales & Compras',
    icons: [
      { id: 'Tag', label: 'Etiqueta' },
      { id: 'ShoppingBag', label: 'Bolsa de compras' },
      { id: 'ShoppingCart', label: 'Supermercado' },
      { id: 'Shirt', label: 'Ropa / Moda' },
      { id: 'Gift', label: 'Regalo' }
    ]
  },
  {
    name: 'Comida & Bebida',
    icons: [
      { id: 'Utensils', label: 'Restaurante' },
      { id: 'Coffee', label: 'Cafetería' },
      { id: 'Pizza', label: 'Delivery / Comida rápida' }
    ]
  },
  {
    name: 'Transporte & Viajes',
    icons: [
      { id: 'Car', label: 'Auto' },
      { id: 'Fuel', label: 'Combustible' },
      { id: 'Bus', label: 'Transporte' },
      { id: 'Bike', label: 'Bicicleta' },
      { id: 'Plane', label: 'Viaje / Vuelo' },
      { id: 'Hotel', label: 'Alojamiento' }
    ]
  },
  {
    name: 'Hogar & Servicios',
    icons: [
      { id: 'Home', label: 'Hogar / Alquiler' },
      { id: 'Armchair', label: 'Muebles' },
      { id: 'Key', label: 'Expensas / Llaves' },
      { id: 'Wrench', label: 'Mantenimiento' },
      { id: 'Zap', label: 'Luz / Servicios' },
      { id: 'Wifi', label: 'Internet / Cable' },
      { id: 'Smartphone', label: 'Celular' },
      { id: 'Receipt', label: 'Facturas / Impuestos' }
    ]
  },
  {
    name: 'Salud, Deportes & Cuidado',
    icons: [
      { id: 'Heart', label: 'Salud / Pareja' },
      { id: 'Pill', label: 'Farmacia' },
      { id: 'Stethoscope', label: 'Médico' },
      { id: 'Dumbbell', label: 'Gimnasio' },
      { id: 'Sparkles', label: 'Belleza' },
      { id: 'Scissors', label: 'Peluquería' }
    ]
  },
  {
    name: 'Ocio & Familia',
    icons: [
      { id: 'Play', label: 'Juegos / Streaming' },
      { id: 'Tv', label: 'Televisión' },
      { id: 'Film', label: 'Cine' },
      { id: 'Music', label: 'Música' },
      { id: 'PawPrint', label: 'Mascotas' },
      { id: 'Baby', label: 'Bebé / Hijos' }
    ]
  },
  {
    name: 'Trabajo, Educación & Finanzas',
    icons: [
      { id: 'Briefcase', label: 'Trabajo' },
      { id: 'DollarSign', label: 'Ingresos / Sueldo' },
      { id: 'Landmark', label: 'Banco / Inversión' },
      { id: 'ShieldCheck', label: 'Seguros' },
      { id: 'GraduationCap', label: 'Universidad / Cursos' },
      { id: 'Book', label: 'Educación / Libros' },
      { id: 'MoreHorizontal', label: 'Otros' }
    ]
  }
];

export const ALL_CATEGORY_ICONS = CATEGORY_ICON_GROUPS.flatMap(g => g.icons.map(i => i.id));

export const getCategoryIcon = (iconName?: string): React.ComponentType<{ size?: number; className?: string }> => {
  if (!iconName) return Tag;
  return CATEGORY_ICON_MAP[iconName] || MoreHorizontal;
};
