import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Play, AlertOctagon, TrendingUp, Settings, RotateCcw, Map as MapIcon } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';

const API_URL = "http://127.0.0.1:8000";

// Couleurs pour le BarChart
const BAR_COLORS = ['#2563eb', '#64748b', '#94a3b8', '#cbd5e1'];

export default function SimulationPanel({ island, onClose }) {
  const [loading, setLoading] = useState(false);
  const [criteriaList, setCriteriaList] = useState([]);
  const [scores, setScores] = useState({}); 
  const [originalScores, setOriginalScores] = useState({}); // Pour le Reset
  const [alpha, setAlpha] = useState(0.3);
  const [results, setResults] = useState(null);

  // 1. Chargement des données
  useEffect(() => {
    const fetchData = async () => {
      try {
        const critRes = await axios.get(`${API_URL}/criteria`);
        setCriteriaList(critRes.data);

        const islandRes = await axios.get(`${API_URL}/islands`);
        if (islandRes.data[island.id]) {
          setScores(islandRes.data[island.id]);
          setOriginalScores(islandRes.data[island.id]); // Sauvegarde pour reset
        }
      } catch (error) {
        console.error("Erreur chargement:", error);
      }
    };
    fetchData();
    setResults(null); // Reset résultats si on change d'île
  }, [island.id]);

  // 2. Calcul du Radar (Moyenne par Thématique)
  const radarData = useMemo(() => {
    if (!criteriaList.length || !Object.keys(scores).length) return [];

    const themes = {};
    criteriaList.forEach(c => {
      if (!themes[c.Thématique]) themes[c.Thématique] = { sum: 0, count: 0 };
      themes[c.Thématique].sum += (scores[c.Code] || 0);
      themes[c.Thématique].count += 1;
    });

    return Object.keys(themes).map(theme => ({
      subject: theme,
      A: parseFloat((themes[theme].sum / themes[theme].count).toFixed(2)),
      fullMark: 5,
    }));
  }, [scores, criteriaList]);

  // 3. Appel API Calcul
  const handleCalculate = async () => {
    setLoading(true);
    try {
      const payload = {
        island_id: island.id,
        alpha: parseFloat(alpha),
        overrides: scores
      };
      const response = await axios.post(`${API_URL}/calculate`, payload);
      setResults(response.data);
    } catch (error) {
      alert("Erreur serveur Python");
    } finally {
      setLoading(false);
    }
  };

  // Reset des scores
  const handleReset = () => {
    setScores(originalScores);
    setResults(null);
  };

  return (
    <div className="w-[650px] bg-white shadow-2xl z-20 h-full overflow-y-auto border-l border-gray-200 flex flex-col font-sans">
      
      {/* HEADER */}
      <div className="p-6 border-b bg-slate-50 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MapIcon size={24} className="text-blue-600"/> {island.name}
          </h2>
          <p className="text-sm text-slate-500">Outil d'Analyse Multicritère</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition">✕</button>
      </div>

      <div className="p-6 space-y-8 flex-1">

        {/* --- ZONE 1 : ANALYSE VISUELLE (RADAR) --- */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <h3 className="font-bold text-slate-700 mb-2 text-sm uppercase tracking-wide">Profil de Vulnérabilité (Moyennes)</h3>
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                <PolarRadiusAxis angle={30} domain={[0, 5]} />
                <Radar
                  name="Score Île"
                  dataKey="A"
                  stroke="#2563eb"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
            {/* Légende rapide */}
            <div className="absolute top-0 right-0 text-xs text-gray-400 bg-white/80 p-1 rounded">
              Extérieur (5) = Robuste<br/>Centre (0) = Vulnérable
            </div>
          </div>
        </div>

        {/* --- ZONE 2 : ACTIONS & RÉSULTATS --- */}
        <div className="flex gap-2">
           <button 
            onClick={handleCalculate}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all flex justify-center items-center gap-2"
          >
            {loading ? "Calcul..." : <><Play size={18} /> Lancer la Simulation</>}
          </button>
          <button 
            onClick={handleReset}
            title="Réinitialiser les scores Excel"
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-3 rounded-lg border border-gray-300 transition"
          >
            <RotateCcw size={18}/>
          </button>
        </div>

        {/* RÉSULTATS DU CALCUL */}
        {results && (
          <div className="animate-fade-in space-y-4 pt-4 border-t border-dashed">
            {results.is_nogo ? (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                <div className="flex items-center gap-2 text-red-700 font-bold">
                  <AlertOctagon /> HARD NO-GO DÉTECTÉ
                </div>
                <div className="text-sm text-red-600 mt-1">
                  Le projet est bloqué par : <span className="font-semibold">{results.nogo_reasons.join(", ")}</span>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg text-emerald-800 font-bold flex items-center gap-2">
                <TrendingUp /> Tous les indicateurs critiques sont au vert.
              </div>
            )}

            <div className="h-80 w-full">
              <h3 className="font-bold text-slate-700 mb-4">Top SMR Compatibles</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results.ranking.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <XAxis type="number" domain={[0, 5]} hide />
                  <YAxis dataKey="technologie" type="category" width={140} tick={{fontSize: 11, fontWeight: 500}} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                    {results.ranking.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* --- ZONE 3 : PARAMÈTRES AVANCÉS (ACCORDÉON) --- */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4 text-sm uppercase">
            <Settings size={16} /> Ajustement des Critères (Input)
          </h3>
          
          <div className="mb-6 px-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">Sensibilité (Alpha) : {alpha}</label>
            <input 
              type="range" min="0" max="1" step="0.1" 
              value={alpha} 
              onChange={(e) => setAlpha(e.target.value)}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-2"
            />
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            {/* On groupe les sliders par thématique pour la lisibilité */}
            {Object.keys(radarData).length > 0 && radarData.map((themeData) => (
               <div key={themeData.subject} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                 <h4 className="font-bold text-xs text-indigo-600 uppercase mb-3 border-b pb-1">{themeData.subject}</h4>
                 {criteriaList.filter(c => c.Thématique === themeData.subject).map(crit => (
                    <div key={crit.Code} className="mb-3 last:mb-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 truncate w-3/4" title={crit.Critère}>{crit.Critère}</span>
                        <span className={`font-mono font-bold ${scores[crit.Code] < 2 ? 'text-red-500' : 'text-slate-700'}`}>
                          {scores[crit.Code]}/5
                        </span>
                      </div>
                      <input 
                        type="range" min="0" max="5" step="1"
                        value={scores[crit.Code] || 0}
                        onChange={(e) => setScores(prev => ({...prev, [crit.Code]: parseInt(e.target.value)}))}
                        className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${scores[crit.Code] < 2 ? 'bg-red-100 accent-red-500' : 'bg-slate-200 accent-blue-500'}`}
                      />
                    </div>
                 ))}
               </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}