// Rodrigo Osorio v0.2 - Sucursales con tabla escalable
import React, { useEffect, useState, useMemo } from 'react';
import { MapPin, Users, Activity, Plus, X, Search, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getBranches, addBranch, getTechnicians } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { Branch, Technician } from '../types';
import { StatusBadge, ScoreBadge } from '../components/shared/StatusBadge';

// --- SUB-COMPONENT: BRANCH DETAIL ---
const BranchDetail = ({ branch, onBack }: { branch: Branch, onBack: () => void }) => {
  const navigate = useNavigate();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTechnicians().then(allTechs => {
      const branchTechs = allTechs.filter(t => t.branch === branch.name || t.branch === branch.id);
      setTechnicians(branchTechs);
      setLoading(false);
    });
  }, [branch]);

  const filteredTechs = technicians.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      <button onClick={onBack} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm font-medium">
        &larr; Volver a Sucursales
      </button>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
            <MapPin size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{branch.name}</h2>
            <p className="text-sm text-slate-500">{branch.location || 'Sin dirección registrada'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-100 text-center">
            <div className="text-xl font-bold text-slate-800">{branch.technicianCount}</div>
            <div className="text-xs text-slate-500">Técnicos</div>
          </div>
          <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-100 text-center">
            <div className={`text-xl font-bold ${branch.complianceScore > 80 ? 'text-green-600' : 'text-yellow-600'}`}>{branch.complianceScore}%</div>
            <div className="text-xs text-slate-500">Cumplimiento</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
            <Users size={16} className="text-slate-400" /> Técnicos ({technicians.length})
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-8 pr-3 py-1.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 w-48"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Cargando técnicos...</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 text-xs">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Rol</th>
                <th className="px-4 py-2.5 font-medium text-center">Score</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTechs.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-slate-400">No se encontraron técnicos</td></tr>
              ) : (
                filteredTechs.map(tech => (
                  <tr key={tech.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/technicians?id=${tech.id}`)}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-brand-600 hover:underline flex items-center gap-1">
                        {tech.name}
                        <ExternalLink size={12} className="text-slate-400" />
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{tech.role}</td>
                    <td className="px-4 py-2.5 text-center"><ScoreBadge score={tech.complianceScore} /></td>
                    <td className="px-4 py-2.5"><StatusBadge status={tech.overallStatus} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// --- SUB-COMPONENT: NEW BRANCH MODAL ---
const NewBranchModal = ({ isOpen, onClose, onSave }: any) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, location });
    setName('');
    setLocation('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-brand-50">
          <h3 className="font-bold text-brand-900 flex items-center gap-2">
            <MapPin size={18} /> Nueva Sucursal
          </h3>
          <button onClick={onClose}><X size={18} className="text-brand-700 hover:text-brand-900" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white outline-none focus:ring-2 focus:ring-brand-500"
              value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Santiago Centro" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white outline-none focus:ring-2 focus:ring-brand-500"
              value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Av. Libertador 123" />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
            <button type="submit" className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 text-sm">Crear</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- MAIN PAGE ---
export const Branches = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Búsqueda, ordenamiento y paginación
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'name' | 'technicianCount' | 'complianceScore'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const { user, isBranchManager } = useAuth();

  const loadBranches = async () => {
    setLoading(true);
    let data = await getBranches();

    // Rodrigo Osorio v0.14 - Filtrado por sucursales asignadas
    if (isBranchManager && user?.assignedBranchIds && user.assignedBranchIds.length > 0) {
      data = data.filter(b => user.assignedBranchIds?.includes(b.id));
    }

    setBranches(data);
    setLoading(false);
  };

  useEffect(() => {
    loadBranches();
  }, [isBranchManager, user?.assignedBranchIds]);


  const handleCreate = async (data: Partial<Branch>) => {
    await addBranch(data);
    setIsModalOpen(false);
    loadBranches();
  };

  // Filtrar y ordenar
  const filteredData = useMemo(() => {
    let filtered = branches.filter(b =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.location || '').toLowerCase().includes(searchTerm.toLowerCase())
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
  }, [branches, searchTerm, sortField, sortDirection]);

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

  if (selectedBranch) {
    return <BranchDetail branch={selectedBranch} onBack={() => setSelectedBranch(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sucursales</h1>
          <p className="text-slate-500 text-sm">Gestión de ubicaciones y personal asignado</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-brand-700 text-sm">
          <Plus size={16} /> Nueva Sucursal
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar sucursal..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full sm:w-72 pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Cargando sucursales...</div>
        ) : branches.length === 0 ? (
          <div className="p-8 text-center">
            <MapPin size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-slate-500 text-sm">No hay sucursales registradas</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-900">
                        Sucursal
                        <ArrowUpDown size={12} className={sortField === 'name' ? 'text-brand-600' : ''} />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Ubicación</th>
                    <th className="px-4 py-3 text-center font-medium">
                      <button onClick={() => handleSort('technicianCount')} className="flex items-center gap-1 hover:text-slate-900 mx-auto">
                        Técnicos
                        <ArrowUpDown size={12} className={sortField === 'technicianCount' ? 'text-brand-600' : ''} />
                      </button>
                    </th>
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
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No se encontraron sucursales
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map(branch => (
                      <tr key={branch.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-brand-50 text-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
                              <MapPin size={16} />
                            </div>
                            <span className="font-medium text-slate-900">{branch.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">
                          {branch.location || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-slate-700">
                            <Users size={14} className="text-slate-400" />
                            {branch.technicianCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ScoreBadge score={branch.complianceScore} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedBranch(branch)}
                            className="text-brand-600 hover:text-brand-800 text-xs font-medium hover:underline"
                          >
                            Ver detalle
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

      <NewBranchModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleCreate} />
    </div>
  );
};
