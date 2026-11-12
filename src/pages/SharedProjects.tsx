import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plane, Home, PlusCircle, Share2, Edit3, Trash2, Eye, MoreVertical, Hourglass, Users, X, Wallet, Briefcase, Heart, ShoppingBag, Landmark, Star, Archive, CheckCircle2, Power, ArrowLeft, Check } from 'lucide-react';
import { formatCurrency, cn, formatCurrencyInput, formatAmountForDisplay, parseFormattedAmount } from '@/src/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { createProject, updateProject, deleteProject, removeMemberFromProject, inviteUserToProjectByEmail, updateUserProfile, getUsersByIds } from '../services/firestoreService';
import { PROJECT_COLOR_OPTIONS, PROJECT_ICONS, getProjectIcon, getProjectGradient } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { CustomSelect } from '../components/CustomSelect';

export const isProjectOwner = (project: any, userId?: string): boolean => {
  if (!userId || !project) return false;
  if (project.ownerId) {
    return project.ownerId === userId;
  }
  if (Array.isArray(project.memberIds) && project.memberIds.length > 0) {
    return project.memberIds[0] === userId;
  }
  return false;
};

export const SharedProjects: React.FC = () => {
  const navigate = useNavigate();
  const { projects, loading, transactions } = useData();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [membersMap, setMembersMap] = useState<Record<string, any>>({});
  const [formData, setFormData] = useState({ 
    name: '', 
    icon: 'plane', 
    currency: 'ARS',
    showInHome: true,
    showInExpenseSelector: true,
    status: 'active' as 'active' | 'inactive',
    homeOrder: 1,
    isDefaultProject: false,
    cardColor: 'slate'
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [saveError, setSaveError] = useState('');

  // Fetch real user metadata for all project members
  useEffect(() => {
    const allMemberIds = new Set<string>();
    projects.forEach(p => {
      p.memberIds?.forEach((mid: string) => allMemberIds.add(mid));
      if (p.ownerId) allMemberIds.add(p.ownerId);
    });
    if (user?.uid) allMemberIds.add(user.uid);

    const ids = Array.from(allMemberIds);
    if (ids.length > 0) {
      getUsersByIds(ids).then(users => {
        if (users) {
          const map: Record<string, any> = {};
          users.forEach((u: any) => {
            map[u.id] = u;
          });
          setMembersMap(map);
        }
      });
    }
  }, [projects, user?.uid]);

  // Compute current month expenses per project
  const projectMonthlyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    transactions.forEach(t => {
      const pId = t.projectId || 'personal';
      if (t.type === 'expense') {
        const tDate = t.date instanceof Date ? t.date : new Date(t.date);
        if (!isNaN(tDate.getTime()) && tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
          totals[pId] = (totals[pId] || 0) + (t.amount || 0);
        }
      }
    });
    return totals;
  }, [transactions]);

  const myProjects = useMemo(() => projects.filter(p => isProjectOwner(p, user?.uid)).map(p => ({
    ...p,
    status: p.status || 'active'
  })), [projects, user]);
  
  const personalProject = useMemo(() => ({
    id: 'personal',
    isPersonal: true,
    name: 'Personal',
    icon: 'wallet',
    showInHome: profile?.personalShowInHome ?? true,
    showInExpenseSelector: profile?.personalShowInExpenseSelector ?? true,
    status: profile?.personalStatus || 'active',
    homeOrder: profile?.personalHomeOrder ?? 1,
    cardColor: profile?.personalCardColor || 'navy',
    memberIds: [user?.uid],
    ownerId: user?.uid,
    currency: profile?.currency || 'ARS'
  }), [profile, user]);

  const allMyManageable = useMemo(() => [personalProject, ...myProjects], [personalProject, myProjects]);
  const sharedWithMe = useMemo(() => projects.filter(p => !isProjectOwner(p, user?.uid)).map(p => ({
    ...p,
    status: p.status || 'active'
  })), [projects, user]);

  const activeMyProjects = useMemo(() => allMyManageable.filter(p => (p.status || 'active') === 'active'), [allMyManageable]);
  const inactiveMyProjects = useMemo(() => allMyManageable.filter(p => p.status === 'inactive'), [allMyManageable]);

  const activeSharedWithMe = useMemo(() => sharedWithMe.filter(p => (p.status || 'active') === 'active'), [sharedWithMe]);
  const inactiveSharedWithMe = useMemo(() => sharedWithMe.filter(p => p.status === 'inactive'), [sharedWithMe]);

  const projectsCount = useMemo(() => allMyManageable.length, [allMyManageable]);

  const handleOpenModal = (project?: any) => {
    const currentDefault = profile?.defaultProjectId || 'personal';
    if (project) {
      setEditingProject(project);
      setFormData({ 
        name: project.name, 
        icon: project.icon, 
        currency: project.currency || 'ARS',
        showInHome: project.showInHome !== undefined ? project.showInHome : true,
        showInExpenseSelector: project.isPersonal
          ? (profile?.personalShowInExpenseSelector ?? true)
          : (project.showInExpenseSelector !== undefined ? project.showInExpenseSelector : true),
        status: project.isPersonal
          ? (profile?.personalStatus || 'active')
          : (project.status || 'active'),
        homeOrder: project.homeOrder || 1,
        isDefaultProject: currentDefault === project.id,
        cardColor: project.isPersonal 
          ? (profile?.personalCardColor || 'navy')
          : (project.cardColor || 'slate')
      });
    } else {
      setEditingProject(null);
      // Calc next order
      const maxOrder = Math.max(...allMyManageable.map(p => p.homeOrder || 0), 0);
      setFormData({ 
        name: '', 
        icon: 'plane', 
        currency: 'ARS',
        showInHome: true,
        showInExpenseSelector: true,
        status: 'active',
        homeOrder: maxOrder + 1,
        isDefaultProject: false,
        cardColor: 'slate'
      });
    }
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (project: any) => {
    const newStatus = (project.status || 'active') === 'active' ? 'inactive' : 'active';
    if (project.isPersonal) {
      await updateUserProfile(user!.uid, { personalStatus: newStatus });
    } else {
      await updateProject(project.id, { status: newStatus });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    setIsSaving(true);
    setSaveError('');
    
    try {
      const { isDefaultProject, ...projectFields } = formData;

      if (editingProject) {
        if (editingProject.isPersonal) {
          await updateUserProfile(user!.uid, {
            currency: formData.currency,
            personalShowInHome: formData.showInHome,
            personalShowInExpenseSelector: formData.showInExpenseSelector,
            personalStatus: formData.status,
            personalHomeOrder: formData.homeOrder,
            personalCardColor: formData.cardColor,
            ...(isDefaultProject ? { defaultProjectId: 'personal' } : {})
          });
        } else {
          await updateProject(editingProject.id, {
            ...projectFields,
            cardColor: formData.cardColor
          });
          if (isDefaultProject) {
            await updateUserProfile(user!.uid, { defaultProjectId: editingProject.id });
          } else if (profile?.defaultProjectId === editingProject.id) {
            await updateUserProfile(user!.uid, { defaultProjectId: 'personal' });
          }
        }
      } else {
        const docRef = await createProject({
          ...projectFields,
          cardColor: formData.cardColor
        });
        if (isDefaultProject && docRef?.id) {
          await updateUserProfile(user!.uid, { defaultProjectId: docRef.id });
        }
      }
      setIsModalOpen(false);
      setEditingProject(null);
    } catch (error) {
      console.error('Error saving project:', error);
      setSaveError('No se pudo guardar los cambios. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este proyecto? Se perderá el acceso para todos los colaboradores.')) {
      await deleteProject(id);
    }
  };

  const handleLeave = async (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas salir de este proyecto?')) {
      await removeMemberFromProject(id, user!.uid);
    }
  };

  const handleOpenInvite = (project: any) => {
    setSelectedProject(project);
    setInviteEmail('');
    setInviteError('');
    setIsInviteModalOpen(true);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !inviteEmail) return;

    setIsInviting(true);
    setInviteError('');

    try {
      const result = await inviteUserToProjectByEmail(selectedProject.id, inviteEmail);
      
      if (result.success) {
        setIsInviteModalOpen(false);
        if (result.type === 'member') {
          alert('¡Usuario invitado con éxito!');
        } else {
          alert('Invitación enviada. El usuario verá el proyecto cuando se registre.');
        }
      } else {
        setInviteError('Ocurrió un error al invitar al usuario.');
      }
    } catch (error) {
      console.error('Error inviting user:', error);
      setInviteError('Ocurrió un error al invitar al usuario.');
    } finally {
      setIsInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-on-surface-variant font-bold text-xs uppercase tracking-widest">Cargando proyectos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 max-w-5xl mx-auto py-8 pb-32">
      {/* Section Header */}
      <PageHeader
        backTo="/settings"
        categoryTag="Colaboración"
        title="Bóvedas Compartidas"
        subtitle="Administra tus espacios compartidos, invita a colaboradores y controla los gastos en conjunto."
        rightAction={
          <button 
            onClick={() => handleOpenModal()}
            className="bg-primary hover:opacity-90 text-white px-5 py-3 rounded-2xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/20 shrink-0 font-bold text-xs sm:text-sm cursor-pointer"
          >
            <PlusCircle size={18} />
            <span>Crear Proyecto</span>
          </button>
        }
        className="mb-8"
      />

      {/* Status Tabs */}
      <div className="flex bg-surface-container-low p-1.5 rounded-2xl border border-on-surface/5 mb-8 max-w-md">
        <button
          onClick={() => setActiveTab('active')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
            activeTab === 'active' ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant/70 hover:text-on-surface"
          )}
        >
          <CheckCircle2 size={16} />
          Activos ({activeMyProjects.length + activeSharedWithMe.length})
        </button>
        <button
          onClick={() => setActiveTab('inactive')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
            activeTab === 'inactive' ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant/70 hover:text-on-surface"
          )}
        >
          <Archive size={16} />
          Inactivos ({inactiveMyProjects.length + inactiveSharedWithMe.length})
        </button>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* My Projects */}
        <div className="md:col-span-8 space-y-6">
          <h2 className="text-lg font-bold text-on-surface flex items-center gap-2 mb-4">
            <Users size={20} className="text-primary" />
            {activeTab === 'active' ? 'Mis Proyectos Activos' : 'Mis Proyectos Inactivos'}
          </h2>
          
          {(activeTab === 'active' ? activeMyProjects : inactiveMyProjects).length === 0 ? (
            <div className="bg-surface-container-low/50 border-2 border-dashed border-on-surface/10 rounded-3xl p-12 text-center">
              <div className="w-16 h-16 bg-on-surface/5 rounded-full flex items-center justify-center mx-auto mb-4">
                {activeTab === 'active' ? <PlusCircle size={32} className="text-on-surface-variant/30" /> : <Archive size={32} className="text-on-surface-variant/30" />}
              </div>
              <p className="text-on-surface-variant/70 font-medium">
                {activeTab === 'active' ? 'No tienes proyectos creados activos.' : 'No tienes proyectos inactivos o archivados.'}
              </p>
            </div>
          ) : (
            (activeTab === 'active' ? activeMyProjects : inactiveMyProjects).map((project: any) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                isOwner={true}
                isDefault={(profile?.defaultProjectId || 'personal') === project.id}
                monthlyTotal={projectMonthlyTotals[project.id] || 0}
                membersMap={membersMap}
                onEdit={() => handleOpenModal(project)}
                onToggleStatus={() => handleToggleStatus(project)}
                onDelete={project.isPersonal ? undefined : () => handleDelete(project.id)}
                onInvite={project.isPersonal ? undefined : () => handleOpenInvite(project)}
                onView={() => project.isPersonal ? navigate('/home') : navigate(`/project/${project.id}`)}
              />
            ))
          )}

          <h2 className="text-lg font-bold text-on-surface flex items-center gap-2 mb-4 pt-4">
            <Share2 size={20} className="text-secondary" />
            {activeTab === 'active' ? 'Compartidos conmigo (Activos)' : 'Compartidos conmigo (Inactivos)'}
          </h2>

          {(activeTab === 'active' ? activeSharedWithMe : inactiveSharedWithMe).length === 0 ? (
            <div className="bg-surface-container-low/50 border-2 border-dashed border-on-surface/10 rounded-3xl p-12 text-center">
              <p className="text-on-surface-variant/70 font-medium">
                {activeTab === 'active' ? 'No tienes proyectos compartidos activos.' : 'No tienes proyectos compartidos inactivos.'}
              </p>
            </div>
          ) : (
            (activeTab === 'active' ? activeSharedWithMe : inactiveSharedWithMe).map((project) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                isOwner={isProjectOwner(project, user?.uid)}
                isDefault={(profile?.defaultProjectId || 'personal') === project.id}
                monthlyTotal={projectMonthlyTotals[project.id] || 0}
                membersMap={membersMap}
                onEdit={() => handleOpenModal(project)}
                onInvite={() => handleOpenInvite(project)}
                onToggleStatus={() => handleToggleStatus(project)}
                onView={() => navigate(`/project/${project.id}`)}
                onLeave={() => handleLeave(project.id)}
              />
            ))
          )}
        </div>

        {/* Side Stats */}
        <div className="md:col-span-4 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-primary text-white p-8 rounded-3xl shadow-2xl shadow-primary/20 relative overflow-hidden"
          >
            <div className="relative z-10">
              <h4 className="text-sm font-bold opacity-60 uppercase tracking-widest mb-2">Total Proyectos</h4>
              <p className="text-4xl font-extrabold tracking-tighter font-headline">{projects.length}</p>
              <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs font-medium opacity-80">{myProjects.length} creados por ti</span>
                <span className="bg-white/20 px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider">ACTIVOS</span>
              </div>
            </div>
            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-surface-container-lowest p-8 rounded-3xl border border-on-surface/10 shadow-sm"
          >
            <h4 className="text-sm font-extrabold text-on-surface uppercase tracking-widest mb-6">Invitaciones</h4>
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <Hourglass size={32} className="text-on-surface-variant/20 mb-2" />
                <p className="text-xs text-on-surface-variant/70 font-medium">No tienes invitaciones pendientes</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-container-lowest w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden border border-on-surface/10"
            >
              {/* Fixed Header */}
              <div className="flex justify-between items-center px-6 py-5 border-b border-on-surface/10 shrink-0 bg-surface-container-lowest">
                <div className="min-w-0 flex-1 mr-3">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface font-headline truncate">
                    {editingProject ? (editingProject.isPersonal ? 'Editar Proyecto Personal' : 'Editar Proyecto') : 'Nuevo Proyecto'}
                  </h2>
                  <p className="text-xs text-on-surface-variant/60 font-bold uppercase tracking-wider mt-0.5 truncate">
                    {editingProject?.isPersonal ? 'Configura tu billetera principal' : 'Configura los detalles y visibilidad'}
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-on-surface/5 rounded-full transition-colors text-on-surface-variant shrink-0">
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form id="project-form" onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
                {!editingProject?.isPersonal ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">Nombre del Proyecto</label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ej: Viaje a Córdoba, Gastos Casa..."
                        className="w-full bg-surface-container-low border border-on-surface/10 rounded-2xl p-4 text-base font-bold focus:ring-2 focus:ring-primary/20 transition-all text-on-surface outline-none"
                      />
                    </div>

                    <div>
                      <CustomSelect
                        label="Preferencia de Moneda"
                        value={formData.currency}
                        onChange={(val) => setFormData({ ...formData, currency: val as string })}
                        options={[
                          { value: 'ARS', label: 'Peso Argentino (ARS)' },
                          { value: 'USD', label: 'Dólar (USD)' },
                          { value: 'EUR', label: 'Euro (EUR)' },
                          { value: 'BRL', label: 'Real (BRL)' },
                          { value: 'CLP', label: 'Peso Chileno (CLP)' },
                          { value: 'UYU', label: 'Peso Uruguayo (UYU)' },
                          { value: 'COP', label: 'Peso Colombiano (COP)' },
                          { value: 'MXN', label: 'Peso Mexicano (MXN)' },
                        ]}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">Icono del Proyecto</label>
                      <div className="grid grid-cols-4 gap-3">
                        {PROJECT_ICONS.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, icon: item.id })}
                            className={cn(
                              "aspect-square rounded-2xl flex items-center justify-center transition-all border-2",
                              formData.icon === item.id 
                                ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
                                : "bg-surface-container-low border-transparent text-on-surface-variant hover:bg-on-surface/5"
                            )}
                          >
                            <item.icon size={22} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <CustomSelect
                      label="Preferencia de Moneda (Personal)"
                      value={formData.currency}
                      onChange={(val) => setFormData({ ...formData, currency: val as string })}
                      options={[
                        { value: 'ARS', label: 'Peso Argentino (ARS)' },
                        { value: 'USD', label: 'Dólar (USD)' },
                        { value: 'EUR', label: 'Euro (EUR)' },
                        { value: 'BRL', label: 'Real (BRL)' },
                        { value: 'CLP', label: 'Peso Chileno (CLP)' },
                        { value: 'UYU', label: 'Peso Uruguayo (UYU)' },
                        { value: 'COP', label: 'Peso Colombiano (COP)' },
                        { value: 'MXN', label: 'Peso Mexicano (MXN)' },
                      ]}
                    />
                  </div>
                )}

                {/* Color de Tarjeta en Home */}
                <div>
                  <label className="block text-xs font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-2.5 ml-1">
                    Color de Tarjeta en Home
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                    {PROJECT_COLOR_OPTIONS.map((c) => {
                      const isSelected = (formData.cardColor || (editingProject?.isPersonal ? 'navy' : 'slate')) === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, cardColor: c.id })}
                          className={cn(
                            "h-11 rounded-2xl flex items-center justify-center transition-all relative shadow-sm cursor-pointer",
                            c.previewClass,
                            isSelected ? "ring-4 ring-primary ring-offset-2 scale-105" : "hover:scale-102 opacity-90 hover:opacity-100"
                          )}
                          title={c.name}
                        >
                          {isSelected && (
                            <Check size={18} className="text-white drop-shadow-md stroke-[3]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Display configuration */}
                <div className="pt-4 border-t border-on-surface/10 space-y-5">
                  <span className="text-[10px] font-black text-on-surface-variant/70 uppercase tracking-[0.2em] block mb-2">Configuración y Visibilidad</span>

                  <div className="flex items-center justify-between bg-surface-container-low p-3.5 rounded-2xl border border-on-surface/5">
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-0.5">Visibilidad en la Home</label>
                      <p className="text-[11px] text-on-surface-variant/70 font-medium">Mostrar tarjeta en la pantalla principal</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, showInHome: !formData.showInHome })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative shrink-0 ml-3",
                        formData.showInHome ? "bg-primary" : "bg-on-surface/20"
                      )}
                    >
                      <motion.div 
                        animate={{ x: formData.showInHome ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-surface-container-lowest rounded-full shadow-sm" 
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-surface-container-low p-3.5 rounded-2xl border border-on-surface/5">
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-0.5">Visibilidad al Cargar Gastos</label>
                      <p className="text-[11px] text-on-surface-variant/70 font-medium">Mostrar en selector al registrar gasto</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, showInExpenseSelector: !formData.showInExpenseSelector })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative shrink-0 ml-3",
                        formData.showInExpenseSelector ? "bg-primary" : "bg-on-surface/20"
                      )}
                    >
                      <motion.div 
                        animate={{ x: formData.showInExpenseSelector ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-surface-container-lowest rounded-full shadow-sm" 
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-surface-container-low p-3.5 rounded-2xl border border-on-surface/5">
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-0.5">Preinicialización</label>
                      <p className="text-[11px] text-on-surface-variant/70 font-medium">Usar por defecto al cargar movimientos</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isDefaultProject: !formData.isDefaultProject })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative shrink-0 ml-3",
                        formData.isDefaultProject ? "bg-primary" : "bg-on-surface/20"
                      )}
                    >
                      <motion.div 
                        animate={{ x: formData.isDefaultProject ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-surface-container-lowest rounded-full shadow-sm" 
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-surface-container-low p-3.5 rounded-2xl border border-on-surface/5">
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-0.5">Estado del Proyecto</label>
                      <p className="text-[11px] text-on-surface-variant/70 font-medium">Proyecto Activo o Archivados</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: formData.status === 'active' ? 'inactive' : 'active' })}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all border shrink-0 ml-3",
                        formData.status === 'active' 
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" 
                          : "bg-on-surface/10 text-on-surface-variant border-on-surface/15"
                      )}
                    >
                      {formData.status === 'active' ? 'Activo' : 'Inactivo'}
                    </button>
                  </div>

                  <div>
                    <CustomSelect
                      label="Posición en la Home"
                      value={formData.homeOrder}
                      onChange={(val) => setFormData({ ...formData, homeOrder: Number(val) })}
                      options={Array.from({ length: editingProject ? projectsCount : projectsCount + 1 }, (_, i) => i + 1).map(num => ({
                        value: num,
                        label: `${num}ª Posición`
                      }))}
                    />
                  </div>
                </div>
              </form>

              {/* Fixed Footer */}
              <div className="p-6 pt-4 border-t border-on-surface/10 bg-surface-container-lowest shrink-0 flex flex-col gap-2">
                {saveError && (
                  <p className="text-rose-600 text-xs font-bold text-center p-2.5 bg-rose-500/10 rounded-xl uppercase tracking-wider">{saveError}</p>
                )}
                <button 
                  type="submit"
                  form="project-form"
                  disabled={isSaving}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-base shadow-xl shadow-primary/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    editingProject ? 'Guardar Cambios' : 'Crear Proyecto'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-container-lowest w-full max-w-md rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-y-auto border border-on-surface/10"
            >
              <div className="flex justify-between items-center mb-6 gap-3 shrink-0">
                <h2 className="text-xl sm:text-2xl font-extrabold text-on-surface font-headline truncate min-w-0 flex-1">
                  Invitar Colaborador
                </h2>
                <button onClick={() => setIsInviteModalOpen(false)} className="p-2 hover:bg-on-surface/5 rounded-full transition-colors shrink-0 text-on-surface-variant">
                  <X size={24} />
                </button>
              </div>

              <p className="text-on-surface-variant mb-6">
                Ingresa el correo electrónico de la persona que deseas invitar al proyecto <span className="font-bold text-primary">"{selectedProject?.name}"</span>.
              </p>

              <form onSubmit={handleInvite} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3 ml-1">Email del Colaborador</label>
                  <input 
                    type="email" 
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full bg-surface-container-low border border-on-surface/10 rounded-2xl p-4 text-lg font-bold focus:ring-2 focus:ring-primary/20 transition-all text-on-surface outline-none"
                  />
                  {inviteError && (
                    <p className="text-error text-xs font-bold mt-2 ml-1 uppercase tracking-wider">{inviteError}</p>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={isInviting}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:opacity-90 transition-all active:scale-[0.98] mt-4 disabled:opacity-50"
                >
                  {isInviting ? 'Invitando...' : 'Enviar Invitación'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ProjectCardProps {
  project: any;
  isOwner: boolean;
  isDefault?: boolean;
  monthlyTotal?: number;
  membersMap?: Record<string, any>;
  onEdit?: () => void;
  onDelete?: () => void;
  onInvite?: () => void;
  onLeave?: () => void;
  onToggleStatus?: () => void;
  onView: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ 
  project, 
  isOwner, 
  isDefault, 
  monthlyTotal = 0,
  membersMap = {},
  onEdit, 
  onDelete, 
  onInvite, 
  onLeave, 
  onToggleStatus, 
  onView 
}) => {
  const Icon = getProjectIcon(project.icon);
  const isInactive = project.status === 'inactive';
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Collect real member objects
  const projectMemberIds: string[] = useMemo(() => {
    const list: string[] = [];
    if (project.ownerId) list.push(project.ownerId);
    if (Array.isArray(project.memberIds)) {
      project.memberIds.forEach((id: string) => {
        if (!list.includes(id)) list.push(id);
      });
    }
    return list;
  }, [project.ownerId, project.memberIds]);

  const membersList = useMemo(() => {
    return projectMemberIds.map(id => {
      if (membersMap[id]) return membersMap[id];
      if (id === 'personal' || project.isPersonal) return { id, name: 'Personal' };
      return { id, name: 'Usuario' };
    });
  }, [projectMemberIds, membersMap, project.isPersonal]);

  const displayMembers = membersList.slice(0, 3);
  const extraMembersCount = Math.max(0, membersList.length - 3);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-surface-container-lowest rounded-[2rem] p-5 sm:p-7 border border-on-surface/10 shadow-sm hover:shadow-md transition-all group relative",
        isInactive && "opacity-75 bg-surface-container-low/50"
      )}
    >
      <div className="flex justify-between items-start gap-3 mb-5">
        <div className="flex items-start gap-3.5 sm:gap-5 min-w-0 flex-1">
          <div className={cn(
            "w-12 h-12 sm:w-16 sm:h-16 rounded-[18px] sm:rounded-[22px] flex items-center justify-center shrink-0 mt-0.5 shadow-sm",
            isInactive
              ? "bg-on-surface/10 text-on-surface-variant"
              : cn(getProjectGradient(project.cardColor, Boolean(project.isPersonal)), "text-white shadow-md")
          )}>
            <Icon className="w-6 h-6 sm:w-8 sm:h-8" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg sm:text-2xl font-extrabold text-on-surface tracking-tight font-headline group-hover:text-primary transition-colors break-words leading-tight">
              {project.name}
            </h3>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap">
              <span className={cn(
                "text-[10px] font-extrabold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg uppercase tracking-wider shrink-0",
                isOwner ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
              )}>
                {isOwner ? 'PROPIETARIO' : 'COLABORADOR'}
              </span>
              {isInactive && (
                <span className="bg-on-surface/10 text-on-surface-variant text-[10px] font-extrabold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 shrink-0">
                  <Archive size={10} />
                  INACTIVO
                </span>
              )}
              {isDefault && !isInactive && (
                <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-extrabold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 shrink-0">
                  <Star size={10} className="fill-current" />
                  PREDETERMINADO
                </span>
              )}
              <span className="bg-surface-container-high/60 text-on-surface-variant text-[10px] font-black uppercase px-2 py-0.5 rounded-md shrink-0">
                {project.currency || 'ARS'}
              </span>
              <span className="text-on-surface-variant/70 text-xs font-medium flex items-center gap-1 shrink-0">
                <Users size={13} />
                {membersList.length}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Actions Button with Dropdown (prevents squishing title on mobile) */}
        <div className="sm:hidden relative shrink-0">
          <button 
            type="button"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 text-on-surface-variant/60 hover:text-on-surface hover:bg-on-surface/5 rounded-xl transition-all"
            title="Opciones de la bóveda"
          >
            <MoreVertical size={20} />
          </button>

          <AnimatePresence>
            {showMobileMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMobileMenu(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  className="absolute right-0 top-full mt-1 w-52 bg-surface-container-lowest border border-on-surface/10 rounded-2xl shadow-xl z-50 py-1.5 overflow-hidden"
                >
                  {onEdit && (
                    <button 
                      type="button"
                      onClick={() => { setShowMobileMenu(false); onEdit(); }}
                      className="w-full px-4 py-2.5 text-left text-xs font-bold text-on-surface hover:bg-on-surface/5 flex items-center gap-2.5 transition-colors"
                    >
                      <Edit3 size={15} className="text-primary" />
                      Editar Bóveda
                    </button>
                  )}
                  {onInvite && (
                    <button 
                      type="button"
                      onClick={() => { setShowMobileMenu(false); onInvite(); }}
                      className="w-full px-4 py-2.5 text-left text-xs font-bold text-on-surface hover:bg-on-surface/5 flex items-center gap-2.5 transition-colors"
                    >
                      <Share2 size={15} className="text-secondary" />
                      Invitar Colaborador
                    </button>
                  )}
                  {onToggleStatus && (
                    <button 
                      type="button"
                      onClick={() => { setShowMobileMenu(false); onToggleStatus(); }}
                      className="w-full px-4 py-2.5 text-left text-xs font-bold text-on-surface hover:bg-on-surface/5 flex items-center gap-2.5 transition-colors"
                    >
                      <Power size={15} className={isInactive ? "text-emerald-600" : "text-amber-600"} />
                      {isInactive ? "Reactivar Bóveda" : "Inactivar / Archivar"}
                    </button>
                  )}
                  {isOwner && onDelete && (
                    <button 
                      type="button"
                      onClick={() => { setShowMobileMenu(false); onDelete(); }}
                      className="w-full px-4 py-2.5 text-left text-xs font-bold text-rose-600 hover:bg-rose-500/10 flex items-center gap-2.5 border-t border-on-surface/5 transition-colors"
                    >
                      <Trash2 size={15} />
                      Eliminar Bóveda
                    </button>
                  )}
                  {!isOwner && onLeave && (
                    <button 
                      type="button"
                      onClick={() => { setShowMobileMenu(false); onLeave(); }}
                      className="w-full px-4 py-2.5 text-left text-xs font-bold text-rose-600 hover:bg-rose-500/10 flex items-center gap-2.5 border-t border-on-surface/5 transition-colors"
                    >
                      <X size={15} />
                      Salir del Proyecto
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop Actions Bar */}
        <div className="hidden sm:flex items-center gap-1 sm:gap-1.5 shrink-0">
          {onToggleStatus && (
            <button 
              onClick={onToggleStatus}
              className={cn(
                "p-2 sm:p-2.5 rounded-xl transition-all shrink-0",
                isInactive ? "text-emerald-600 hover:bg-emerald-500/10" : "text-on-surface-variant/40 hover:text-on-surface hover:bg-on-surface/5"
              )}
              title={isInactive ? "Reactivar proyecto" : "Inactivar / Archivar proyecto"}
            >
              <Power size={18} className="sm:w-5 sm:h-5" />
            </button>
          )}
          {onInvite && (
            <button 
              onClick={onInvite}
              className="p-2 sm:p-2.5 text-on-surface-variant/40 hover:text-secondary hover:bg-secondary/5 rounded-xl transition-all shrink-0"
              title="Invitar colaborador"
            >
              <Share2 size={18} className="sm:w-5 sm:h-5" />
            </button>
          )}
          {onEdit && (
            <button 
              onClick={onEdit}
              className="p-2 sm:p-2.5 text-on-surface-variant/40 hover:text-primary hover:bg-primary/5 rounded-xl transition-all shrink-0"
              title="Editar proyecto"
            >
              <Edit3 size={18} className="sm:w-5 sm:h-5" />
            </button>
          )}
          {isOwner && onDelete && (
            <button 
              onClick={onDelete}
              className="p-2 sm:p-2.5 text-on-surface-variant/40 hover:text-error hover:bg-error/5 rounded-xl transition-all shrink-0"
              title="Eliminar proyecto"
            >
              <Trash2 size={18} className="sm:w-5 sm:h-5" />
            </button>
          )}
          {!isOwner && onLeave && (
            <button 
              onClick={onLeave}
              className="p-2 sm:p-2.5 text-on-surface-variant/40 hover:text-error hover:bg-error/5 rounded-xl transition-all shrink-0"
              title="Salir del proyecto"
            >
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Footer with Real Member Avatars, Monthly Expense KPI & View Details Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-on-surface/10">
        <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 flex-wrap">
          {/* Real Avatars Stack */}
          <div className="flex -space-x-2.5 overflow-hidden py-0.5">
            {displayMembers.map((m, idx) => (
              <div 
                key={m.id || idx} 
                title={m.name || 'Colaborador'}
                className="w-9 h-9 rounded-full border-2 border-surface-container-lowest bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shadow-xs overflow-hidden shrink-0"
              >
                {m.photoURL ? (
                  <img src={m.photoURL} alt={m.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span>{(m.name || 'U').substring(0, 2).toUpperCase()}</span>
                )}
              </div>
            ))}
            {extraMembersCount > 0 && (
              <div 
                title={`+${extraMembersCount} colaboradores más`}
                className="w-9 h-9 rounded-full border-2 border-surface-container-lowest bg-surface-container-high flex items-center justify-center text-[10px] font-black text-on-surface-variant shadow-xs shrink-0"
              >
                +{extraMembersCount}
              </div>
            )}
          </div>

          {/* Current Month Spending Pill */}
          <div className="bg-surface-container-low px-3 py-1.5 rounded-xl border border-on-surface/5 flex items-center gap-1.5 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60">Mes:</span>
            <span className="font-bold font-mono text-on-surface">
              {formatCurrency(monthlyTotal, project.currency || 'ARS')}
            </span>
          </div>
        </div>

        <button 
          onClick={onView}
          className="w-full sm:w-auto bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-md shadow-primary/20 cursor-pointer"
        >
          <Eye size={16} />
          Ver Detalles
        </button>
      </div>
    </motion.div>
  );
};
