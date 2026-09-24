import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plane, Home, PlusCircle, Share2, Edit3, Trash2, Eye, MoreVertical, Hourglass, Users, X, Wallet, Briefcase, Heart, ShoppingBag, Landmark, Star, Archive, CheckCircle2, Power } from 'lucide-react';
import { formatCurrency, cn } from '@/src/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useData } from '../lib/DataContext';
import { useAuth } from '../lib/AuthContext';
import { createProject, updateProject, deleteProject, removeMemberFromProject, inviteUserToProjectByEmail, updateUserProfile } from '../services/firestoreService';

const PROJECT_ICONS = [
  { id: 'plane', icon: Plane, label: 'Viajes' },
  { id: 'home', icon: Home, label: 'Hogar' },
  { id: 'wallet', icon: Wallet, label: 'Finanzas' },
  { id: 'briefcase', icon: Briefcase, label: 'Trabajo' },
  { id: 'heart', icon: Heart, label: 'Pareja' },
  { id: 'shopping-bag', icon: ShoppingBag, label: 'Compras' },
  { id: 'landmark', icon: Landmark, label: 'Inversiones' },
];

export const SharedProjects: React.FC = () => {
  const navigate = useNavigate();
  const { projects, loading } = useData();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    icon: 'plane', 
    currency: 'ARS',
    showInHome: true,
    showInExpenseSelector: true,
    status: 'active' as 'active' | 'inactive',
    homeOrder: 1,
    isDefaultProject: false
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [saveError, setSaveError] = useState('');

  const myProjects = useMemo(() => projects.filter(p => p.ownerId === user?.uid).map(p => ({
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
    memberIds: [user?.uid],
    ownerId: user?.uid,
    currency: profile?.currency || 'ARS'
  }), [profile, user]);

  const allMyManageable = useMemo(() => [personalProject, ...myProjects], [personalProject, myProjects]);
  const sharedWithMe = useMemo(() => projects.filter(p => p.ownerId !== user?.uid).map(p => ({
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
        isDefaultProject: currentDefault === project.id
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
        isDefaultProject: false
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
            personalShowInHome: formData.showInHome,
            personalShowInExpenseSelector: formData.showInExpenseSelector,
            personalStatus: formData.status,
            personalHomeOrder: formData.homeOrder,
            ...(isDefaultProject ? { defaultProjectId: 'personal' } : {})
          });
        } else {
          await updateProject(editingProject.id, projectFields);
          if (isDefaultProject) {
            await updateUserProfile(user!.uid, { defaultProjectId: editingProject.id });
          } else if (profile?.defaultProjectId === editingProject.id) {
            await updateUserProfile(user!.uid, { defaultProjectId: 'personal' });
          }
        }
      } else {
        const docRef = await createProject(projectFields);
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
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-black/40 font-bold text-xs uppercase tracking-widest">Cargando proyectos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 max-w-5xl mx-auto py-8 pb-32">
      {/* Section Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[0.75rem] font-bold uppercase tracking-[0.1em] text-on-surface-variant/60 mb-2 block">Colaboración</span>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface font-headline">Bóvedas Compartidas</h1>
          <p className="text-on-surface-variant mt-2 max-w-md">Administra tus espacios compartidos, invita a colaboradores y controla los gastos en conjunto.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary hover:opacity-90 text-white px-6 py-3.5 rounded-2xl flex items-center gap-2 transition-all active:scale-95 shadow-xl shadow-primary/10"
        >
          <PlusCircle size={20} />
          <span className="font-bold">Crear Nuevo Proyecto</span>
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex bg-surface-container-low p-1.5 rounded-2xl border border-on-surface/5 mb-8 max-w-md">
        <button
          onClick={() => setActiveTab('active')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
            activeTab === 'active' ? "bg-white text-primary shadow-sm" : "text-on-surface-variant/40 hover:text-on-surface-variant"
          )}
        >
          <CheckCircle2 size={16} />
          Activos ({activeMyProjects.length + activeSharedWithMe.length})
        </button>
        <button
          onClick={() => setActiveTab('inactive')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
            activeTab === 'inactive' ? "bg-white text-slate-700 shadow-sm" : "text-on-surface-variant/40 hover:text-on-surface-variant"
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
            <div className="bg-white/50 border-2 border-dashed border-black/5 rounded-3xl p-12 text-center">
              <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4">
                {activeTab === 'active' ? <PlusCircle size={32} className="text-black/20" /> : <Archive size={32} className="text-black/20" />}
              </div>
              <p className="text-black/40 font-medium">
                {activeTab === 'active' ? 'No tienes proyectos creados activos.' : 'No tienes proyectos inactivos o archivados.'}
              </p>
            </div>
          ) : (
            (activeTab === 'active' ? activeMyProjects : inactiveMyProjects).map((project) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                isOwner={true}
                isDefault={(profile?.defaultProjectId || 'personal') === project.id}
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
            <div className="bg-white/50 border-2 border-dashed border-black/5 rounded-3xl p-12 text-center">
              <p className="text-black/40 font-medium">
                {activeTab === 'active' ? 'No tienes proyectos compartidos activos.' : 'No tienes proyectos compartidos inactivos.'}
              </p>
            </div>
          ) : (
            (activeTab === 'active' ? activeSharedWithMe : inactiveSharedWithMe).map((project) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                isOwner={false}
                isDefault={(profile?.defaultProjectId || 'personal') === project.id}
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
            className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm"
          >
            <h4 className="text-sm font-extrabold text-on-surface uppercase tracking-widest mb-6">Invitaciones</h4>
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <Hourglass size={32} className="text-black/10 mb-2" />
                <p className="text-xs text-black/40 font-medium">No tienes invitaciones pendientes</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-extrabold text-on-surface font-headline">
                  {editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {!editingProject?.isPersonal && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-black/40 uppercase tracking-widest mb-3 ml-1">Nombre del Proyecto</label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ej: Viaje a Córdoba, Gastos Casa..."
                        className="w-full bg-[#F2F2F7] border-none rounded-2xl p-4 text-lg font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-black/40 uppercase tracking-widest mb-3 ml-1">Preferencia de Moneda</label>
                      <select 
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        className="w-full bg-[#F2F2F7] border-none rounded-2xl p-4 text-lg font-bold focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                      >
                        <option value="ARS">Peso Argentino (ARS)</option>
                        <option value="USD">Dólar (USD)</option>
                        <option value="EUR">Euro (EUR)</option>
                        <option value="BRL">Real (BRL)</option>
                        <option value="CLP">Peso Chileno (CLP)</option>
                        <option value="UYU">Peso Uruguayo (UYU)</option>
                        <option value="COP">Peso Colombiano (COP)</option>
                        <option value="MXN">Peso Mexicano (MXN)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-black/40 uppercase tracking-widest mb-3 ml-1">Icono</label>
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
                                : "bg-[#F2F2F7] border-transparent text-black/40 hover:bg-black/5"
                            )}
                          >
                            <item.icon size={24} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Display configuration (Always visible) */}
                <div className="pt-4 mt-4 border-t border-black/5 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-black/40 uppercase tracking-widest mb-1 ml-1">Visibilidad en la Home</label>
                      <p className="text-xs text-black/40 ml-1">Mostrar tarjeta en la pantalla principal</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, showInHome: !formData.showInHome })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        formData.showInHome ? "bg-primary" : "bg-black/10"
                      )}
                    >
                      <motion.div 
                        animate={{ x: formData.showInHome ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-black/40 uppercase tracking-widest mb-1 ml-1">Visibilidad al Cargar Gastos</label>
                      <p className="text-xs text-black/40 ml-1">Mostrar en selector al registrar un movimiento</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, showInExpenseSelector: !formData.showInExpenseSelector })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        formData.showInExpenseSelector ? "bg-primary" : "bg-black/10"
                      )}
                    >
                      <motion.div 
                        animate={{ x: formData.showInExpenseSelector ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-black/40 uppercase tracking-widest mb-1 ml-1">Preinicialización</label>
                      <p className="text-xs text-black/40 ml-1">Usar por defecto al cargar gastos</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isDefaultProject: !formData.isDefaultProject })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        formData.isDefaultProject ? "bg-primary" : "bg-black/10"
                      )}
                    >
                      <motion.div 
                        animate={{ x: formData.isDefaultProject ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-black/40 uppercase tracking-widest mb-1 ml-1">Estado del Proyecto</label>
                      <p className="text-xs text-black/40 ml-1">Proyecto Activo o Inactivo (Archivado)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: formData.status === 'active' ? 'inactive' : 'active' })}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all border",
                        formData.status === 'active' 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      )}
                    >
                      {formData.status === 'active' ? 'Activo' : 'Inactivo'}
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-black/40 uppercase tracking-widest mb-3 ml-1">Posición en la Home</label>
                    <select 
                      value={formData.homeOrder}
                      onChange={(e) => setFormData({ ...formData, homeOrder: parseInt(e.target.value) })}
                      className="w-full bg-[#F2F2F7] border-none rounded-2xl p-4 text-lg font-bold focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                    >
                      {Array.from({ length: editingProject ? projectsCount : projectsCount + 1 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>{num}ª Posición</option>
                      ))}
                    </select>
                  </div>
                </div>

                {saveError && (
                  <p className="text-error text-xs font-bold text-center mt-2 p-3 bg-error/10 rounded-xl uppercase tracking-wider">{saveError}</p>
                )}

                <button 
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:opacity-90 transition-all active:scale-[0.98] mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
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
              </form>
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
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-extrabold text-on-surface font-headline">
                  Invitar Colaborador
                </h2>
                <button onClick={() => setIsInviteModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <p className="text-on-surface-variant mb-6">
                Ingresa el correo electrónico de la persona que deseas invitar al proyecto <span className="font-bold text-primary">"{selectedProject?.name}"</span>.
              </p>

              <form onSubmit={handleInvite} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-black/40 uppercase tracking-widest mb-3 ml-1">Email del Colaborador</label>
                  <input 
                    type="email" 
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full bg-[#F2F2F7] border-none rounded-2xl p-4 text-lg font-bold focus:ring-2 focus:ring-primary/20 transition-all"
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
  onEdit?: () => void;
  onDelete?: () => void;
  onInvite?: () => void;
  onLeave?: () => void;
  onToggleStatus?: () => void;
  onView: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, isOwner, isDefault, onEdit, onDelete, onInvite, onLeave, onToggleStatus, onView }) => {
  const Icon = PROJECT_ICONS.find(i => i.id === project.icon)?.icon || Plane;
  const isInactive = project.status === 'inactive';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white rounded-[2rem] p-8 border border-black/5 shadow-sm hover:shadow-md transition-all group",
        isInactive && "opacity-75 bg-slate-50/50"
      )}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-5">
          <div className={cn(
            "w-16 h-16 rounded-[22px] flex items-center justify-center",
            isInactive ? "bg-slate-200 text-slate-500" : isOwner ? "bg-primary/5 text-primary" : "bg-secondary/5 text-secondary"
          )}>
            <Icon size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-on-surface tracking-tight font-headline group-hover:text-primary transition-colors">{project.name}</h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={cn(
                "text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider",
                isOwner ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
              )}>
                {isOwner ? 'PROPIETARIO' : 'COLABORADOR'}
              </span>
              {isInactive && (
                <span className="bg-slate-200 text-slate-700 text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
                  <Archive size={10} />
                  INACTIVO
                </span>
              )}
              {isDefault && !isInactive && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
                  <Star size={10} className="fill-amber-800" />
                  PREDETERMINADO
                </span>
              )}
              <span className="text-black/40 text-sm font-medium flex items-center gap-1.5 ml-1">
                <Users size={14} />
                {project.memberIds?.length || 1} colaboradores
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {onToggleStatus && (
            <button 
              onClick={onToggleStatus}
              className={cn(
                "p-2.5 rounded-xl transition-all",
                isInactive ? "text-emerald-600 hover:bg-emerald-50" : "text-black/20 hover:text-slate-600 hover:bg-black/5"
              )}
              title={isInactive ? "Reactivar proyecto" : "Inactivar / Archivar proyecto"}
            >
              <Power size={20} />
            </button>
          )}
          {isOwner ? (
            <>
              <button 
                onClick={onInvite}
                className="p-2.5 text-black/20 hover:text-secondary hover:bg-secondary/5 rounded-xl transition-all"
                title="Invitar colaborador"
              >
                <Share2 size={20} />
              </button>
              <button 
                onClick={onEdit}
                className="p-2.5 text-black/20 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
              >
                <Edit3 size={20} />
              </button>
              <button 
                onClick={onDelete}
                className="p-2.5 text-black/20 hover:text-error hover:bg-error/5 rounded-xl transition-all"
              >
                <Trash2 size={20} />
              </button>
            </>
          ) : (
            <button 
              onClick={onLeave}
              className="p-2.5 text-black/20 hover:text-error hover:bg-error/5 rounded-xl transition-all"
              title="Salir del proyecto"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-black/5">
        <div className="flex -space-x-3">
          {/* Mock avatars for now, in a real app these would be member profile pics */}
          <div className="w-10 h-10 rounded-full border-4 border-white bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">U1</div>
          {project.memberIds?.length > 1 && (
            <div className="w-10 h-10 rounded-full border-4 border-white bg-secondary/10 flex items-center justify-center text-[10px] font-bold text-secondary">U2</div>
          )}
        </div>
        <button 
          onClick={onView}
          className="bg-black text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all active:scale-95"
        >
          <Eye size={18} />
          Ver Detalles
        </button>
      </div>
    </motion.div>
  );
};
