'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaces } from '@/contexts/WorkspaceContext';
import { createClient } from '@/utils/supabase/client';
import { Search, Plus, Trash2, CheckCircle, Clock3, AlertCircle, X, FileText, Calendar, Building, Link as LinkIcon, HelpCircle } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export interface MedicalOrder {
  id: string;
  workspaceId: string;
  examType: string;
  institution: string;
  requiredAuthorization: boolean;
  hasAuthorization: boolean;
  expirationDate: string | null;
  attachmentUrl: string | null;
  fileHash?: string | null;
  status: 'pending' | 'completed' | 'expired';
  notes: string | null;
}

const MOCK_ORDERS: MedicalOrder[] = [
  {
    id: 'order-1',
    workspaceId: 'family-workspace-id',
    examType: 'Examen de Sangre Perfil Bioquímico',
    institution: 'Laboratorio Clínico San Lorenzo',
    requiredAuthorization: true,
    hasAuthorization: false,
    expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString().split('T')[0], // 5 days from now
    attachmentUrl: 'https://placeholder-document-link.pdf',
    status: 'pending',
    notes: 'Requiere ayuno de 8 horas. No tomar café antes del examen.',
  },
  {
    id: 'order-2',
    workspaceId: 'family-workspace-id',
    examType: 'Resonancia Magnética de Columna Lumbar',
    institution: 'Centro de Diagnóstico Imago',
    requiredAuthorization: true,
    hasAuthorization: true,
    expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().split('T')[0], // 30 days from now
    attachmentUrl: null,
    status: 'pending',
    notes: 'Ya cuenta con orden autorizada por la aseguradora. Traer CD de examen previo.',
  },
  {
    id: 'order-3',
    workspaceId: 'family-workspace-id',
    examType: 'Radiografía de Tórax AP',
    institution: 'Hospital del Salvador',
    requiredAuthorization: false,
    hasAuthorization: false,
    expirationDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString().split('T')[0], // Expired 15 days ago
    attachmentUrl: null,
    status: 'expired',
    notes: 'Venció el plazo de 30 días para realizarlo sin nueva orden.',
  }
];

