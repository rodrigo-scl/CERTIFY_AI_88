import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Building2, User, Loader2, ChevronRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { getTechniciansLight, getCompanies } from '../../services/dataService';
import { Technician, Company } from '../../types';

interface SearchResult {
    id: string;
    type: 'TECHNICIAN' | 'COMPANY';
    title: string;
    subtitle: string;
    avatarUrl?: string; // For technicians
    logoUrl?: string;   // For companies
    status?: string;
}

export const GlobalSearch = ({ className = '' }: { className?: string }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [technicians, setTechnicians] = useState<Partial<Technician>[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const debouncedQuery = useDebounce(query, 300);
    const navigate = useNavigate();
    const searchRef = useRef<HTMLDivElement>(null);

    // Load data once (or could be lazy loaded on focus)
    useEffect(() => {
        const loadData = async () => {
            try {
                const [techs, comps] = await Promise.all([
                    getTechniciansLight(),
                    getCompanies()
                ]);
                setTechnicians(techs);
                setCompanies(comps);
            } catch (error) {
                console.error("Error loading search data", error);
            }
        };
        loadData();
    }, []);

    // Filter results
    useEffect(() => {
        if (!debouncedQuery.trim()) {
            setResults([]);
            return;
        }

        setLoading(true);
        // Simulate async search for UI feel or actual heavy computation
        setTimeout(() => {
            const lowerQuery = debouncedQuery.toLowerCase();

            const techResults: SearchResult[] = technicians
                .filter(t =>
                (t.name?.toLowerCase().includes(lowerQuery) ||
                    t.rut?.toLowerCase().includes(lowerQuery))
                )
                .slice(0, 5)
                .map(t => ({
                    id: t.id!,
                    type: 'TECHNICIAN',
                    title: t.name!,
                    subtitle: `${t.rut} • ${t.role}`,
                    avatarUrl: t.avatarUrl,
                    status: t.overallStatus
                }));

            const compResults: SearchResult[] = companies
                .filter(c =>
                (c.name.toLowerCase().includes(lowerQuery) ||
                    c.rut.toLowerCase().includes(lowerQuery))
                )
                .slice(0, 3)
                .map(c => ({
                    id: c.id,
                    type: 'COMPANY',
                    title: c.name,
                    subtitle: `${c.rut} • ${c.industry}`,
                    logoUrl: c.logoUrl,
                }));

            setResults([...techResults, ...compResults]);
            setLoading(false);
            setShowResults(true);
        }, 100);
    }, [debouncedQuery, technicians, companies]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (result: SearchResult) => {
        if (result.type === 'TECHNICIAN') {
            navigate(`/technicians/${result.id}`);
            // Note: check routes, typically /technicians/detail or similar if passing state, but usually ID
            // If routes are different, adjust here. Assuming /technicians for list, maybe passing ID as query param or state?
            // Based on Dashboard: /technicians is list. 
            // I'll assume we want to open a modal or filter the list.
            // If there is a detail view, navigate there.
            // Let's stick navigate to /technicians and pass state to highlight? 
            // OR if there is a detail route: '/technicians/detail' (checked sidebar)
            navigate('/technicians', { state: { highlightedId: result.id, searchTerm: result.title } });
        } else {
            navigate('/companies', { state: { highlightedId: result.id, searchTerm: result.title } });
        }
        setShowResults(false);
        setQuery('');
    };

    return (
        <div ref={searchRef} className={`relative group ${className}`}>
            <div className={`flex items-center gap-3 px-4 py-2.5 bg-slate-100/50 border border-slate-200 rounded-2xl transition-all duration-300 focus-within:bg-white focus-within:border-brand-500/50 focus-within:ring-4 focus-within:ring-brand-500/10 focus-within:shadow-xl focus-within:shadow-brand-500/5 ${showResults && query ? 'rounded-b-none border-b-0' : ''}`}>
                <Search size={18} className="text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        if (!showResults && e.target.value) setShowResults(true);
                    }}
                    onFocus={() => {
                        if (query.trim()) setShowResults(true);
                    }}
                    placeholder="Buscar técnico o empresa..."
                    className="bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400 w-full"
                />
                {query && (
                    <button
                        onClick={() => { setQuery(''); setResults([]); }}
                        className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
                    >
                        <X size={14} />
                    </button>
                )}
                {loading && <Loader2 size={16} className="text-brand-500 animate-spin" />}
            </div>

            {/* Results Dropdown */}
            {showResults && (query.trim().length > 0) && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 border-t-0 rounded-b-2xl shadow-xl shadow-slate-200/50 z-50 overflow-hidden max-h-[400px] overflow-y-auto">
                    {results.length > 0 ? (
                        <div className="py-2">
                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resultados</div>
                            {results.map((result) => (
                                <button
                                    key={`${result.type}-${result.id}`}
                                    onClick={() => handleSelect(result)}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors border-l-2 border-transparent hover:border-brand-500"
                                >
                                    {/* Avatar/Icon */}
                                    <div className="shrink-0">
                                        {result.type === 'TECHNICIAN' ? (
                                            result.avatarUrl ? (
                                                <img src={result.avatarUrl} alt={result.title} className="w-8 h-8 rounded-full bg-slate-200 object-cover" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                                                    <User size={16} />
                                                </div>
                                            )
                                        ) : (
                                            result.logoUrl ? (
                                                <img src={result.logoUrl} alt={result.title} className="w-8 h-8 rounded-lg bg-slate-200 object-cover" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                    <Building2 size={16} />
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-semibold text-slate-800 truncate">{result.title}</h4>
                                        <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                                            {result.type === 'COMPANY' && <Building2 size={10} />}
                                            {result.subtitle}
                                        </p>
                                    </div>

                                    <ChevronRight size={14} className="text-slate-300" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            <p className="text-sm">No se encontraron resultados</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
