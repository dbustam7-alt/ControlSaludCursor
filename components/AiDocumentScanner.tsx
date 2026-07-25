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
  const [saving, setSaving] = useState(false);
  
  // Scanned / Preview states
  const [scannedData, setScannedData] = useState<any | null>(null);
  const [detectedType, setDetectedType] = useState<'appointment' | 'order' | 'medication' | null>(null);
  const [calculatedHash, setCalculatedHash] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    type: string;
    detail: string;
    isSameFile: boolean;
  } | null>(null);
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
  const [medNotes, setMedNotes] = useState('');

  const calculateFileHash = async (fileObj: File): Promise<string> => {
    const arrayBuffer = await fileObj.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const checkDuplicateHash = async (hash: string, workspaceId: string) => {
    if (isDemoMode) {
      const apptsSaved = localStorage.getItem('demo_appointments');
      const appts: any[] = apptsSaved ? JSON.parse(apptsSaved) : [];
      const apptDup = appts.find(a => a.workspaceId === workspaceId && a.fileHash === hash);
      if (apptDup) {
        return { exists: true, type: 'appointment', detail: `Cita con el Dr. ${apptDup.doctorName}` };
      }

      const ordersSaved = localStorage.getItem('demo_orders');
      const orders: any[] = ordersSaved ? JSON.parse(ordersSaved) : [];
      const orderDup = orders.find(o => o.workspaceId === workspaceId && o.fileHash === hash);
      if (orderDup) {
        return { exists: true, type: 'order', detail: `Orden médica para ${orderDup.examType}` };
      }

      const medsSaved = localStorage.getItem('demo_medications');
      const meds: any[] = medsSaved ? JSON.parse(medsSaved) : [];
      const medDup = meds.find(m => m.workspaceId === workspaceId && m.fileHash === hash);
      if (medDup) {
        return { exists: true, type: 'medication', detail: `Medicamento: ${medDup.name}` };
      }

      return { exists: false };
    } else {
      const { data: apptData } = await supabase
        .from('appointments')
        .select('id, doctor_name')
        .eq('workspace_id', workspaceId)
        .eq('file_hash', hash)
        .limit(1);

      if (apptData && apptData.length > 0) {
        return { exists: true, type: 'appointment', detail: `Cita con el Dr. ${apptData[0].doctor_name}` };
      }

      const { data: orderData } = await supabase
        .from('medical_orders')
        .select('id, exam_type')
        .eq('workspace_id', workspaceId)
        .eq('file_hash', hash)
        .limit(1);

      if (orderData && orderData.length > 0) {
        return { exists: true, type: 'order', detail: `Orden médica para ${orderData[0].exam_type}` };
      }

      const { data: medData } = await supabase
        .from('medications')
        .select('id, name')
        .eq('workspace_id', workspaceId)
        .eq('file_hash', hash)
        .limit(1);

      if (medData && medData.length > 0) {
        return { exists: true, type: 'medication', detail: `Medicamento: ${medData[0].name}` };
      }

      return { exists: false };
    }
  };

  const checkSimilarRecord = async (
    type: 'appointment' | 'order' | 'medication',
    data: any,
    workspaceId: string
  ) => {
    if (isDemoMode) {
      if (type === 'appointment') {
        const saved = localStorage.getItem('demo_appointments');
        const list: any[] = saved ? JSON.parse(saved) : [];
        const dateOnly = data.apptDate;
        const dup = list.find(a => 
          a.workspaceId === workspaceId && 
          a.doctorName.toLowerCase().trim() === data.apptDoctor.toLowerCase().trim() &&
          a.dateTime.substring(0, 10) === dateOnly
        );
        if (dup) {
          return { exists: true, detail: `Ya tienes una cita registrada con el Dr. ${dup.doctorName} para este día.` };
        }
      } else if (type === 'order') {
        const saved = localStorage.getItem('demo_orders');
        const list: any[] = saved ? JSON.parse(saved) : [];
        const dup = list.find(o => 
          o.workspaceId === workspaceId &&
          o.examType.toLowerCase().trim() === data.orderExam.toLowerCase().trim() &&
          o.institution.toLowerCase().trim() === data.orderInst.toLowerCase().trim()
        );
        if (dup) {
          return { exists: true, detail: `Ya tienes una orden registrada de "${dup.examType}" en la institución "${dup.institution}".` };
        }
      } else if (type === 'medication') {
        const saved = localStorage.getItem('demo_medications');
        const list: any[] = saved ? JSON.parse(saved) : [];
        const dup = list.find(m => 
          m.workspaceId === workspaceId &&
          m.name.toLowerCase().trim() === data.medName.toLowerCase().trim() &&
          m.dosage.toLowerCase().trim() === data.medDosage.toLowerCase().trim()
        );
        if (dup) {
          return { exists: true, detail: `Ya tienes registrado el medicamento "${dup.name}" con la dosis "${dup.dosage}".` };
        }
      }
      return { exists: false };
    } else {
      if (type === 'appointment') {
        const dateOnly = data.apptDate;
        if (!data.apptDoctor || !dateOnly) return { exists: false };
        const { data: dups } = await supabase
          .from('appointments')
          .select('id, doctor_name, date_time')
          .eq('workspace_id', workspaceId)
          .ilike('doctor_name', `%${data.apptDoctor.trim()}%`);
        
        const dup = (dups || []).find(a => a.date_time.substring(0, 10) === dateOnly);
        if (dup) {
          return { exists: true, detail: `Ya tienes una cita registrada con el Dr. ${dup.doctor_name} para este día.` };
        }
      } else if (type === 'order') {
        if (!data.orderExam || !data.orderInst) return { exists: false };
        const { data: dups } = await supabase
          .from('medical_orders')
          .select('id, exam_type, institution')
          .eq('workspace_id', workspaceId)
          .ilike('exam_type', `%${data.orderExam.trim()}%`)
          .ilike('institution', `%${data.orderInst.trim()}%`);
        
        if (dups && dups.length > 0) {
          return { exists: true, detail: `Ya tienes una orden registrada de "${dups[0].exam_type}" en la institución "${dups[0].institution}".` };
        }
      } else if (type === 'medication') {
        if (!data.medName || !data.medDosage) return { exists: false };
        const { data: dups } = await supabase
          .from('medications')
          .select('id, name, dosage')
          .eq('workspace_id', workspaceId)
          .ilike('name', `%${data.medName.trim()}%`)
          .ilike('dosage', `%${data.medDosage.trim()}%`);
        
        if (dups && dups.length > 0) {
          return { exists: true, detail: `Ya tienes registrado el medicamento "${dups[0].name}" con la dosis "${dups[0].dosage}".` };
        }
      }
      return { exists: false };
    }
  };

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

  const handleFileSelected = async (selectedFile: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Formato de archivo inválido. Sube una foto (JPG, PNG, WEBP) o un documento PDF.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setDuplicateWarning(null);

    if (!activeWorkspace) return;

    try {
      setScanning(true);
      const hash = await calculateFileHash(selectedFile);
      setCalculatedHash(hash);

      const dupCheck = await checkDuplicateHash(hash, activeWorkspace.id);
      if (dupCheck.exists) {
        setDuplicateWarning({
          type: dupCheck.type!,
          detail: dupCheck.detail!,
          isSameFile: true
        });
        setScanning(false);
      } else {
        startScanning(selectedFile);
      }
    } catch (err: any) {
      console.error("Error al calcular hash o validar duplicados:", err);
      startScanning(selectedFile);
    }
  };

  const startScanning = async (targetFile: File) => {
    setScanning(true);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(targetFile);
      reader.onloadend = async () => {
        try {
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
            throw new Error(json.error || json.details || 'Error al escanear con la Inteligencia Artificial.');
          }

          if (json.success && json.data) {
            populateVerificationFields(json.data);
          } else {
            throw new Error('No se pudo extraer información estructurada del documento.');
          }
        } catch (err: any) {
          console.error('Error inside reader.onloadend:', err);
          setError(err.message || 'Error al procesar el archivo con Inteligencia Artificial.');
          setScanning(false);
        }
      };
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error del servidor al procesar el archivo.');
      setScanning(false);
    }
  };

  const populateVerificationFields = async (extracted: any) => {
    const type = extracted.type;
    setDetectedType(type);
    setScannedData(extracted);

    let apptDoctorStr = '';
    let apptSpecialtyStr = '';
    let apptLocationStr = '';
    let apptDateStr = '';
    let apptTimeStr = '';
    let apptNotesStr = '';

    let orderExamStr = '';
    let orderInstStr = '';
    let orderReqAuthVal = false;
    let orderExpDateStr = '';
    let orderNotesStr = '';

    let medNameStr = '';
    let medDosageStr = '';
    let medFreqStr = '';
    let medStartStr = '';
    let medEndStr = '';
    let medNotesStr = '';

    if (type === 'appointment' && extracted.appointment) {
      const appt = extracted.appointment;
      apptDoctorStr = appt.doctorName || '';
      apptSpecialtyStr = appt.specialty || '';
      apptLocationStr = appt.location || '';
      
      if (appt.dateTime) {
        const dt = new Date(appt.dateTime);
        if (!isNaN(dt.getTime())) {
          apptDateStr = dt.toISOString().split('T')[0];
          apptTimeStr = dt.toTimeString().split(' ')[0].substring(0, 5);
        }
      }
      apptNotesStr = appt.notes || '';

      setApptDoctor(apptDoctorStr);
      setApptSpecialty(apptSpecialtyStr);
      setApptLocation(apptLocationStr);
      setApptDate(apptDateStr);
      setApptTime(apptTimeStr);
      setApptNotes(apptNotesStr);
    } else if (type === 'order' && extracted.order) {
      const order = extracted.order;
      orderExamStr = order.examType || '';
      orderInstStr = order.institution || '';
      orderReqAuthVal = order.requiredAuthorization || false;
      orderExpDateStr = order.expirationDate || '';
      orderNotesStr = order.notes || '';

      setOrderExam(orderExamStr);
      setOrderInst(orderInstStr);
      setOrderRequiredAuth(orderReqAuthVal);
      setOrderHasAuth(false);
      setOrderExpDate(orderExpDateStr);
      setOrderNotes(orderNotesStr);
    } else if (type === 'medication' && extracted.medication) {
      const med = extracted.medication;
      medNameStr = med.name || '';
      medDosageStr = med.dosage || '';
      medFreqStr = med.frequency || '';
      medStartStr = med.startDate || new Date().toISOString().split('T')[0];
      medEndStr = med.endDate || '';
      medNotesStr = med.notes || '';

      setMedName(medNameStr);
      setMedDosage(medDosageStr);
      setMedFrequency(medFreqStr);
      setMedStartDate(medStartStr);
      setMedEndDate(medEndStr);
      setMedNotes(medNotesStr);
    }

    setScanning(false);

    if (activeWorkspace) {
      const checkData = type === 'appointment' 
        ? { apptDoctor: apptDoctorStr, apptDate: apptDateStr }
        : type === 'order'
        ? { orderExam: orderExamStr, orderInst: orderInstStr }
        : { medName: medNameStr, medDosage: medDosageStr };

      try {
        const simCheck = await checkSimilarRecord(type, checkData, activeWorkspace.id);
        if (simCheck.exists) {
          setDuplicateWarning({
            type,
            detail: simCheck.detail!,
            isSameFile: false
          });
        }
      } catch (err) {
        console.error("Error al verificar registros similares:", err);
      }
    }
  };

  const handleSaveConfirmed = async () => {
    if (!activeWorkspace) return;
    setError(null);
    setSaving(true);

    try {
      let storagePath: string | null = null;

      if (file) {
        if (isDemoMode) {
          // En modo demo, creamos una URL de objeto temporal para previsualizarlo en vivo
          storagePath = URL.createObjectURL(file);
        } else {
          const fileExt = file.name.split('.').pop();
          const fileNameClean = file.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
          const path = `${activeWorkspace.id}/${detectedType}/${Date.now()}_${fileNameClean}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('medical-documents')
            .upload(path, file);

          if (uploadError) {
            throw new Error(`Error al subir el archivo: ${uploadError.message}`);
          }
          storagePath = path;
        }
      }

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
            attachmentUrl: storagePath,
            fileHash: calculatedHash,
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
            attachment_url: storagePath,
            file_hash: calculatedHash,
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
            attachmentUrl: storagePath,
            fileHash: calculatedHash,
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
            attachment_url: storagePath,
            file_hash: calculatedHash,
            status: 'pending',
            notes: orderNotes || null,
            created_by: user?.id,
          });
          if (dbErr) throw dbErr;
        }
      } 
      
      else if (detectedType === 'medication') {
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
            status: 'active',
            notes: medNotes || null,
            attachmentUrl: storagePath,
            fileHash: calculatedHash,
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
            status: 'active',
            notes: medNotes || null,
            attachment_url: storagePath,
            file_hash: calculatedHash,
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
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setScanning(false);
    setScannedData(null);
    setDetectedType(null);
    setCalculatedHash(null);
    setDuplicateWarning(null);
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
        {!scanning && !scannedData && (!duplicateWarning || !duplicateWarning.isSameFile) && (
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

        {/* STEP 1.5: DUPLICATE FILE WARNING */}
        {!scanning && !scannedData && duplicateWarning && duplicateWarning.isSameFile && (
          <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-6 text-center animate-in fade-in duration-200">
            <div className="p-4 bg-amber-500 text-white rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4 border-2 border-white shadow-soft">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h4 className="text-base font-bold text-slate-800">¡Documento ya registrado!</h4>
            <p className="mt-2 text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Este archivo exacto ya ha sido escaneado y guardado previamente en tu espacio de trabajo como un registro de:
              <strong className="block mt-1 text-slate-800 text-sm font-extrabold">{duplicateWarning.detail}</strong>
            </p>
            <p className="mt-4 text-[11px] text-slate-500">
              Para evitar duplicados innecesarios y mantener el historial médico limpio, te recomendamos descartarlo.
            </p>
            
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-sm"
              >
                Descartar archivo (Recomendado)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDuplicateWarning(null);
                  if (file) startScanning(file);
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors border border-amber-200"
              >
                Volver a escanear de todas formas
              </button>
            </div>
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

        {/* STEP 3: HUMAN-IN-THE-LOOP VERIFICATION */}
        {!scanning && scannedData && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5">
              <div className="p-1 bg-emerald-500 text-white rounded-full">
                <Check className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="block text-xs font-bold text-emerald-800">¡Documento escaneado con éxito!</span>
                <span className="text-[11px] text-emerald-700">Por favor, revisa y confirma que los datos extraídos son correctos. Puedes editarlos directamente si es necesario.</span>
              </div>
            </div>

            {duplicateWarning && !duplicateWarning.isSameFile && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="block text-xs font-bold text-amber-800">¡Posible duplicado detectado!</span>
                  <span className="block text-[11px] text-amber-700 leading-relaxed mt-0.5">
                    {duplicateWarning.detail}
                  </span>
                  <span className="block text-[10px] text-amber-500 font-medium mt-1">
                    Verifica si necesitas crear un nuevo registro o si ya habías ingresado esta información previamente.
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 max-h-[48vh] overflow-y-auto">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Registro Detectado:</span>
                <span className="text-xs font-bold text-indigo-600 uppercase bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                  {detectedType === 'appointment' && <Calendar className="h-3.5 w-3.5" />}
                  {detectedType === 'order' && <FileText className="h-3.5 w-3.5" />}
                  {detectedType === 'medication' && <Pill className="h-3.5 w-3.5" />}
                  {detectedType === 'appointment' ? 'Cita Médica' : detectedType === 'order' ? 'Orden Médica' : 'Medicamento'}
                </span>
              </div>

              {/* APPOINTMENT FORM */}
              {detectedType === 'appointment' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre del Médico / Profesional</label>
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
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Lugar / Box / Sucursal</label>
                    <input
                      type="text"
                      value={apptLocation}
                      onChange={(e) => setApptLocation(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas o preparativos</label>
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
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tipo de Examen / Procedimiento</label>
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
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Descartar e intentar de nuevo
              </button>
              <button
                type="button"
                onClick={handleSaveConfirmed}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-80 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Guardar {detectedType === 'appointment' ? 'Cita' : detectedType === 'order' ? 'Orden' : 'Medicamento'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
