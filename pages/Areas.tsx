// Rodrigo Osorio v0.2 - Áreas con tabla escalable
import React, { useEffect, useState, useMemo } from 'react';
import { FolderOpen, Clock, AlertCircle, CheckCircle, Calendar, AlertTriangle, Search, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { getAreas, getAreaTasks } from '../services/dataService';
import { WorkArea, AreaTask } from '../types';
import { StatusBadge } from '../components/shared/StatusBadge';

// Helper para formatear fecha relativa
const getDeadlineText = (date: Date) => {
  const today = new Date();
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `Venció hace ${Math.abs(diffDays)} días`;
  if (diffDays === 0) return 'Vence hoy';
  if (diffDays === 1) return 'Vence mañana';
  return `Vence en ${diffDays} días`;
};

// --- DETALLE DE ÁREA ---
const AreaDetail = ({ area, onBack }: { area: WorkArea, onBack: () => void }) => {
  const [tasks, setTasks] = useState<AreaTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAreaTasks(area.id).then((data) => {
      setTasks(data);
      setLoading(false);
    });
  }, [area.id]);

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      <button onClick={onBack} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm font-medium">
         &larr; Volver a Áreas
      </button>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between gap-4">
         <div>
            <h2 className="text-xl font-bold text-slate-900">{area.name}</h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
              <div className="flex items-center gap-1">
                 <Clock size={14} className="text-brand-600" />
                 <span>SLA: <strong>{area.slaDays} días</strong> ({area.slaType === 'BUSINESS' ? 'Hábiles' : 'Corridos'})</span>
              </div>
              <div className="flex items-center gap-1">
                 <AlertCircle size={14} className={area.criticality === 'HIGH' ? 'text-red-500' : 'text-yellow-500'} />
                 <span>Criticidad: <strong>{area.criticality === 'HIGH' ? 'Alta' : area.criticality === 'MEDIUM' ? 'Media' : 'Baja'}</strong></span>
              </div>
            </div>
         </div>
         <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{tasks.length}</div>
              <div className="text-xs text-slate-500">Pendientes</div>
            </div>
            <div className="w-px h-10 bg-slate-200"></div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${area.complianceScore > 80 ? 'text-green-600' : 'text-yellow-600'}`}>
                {area.complianceScore}%
              </div>
              <div className="text-xs text-slate-500">Cumplimiento</div>
            </div>
         </div>
      </div>

      {/* Cola de Renovación */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
           <h3 className="font-semibold text-slate-900">Cola de Renovación</h3>
           <span className="text-xs text-slate-500">Documentos pendientes de esta área</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Cargando tareas...</div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center">
             <CheckCircle size={36} className="mx-auto text-green-400 mb-2 opacity-50" />
             <p className="text-slate-500 text-sm">No hay renovaciones pendientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 text-xs">
                <tr>
                   <th className="px-4 py-2.5 font-medium">Técnico</th>
                   <th className="px-4 py-2.5 font-medium">Documento</th>
                   <th className="px-4 py-2.5 font-medium">Estado</th>
                   <th className="px-4 py-2.5 font-medium">Deadline SLA</th>
                   <th className="px-4 py-2.5 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {tasks.map((task, idx) => (
                   <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{task.technicianName}</td>
                      <td className="px-4 py-2.5 text-slate-600">{task.documentName}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={task.status} /></td>
                      <td className="px-4 py-2.5">
                         <div className={`flex items-center gap-1.5 text-xs ${task.isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                            {task.isOverdue ? <AlertTriangle size={14} /> : <Calendar size={14} className="text-slate-400"/>}
                            <div>
                               <div>{task.deadlineDate.toLocaleDateString()}</div>
                               <div className="opacity-70">{getDeadlineText(task.deadlineDate)}</div>
                            </div>
                         </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                         <button className="bg-brand-50 text-brand-700 px-2.5 py-1 rounded text-xs font-medium hover:bg-brand-100">
                            Cargar Doc
                         </button>
                      </td>
                   </tr>
                 ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---
export const Areas = () => {
  const [areas, setAreas] = useState<WorkArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<WorkArea | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Búsqueda, ordenamiento y paginación
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'name' | 'slaDays' | 'complianceScore'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    getAreas().then(data => {
      setAreas(data);
      setLoading(false);
    });
  }, []);

  // Filtrar y ordenar
  const filteredData = useMemo(() => {
    let filtered = areas.filter(a => 
      a.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = (a[sortField] || 0) - (b[sortField] || 0);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [areas, searchTerm, sortField, sortDirection]);

  // Paginación
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (selectedArea) {
    return <AreaDetail area={selectedArea} onBack={() => setSelectedArea(null)} />;
  }

  return (
    <div className="space-y-4">
       <div>
          <h1 className="text-xl font-bold text-slate-900">Áreas y SLAs</h1>
          <p className="text-slate-500 text-sm">Gestión de tiempos de respuesta por área</p>
       </div>

       {/* Filtros */}
       <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
         <div className="relative">
           <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
           <input
             type="text"
             placeholder="Buscar área..."
             value={searchTerm}
             onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
             className="w-full sm:w-72 pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
           />
         </div>
       </div>

       {/* Tabla */}
       <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
         {loading ? (
           <div className="p-8 text-center text-slate-400 text-sm">Cargando áreas...</div>
         ) : areas.length === 0 ? (
           <div className="p-8 text-center">
               <FolderOpen size={36} className="mx-auto mb-2 text-slate-300" />
               <p className="text-slate-500 text-sm">No hay áreas registradas</p>
           </div>
         ) : (
           <>
             <div className="overflow-x-auto">
               <table className="w-full text-sm">
                 <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-100">
                   <tr>
                     <th className="px-4 py-3 text-left font-medium">
                       <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-900">
                         Área
                         <ArrowUpDown size={12} className={sortField === 'name' ? 'text-brand-600' : ''} />
                       </button>
                     </th>
                     <th className="px-4 py-3 text-center font-medium">
                       <button onClick={() => handleSort('slaDays')} className="flex items-center gap-1 hover:text-slate-900 mx-auto">
                         SLA
                         <ArrowUpDown size={12} className={sortField === 'slaDays' ? 'text-brand-600' : ''} />
                       </button>
                     </th>
                     <th className="px-4 py-3 text-center font-medium">Tipo SLA</th>
                     <th className="px-4 py-3 text-center font-medium">Criticidad</th>
                     <th className="px-4 py-3 text-center font-medium">
                       <button onClick={() => handleSort('complianceScore')} className="flex items-center gap-1 hover:text-slate-900 mx-auto">
                         Cumplimiento
                         <ArrowUpDown size={12} className={sortField === 'complianceScore' ? 'text-brand-600' : ''} />
                       </button>
                     </th>
                     <th className="px-4 py-3 text-right font-medium">Acción</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {paginatedData.length === 0 ? (
                     <tr>
                       <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                         No se encontraron áreas
                       </td>
                     </tr>
                   ) : (
                     paginatedData.map(area => (
                       <tr key={area.id} className="hover:bg-slate-50">
                         <td className="px-4 py-3">
                           <div className="flex items-center gap-2">
                             <div className="w-8 h-8 bg-blue-50 text-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
                               <FolderOpen size={16} />
                             </div>
                             <span className="font-medium text-slate-900">{area.name}</span>
                           </div>
                         </td>
                         <td className="px-4 py-3 text-center">
                           <span className="font-medium text-slate-700">{area.slaDays} días</span>
                         </td>
                         <td className="px-4 py-3 text-center">
                           <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                             {area.slaType === 'BUSINESS' ? 'Hábiles' : 'Corridos'}
                           </span>
                         </td>
                         <td className="px-4 py-3 text-center">
                           <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                             area.criticality === 'HIGH' 
                               ? 'bg-red-50 text-red-600' 
                               : area.criticality === 'MEDIUM'
                               ? 'bg-yellow-50 text-yellow-600'
                               : 'bg-green-50 text-green-600'
                           }`}>
                             {area.criticality === 'HIGH' ? 'Alta' : area.criticality === 'MEDIUM' ? 'Media' : 'Baja'}
                           </span>
                         </td>
                         <td className="px-4 py-3 text-center">
                           <div className="flex items-center justify-center gap-2">
                             <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                               <div 
                                 className={`h-2 rounded-full ${area.complianceScore > 80 ? 'bg-green-500' : 'bg-yellow-500'}`}
                                 style={{ width: `${area.complianceScore}%` }}
                               />
                             </div>
                             <span className={`text-xs font-medium ${area.complianceScore > 80 ? 'text-green-600' : 'text-yellow-600'}`}>
                               {area.complianceScore}%
                             </span>
                           </div>
                         </td>
                         <td className="px-4 py-3 text-right">
                           <button 
                             onClick={() => setSelectedArea(area)}
                             className="text-brand-600 hover:text-brand-800 text-xs font-medium hover:underline"
                           >
                             Ver cola
                           </button>
                         </td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
             </div>

             {/* Paginación */}
             {totalPages > 1 && (
               <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                 <span className="text-xs text-slate-500">
                   {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length}
                 </span>
                 <div className="flex items-center gap-1">
                   <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                     className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                     <ChevronsLeft size={16} />
                   </button>
                   <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                     className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                     <ChevronLeft size={16} />
                   </button>
                   <span className="px-3 py-1 text-sm">{currentPage} / {totalPages}</span>
                   <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                     className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                     <ChevronRight size={16} />
                   </button>
                   <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                     className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                     <ChevronsRight size={16} />
                   </button>
                 </div>
               </div>
             )}
           </>
         )}
       </div>
    </div>
  );
};
