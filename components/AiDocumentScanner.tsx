'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaces } from '@/contexts/WorkspaceContext';
import { createClient } from '@/utils/supabase/client';
import { X, Upload, Sparkles, AlertCircle, Check, HelpCircle, Edit2, Calendar, Clock, MapPin, Building, Pill, FileText } from 'lucide-react';
import { Appointment } from './AppointmentModule';
import { MedicalOrder } from './OrderModule';
import { Medication } from './MedicationModule';

interface AiDocumentScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (type: 'appointment' | 'order' | 'medication') => void;
}

export const AiDocumentScanner: React.FC<AiDocumentScannerProps> = ({ isOpen, onClose, onSaveSuccess }) => {
  const { user, isDemoMode } = useAuth();
  const { activeWorkspace } = useWorkspaces();
  const supabase = createClient();

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Scanned / Preview states
  const [scannedData, setScannedData] = useState<any | null>(null);
  const [detectedType, setDetectedType] = useState<'appointment' | 'order' | 'medication' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit states for Human-in-the-loop preview
  const [apptDoctor, setApptDoctor] = useState('');
  const [apptSpecialty, setApptSpecialty] = useState('');
  const [apptLocation, setApptLocation] = useState('');
  const [apptDate, setApptDate] = useState('');
  const [apptTime, setApptTime] = useState('');
  const [apptNotes, setApptNotes] = useState('');

  const [orderExam, setOrderExam] = useState('');
  const [orderInst, setOrderInst] = useState('');
  const [orderReqAuth, setOrderRequiredAuth] = useState(false);
  const [orderHasAuth, setOrderHasAuth] = useState(false);
  const [orderExpDate, setOrderExpDate] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFrequency] = useState('');
  const [medStart, setMedStartDate] = useState('');
  const [medEnd, setMedEndDate] = useState('');
  const [medStock, setMedStock] = useState('');
  const [medAlert, setMedAlert] = useState('');
  const [medNotes, setMedNotes] = useState('');

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (selectedFile: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Formato de archivo inválido. Sube una foto (JPG, PNG, WEBP) o un documento PDF.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    startScanning(selectedFile);
  };

  const startScanning = async (targetFile: File) => {
    setScanning(true);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(targetFile);
      reader.onloadend = async () => {
        const base64Str = reader.result as string;
        
        // Post to our API route
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: base64Str,
            fileName: targetFile.name,
            fileType: targetFile.type
          }),
        });

        const json = await res.json();
        
        if (!res.ok) {
          throw new Error(json.error || 'Error al escanear con la Inteligencia Artificial.');
        }

        if (json.success && json.data) {
          populateVerificationFields(json.data);
        } else {
          throw new Error('No se pudo extraer información estructurada del documento.');
        }
      };
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error del servidor al procesar el archivo.');
      setScanning(false);
    }
  };

  const populateVerificationFields = (extracted: any) => {
    const type = extracted.type;
    setDetectedType(type);
    setScannedData(extracted);

    if (type === 'appointment' && extracted.appointment) {
      const appt = extracted.appointment;
      setApptDoctor(appt.doctorName || '');
      setApptSpecialty(appt.specialty || '');
      setApptLocation(appt.location || '');
      
      if (appt.dateTime) {
        const dt = new Date(appt.dateTime);
        if (!isNaN(dt.getTime())) {
          setApptDate(dt.toISOString().split('T')[0]);
          setApptTime(dt.toTimeString().split(' ')[0].substring(0, 5));
        }
      }
      setApptNotes(appt.notes || '');
    } else if (type === 'order' && extracted.order) {
      const order = extracted.order;
      setOrderExam(order.examType || '');
      setOrderInst(order.institution || '');
      setOrderRequiredAuth(order.requiredAuthorization || false);
      setOrderHasAuth(false);
      setOrderExpDate(order.expirationDate || '');
      setOrderNotes(order.notes || '');
    } else if (type === 'medication' && extracted.medication) {
      const med = extracted.medication;
      setMedName(med.name || '');
      setMedDosage(med.dosage || '');
      setMedFrequency(med.frequency || '');
      setMedStartDate(med.startDate || new Date().toISOString().split('T')[0]);
      setMedEndDate(med.endDate || '');
      setMedStock(med.stockQuantity !== undefined ? String(med.stockQuantity) : '30');
      setMedAlert(med.lowStockAlert !== undefined ? String(med.lowStockAlert) : '7');
      setMedNotes(med.notes || '');
    }

    setScanning(false);
  };

  const handleSaveConfirmed = async () => {
    if (!activeWorkspace) return;
    setError(null);

    try {
      if (detectedType === 'appointment') {
        const dateTimeStr = new Date(`${apptDate}T${apptTime}`).toISOString();
        
        if (isDemoMode) {
          const saved = localStorage.getItem('demo_appointments');
          const list: Appointment[] = saved ? JSON.parse(saved) : [];
          
          const newAppt: Appointment = {
            id: `appt-scan-${Date.now()}`,
            workspaceId: activeWorkspace.id,
            doctorName: apptDoctor,
            specialty: apptSpecialty,
            location: apptLocation || null,
            dateTime: dateTimeStr,
            status: 'pending',
            notes: apptNotes || null,
          };
          
          localStorage.setItem('demo_appointments', JSON.stringify([newAppt, ...list]));
        } else {
          const { error: dbErr } = await supabase.from('appointments').insert({
            workspace_id: activeWorkspace.id,
            doctor_name: apptDoctor,
            specialty: apptSpecialty,
            location: apptLocation || null,
            date_time: dateTimeStr,
            status: 'pending',
            notes: apptNotes || null,
            created_by: user?.id,
          });
          if (dbErr) throw dbErr;
        }
      } 
      
      else if (detectedType === 'order') {
        if (isDemoMode) {
          const saved = localStorage.getItem('demo_orders');
          const list: MedicalOrder[] = saved ? JSON.parse(saved) : [];
          
          const newOrder: MedicalOrder = {
            id: `order-scan-${Date.now()}`,
            workspaceId: activeWorkspace.id,
            examType: orderExam,
            institution: orderInst,
            requiredAuthorization: orderReqAuth,
            hasAuthorization: orderReqAuth ? orderHasAuth : false,
            expirationDate: orderExpDate || null,
            attachmentUrl: null,
            status: 'pending',
            notes: orderNotes || null,
          };
          
          localStorage.setItem('demo_orders', JSON.stringify([newOrder, ...list]));
        } else {
          const { error: dbErr } = await supabase.from('medical_orders').insert({
            workspace_id: activeWorkspace.id,
            exam_type: orderExam,
            institution: orderInst,
            required_authorization: orderReqAuth,
            has_authorization: orderReqAuth ? orderHasAuth : false,
            expiration_date: orderExpDate || null,
            attachment_url: null,
            status: 'pending',
            notes: orderNotes || null,
            created_by: user?.id,
          });
          if (dbErr) throw dbErr;
        }
      } 
      
      else if (detectedType === 'medication') {
        const stockVal = medStock !== '' ? parseInt(medStock) : null;
        const alertVal = medAlert !== '' ? parseInt(medAlert) : null;

        if (isDemoMode) {
          const saved = localStorage.getItem('demo_medications');
          const list: Medication[] = saved ? JSON.parse(saved) : [];
          
          const newMed: Medication = {
            id: `med-scan-${Date.now()}`,
            workspaceId: activeWorkspace.id,
            name: medName,
            dosage: medDosage,
            frequency: medFreq,
            startDate: medStart,
            endDate: medEnd || null,
            stockQuantity: stockVal,
            lowStockAlert: alertVal,
            status: 'active',
            notes: medNotes || null,
          };
          
          localStorage.setItem('demo_medications', JSON.stringify([newMed, ...list]));
        } else {
          const { error: dbErr } = await supabase.from('medications').insert({
            workspace_id: activeWorkspace.id,
            name: medName,
            dosage: medDosage,
            frequency: medFreq,
            start_date: medStart,
            end_date: medEnd || null,
            stock_quantity: stockVal,
            low_stock_alert: alertVal,
            status: 'active',
            notes: medNotes || null,
            created_by: user?.id,
          });
          if (dbErr) throw dbErr;
        }
      }

      onSaveSuccess(detectedType!);
      handleClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al registrar la información escaneada.');
    }
  };

  const handleClose = () => {
    setFile(null);
    setScanning(false);
    setScannedData(null);
    setDetectedType(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl max-w-xl w-full p-6 shadow-soft border border-slate-100 z-10 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-indigo-500 to-blue-500 rounded-xl text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Escáner de Documentos IA</h3>
              <p className="text-xs text-slate-500">Analiza recetas u órdenes médicas en un instante con Gemini AI</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 p-3.5 rounded-xl border border-rose-200 flex items-start gap-2">
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: DROPZONE (Before Scan) */}
        {!scanning && !scannedData && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center ${
              dragActive 
                ? 'border-indigo-500 bg-indigo-50/50' 
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-4 border border-indigo-100/50">
              <Upload className="h-8 w-8" />
            </div>
            <h4 className="text-base font-bold text-slate-800">Sube una receta u orden médica</h4>
            <p className="mt-2 text-xs text-slate-500 max-w-sm leading-relaxed">
              Arrastra y suelta tu archivo aquí, o haz clic para buscar.
              Soporta fotos de celular (PNG, JPG, WEBP) o documentos en PDF.
            </p>
          </div>
        )}

        {/* STEP 2: SCANNING PROGRESS */}
        {scanning && (
          <div className="py-14 text-center">
            <div className="relative w-16 h-16 mx-auto mb-6">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-pulse" />
              {/* Inner spin */}
              <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
              <Sparkles className="absolute inset-4 h-8 w-8 text-indigo-600 animate-pulse" />
            </div>
            <h4 className="text-base font-bold text-slate-800 animate-pulse">Analizando documento con Gemini IA...</h4>
            <p className="mt-2 text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Estamos aplicando reconocimiento de texto OCR y extrayendo los datos médicos relevantes para cargarlos automáticamente.
            </p>
          </div>
        )}

        {/* STEP 3: PREVIEW & HUMAN-IN-THE-LOOP VERIFICATION */}
        {scannedData && detectedType && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
                <span className="text-xs font-bold text-indigo-700">
                  ¡Extracción completada! Documento clasificado como:
                </span>
              </div>
              <span className="px-2.5 py-0.5 bg-indigo-600 text-white font-bold rounded-lg uppercase text-[10px]">
                {detectedType === 'appointment' ? 'Cita Médica' : detectedType === 'order' ? 'Orden de Examen' : 'Receta / Medicamento'}
              </span>
            </div>

            <div className="text-sm font-semibold text-slate-800 pb-1 flex items-center gap-1.5 border-b border-slate-100">
              <Edit2 className="h-4 w-4 text-slate-400" />
              <span>Verifica y edita la información antes de guardar:</span>
            </div>

            {/* Verification Form based on Type */}
            <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
              
              {/* APPOINTMENT FORM */}
              {detectedType === 'appointment' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre del Doctor</label>
                    <input
                      type="text"
                      required
                      value={apptDoctor}
                      onChange={(e) => setApptDoctor(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Especialidad</label>
                    <input
                      type="text"
                      required
                      value={apptSpecialty}
                      onChange={(e) => setApptSpecialty(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha</label>
                      <input
                        type="date"
                        required
                        value={apptDate}
                        onChange={(e) => setApptDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hora</label>
                      <input
                        type="time"
                        required
                        value={apptTime}
                        onChange={(e) => setApptTime(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ubicación / Box</label>
                    <input
                      type="text"
                      value={apptLocation}
                      onChange={(e) => setApptLocation(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas adicionales</label>
                    <textarea
                      rows={3}
                      value={apptNotes}
                      onChange={(e) => setApptNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* ORDER FORM */}
              {detectedType === 'order' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Examen / Estudio solicitado</label>
                    <input
                      type="text"
                      required
                      value={orderExam}
                      onChange={(e) => setOrderExam(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Institución Médica</label>
                    <input
                      type="text"
                      required
                      value={orderInst}
                      onChange={(e) => setOrderInst(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className="block text-xs font-semibold text-slate-800">¿Requiere Autorización Médica?</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={orderReqAuth}
                      onChange={(e) => {
                        setOrderRequiredAuth(e.target.checked);
                        if (!e.target.checked) setOrderHasAuth(false);
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  {orderReqAuth && (
                    <div className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-150 animate-in slide-in-from-top-2 duration-150">
                      <div>
                        <span className="block text-xs font-semibold text-emerald-850">¿Ya está autorizada?</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={orderHasAuth}
                        onChange={(e) => setOrderHasAuth(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha de Vencimiento</label>
                    <input
                      type="date"
                      value={orderExpDate}
                      onChange={(e) => setOrderExpDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas o indicaciones</label>
                    <textarea
                      rows={3}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* MEDICATION FORM */}
              {detectedType === 'medication' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Medicamento / Fármaco</label>
                    <input
                      type="text"
                      required
                      value={medName}
                      onChange={(e) => setMedName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dosis</label>
                      <input
                        type="text"
                        required
                        value={medDosage}
                        onChange={(e) => setMedDosage(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Frecuencia</label>
                      <input
                        type="text"
                        required
                        value={medFreq}
                        onChange={(e) => setMedFrequency(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha de Inicio</label>
                      <input
                        type="date"
                        required
                        value={medStart}
                        onChange={(e) => setMedStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha de Término</label>
                      <input
                        type="date"
                        value={medEnd}
                        onChange={(e) => setMedEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Stock Actual</label>
                      <input
                        type="number"
                        min="0"
                        value={medStock}
                        onChange={(e) => setMedStock(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Stock Alerta Mínimo</label>
                      <input
                        type="number"
                        min="0"
                        value={medAlert}
                        onChange={(e) => setMedAlert(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas adicionales</label>
                    <textarea
                      rows={3}
                      value={medNotes}
                      onChange={(e) => setMedNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setScannedData(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              >
                Descartar e intentar de nuevo
              </button>
              <button
                type="button"
                onClick={handleSaveConfirmed}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                Guardar {detectedType === 'appointment' ? 'Cita' : detectedType === 'order' ? 'Orden' : 'Medicamento'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
