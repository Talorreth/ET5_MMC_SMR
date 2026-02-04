import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
// CORRECTION : Ajout de 'Activity' qui manquait dans l'import
import { 
  Play, 
  AlertTriangle, 
  CheckCircle, 
  RotateCcw, 
  MapPin, 
  Info, 
  BarChart as IconBarChart, 
  SlidersHorizontal, 
  ChevronDown, 
  ChevronUp,
  Activity // <--- L'icône manquante est ajoutée ici
} from 'lucide-react';

import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend 
} from 'recharts';

const API_URL = "http://127.0.0.1:8000";
const BAR_COLORS = ['#3b82f6', '#64748b', '#94a3b8', '#cbd5e1'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950 p-3 border border-cyan-500/30 shadow-xl rounded-lg text-sm">
        <p className="font-bold text-cyan-400 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="flex items-center gap-2 text-slate-100">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }}></span>
            {entry.name}: <span className="font-mono font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function SimulationPanel({ island, onClose }) {
  const [loading, setLoading] = useState(false);
  const [criteriaList, setCriteriaList] = useState([]);
  const [scores, setScores] = useState({}); 
  const [originalScores, setOriginalScores] = useState({});
  const [smrProfiles, setSmrProfiles] = useState({});
  const [alpha, setAlpha] = useState(0.3);
  const [results, setResults] = useState(null);
  const [selectedSmr, setSelectedSmr] = useState(null);
  const [openTheme, setOpenTheme] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [critRes, islandRes, smrRes] = await Promise.all([
          axios.get(`${API_URL}/criteria`),
          axios.get(`${API_URL}/islands`),
          axios.get(`${API_URL}/smrs`)
        ]);
        setCriteriaList(critRes.data || []);
        setSmrProfiles(smrRes.data || {});
        if (islandRes.data && islandRes.data[island.id]) {
          setScores(islandRes.data[island.id]);
          setOriginalScores(islandRes.data[island.id]);
        }
      } catch (error) { console.error("Erreur chargement:", error); }
    };
    fetchData();
    setResults(null); setSelectedSmr(null);
  }, [island.id]);

  const radarData = useMemo(() => {
    if (!criteriaList.length || !Object.keys(scores).length) return [];
    const themes = {};
    criteriaList.forEach(c => {
      if (!themes[c.Thématique]) themes[c.Thématique] = { islandSum: 0, smrSum: 0, count: 0 };
      themes[c.Thématique].islandSum += (scores[c.Code] || 0);
      if (selectedSmr && smrProfiles[selectedSmr]) {
        themes[c.Thématique].smrSum += (smrProfiles[selectedSmr][c.Code] || 0);
      }
      themes[c.Thématique].count += 1;
    });
    return Object.keys(themes).map(theme => ({
      subject: theme,
      island: parseFloat((themes[theme].islandSum / themes[theme].count).toFixed(2)),
      smr: selectedSmr ? parseFloat((themes[theme].smrSum / themes[theme].count).toFixed(2)) : 0,
      fullMark: 5,
    }));
  }, [scores, criteriaList, selectedSmr, smrProfiles]);

  const handleCalculate = async () => {
    setLoading(true); setSelectedSmr(null);
    try {
      const response = await axios.post(`${API_URL}/calculate`, {
        island_id: island.id, alpha: parseFloat(alpha), overrides: scores
      });
      setResults(response.data);
    } catch (error) { 
        alert("Erreur serveur. Vérifiez que le terminal Python est lancé."); 
        console.error(error);
    } finally { setLoading(false); }
  };

  const handleReset = () => {
    setScores(originalScores); setResults(null); setSelectedSmr(null);
  };

  const toggleTheme = (theme) => setOpenTheme(openTheme === theme ? null : theme);

  return (
    <div className="simulation-panel-wrapper flex flex-col h-full w-full bg-slate-900 text-white font-sans relative overflow-hidden">
      
      {/* HEADER FIXE - Modern glassmorphism avec gradient */}
      <div className="px-8 py-7 border-b border-cyan-500/10 bg-gradient-to-b from-slate-950/95 to-slate-900/50 backdrop-blur-xl z-20 flex justify-between items-start shadow-2xl">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-cyan-400 mb-3">
            <MapPin size={14} className="flex-shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-widest opacity-75">📍 Site Pilote</span>
          </div>
          <h2 className="text-4xl font-black text-white leading-tight bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent">{island.name}</h2>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-cyan-500/20 active:bg-cyan-500/30 rounded-xl transition-all text-slate-400 hover:text-cyan-300 hover:scale-110 duration-300 group border border-cyan-500/0 hover:border-cyan-500/20">
          <svg className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">

        {/* SECTION 1: RADAR & ACTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Radar Card */}
            <div className="lg:col-span-2 bg-gradient-to-br from-slate-800/60 to-slate-900/40 rounded-3xl p-8 border border-cyan-500/20 relative shadow-lg hover:shadow-2xl hover:border-cyan-500/40 transition-all duration-500 backdrop-blur-md group">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <h3 className="font-bold text-white text-lg flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-cyan-500/40 to-cyan-500/20 rounded-xl border border-cyan-500/40 group-hover:border-cyan-500/60 transition-all duration-300">
                            <Activity size={20} className="text-cyan-300"/>
                        </div>
                        Analyse de Vulnérabilité
                    </h3>
                    {selectedSmr && (
                        <span className="text-xs font-bold bg-cyan-500/20 text-cyan-300 px-3 py-1 rounded-full border border-cyan-500/40">
                           {selectedSmr}
                        </span>
                    )}
                </div>
                <div className="h-80 w-full bg-slate-900/40 rounded-2xl p-4 border border-cyan-500/20 relative z-10">
                    {radarData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                            <PolarGrid stroke="#0e7490" strokeDasharray="3" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#a1f5ff', fontWeight: 500 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                            <Radar name="Site" dataKey="island" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2.5} />
                            {selectedSmr && <Radar name={selectedSmr} dataKey="smr" stroke="#f97316" fill="#f97316" fillOpacity={0.2} strokeWidth={2.5} />}
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px', color: '#a1f5ff' }} />
                        </RadarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            <div className="text-center">
                                <Activity className="mx-auto mb-2 animate-spin opacity-20" size={28} />
                                <p className="text-sm">Chargement...</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Card */}
            <div className="flex flex-col gap-4">
                <div className="bg-gradient-to-br from-cyan-600/90 via-blue-600 to-blue-700 text-white rounded-3xl p-8 shadow-2xl shadow-cyan-500/30 flex flex-col justify-between h-full hover:shadow-cyan-500/40 transition-all duration-500 border border-cyan-400/30 group hover:border-cyan-300/50 relative overflow-hidden">
                    <div className="relative z-10">
                        <h4 className="font-bold text-base mb-3">Simulation MCDA</h4>
                        <p className="text-cyan-50/60 text-sm leading-relaxed">Classement des 16 technologies SMR</p>
                    </div>
                    <button 
                        onClick={handleCalculate}
                        disabled={loading}
                        className="w-full bg-white/95 text-cyan-700 hover:bg-white disabled:bg-slate-700/60 disabled:text-slate-300 font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105 flex justify-center items-center gap-2 text-sm disabled:cursor-not-allowed disabled:scale-100 disabled:hover:shadow-lg relative z-10"
                    >
                        {loading ? (
                            <><Activity size={16} className="animate-spin"/> Calcul...</>
                        ) : (
                            <><Play size={16} fill="currentColor"/> Lancer</>
                        )}
                    </button>
                </div>
                <button onClick={handleReset} className="w-full bg-slate-800/60 border-2 border-cyan-500/40 text-cyan-300 hover:bg-slate-700/80 hover:border-cyan-500/70 py-3 px-4 rounded-xl font-semibold flex justify-center items-center gap-2 transition-all shadow-md hover:shadow-lg hover:scale-105 text-sm relative z-10 backdrop-blur-sm group">
                    <RotateCcw size={16} className="group-hover:rotate-180 transition-transform duration-500"/> Réinitialiser
                </button>
            </div>
        </div>

        {/* SECTION 2: RÉSULTATS */}
        {results && (
          <div className="animate-fade-in border-t border-cyan-500/10 pt-8">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-cyan-500/40 to-cyan-500/20 rounded-xl border border-cyan-500/40">
                    <IconBarChart size={20} className="text-cyan-300"/>
                </div>
                Résultats & Classement
            </h3>

            {/* Status Banner */}
            <div className={`p-5 rounded-2xl border-2 mb-6 flex items-start gap-4 shadow-lg transition-all backdrop-blur-sm ${results.is_nogo ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'}`}>
                <div className={`p-3 rounded-lg flex-shrink-0 ${results.is_nogo ? 'bg-red-500/30 text-red-400' : 'bg-emerald-500/30 text-emerald-400'}`}>
                    {results.is_nogo ? <AlertTriangle size={22}/> : <CheckCircle size={22}/>}
                </div>
                <div>
                    <h4 className="font-bold text-base mb-2">{results.is_nogo ? "Projet Critique (No-Go)" : "Projet Viable"}</h4>
                    <p className="text-sm opacity-80 leading-relaxed">
                        {results.is_nogo 
                            ? `Contraintes bloquantes : ${results.nogo_reasons.join(", ")}` 
                            : "Tous les critères d'exclusion sont respectés."}
                    </p>
                </div>
            </div>

            {/* Chart */}
            <div className="rounded-2xl border border-cyan-500/20 p-6 shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-slate-800/40 to-slate-900/30 backdrop-blur-md">
                <ResponsiveContainer width="100%" height={320}>
                <BarChart 
                    data={results.ranking.slice(0, 12)} 
                    layout="vertical" 
                    margin={{ left: 110, right: 20, top: 5, bottom: 5 }}
                    onClick={(data) => data?.activePayload && setSelectedSmr(data.activePayload[0].payload.technologie)}
                    className="cursor-pointer"
                >
                    <XAxis type="number" domain={[0, 5]} stroke="#0e7490" hide />
                    <YAxis dataKey="technologie" type="category" width={105} tick={{fontSize: 11, fontWeight: 500, fill: '#a1f5ff'}} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#0e7490'}} />
                    <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={22}>
                    {results.ranking.map((entry, index) => (
                        <Cell 
                        key={`cell-${index}`} 
                        fill={entry.technologie === selectedSmr ? '#f97316' : BAR_COLORS[index % BAR_COLORS.length]} 
                        className="transition-all duration-300 hover:opacity-80"
                        />
                    ))}
                    </Bar>
                </BarChart>
                </ResponsiveContainer>
                <p className="text-center text-xs text-cyan-300/70 mt-3 flex justify-center items-center gap-2 font-medium">
                    <Info size={14}/> Cliquez pour comparer
                </p>
            </div>
          </div>
        )}

        {/* SECTION 3: PARAMÈTRES (ACCORDÉON) */}
        <div className="border-t border-cyan-500/10 pt-8 pb-20">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500/40 to-cyan-500/20 rounded-xl border border-cyan-500/40">
                <SlidersHorizontal size={20} className="text-cyan-300"/>
            </div>
            Configuration
          </h3>
          
          <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/40 p-6 rounded-2xl border border-cyan-500/20 mb-6 shadow-md backdrop-blur-md hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <label className="font-bold text-white text-base">Sensibilité (Alpha)</label>
                    <p className="text-xs text-cyan-300/60 mt-1">Poids du besoin</p>
                </div>
                <span className="text-2xl font-bold text-cyan-300 bg-slate-900/50 px-4 py-2 rounded-lg border border-cyan-500/40 font-mono">{alpha}</span>
            </div>
            <input 
                type="range" min="0" max="1" step="0.1" 
                value={alpha} 
                onChange={(e) => setAlpha(e.target.value)}
                className="w-full h-2 bg-cyan-600/30 rounded-lg appearance-none cursor-pointer"
                style={{
                    accentColor: '#06b6d4'
                }}
            />
          </div>

          <div className="space-y-3">
            {Object.keys(radarData).map((themeName) => (
               <div key={themeName} className="bg-gradient-to-br from-slate-800/40 to-slate-900/30 border border-cyan-500/20 rounded-2xl overflow-hidden transition-all shadow-md hover:shadow-lg hover:border-cyan-500/40 group">
                 <button 
                    onClick={() => toggleTheme(themeName)}
                    className="w-full flex justify-between items-center p-5 hover:bg-slate-800/60 transition-all"
                 >
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-full group-hover:h-7 transition-all"></div>
                        <span className="font-bold text-sm text-cyan-300 uppercase tracking-tight">{themeName}</span>
                    </div>
                    {openTheme === themeName ? <ChevronUp size={20} className="text-cyan-400"/> : <ChevronDown size={20} className="text-slate-500 group-hover:text-slate-300"/>}
                 </button>
                 
                 {openTheme === themeName && (
                    <div className="p-4 bg-slate-900/60 border-t border-cyan-500/10 space-y-4 animate-fade-in">
                        {criteriaList.filter(c => c.Thématique === themeName).map(crit => (
                            <div key={crit.Code} className="bg-gradient-to-br from-slate-800/50 to-slate-900/30 rounded-xl p-4 border border-cyan-500/15 hover:border-cyan-500/40 hover:shadow-md transition-all">
                                <div className="flex justify-between items-end mb-3">
                                    <div className="flex items-center gap-3 flex-1">
                                        <span className="text-xs font-bold text-white bg-gradient-to-br from-cyan-600 to-blue-700 w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 shadow-md">{crit.Code}</span>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-bold text-white block truncate" title={crit.Critère}>{crit.Critère}</span>
                                            <span className="text-xs text-cyan-300/70"><span className={`font-bold ${scores[crit.Code] < 2 ? 'text-red-400' : 'text-cyan-400'}`}>{scores[crit.Code] || 0}</span>/5</span>
                                        </div>
                                        {crit.Explications && (
                                            <div className="group relative">
                                                <Info size={16} className="text-slate-500 hover:text-cyan-400 cursor-help flex-shrink-0 transition-colors" />
                                                <div className="absolute left-0 bottom-8 w-56 p-3 bg-slate-950 border border-cyan-500/40 text-white text-xs rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 leading-snug">
                                                    {crit.Explications}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <input 
                                    type="range" min="0" max="5" step="1"
                                    value={scores[crit.Code] || 0}
                                    onChange={(e) => setScores(prev => ({...prev, [crit.Code]: parseInt(e.target.value)}))}
                                    className={`w-full h-2 rounded-full appearance-none cursor-pointer transition`}
                                    style={{
                                        accentColor: scores[crit.Code] < 2 ? '#ef4444' : '#06b6d4'
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                 )}
               </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}