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
      <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-lg text-sm">
        <p className="font-bold text-slate-800 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="flex items-center gap-2">
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
    <div className="flex flex-col h-full w-full bg-white text-slate-800 font-sans relative">
      
      {/* HEADER FIXE */}
      <div className="px-8 py-6 border-b border-slate-100 bg-white/95 backdrop-blur z-20 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <MapPin size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Site Pilote</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900">{island.name}</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-400 hover:text-slate-600">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">

        {/* SECTION 1: RADAR & ACTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Radar Card */}
            <div className="lg:col-span-2 bg-slate-50 rounded-2xl p-6 border border-slate-100 relative shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Activity size={18} className="text-blue-500"/>
                        Analyse de Vulnérabilité
                    </h3>
                    {selectedSmr && (
                        <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-full border border-orange-200">
                           VS {selectedSmr}
                        </span>
                    )}
                </div>
                <div className="h-[300px] w-full">
                    {radarData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                            <Radar name="Site" dataKey="island" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                            {selectedSmr && <Radar name={selectedSmr} dataKey="smr" stroke="#f97316" fill="#f97316" fillOpacity={0.4} />}
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                        </RadarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">Chargement...</div>
                    )}
                </div>
            </div>

            {/* Action Card */}
            <div className="flex flex-col gap-4">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-xl flex flex-col justify-between h-full">
                    <div>
                        <h4 className="font-bold text-lg mb-2">Simulation</h4>
                        <p className="text-slate-400 text-sm mb-6">Lancez l'algorithme MCDA pour classer les 16 technologies SMR.</p>
                    </div>
                    <button 
                        onClick={handleCalculate}
                        disabled={loading}
                        className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 flex justify-center items-center gap-2"
                    >
                        {loading ? "Calcul..." : <><Play size={20} fill="currentColor"/> Lancer</>}
                    </button>
                </div>
                <button onClick={handleReset} className="w-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 py-3 rounded-xl font-medium flex justify-center items-center gap-2 transition">
                    <RotateCcw size={16}/> Reset Paramètres
                </button>
            </div>
        </div>

        {/* SECTION 2: RÉSULTATS */}
        {results && (
          <div className="animate-fade-in border-t border-slate-100 pt-8">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <IconBarChart className="text-blue-600"/> Résultats & Classement
            </h3>

            {/* Status Banner */}
            <div className={`p-4 rounded-xl border mb-6 flex items-start gap-4 ${results.is_nogo ? 'bg-red-50 border-red-100 text-red-900' : 'bg-emerald-50 border-emerald-100 text-emerald-900'}`}>
                <div className={`p-2 rounded-full ${results.is_nogo ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {results.is_nogo ? <AlertTriangle size={24}/> : <CheckCircle size={24}/>}
                </div>
                <div>
                    <h4 className="font-bold text-lg">{results.is_nogo ? "Projet Critique (No-Go)" : "Projet Viable"}</h4>
                    <p className="text-sm opacity-90 mt-1">
                        {results.is_nogo 
                            ? `Le site présente des contraintes bloquantes : ${results.nogo_reasons.join(", ")}` 
                            : "Tous les critères d'exclusion (Hard No-Go) sont respectés."}
                    </p>
                </div>
            </div>

            {/* Chart */}
            <div className="h-[400px] bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                    data={results.ranking.slice(0, 12)} 
                    layout="vertical" 
                    margin={{ left: 10, right: 30 }}
                    onClick={(data) => data?.activePayload && setSelectedSmr(data.activePayload[0].payload.technologie)}
                    className="cursor-pointer"
                >
                    <XAxis type="number" domain={[0, 5]} hide />
                    <YAxis dataKey="technologie" type="category" width={160} tick={{fontSize: 12, fontWeight: 600, fill: '#475569'}} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#f1f5f9'}} />
                    <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={24}>
                    {results.ranking.map((entry, index) => (
                        <Cell 
                        key={`cell-${index}`} 
                        fill={entry.technologie === selectedSmr ? '#f97316' : BAR_COLORS[index % BAR_COLORS.length]} 
                        className="transition-all duration-300"
                        />
                    ))}
                    </Bar>
                </BarChart>
                </ResponsiveContainer>
                <p className="text-center text-xs text-slate-400 mt-2 flex justify-center items-center gap-1">
                    <Info size={12}/> Cliquez sur une barre pour comparer sur le radar
                </p>
            </div>
          </div>
        )}

        {/* SECTION 3: PARAMÈTRES (ACCORDÉON) */}
        <div className="border-t border-slate-100 pt-8 pb-20">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <SlidersHorizontal className="text-blue-600"/> Configuration
          </h3>
          
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6">
            <div className="flex justify-between items-center mb-4">
                <label className="font-bold text-slate-700">Sensibilité (Alpha) : <span className="text-blue-600 font-mono">{alpha}</span></label>
                <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border">Poids du besoin</span>
            </div>
            <input 
                type="range" min="0" max="1" step="0.1" 
                value={alpha} 
                onChange={(e) => setAlpha(e.target.value)}
                className="w-full"
            />
          </div>

          <div className="space-y-3">
            {Object.keys(radarData).map((themeName) => (
               <div key={themeName} className="bg-white border border-slate-200 rounded-xl overflow-hidden transition-all shadow-sm hover:shadow-md">
                 <button 
                    onClick={() => toggleTheme(themeName)}
                    className="w-full flex justify-between items-center p-4 bg-white hover:bg-slate-50 transition"
                 >
                    <span className="font-bold text-sm text-slate-700 uppercase tracking-wide">{themeName}</span>
                    {openTheme === themeName ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
                 </button>
                 
                 {openTheme === themeName && (
                    <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-4 animate-fade-in">
                        {criteriaList.filter(c => c.Thématique === themeName).map(crit => (
                            <div key={crit.Code}>
                                <div className="flex justify-between items-end mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500 w-10">{crit.Code}</span>
                                        <span className="text-sm font-medium text-slate-700 truncate w-48" title={crit.Critère}>{crit.Critère}</span>
                                        {crit.Explications && (
                                            <div className="group relative">
                                                <Info size={14} className="text-slate-300 hover:text-blue-500 cursor-help" />
                                                <div className="absolute left-0 bottom-6 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                                                    {crit.Explications}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <span className={`text-sm font-bold font-mono ${scores[crit.Code] < 2 ? 'text-red-500' : 'text-blue-600'}`}>
                                        {scores[crit.Code]}/5
                                    </span>
                                </div>
                                <input 
                                    type="range" min="0" max="5" step="1"
                                    value={scores[crit.Code] || 0}
                                    onChange={(e) => setScores(prev => ({...prev, [crit.Code]: parseInt(e.target.value)}))}
                                    className={`w-full ${scores[crit.Code] < 2 ? 'danger-slider' : ''}`}
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