export const OrderModule: React.FC = () => {
  const { user, isDemoMode } = useAuth();
  const { activeWorkspace } = useWorkspaces();
  const supabase = createClient();

  const [orders, setOrders] = useState<MedicalOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'expired'>('all');

  // New Order Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [examType, setExamType] = useState('');
  const [institution, setInstitution] = useState('');
  const [requiredAuth, setRequiredAuth] = useState(false);
  const [hasAuth, setHasAuth] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Deletion Confirmation State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Fetch orders
  useEffect(() => {
    if (!activeWorkspace) return;

    if (isDemoMode) {
      const saved = localStorage.getItem('demo_orders');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as MedicalOrder[];
          setOrders(parsed.filter(o => o.workspaceId === activeWorkspace.id));
        } catch (e) {
          console.error(e);
        }
      } else {
        localStorage.setItem('demo_orders', JSON.stringify(MOCK_ORDERS));
        setOrders(MOCK_ORDERS.filter(o => o.workspaceId === activeWorkspace.id));
      }
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('medical_orders')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .order('expiration_date', { ascending: true });

        if (error) throw error;

        const mapped: MedicalOrder[] = (data || []).map((o: any) => ({
          id: o.id,
          workspaceId: o.workspace_id,
          examType: o.exam_type,
          institution: o.institution,
          requiredAuthorization: o.required_authorization,
          hasAuthorization: o.has_authorization,
          expirationDate: o.expiration_date,
          attachmentUrl: o.attachment_url,
          fileHash: o.file_hash,
          status: o.status,
          notes: o.notes,
        }));

        setOrders(mapped);
      } catch (err) {
        console.error('Error fetching medical orders:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [activeWorkspace, isDemoMode]);

  const saveOrdersState = (updatedList: MedicalOrder[]) => {
    if (isDemoMode) {
      const saved = localStorage.getItem('demo_orders');
      let fullList: MedicalOrder[] = [];
      if (saved) {
        try {
          fullList = JSON.parse(saved) as MedicalOrder[];
        } catch (e) {
          fullList = MOCK_ORDERS;
        }
      }
      const otherWorkspaces = fullList.filter(o => o.workspaceId !== activeWorkspace?.id);
      const merged = [...otherWorkspaces, ...updatedList];
      localStorage.setItem('demo_orders', JSON.stringify(merged));
    }
    setOrders(updatedList);
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examType.trim() || !institution.trim() || !activeWorkspace) return;

    setFormError(null);
    const dateStr = expirationDate ? expirationDate : null;

    // Check if newly created is already expired
    let initialStatus: MedicalOrder['status'] = 'pending';
    if (dateStr && new Date(dateStr).getTime() < new Date().setHours(0, 0, 0, 0)) {
      initialStatus = 'expired';
    }

    if (isDemoMode) {
      const newOrder: MedicalOrder = {
        id: `order-demo-${Date.now()}`,
        workspaceId: activeWorkspace.id,
        examType,
        institution,
        requiredAuthorization: requiredAuth,
        hasAuthorization: requiredAuth ? hasAuth : false,
        expirationDate: dateStr,
        attachmentUrl: attachmentUrl.trim() || null,
        status: initialStatus,
        notes: notes.trim() || null,
      };

      const updated = [newOrder, ...orders];
      saveOrdersState(updated);
      resetForm();
      setIsFormOpen(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('medical_orders')
        .insert({
          workspace_id: activeWorkspace.id,
          exam_type: examType,
          institution,
          required_authorization: requiredAuth,
          has_authorization: requiredAuth ? hasAuth : false,
          expiration_date: dateStr,
          attachment_url: attachmentUrl.trim() || null,
          status: initialStatus,
          notes: notes.trim() || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newOrder: MedicalOrder = {
        id: data.id,
        workspaceId: data.workspace_id,
        examType: data.exam_type,
        institution: data.institution,
        requiredAuthorization: data.required_authorization,
        hasAuthorization: data.has_authorization,
        expirationDate: data.expiration_date,
        attachmentUrl: data.attachment_url,
        status: data.status,
        notes: data.notes,
      };

      setOrders([newOrder, ...orders]);
      resetForm();
      setIsFormOpen(false);
    } catch (err: any) {
      console.error('Error creating medical order:', err);
      setFormError(err.message || 'Error al guardar la orden.');
    }
  };

  const handleToggleStatus = async (order: MedicalOrder) => {
    let newStatus: MedicalOrder['status'] = 'pending';
    if (order.status === 'pending' || order.status === 'expired') {
      newStatus = 'completed';
    } else {
      // Revert to pending, but check if now expired
      const isExpiredNow = order.expirationDate && new Date(order.expirationDate).getTime() < new Date().setHours(0, 0, 0, 0);
      newStatus = isExpiredNow ? 'expired' : 'pending';
    }

    if (isDemoMode) {
      const updated = orders.map(o => o.id === order.id ? { ...o, status: newStatus } : o);
      saveOrdersState(updated);
      return;
    }

    try {
      const { error } = await supabase
        .from('medical_orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) throw error;

      setOrders(orders.map(o => o.id === order.id ? { ...o, status: newStatus } : o));
    } catch (err) {
      console.error('Error toggling order status:', err);
    }
  };

  const handleToggleAuth = async (order: MedicalOrder) => {
    const newAuth = !order.hasAuthorization;

    if (isDemoMode) {
      const updated = orders.map(o => o.id === order.id ? { ...o, hasAuthorization: newAuth } : o);
      saveOrdersState(updated);
      return;
    }

    try {
      const { error } = await supabase
        .from('medical_orders')
        .update({ has_authorization: newAuth })
        .eq('id', order.id);

      if (error) throw error;

      setOrders(orders.map(o => o.id === order.id ? { ...o, hasAuthorization: newAuth } : o));
    } catch (err) {
      console.error('Error toggling order authorization:', err);
    }
  };

  const handleDeleteOrder = async () => {
    if (!deleteTargetId) return;

    if (isDemoMode) {
      const updated = orders.filter(o => o.id !== deleteTargetId);
      saveOrdersState(updated);
      setDeleteTargetId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('medical_orders')
        .delete()
        .eq('id', deleteTargetId);

      if (error) throw error;

      setOrders(orders.filter(o => o.id !== deleteTargetId));
      setDeleteTargetId(null);
    } catch (err) {
      console.error('Error deleting medical order:', err);
    }
  };

  const handleDownloadAttachment = async (path: string) => {
    if (path.startsWith('http') || path.startsWith('blob:')) {
      window.open(path, '_blank');
      return;
    }

    if (isDemoMode) {
      alert('Las visualizaciones de documentos reales no están disponibles en Modo Demo.');
      return;
    }

    try {
      // Generate a 5-minute signed URL
      const { data, error } = await supabase
        .storage
        .from('medical-documents')
        .createSignedUrl(path, 300);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      console.error('Error generating signed URL:', err);
      alert('No se pudo acceder al documento. Asegúrate de tener permisos suficientes.');
    }
  };

  const resetForm = () => {
    setExamType('');
    setInstitution('');
    setRequiredAuth(false);
    setHasAuth(false);
    setExpirationDate('');
    setAttachmentUrl('');
    setNotes('');
    setFormError(null);
  };

  const filteredOrders = orders.map(order => {
    // Dynamically update expired status for pending orders if date passed
    if (order.status === 'pending' && order.expirationDate) {
      const exp = new Date(order.expirationDate + 'T23:59:59').getTime();
      if (exp < Date.now()) {
        return { ...order, status: 'expired' as const };
      }
    }
    return order;
  }).filter(order => {
    const matchesSearch = 
      order.examType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.institution.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.notes && order.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = 
      statusFilter === 'all' || 
      order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No expira';
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const dateObj = new Date(dateStr + 'T12:00:00'); // avoids timezone shifting
    return dateObj.toLocaleDateString('es-ES', options);
  };

  return (
    <div className="space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar exámenes o laboratorios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Status filter */}
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'pending' ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Realizados
            </button>
            <button
              onClick={() => setStatusFilter('expired')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === 'expired' ? 'bg-rose-50 text-rose-700' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Vencidos
            </button>
          </div>

          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-indigo-soft transition-colors w-full sm:w-auto shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nueva Orden
          </button>
        </div>
      </div>

      {/* Main Listing Area */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-sm text-slate-500">Cargando órdenes médicas...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center max-w-lg mx-auto shadow-sm">
          <div className="p-4 bg-slate-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <FileText className="h-8 w-8 text-slate-400" />
          </div>
          <h4 className="text-base font-bold text-slate-900">No se encontraron órdenes</h4>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            {searchTerm || statusFilter !== 'all'
              ? 'No hay órdenes registradas que coincidan con los filtros aplicados.'
              : 'Registra las órdenes médicas, autorizaciones, recetas o exámenes preventivos de tu familia para controlar sus vencimientos.'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-colors"
            >
              <Plus className="h-4 w-4" />
              Registrar Primera Orden
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map((order) => {
            const isPending = order.status === 'pending';
            const isExpired = order.status === 'expired';
            const isCompleted = order.status === 'completed';

            // Calculate days remaining to highlight upcoming expirations
            let daysRemaining: number | null = null;
            if (order.expirationDate && isPending) {
              const diffTime = new Date(order.expirationDate + 'T23:59:59').getTime() - Date.now();
              daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 shadow-soft p-5 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {/* Authorization Status Badge */}
                    {order.requiredAuthorization ? (
                      order.hasAuthorization ? (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded-full text-xs font-semibold">
                          Autorizada
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-150 rounded-full text-xs font-semibold">
                          Falta Autorizar
                        </span>
                      )
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-50 text-slate-500 border border-slate-200 rounded-full text-xs font-semibold">
                        No requiere Aut.
                      </span>
                    )}

                    {/* Expiration Status Badge */}
                    {isCompleted ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                        <CheckCircle className="h-3 w-3" />
                        Realizado
                      </span>
                    ) : isExpired ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-semibold">
                        <AlertCircle className="h-3 w-3" />
                        Vencida
                      </span>
                    ) : daysRemaining !== null && daysRemaining <= 7 ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-150 rounded-full text-xs font-semibold animate-pulse">
                        <Clock3 className="h-3 w-3 animate-spin duration-3000" />
                        Vence en {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-150 rounded-full text-xs font-semibold">
                        <Clock3 className="h-3 w-3" />
                        Vigente
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-2 leading-snug">
                    {order.examType}
                  </h3>

                  <div className="space-y-2 text-sm text-slate-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{order.institution}</span>
                    </div>
                    {order.expirationDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>Vence: <strong className={isExpired ? 'text-rose-600' : ''}>{formatDate(order.expirationDate)}</strong></span>
                      </div>
                    )}
                    {order.attachmentUrl && (
                      <div className="flex items-center gap-2 pt-1">
                        <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                        <button
                          onClick={() => handleDownloadAttachment(order.attachmentUrl!)}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline font-bold text-xs"
                        >
                          Ver orden original digitalizada
                        </button>
                      </div>
                    )}
                    {order.notes && (
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <p className="text-xs text-slate-500 italic">"{order.notes}"</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(order)}
                      className={`text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
                        isCompleted
                          ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isCompleted ? 'Marcar Pendiente' : 'Marcar Realizado'}
                    </button>

                    {order.requiredAuthorization && !isCompleted && (
                      <button
                        onClick={() => handleToggleAuth(order)}
                        className={`text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
                          order.hasAuthorization
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {order.hasAuthorization ? 'Quitar Autorización' : 'Autorizar'}
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setDeleteTargetId(order.id)}
                    className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                    title="Eliminar orden"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* NEW ORDER FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <form
            onSubmit={handleAddOrder}
            className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-soft border border-slate-100 z-10 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Registrar Nueva Orden Médica</h3>
              <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Examen / Estudio Requerido</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Resonancia de Cerebro, Perfil Lipídico"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Centro Médico / Institución</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Laboratorio Clínico San Lorenzo"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-600">Requiere Aut.</span>
                  <input
                    type="checkbox"
                    checked={requiredAuth}
                    onChange={(e) => {
                      setRequiredAuth(e.target.checked);
                      if (!e.target.checked) setHasAuth(false);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                {requiredAuth && (
                  <div className="flex items-center justify-between p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-150 animate-in slide-in-from-top-2 duration-150">
                    <span className="text-xs font-bold text-emerald-800">¿Autorizada?</span>
                    <input
                      type="checkbox"
                      checked={hasAuth}
                      onChange={(e) => setHasAuth(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Vencimiento (Opcional)</label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">URL o Ruta del Adjunto (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej. id_workspace/nombre_archivo.pdf"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notas / Indicaciones (Opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Ej. Requiere ayuno de 8 horas. Retirar resultados en 3 días."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
              >
                Guardar Orden
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRM DELETION MODAL */}
      <ConfirmModal
        isOpen={deleteTargetId !== null}
        title="¿Eliminar orden médica?"
        message="¿Estás seguro de que deseas eliminar esta orden médica? Esta acción es irreversible y tu grupo familiar perderá acceso a la información de esta orden."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleDeleteOrder}
        onCancel={() => setDeleteTargetId(null)}
        variant="danger"
      />
    </div>
  );
};
